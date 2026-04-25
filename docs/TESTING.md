# テスト規約

## 前提

```bash
npm install      # vitest を含む依存をインストール
npm test         # 1 回実行
npm run test:watch   # ファイル変更で再実行
```

> 注：`npm install` 後に `electron-rebuild` が走るため、その後 `npm test` を打つと
> `better-sqlite3` の ABI 不一致で Repository 直接呼び出しテストは失敗する。
> 本プロジェクトではそれを避けるため Repository は **mock** して切り離している。

## 配置

```
tests/
├── helpers/
│   └── mocks.ts                  # createMockBroadcaster / installMockApi
├── main/                         # main プロセス側ロジック
│   ├── navigation/
│   ├── settings/
│   └── ...
├── shared/                       # shared 層（zod スキーマ等）
└── shell/                        # shell renderer 側ロジック
    └── stores/
```

実装と対応するテストは **同じパス階層**で書く。`src/main/foo/bar.ts` のテストは `tests/main/foo/bar.test.ts`。

## 規約：振る舞いに焦点を当てる

### 1. 命名は「外から見て何が起きるか」

- ✅ `'設定が変わったとき settings.updated イベントを発火する'`
- ❌ `'patch メソッドが broadcaster.emit を呼ぶ'`

実装の手続きではなく、**観測可能な結果**を述べる。

### 2. テスト本体は「準備 / 実行 / 結果」の三段で書く

```typescript
it('TLD 付きドメインに https:// を補う', () => {
  // 準備
  const input = 'example.com';

  // 実行
  const result = resolveUrl(input);

  // 結果
  expect(result).toBe('https://example.com');
});
```

- 各セクションの間に空行
- セクションラベルは日本語コメント `// 準備` `// 実行` `// 結果`
- 「準備」がないなら省略可。「実行・結果」を 1 ブロックにまとめても良い

### 3. describe は「対象 → 状況」の階層で書く

```typescript
describe('SettingsService', () => {           // 対象
  describe('patch() を呼んだとき', () => {    // 状況
    it('指定したカテゴリのフィールドだけ更新される', () => { ... });
    it('settings.updated イベントを発火する', () => { ... });
  });
});
```

### 4. 内部実装に依存しない

- 公開メソッド・公開イベントのみテストする
- Private メソッドや内部の `Map` を直接見ない
- 副作用は **broadcaster の emit** などの境界で観測する

### 5. テストデータはファクトリで作る

```typescript
function makeTab(overrides: Partial<Tab> = {}): Tab {
  return {
    id: 'tab-1' as TabId,
    url: 'https://example.com',
    // ... 全 default 値
    ...overrides,
  };
}
```

各テストは `makeTab({ title: 'Old' })` のように差分だけ書く。

## モック

### Broadcaster（main 側）

```typescript
import { createMockBroadcaster } from 'tests/helpers/mocks';

const broadcaster = createMockBroadcaster();
const service = new SettingsService(broadcaster as any);
service.patch({ ... });

// 発火されたイベントは broadcaster.emittedEvents に蓄積される
expect(broadcaster.emittedEvents).toContainEqual({
  kind: 'settings.updated',
  settings: ...,
});
```

### window.api（shell 側）

```typescript
import { installMockApi } from 'tests/helpers/mocks';

const api = installMockApi();
api.__setHandler('tab.create', () => 'new-tab' as TabId);

// テスト対象の処理を実行...

expect(api.__invokeCalls).toContainEqual({
  channel: 'tab.create',
  input: { url: 'https://example.com' },
});

// store に main からのイベントを届けたいときは __emit
api.__emit({ kind: 'tab.created', tab: ... });
```

### Repository（DB 系）

`better-sqlite3` は Electron バイナリ向けにリビルドされているため、テスト環境（Node）からは読めない。Repository は `vi.mock` で置き換える：

```typescript
const fakeStore = new Map<string, unknown>();
vi.mock('../../../src/main/storage/repositories/settings-repo', () => ({
  SettingsRepository: {
    getRaw: vi.fn(() => Object.fromEntries(fakeStore)),
    setCategory: vi.fn((key, value) => fakeStore.set(key, value)),
  },
}));
vi.mock('../../../src/main/storage/db', () => ({
  getDb: vi.fn(),
  closeDb: vi.fn(),
}));
```

## TDD の進め方

1. **Red**：失敗するテストを書く（振る舞いの仕様を述べる）
2. **Green**：最小の実装で通す
3. **Refactor**：内部を整理。テストは触らない

新機能を足すときは、まず `tests/...test.ts` に「準備 / 実行 / 結果」を書く。
バグ修正のときは、まずバグを再現するテストを書いてから直す。

## カバー対象 / 対象外

| 領域 | 自動テスト | 備考 |
|---|---|---|
| 純粋関数（resolveUrl 等） | ✅ ユニット | 軽量・速い |
| zod スキーマ | ✅ ユニット | デフォルト値・バリデーション |
| Service（mock 依存） | ✅ ユニット | 振る舞いを境界で検証 |
| Zustand ストア | ✅ ユニット | applyEvent / actions |
| Repository（実 DB） | ❌ | 手動 / 将来の E2E |
| TabManager | ❌ | BrowserWindow / WebContentsView 依存が重い |
| React コンポーネント | ❌ | 必要になれば testing-library を入れる |
| E2E（Electron 起動） | ❌ | プロトタイプ範囲外、後フェーズで Playwright |

## トラブルシュート

### `Cannot find module 'vitest'`
`npm install` を実行（vitest 本体と型定義が入る）。

### `better-sqlite3` がロードできない
テストは Repository を mock しているため通常は起きない。実 DB に触れているテストがあれば、それは設計違反。`vi.mock` で隔離する。

### debounce や setTimeout を含むテストが固まる
`vi.useFakeTimers()` を `beforeEach` で有効化、`vi.useRealTimers()` を `afterEach` で戻す。時間は `vi.advanceTimersByTimeAsync(ms)` で進める。
