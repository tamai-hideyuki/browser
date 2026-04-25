import type { Tab, TabId, SpaceId } from '@shared/types/tab';
import type { Space } from '@shared/types/space';


type TabRow = {
  id: string;
  space_id: string;
  url: string;
  title: string;
  favicon_url: string | null;
  state: 'today' | 'pinned' | 'archived';
  position: number;
  last_active_at: number;
  created_at: number;
  archived_at: number | null;
};

export const rowToTab = (row: TabRow): Tab => ({
  id: row.id as TabId,
  spaceId: row.space_id as SpaceId,
  url: row.url,
  title: row.title,
  faviconUrl: row.favicon_url,
  state: row.state,
  position: row.position,
  lastActiveAt: row.last_active_at,
  createdAt: row.created_at,
  archivedAt: row.archived_at,
  loading: false,
  loadProgress: 0,
  audible: false,
  canGoBack: false,
  canGoForward: false,
});

type SpaceRow = {
  id: string;
  name: string;
  icon: string | null;
  position: number;
  created_at: number;
  updated_at: number;
};

export const rowToSpace = (row: SpaceRow): Space => ({
  id: row.id as SpaceId,
  name: row.name,
  icon: row.icon,
  position: row.position,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});
