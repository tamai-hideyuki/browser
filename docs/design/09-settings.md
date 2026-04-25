# 09. 設定

対応要件：[80-settings.md](../requirements/80-settings.md)

## M1 で扱う設定範囲
全カテゴリではなく、MVP に必要な最小限のみ。

- 一般：起動時挙動、デフォルト検索エンジン
- 外観：テーマ、サイドバー幅
- パフォーマンス：タブスリープ閾値、自動アーカイブ閾値
- ダウンロード：保存先

## 設定型と zod スキーマ

```typescript
// src/shared/types/settings.ts
import { z } from 'zod';

export const SettingsSchema = z.object({
  general: z.object({
    onStartup: z.enum(['restore', 'newTab', 'specific']).default('restore'),
    startupUrls: z.array(z.string().url()).optional(),
    defaultSearchEngine: z.enum(['google', 'duckduckgo', 'bing', 'kagi', 'custom']).default('google'),
    customSearchUrl: z.string().url().optional(),
    language: z.enum(['ja', 'en']).default('ja'),
  }).default({}),

  appearance: z.object({
    theme: z.enum(['light', 'dark', 'system']).default('system'),
    sidebarWidth: z.number().int().min(180).max(400).default(240),
    sidebarVisible: z.boolean().default(true),
    fontSize: z.enum(['small', 'medium', 'large']).default('medium'),
  }).default({}),

  performance: z.object({
    tabSleepAfter: z.union([z.literal(15), z.literal(60), z.literal(720), z.literal(-1)]).default(60),
    archiveTabsAfter: z.union([z.literal(12), z.literal(24), z.literal(168), z.literal(720), z.literal(-1)]).default(12),
    sleepPinnedTabs: z.boolean().default(false),
    cacheSizeMb: z.number().int().min(256).max(2048).default(512),
  }).default({}),

  downloads: z.object({
    location: z.string().default(''),  // 起動時に OS 既定で初期化
    promptForLocation: z.boolean().default(false),
    parallelLimit: z.number().int().min(1).max(10).default(6),
  }).default({}),
});

export type Settings = z.infer<typeof SettingsSchema>;

export const DEFAULT_SETTINGS = SettingsSchema.parse({});
```

## 永続化レイヤ

設定は **SQLite の `settings` テーブル**（KVS）に JSON で格納。
- key：トップレベルカテゴリ名（`general`, `appearance`, ...）
- value：カテゴリ単位の JSON 文字列

理由：カテゴリ単位の atomic 更新がしやすく、不要キーが増えても柔軟。

```typescript
// src/main/storage/repositories/settings-repo.ts
export const SettingsRepository = {
  getAll(): Settings {
    const rows = getDb().prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
    const obj: Record<string, unknown> = {};
    for (const r of rows) {
      try { obj[r.key] = JSON.parse(r.value); }
      catch { /* 壊れた値は無視 */ }
    }
    return SettingsSchema.parse(obj);  // 不足キーはデフォルトで補填
  },

  patch(partial: PartialDeep<Settings>): void {
    const current = this.getAll();
    const merged = deepMerge(current, partial);
    const validated = SettingsSchema.parse(merged);
    const stmt = getDb().prepare(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
    );
    const tx = getDb().transaction(() => {
      for (const [k, v] of Object.entries(validated)) {
        stmt.run(k, JSON.stringify(v));
      }
    });
    tx();
  },
};
```

## SettingsService（main）

```typescript
// src/main/settings/settings-service.ts
export class SettingsService {
  private cache: Settings;

  constructor(private broadcaster: Broadcaster) {
    this.cache = SettingsRepository.getAll();
    if (!this.cache.downloads.location) {
      this.cache.downloads.location = app.getPath('downloads');
    }
  }

  getAll(): Settings {
    return this.cache;
  }

  get<P extends string>(path: P): unknown {
    return getByPath(this.cache, path);
  }

  patch(partial: PartialDeep<Settings>): void {
    SettingsRepository.patch(partial);
    this.cache = SettingsRepository.getAll();
    this.broadcaster.emit({ kind: 'settings.updated', settings: this.cache });
  }
}
```

## IPC ハンドラ

```typescript
registerHandler('settings.get', async () => settingsService.getAll());

registerHandler('settings.patch', async (partial) => {
  settingsService.patch(partial as PartialDeep<Settings>);
});
```

shell 側からは `settingsStore.patch({ appearance: { theme: 'dark' } })` のように呼ぶ。

## マイグレーション

設定は KVS なので、スキーマ追加時は zod の `default()` で自動補填されるため、明示的なマイグレーションは原則不要。

破壊的変更時のみ別途マイグレーション関数を `src/main/settings/migrations.ts` に追加：

```typescript
const settingsVersion = readVersion();
if (settingsVersion < 2) {
  // 例: v1 の `general.searchEngine` を v2 の `general.defaultSearchEngine` にリネーム
  const old = SettingsRepository.getRawCategory('general');
  if (old?.searchEngine) {
    old.defaultSearchEngine = old.searchEngine;
    delete old.searchEngine;
    SettingsRepository.setRawCategory('general', old);
  }
  writeVersion(2);
}
```

## 起動時必須設定（settings.json）

DB 接続前に必要な最小設定（DB 失敗時のフォールバック含む）は `settings.json` に保存：
- 直近のウィンドウ位置・サイズ
- 直近のテーマ（ちらつき防止）

```typescript
// src/main/settings/bootstrap-settings.ts
type BootstrapSettings = {
  windowBounds?: Rect;
  themeHint?: 'light' | 'dark';
};

export function loadBootstrap(): BootstrapSettings {
  const file = path.join(app.getPath('userData'), 'settings.json');
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return {}; }
}

export function saveBootstrap(s: BootstrapSettings): void {
  const file = path.join(app.getPath('userData'), 'settings.json');
  fs.writeFileSync(file, JSON.stringify(s, null, 2));
}
```

## 設定 UI（about:settings）

M1 では React のシンプルなフォーム：
- カテゴリのタブ
- 各設定項目はラベル + 入力（select / toggle / number）
- 保存は変更ごとに即時 patch（debounce 200ms）
- 「リセット」ボタン（カテゴリ単位）

設定 UI 自体は shell renderer 内のルートとして実装：
- `/`：通常のブラウザシェル
- `about:settings` URL → 専用ルート（または shell の overlay）

M1 簡略化案：設定はオーバーレイモーダルで、専用ルーティングは持たない。`Cmd+,` で開く。

```typescript
function SettingsModal() {
  const settings = useSettingsStore((s) => s.settings);
  const patch = useSettingsStore((s) => s.patch);
  const open = useUiStore((s) => s.settingsOpen);
  if (!open) return null;
  return (
    <Modal>
      <Tabs>
        <GeneralTab settings={settings.general} onChange={(p) => patch({ general: p })} />
        <AppearanceTab .../>
        <PerformanceTab .../>
        <DownloadsTab .../>
      </Tabs>
    </Modal>
  );
}
```

## バリデーションエラー

zod の `parse` で失敗した場合：
- main：エラーログ出力 + デフォルトにフォールバック
- shell：patch 操作で main から例外が返る → 元の値に戻す + エラートースト

## 検索（M1 簡易）
設定が増えてきたら検索バーを実装。M1 ではカテゴリタブのみ。

## デフォルトリセット
- カテゴリ単位：そのカテゴリのみ `DEFAULT_SETTINGS[category]` で上書き
- 全体：「すべての設定をリセット」ボタンで `DEFAULT_SETTINGS` を流し込む

## 機微情報の取り扱い
- M1 では機微情報を保存しない（API キー等は M2 以降）
- 将来：API キーは OS Keychain（`keytar` パッケージ）に保存し、設定 DB には参照のみ

## テスト
- zod スキーマのデフォルト挙動をユニット
- patch 操作の deep merge 動作
- 設定変更が IPC で broadcasting されること
