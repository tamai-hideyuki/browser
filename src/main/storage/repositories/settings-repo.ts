import { getDb } from '../db';

export const SettingsRepository = {
  getRaw(): Record<string, unknown> {
    const rows = getDb().prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
    const out: Record<string, unknown> = {};
    for (const r of rows) {
      try { out[r.key] = JSON.parse(r.value); }
      catch { /* 壊れた値は無視してデフォルトに任せる */ }
    }
    return out;
  },

  setCategory(key: string, value: unknown): void {
    getDb().prepare(`
      INSERT INTO settings (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(key, JSON.stringify(value));
  },
};
