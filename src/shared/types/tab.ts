export type TabId = string & { readonly __brand: 'TabId' };
export type SpaceId = string & { readonly __brand: 'SpaceId' };

export type TabState = 'today' | 'pinned' | 'archived';

export type Tab = {
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
  loading: boolean;
  loadProgress: number;
  audible: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
};

export type CreateTabInput = {
  url: string;
  spaceId?: SpaceId;
  state?: TabState;
  background?: boolean;
};

export type Rect = { x: number; y: number; width: number; height: number };
