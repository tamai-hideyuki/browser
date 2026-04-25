# 05. タブライフサイクル

対応要件：[11-tabs-spaces.md](../requirements/11-tabs-spaces.md), [30-webview-integration.md](../requirements/30-webview-integration.md), [60-performance.md](../requirements/60-performance.md)

## 永続状態とランタイム状態の分離

| 種別 | 例 | 保存先 |
|---|---|---|
| 永続状態 | url, title, state(today/pinned/archived), position | SQLite `tabs` |
| ランタイム状態 | loading, loadProgress, audible, discarded フラグ | メモリ（main process） |
| WebContentsView の存在 | あるか / ないか | メモリ（main process） |

WebContentsView は永続化対象ではない。タブの「実体」は SQLite の行。WebContentsView はキャッシュの一形態。

## 状態モデル

```
            ┌─────────────────────────────────────────┐
            │                                         │
            ▼                                         │
[creating] ──→ [loading] ──→ [loaded] ←──────────┐    │
                  │             │                │    │
                  │             ▼                │    │
                  │        [discarded]           │    │
                  │             │                │    │
                  │      activate│                │    │
                  │             ▼                │    │
                  │        [restoring] ──────────┘    │
                  │                                   │
                  │                                   │
                  ▼                                   │
              [crashed] ────────────────reload────────┘

         ──→ [archived] (state field, WebContentsView 破棄)
         ──→ [closed]   (DB から削除)
```

## TabRecord（main 内部表現）

```typescript
// src/main/tabs/types.ts
import type { WebContentsView } from 'electron';
import type { Tab, TabId } from '@shared/types/tab';

export type TabRecord = {
  meta: Tab;                         // DB 由来
  view: WebContentsView | null;      // null なら discarded
  loading: boolean;
  loadProgress: number;
  audible: boolean;
  navHistory: NavHistoryStack;       // 戻る/進む（08-navigation.md）
  scrollPosition: { x: number; y: number };
  formStateSerialized: string | null; // 復元用
};
```

## TabManager 主要 API

```typescript
// src/main/tabs/tab-manager.ts
export class TabManager {
  private records = new Map<TabId, TabRecord>();
  private activeTabId: TabId | null = null;

  constructor(
    private window: BrowserWindow,
    private broadcaster: Broadcaster,
    private settings: SettingsService,
  ) {}

  create(input: CreateTabInput): TabId;
  activate(tabId: TabId): void;
  close(tabId: TabId): void;          // archived 行き
  remove(tabId: TabId): void;         // 完全削除
  pin(tabId: TabId): void;
  unpin(tabId: TabId): void;
  archive(tabId: TabId): void;
  navigate(tabId: TabId, url: string): void;
  goBack(tabId: TabId): void;
  goForward(tabId: TabId): void;
  reload(tabId: TabId, opts?: { ignoreCache?: boolean }): void;
  stop(tabId: TabId): void;
  setBounds(rect: Rect): void;        // ウィンドウリサイズ・サイドバー幅変更時

  discard(tabId: TabId): void;
  restore(tabId: TabId): void;        // discarded → loading

  // 内部
  private mountView(tabId: TabId): void;
  private unmountView(tabId: TabId): void;
  private wireWebContentsEvents(tabId: TabId, view: WebContentsView): void;
}
```

## 各操作の詳細

### create

```typescript
create(input: CreateTabInput): TabId {
  const id = randomTabId();
  const spaceId = input.spaceId ?? this.activeSpaceId();
  const state = input.state ?? 'today';
  const position = TabRepository.nextPosition(spaceId, state);

  const meta: Tab = {
    id, spaceId,
    url: input.url,
    title: '',
    faviconUrl: null,
    state,
    position,
    parentFolderId: null,
    lastActiveAt: Date.now(),
    createdAt: Date.now(),
    archivedAt: null,
    loading: false,
    loadProgress: 0,
    audible: false,
    discarded: true,
  };
  TabRepository.insert(meta);

  this.records.set(id, {
    meta, view: null, loading: false, loadProgress: 0,
    audible: false, navHistory: new NavHistoryStack(),
    scrollPosition: { x: 0, y: 0 }, formStateSerialized: null,
  });

  this.broadcaster.emit({ kind: 'tab.created', tab: meta });

  if (!input.background) {
    this.activate(id);
  }
  return id;
}
```

### activate

```typescript
activate(tabId: TabId): void {
  if (this.activeTabId === tabId) return;

  // 旧アクティブを非表示（破棄ではない）
  if (this.activeTabId) {
    const prev = this.records.get(this.activeTabId);
    if (prev?.view) {
      this.window.contentView.removeChildView(prev.view);
    }
  }

  // 新アクティブをマウント
  const rec = this.records.get(tabId);
  if (!rec) throw new TabNotFoundError(tabId);
  if (!rec.view) {
    this.mountView(tabId);              // discarded からの復元
  }
  this.window.contentView.addChildView(rec.view!);
  rec.view!.setBounds(this.currentBounds());
  rec.meta.lastActiveAt = Date.now();
  TabRepository.update(tabId, { lastActiveAt: rec.meta.lastActiveAt });

  this.activeTabId = tabId;
  this.broadcaster.emit({ kind: 'tab.activated', tabId });
}
```

### mountView

```typescript
private mountView(tabId: TabId): void {
  const rec = this.records.get(tabId)!;

  const view = new WebContentsView({
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      partition: this.partitionForProfile(),  // M1 は固定
    },
  });

  rec.view = view;
  this.wireWebContentsEvents(tabId, view);

  view.webContents.loadURL(rec.meta.url);
}
```

### close → archived

`Cmd+W` での「閉じる」は **アーカイブ行き**。SQLite からは消さない。

```typescript
close(tabId: TabId): void {
  const rec = this.records.get(tabId);
  if (!rec) return;

  this.unmountView(tabId);

  rec.meta.state = 'archived';
  rec.meta.archivedAt = Date.now();
  TabRepository.update(tabId, { state: 'archived', archivedAt: rec.meta.archivedAt });

  this.records.delete(tabId);   // メモリからも消す（archived はメタのみ DB）

  if (this.activeTabId === tabId) {
    this.activeTabId = null;
    this.broadcaster.emit({ kind: 'tab.activated', tabId: null as any });  // 空状態
  }

  this.broadcaster.emit({ kind: 'tab.archived', tabId });
}
```

### unmountView

```typescript
private unmountView(tabId: TabId): void {
  const rec = this.records.get(tabId);
  if (!rec?.view) return;
  this.window.contentView.removeChildView(rec.view);
  // WebContentsView の破棄
  // Electron API: view.webContents.destroy()
  (rec.view.webContents as any).destroy();
  rec.view = null;
}
```

### discard（タブスリープ）

```typescript
discard(tabId: TabId): void {
  const rec = this.records.get(tabId);
  if (!rec || !rec.view || tabId === this.activeTabId) return;

  // スクロール位置を保存
  rec.scrollPosition = await this.captureScrollPosition(rec.view);
  // フォーム状態（M1 は対応しない、簡易にとどめる）

  this.unmountView(tabId);
  this.broadcaster.emit({ kind: 'tab.discarded', tabId });
}

restore(tabId: TabId): void {
  const rec = this.records.get(tabId);
  if (!rec || rec.view) return;
  this.mountView(tabId);
  // ロード完了後にスクロール復元
  rec.view!.webContents.once('did-finish-load', () => {
    rec.view!.webContents.executeJavaScript(
      `window.scrollTo(${rec.scrollPosition.x}, ${rec.scrollPosition.y})`
    );
  });
}
```

## Discard 判定ループ

```typescript
// src/main/tabs/discard.ts
export class DiscardScheduler {
  private interval: NodeJS.Timeout | null = null;

  constructor(private tabs: TabManager, private settings: SettingsService) {}

  start(): void {
    this.interval = setInterval(() => this.tick(), 60_000);  // 1 分
  }

  private tick(): void {
    const thresholdMin = this.settings.get('performance.tabSleepAfter');
    if (thresholdMin === -1) return;
    const cutoff = Date.now() - thresholdMin * 60_000;

    for (const rec of this.tabs.allRecords()) {
      if (rec.meta.id === this.tabs.activeId()) continue;
      if (rec.meta.state === 'pinned' && !this.settings.get('performance.sleepPinnedTabs')) continue;
      if (!rec.view) continue;
      if (rec.meta.lastActiveAt > cutoff) continue;
      this.tabs.discard(rec.meta.id);
    }
  }
}
```

メモリプレッシャー時の追加処理（M2 以降）：
- `process.getProcessMemoryInfo()` で監視
- 閾値超過時、最も古い非アクティブから順に discard

## 自動アーカイブ

別の周期タスクで `today` タブを `archived` に降格：
```typescript
// 同様に setInterval で 5 分ごとに評価
const cutoff = Date.now() - settings.archiveTabsAfter * 3_600_000;
for (const rec of this.tabs.allRecords()) {
  if (rec.meta.state !== 'today') continue;
  if (rec.meta.lastActiveAt > cutoff) continue;
  this.tabs.archive(rec.meta.id);
}
```

## クラッシュハンドリング

```typescript
private wireWebContentsEvents(tabId: TabId, view: WebContentsView) {
  view.webContents.on('render-process-gone', (_e, details) => {
    const rec = this.records.get(tabId);
    if (!rec) return;
    rec.loading = false;
    this.unmountView(tabId);
    this.broadcaster.emit({ kind: 'tab.crashed', tabId, reason: details.reason });
  });

  view.webContents.on('unresponsive', () => {
    // ハング検出。M1 ではログのみ
  });
}
```

クラッシュ後の挙動：
- shell でエラーページオーバーレイを表示
- ユーザーが「再読込」を押すと `tab.reload` を呼び、main は `mountView` → `loadURL`
- 5 分以内に同タブで 3 回クラッシュ → 自動再読込を停止し、ユーザー操作を待つ

## ナビゲーションイベント配線

```typescript
view.webContents.on('did-start-loading', () => {
  rec.loading = true; rec.loadProgress = 0;
  this.broadcaster.emit({ kind: 'tab.loadingStateChanged', tabId, loading: true, progress: 0 });
});
view.webContents.on('did-finish-load', () => {
  rec.loading = false; rec.loadProgress = 1;
  this.broadcaster.emit({ kind: 'tab.loadingStateChanged', tabId, loading: false, progress: 1 });
});
view.webContents.on('page-title-updated', (_e, title) => {
  rec.meta.title = title;
  TabRepository.update(tabId, { title });
  this.broadcaster.emit({ kind: 'tab.titleUpdated', tabId, title });
});
view.webContents.on('page-favicon-updated', (_e, urls) => {
  const url = urls[0] ?? null;
  rec.meta.faviconUrl = url;
  TabRepository.update(tabId, { faviconUrl: url });
  this.broadcaster.emit({ kind: 'tab.faviconUpdated', tabId, faviconUrl: url ?? '' });
});
view.webContents.on('did-navigate', (_e, url) => {
  rec.meta.url = url;
  TabRepository.update(tabId, { url });
  this.broadcaster.emit({ kind: 'tab.urlUpdated', tabId, url });
  HistoryRepository.record({ url, title: rec.meta.title, visitedAt: Date.now(), spaceId: rec.meta.spaceId });
});
view.webContents.on('audio-state-changed', (e: any) => {
  rec.audible = e.audible;
  this.broadcaster.emit({ kind: 'tab.audibleChanged', tabId, audible: e.audible });
});
```

## 起動時の復元

```typescript
async function restoreOpenTabs() {
  const tabs = TabRepository.listAllOpen();   // archived 以外
  for (const meta of tabs) {
    tabManager.records.set(meta.id, {
      meta, view: null, loading: false, loadProgress: 0,
      audible: false, navHistory: new NavHistoryStack(),
      scrollPosition: { x: 0, y: 0 }, formStateSerialized: null,
    });
  }
  // 直近アクティブだったタブだけ即時 mount
  const last = tabs.sort((a, b) => b.lastActiveAt - a.lastActiveAt)[0];
  if (last) tabManager.activate(last.id);
}
```

つまり起動直後はほぼ全タブが discarded 状態。アクティブタブのみマウント。

## サイズ・配置

shell からのリサイズ通知：
```typescript
setBounds(rect: Rect): void {
  this.currentRect = rect;
  const active = this.activeTabId && this.records.get(this.activeTabId);
  active?.view?.setBounds(rect);
}
```

shell renderer 側は `ResizeObserver` で WebView 表示エリアの矩形を計測 → IPC 送信。

## 不変条件
- `records.has(id)` ⇔ `state in ('today', 'pinned')`
- `records.get(id).view !== null` ⇒ `state in ('today', 'pinned')` かつ discarded == false
- アクティブタブの `view` は必ず非 null（active 化時に mount される）
- `archived` のタブは `records` に存在しない

## テスト
- ユニット：`TabManager` を BrowserWindow / WebContentsView をモックして状態遷移を検証
- 統合：実際の Electron ランナーで create → navigate → close → restore のシナリオ
- 性能：100 タブ作成 → activate を 100 回回してメモリ増加が線形でないこと
