export type TabId = string & { readonly __brand: 'TabId' };
export type SpaceId = string & { readonly __brand: 'SpaceId' };

export type TabState = 'today' | 'pinned' | 'archived';

// DB に保存されるフィールド（tabs テーブルと 1:1）
export type PersistedTab = {
  id: TabId;
  spaceId: SpaceId;
  url: string;
  title: string;
  faviconUrl: string | null;
  state: TabState;
  position: number;
  lastActiveAt: number;
  createdAt: number;
  archivedAt: number | null;
};

// 実行中のみ意味を持ち、DB には保存されない状態
export type TabRuntimeState = {
  loading: boolean;
  loadProgress: number;
  audible: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
};

export type Tab = PersistedTab & TabRuntimeState;

export const DEFAULT_TAB_RUNTIME: TabRuntimeState = {
  loading: false,
  loadProgress: 0,
  audible: false,
  canGoBack: false,
  canGoForward: false,
};

export type CreateTabInput = {
  url: string;
  spaceId?: SpaceId;
  state?: TabState;
  background?: boolean;
};

export type Rect = { x: number; y: number; width: number; height: number };
