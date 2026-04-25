# 04. 状態管理（Zustand）

対応要件：[10-shell-ui.md](../requirements/10-shell-ui.md), [11-tabs-spaces.md](../requirements/11-tabs-spaces.md)

## 真実源
- **永続化される状態の真実源は main process（SQLite）**
- shell の Zustand ストアはあくまで「main の投影 + UI ローカル状態」
- 変更操作は IPC コマンドで main に依頼 → main がイベント発行 → shell ストアが反映

```
ユーザー操作
   ↓
shell store action
   ↓ (IPC invoke)
main service
   ↓ (DB 更新)
main broadcaster
   ↓ (IPC event)
shell store reducer
   ↓
React 再描画
```

楽観的 UI 更新（optimistic update）は M1 では使わない。完全な main 経由のラウンドトリップを基本とする。レイテンシ問題が顕在化したら個別に楽観更新を導入する。

## ストア分割

| ストア | 内容 | 永続元 |
|---|---|---|
| `tabsStore` | タブの一覧と状態 | DB（tabs）+ ランタイム |
| `spacesStore` | Space 一覧、アクティブ Space | DB（spaces）+ UI |
| `uiStore` | サイドバー幅・表示・コマンドバー開閉 | settings + UI |
| `commandBarStore` | コマンドバーの入力・候補 | UI のみ |
| `settingsStore` | 設定値 | DB（settings） |

## tabsStore

```typescript
// src/shell/stores/tabs-store.ts
import { create } from 'zustand';
import type { Tab, TabId, SpaceId, TabState } from '@shared/types/tab';
import type { Events } from '@shared/types/ipc';

type TabsState = {
  byId: Record<TabId, Tab>;
  activeTabId: TabId | null;

  // selectors（再計算は useMemo or createSelector）
  // selectors はコンポーネント側で書く

  // actions（IPC を呼ぶ）
  createTab(input: { url: string; spaceId?: SpaceId; background?: boolean }): Promise<TabId>;
  activateTab(tabId: TabId): Promise<void>;
  closeTab(tabId: TabId): Promise<void>;
  navigateTab(tabId: TabId, url: string): Promise<void>;
  pinTab(tabId: TabId): Promise<void>;
  unpinTab(tabId: TabId): Promise<void>;
  archiveTab(tabId: TabId): Promise<void>;
  moveTab(tabId: TabId, toSpaceId: SpaceId, toState: TabState, toPosition: number): Promise<void>;

  // 内部: イベント受信
  applyEvent(event: Events): void;

  // 起動時ハイドレーション
  hydrate(tabs: Tab[], activeTabId: TabId | null): void;
};

export const useTabsStore = create<TabsState>((set, get) => ({
  byId: {},
  activeTabId: null,

  async createTab(input) {
    const tabId = await window.api.invoke('tab.create', { ...input });
    return tabId;
    // 状態反映は 'tab.created' イベント側でやる
  },

  async activateTab(tabId) {
    await window.api.invoke('tab.activate', { tabId });
  },

  async closeTab(tabId) {
    await window.api.invoke('tab.close', { tabId });
  },

  async navigateTab(tabId, url) {
    await window.api.invoke('tab.navigate', { tabId, url });
  },

  async pinTab(tabId) {
    await window.api.invoke('tab.pin', { tabId });
  },

  async unpinTab(tabId) {
    await window.api.invoke('tab.unpin', { tabId });
  },

  async archiveTab(tabId) {
    await window.api.invoke('tab.archive', { tabId });
  },

  async moveTab(tabId, toSpaceId, toState, toPosition) {
    await window.api.invoke('tab.move', { tabId, toSpaceId, toState, toPosition });
  },

  applyEvent(event) {
    set((state) => {
      switch (event.kind) {
        case 'tab.created':
          return { byId: { ...state.byId, [event.tab.id]: event.tab } };
        case 'tab.activated':
          return { activeTabId: event.tabId };
        case 'tab.closed':
        case 'tab.archived': {
          const { [event.tabId]: _, ...rest } = state.byId;
          // tab.archived は state を更新するだけのケースもあるため、main 側の挙動に合わせる
          return event.kind === 'tab.closed'
            ? { byId: rest, activeTabId: state.activeTabId === event.tabId ? null : state.activeTabId }
            : state;
        }
        case 'tab.titleUpdated':
          return patchTab(state, event.tabId, { title: event.title });
        case 'tab.faviconUpdated':
          return patchTab(state, event.tabId, { faviconUrl: event.faviconUrl });
        case 'tab.urlUpdated':
          return patchTab(state, event.tabId, { url: event.url });
        case 'tab.loadingStateChanged':
          return patchTab(state, event.tabId, { loading: event.loading, loadProgress: event.progress });
        case 'tab.audibleChanged':
          return patchTab(state, event.tabId, { audible: event.audible });
        case 'tab.discarded':
          return patchTab(state, event.tabId, { discarded: true });
        case 'tab.crashed':
          return patchTab(state, event.tabId, { loading: false });
        default:
          return state;
      }
    });
  },

  hydrate(tabs, activeTabId) {
    const byId: Record<TabId, Tab> = {};
    for (const t of tabs) byId[t.id] = t;
    set({ byId, activeTabId });
  },
}));

function patchTab(state: TabsState, id: TabId, patch: Partial<Tab>): Partial<TabsState> {
  const cur = state.byId[id];
  if (!cur) return state;
  return { byId: { ...state.byId, [id]: { ...cur, ...patch } } };
}
```

## spacesStore

```typescript
type SpacesState = {
  byId: Record<SpaceId, Space>;
  order: SpaceId[];
  activeSpaceId: SpaceId | null;

  setActiveSpace(spaceId: SpaceId): Promise<void>;
  createSpace(input: CreateSpaceInput): Promise<SpaceId>;
  updateSpace(input: UpdateSpaceInput): Promise<void>;
  deleteSpace(spaceId: SpaceId): Promise<void>;

  applyEvent(event: Events): void;
  hydrate(spaces: Space[], activeSpaceId: SpaceId | null): void;
};
```

## uiStore（永続化対象は一部のみ）

```typescript
type UiState = {
  sidebarWidth: number;          // 永続化
  sidebarVisible: boolean;       // 永続化
  commandBarOpen: boolean;       // セッション内のみ
  contextMenu: { x: number; y: number; targetId: string } | null;

  setSidebarWidth(w: number): void;
  toggleSidebar(): void;
  openCommandBar(): void;
  closeCommandBar(): void;
};
```

`sidebarWidth` / `sidebarVisible` は変更時に `settings.patch` を debounce 500ms で発行。

## commandBarStore

セッションローカル。永続化なし。
詳細は [07-command-bar.md](07-command-bar.md)。

## settingsStore

```typescript
type SettingsState = {
  settings: Settings;
  patch(partial: Partial<Settings>): Promise<void>;
  applyEvent(event: Events): void;
  hydrate(s: Settings): void;
};
```

## イベントの集約配信

ストアごとに `window.api.on` を貼ると重複するため、`App.tsx` で一括購読し各ストアへ配る：

```typescript
// src/shell/App.tsx
import { useEffect } from 'react';
import { useTabsStore } from './stores/tabs-store';
import { useSpacesStore } from './stores/spaces-store';
import { useSettingsStore } from './stores/settings-store';

export function App() {
  useEffect(() => {
    const off = window.api.on((event) => {
      useTabsStore.getState().applyEvent(event);
      useSpacesStore.getState().applyEvent(event);
      useSettingsStore.getState().applyEvent(event);
    });
    return off;
  }, []);
  // ...
}
```

## 起動時ハイドレーション

```typescript
// src/shell/main.tsx
async function bootstrap() {
  const data = await window.api.invoke('bootstrap.fetch', undefined);
  useSpacesStore.getState().hydrate(data.spaces, data.activeSpaceId);
  useTabsStore.getState().hydrate(data.tabs, data.activeTabId);
  useSettingsStore.getState().hydrate(data.settings);

  ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
}
bootstrap();
```

`BootstrapPayload`：
```typescript
type BootstrapPayload = {
  spaces: Space[];
  activeSpaceId: SpaceId | null;
  tabs: Tab[];                   // archived は含まない
  activeTabId: TabId | null;
  settings: Settings;
};
```

## セレクタ

ストアに置かず、コンポーネント側で `useShallow` で抽出：

```typescript
import { useShallow } from 'zustand/react/shallow';

function Sidebar() {
  const tabs = useTabsStore(useShallow((s) => s.byId));
  const activeSpaceId = useSpacesStore((s) => s.activeSpaceId);

  const today = useMemo(
    () => Object.values(tabs)
      .filter(t => t.spaceId === activeSpaceId && t.state === 'today')
      .sort((a, b) => a.position - b.position),
    [tabs, activeSpaceId]
  );
  // ...
}
```

`tabs` 数が多い場合のフィルタ・ソートはコンポーネント側で memoize。`Object.values` のコストが顕在化したら、ストアに `idsBySection: Record<\`${SpaceId}:${TabState}\`, TabId[]>` を持たせるリファクタを検討（M1 では不要と判断）。

## DevTools 統合

Zustand devtools middleware を有効化（dev のみ）：
```typescript
import { devtools } from 'zustand/middleware';
export const useTabsStore = create<TabsState>()(devtools((set, get) => ({ ... })));
```

## テスト方針
- ストアは `applyEvent` ベースで純粋に記述。
- ユニットテスト：イベント列を流して期待状態になることを確認
- IPC 部分はモック（`window.api.invoke` を vi.fn でスタブ）

## アンチパターン
- **shell ストアに main を介さず直接書き換え** → イベント不整合の元。禁止
- **shell から DB に直接アクセス** → preload で許可しない。禁止
- **複数ストア間の派生状態をストアに持つ** → コンポーネントで `useMemo`
