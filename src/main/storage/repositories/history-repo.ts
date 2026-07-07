import { getDb } from '../db';
import type { HistoryEntry } from '@shared/types/history';

export const HistoryRepository = {
  record(url: string, title: string, visitedAt: number): void {
    getDb().prepare(`
      INSERT INTO history (url, title, visited_at) VALUES (?, ?, ?)
    `).run(url, title, visitedAt);
  },

  updateTitleByUrl(url: string, title: string): void {
    getDb().prepare(`
      UPDATE history
      SET title = ?
      WHERE id = (SELECT MAX(id) FROM history WHERE url = ?)
    `).run(title, url);
  },

  search(query: string, limit = 20): HistoryEntry[] {
    // FTS5 の特殊文字を全部スペース化（":" "*" "(" ")" "\"" "^" "+" "-" "."）
    const cleaned = query.replace(/[:"()*^+\-.]/g, ' ').trim();
    if (cleaned.length === 0) return [];
    const tokens = cleaned
      .split(/\s+/)
      .filter((t) => t.length > 0)
      .map((t) => `"${t}"*`)
      .join(' ');
    if (tokens.length === 0) return [];
    // SELECT で HistoryEntry と同じキー名に揃えているためそのまま返せる
    return getDb().prepare(`
      SELECT h.id, h.url, h.title, h.visited_at AS visitedAt
      FROM history_fts
      JOIN history h ON h.id = history_fts.rowid
      WHERE history_fts MATCH ?
      ORDER BY bm25(history_fts), h.visited_at DESC
      LIMIT ?
    `).all(tokens, limit) as HistoryEntry[];
  },

  recent(limit = 50): HistoryEntry[] {
    return getDb().prepare(`
      SELECT id, url, title, visited_at AS visitedAt
      FROM history
      ORDER BY visited_at DESC
      LIMIT ?
    `).all(limit) as HistoryEntry[];
  },
};
