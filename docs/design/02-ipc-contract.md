# 02. IPC 契約

対応要件：[30-webview-integration.md](../requirements/30-webview-integration.md)

## 設計方針
- すべての IPC メッセージは `src/shared/types/ipc.ts` に型定義
- main / shell 双方が同じ型をインポート
- 命名：`<domain>.<action>`（例：`tab.create`, `space.activate`）
- イベントブロードキャストは `<domain>.event` の単一チャネルに集約し、ペイロードの discriminated union で識別

## 型定義の骨格

```typescript
// src/shared/types/ipc.ts

// ─── コマンド: renderer → main → 戻り値 ────────────────────
export type Commands = {
  // tabs
  'tab.create':    { input: CreateTabInput;    output: TabId };
  'tab.activate':  { input: { tabId: TabId };  output: void };
  'tab.close':     { input: { tabId: TabId };  output: void };
  'tab.navigate':  { input: { tabId: TabId; url: string };  output: void };
  'tab.goBack':    { input: { tabId: TabId };  output: void };
  'tab.goForward': { input: { tabId: TabId };  output: void };
  'tab.reload':    { input: { tabId: TabId; ignoreCache?: boolean };  output: void };
  'tab.stop':      { input: { tabId: TabId };  output: void };
  'tab.pin':       { input: { tabId: TabId };  output: void };
  'tab.unpin':     { input: { tabId: TabId };  output: void };
  'tab.archive':   { input: { tabId: TabId };  output: void };
  'tab.move':      { input: MoveTabInput;      output: void };
  'tab.setBounds': { input: { bounds: Rect };  output: void };

  // spaces
  'space.list':     { input: void;                         output: Space[] };
  'space.create':   { input: CreateSpaceInput;             output: SpaceId };
  'space.activate': { input: { spaceId: SpaceId };         output: void };
  'space.update':   { input: UpdateSpaceInput;             output: void };
  'space.delete':   { input: { spaceId: SpaceId };         output: void };

  // history
  'history.search': { input: HistorySearchInput;           output: HistoryEntry[] };
  'history.delete': { input: { ids: number[] };            output: void };
  'history.clear':  { input: { since?: number };           output: void };

  // bootstrap (起動時の状態取得)
  'bootstrap.fetch': { input: void; output: BootstrapPayload };

  // settings
  'settings.get':   { input: void;                         output: Settings };
  'settings.patch': { input: Partial<Settings>;            output: void };

  // command bar
  'commandBar.search': { input: { query: string };         output: CommandBarResult[] };
  'commandBar.execute':{ input: { id: string };            output: void };

  // window
  'window.minimize': { input: void; output: void };
  'window.maximize': { input: void; output: void };
  'window.close':    { input: void; output: void };
};

// ─── イベント: main → renderer broadcast ──────────────────
export type Events =
  | { kind: 'tab.created';        tab: Tab }
  | { kind: 'tab.activated';      tabId: TabId }
  | { kind: 'tab.closed';         tabId: TabId }
  | { kind: 'tab.archived';       tabId: TabId }
  | { kind: 'tab.discarded';      tabId: TabId }
  | { kind: 'tab.crashed';        tabId: TabId; reason: string }
  | { kind: 'tab.titleUpdated';   tabId: TabId; title: string }
  | { kind: 'tab.faviconUpdated'; tabId: TabId; faviconUrl: string }
  | { kind: 'tab.urlUpdated';     tabId: TabId; url: string }
  | { kind: 'tab.loadingStateChanged'; tabId: TabId; loading: boolean; progress: number }
  | { kind: 'tab.audibleChanged'; tabId: TabId; audible: boolean }
  | { kind: 'space.activated';    spaceId: SpaceId }
  | { kind: 'space.updated';      space: Space }
  | { kind: 'settings.updated';   settings: Settings }
  | { kind: 'navigation.error';   tabId: TabId; errorCode: string; url: string };
```

## 補助型

```typescript
// src/shared/types/tab.ts
export type TabId = string & { __brand: 'TabId' };
export type SpaceId = string & { __brand: 'SpaceId' };

export type TabState = 'today' | 'pinned' | 'archived';

export type Tab = {
  id: TabId;
  spaceId: SpaceId;
  url: string;
  title: string;
  faviconUrl: string | null;
  state: TabState;
  position: number;
  parentFolderId: string | null;
  lastActiveAt: number;
  createdAt: number;
  archivedAt: number | null;
  loading: boolean;
  loadProgress: number;     // 0..1
  audible: boolean;
  discarded: boolean;
};

export type CreateTabInput = {
  url: string;
  spaceId?: SpaceId;        // 省略時はアクティブ Space
  position?: number;        // 省略時は末尾
  state?: TabState;         // 省略時は 'today'
  background?: boolean;     // 省略時は false（即時 activate）
};

export type MoveTabInput = {
  tabId: TabId;
  toSpaceId?: SpaceId;
  toState?: TabState;
  toPosition: number;
};

export type Rect = { x: number; y: number; width: number; height: number };
```

## 型安全 IPC ラッパ

### preload 側
```typescript
// src/preload/index.ts
import { contextBridge, ipcRenderer } from 'electron';
import type { Commands, Events } from '@shared/types/ipc';

const api = {
  invoke<K extends keyof Commands>(
    channel: K,
    input: Commands[K]['input']
  ): Promise<Commands[K]['output']> {
    return ipcRenderer.invoke(channel, input);
  },

  on(handler: (event: Events) => void): () => void {
    const listener = (_: unknown, payload: Events) => handler(payload);
    ipcRenderer.on('event', listener);
    return () => ipcRenderer.off('event', listener);
  },
};

contextBridge.exposeInMainWorld('api', api);

// 型を window に拡張する宣言は src/shared/types/ipc.ts でグローバル宣言
declare global {
  interface Window { api: typeof api }
}
```

### main 側
```typescript
// src/main/ipc/handlers.ts
import { ipcMain } from 'electron';
import type { Commands } from '@shared/types/ipc';

type Handler<K extends keyof Commands> = (
  input: Commands[K]['input']
) => Commands[K]['output'] | Promise<Commands[K]['output']>;

export function registerHandler<K extends keyof Commands>(
  channel: K,
  handler: Handler<K>
): void {
  ipcMain.handle(channel, async (_event, input) => handler(input));
}
```

### main → renderer ブロードキャスト
```typescript
// src/main/ipc/broadcaster.ts
import type { BrowserWindow } from 'electron';
import type { Events } from '@shared/types/ipc';

export class Broadcaster {
  constructor(private getWindow: () => BrowserWindow | null) {}

  emit(event: Events): void {
    this.getWindow()?.webContents.send('event', event);
  }
}
```

## エラーハンドリング

- `invoke` の中で例外が throw された場合、Electron が renderer 側に Error として伝播する
- 想定エラーは独自エラークラスで明示：
```typescript
export class TabNotFoundError extends Error {
  constructor(public tabId: TabId) {
    super(`Tab not found: ${tabId}`);
    this.name = 'TabNotFoundError';
  }
}
```
- renderer 側は try/catch で受ける。UI への通知は store 経由

## バリデーション

main 側は受信した input を zod でバリデート：
```typescript
import { z } from 'zod';

const CreateTabSchema = z.object({
  url: z.string().min(1),
  spaceId: z.string().optional(),
  position: z.number().int().nonnegative().optional(),
  state: z.enum(['today', 'pinned', 'archived']).optional(),
  background: z.boolean().optional(),
});

registerHandler('tab.create', async (input) => {
  const parsed = CreateTabSchema.parse(input);
  return tabManager.create(parsed);
});
```

シェルからの入力は信頼できるが、Boost / 拡張機能（後フェーズ）で IPC 経路が増えるため、今のうちから境界バリデーションを入れる。

## イベントの順序保証
- main は単一イベントループから `emit` するため、renderer 側の受信順は送信順と一致
- ストア更新は同一 tick 内で適用（バッチ更新は React の自動バッチに委ねる）

## デバッグ

開発時のみ、`event` チャネルへの送受信をコンソールログに出すミドルウェア：
```typescript
if (import.meta.env.DEV) {
  // renderer
  window.api.on((e) => console.debug('[ipc:event]', e));
}
```

## チャネル一覧の管理
新規チャネル追加時は：
1. `Commands` または `Events` に型追加
2. 型エラーでハンドラ未実装が露見するため、main 側で対応する `registerHandler` を追加
3. 本ドキュメントの一覧を更新（マージ条件）
