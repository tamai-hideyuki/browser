import { getDb } from '../db';
import { rowToTab } from './_helpers';
import type { Tab, TabId, SpaceId, TabState } from '@shared/types/tab';

type InsertTabInput = {
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

export const TabRepository = {
  insert(t: InsertTabInput): void {
    getDb().prepare(`
      INSERT INTO tabs (id, space_id, url, title, favicon_url, state, position,
                        last_active_at, created_at, archived_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      t.id, t.spaceId, t.url, t.title, t.faviconUrl, t.state, t.position,
      t.lastActiveAt, t.createdAt, t.archivedAt,
    );
  },

  findById(id: TabId): Tab | undefined {
    const row = getDb().prepare('SELECT * FROM tabs WHERE id = ?').get(id) as any;
    return row ? rowToTab(row) : undefined;
  },

  listAllOpen(): Tab[] {
    const rows = getDb().prepare(`
      SELECT * FROM tabs
      WHERE state IN ('today', 'pinned')
      ORDER BY space_id, state, position
    `).all() as any[];
    return rows.map(rowToTab);
  },

  nextPosition(spaceId: SpaceId, state: TabState): number {
    const row = getDb().prepare(`
      SELECT COALESCE(MAX(position), -1) + 1 AS next
      FROM tabs WHERE space_id = ? AND state = ?
    `).get(spaceId, state) as { next: number };
    return row.next;
  },

  updateUrl(id: TabId, url: string): void {
    getDb().prepare('UPDATE tabs SET url = ? WHERE id = ?').run(url, id);
  },

  updateTitle(id: TabId, title: string): void {
    getDb().prepare('UPDATE tabs SET title = ? WHERE id = ?').run(title, id);
  },

  updateFavicon(id: TabId, faviconUrl: string | null): void {
    getDb().prepare('UPDATE tabs SET favicon_url = ? WHERE id = ?').run(faviconUrl, id);
  },

  updateLastActive(id: TabId, t: number): void {
    getDb().prepare('UPDATE tabs SET last_active_at = ? WHERE id = ?').run(t, id);
  },

  archive(id: TabId, t: number): void {
    getDb().prepare(`
      UPDATE tabs SET state = 'archived', archived_at = ? WHERE id = ?
    `).run(t, id);
  },

  setState(id: TabId, state: TabState, position: number): void {
    getDb().prepare(`
      UPDATE tabs SET state = ?, position = ? WHERE id = ?
    `).run(state, position, id);
  },

  listArchived(limit = 100): Tab[] {
    const rows = getDb().prepare(`
      SELECT * FROM tabs
      WHERE state = 'archived'
      ORDER BY archived_at DESC, last_active_at DESC
      LIMIT ?
    `).all(limit) as any[];
    return rows.map(rowToTab);
  },

  deletePermanent(id: TabId): void {
    getDb().prepare('DELETE FROM tabs WHERE id = ?').run(id);
  },
};
