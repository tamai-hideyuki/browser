import { getDb } from '../db';

const MIGRATIONS: { version: number; sql: string }[] = [
  {
    version: 2,
    sql: `
      CREATE TABLE IF NOT EXISTS settings (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `,
  },
  {
    version: 1,
    sql: `
      CREATE TABLE IF NOT EXISTS schema_version (
        version INTEGER PRIMARY KEY
      );

      CREATE TABLE IF NOT EXISTS spaces (
        id           TEXT PRIMARY KEY,
        name         TEXT NOT NULL,
        icon         TEXT,
        position     INTEGER NOT NULL,
        created_at   INTEGER NOT NULL,
        updated_at   INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS tabs (
        id              TEXT PRIMARY KEY,
        space_id        TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
        url             TEXT NOT NULL,
        title           TEXT NOT NULL DEFAULT '',
        favicon_url     TEXT,
        state           TEXT NOT NULL CHECK (state IN ('today', 'pinned', 'archived')),
        position        INTEGER NOT NULL,
        last_active_at  INTEGER NOT NULL,
        created_at      INTEGER NOT NULL,
        archived_at     INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_tabs_space_state_position
        ON tabs(space_id, state, position);
      CREATE INDEX IF NOT EXISTS idx_tabs_last_active_at
        ON tabs(last_active_at);

      CREATE TABLE IF NOT EXISTS history (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        url         TEXT NOT NULL,
        title       TEXT NOT NULL DEFAULT '',
        visited_at  INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_history_visited_at
        ON history(visited_at DESC);

      CREATE VIRTUAL TABLE IF NOT EXISTS history_fts USING fts5(
        url, title,
        content='history', content_rowid='id'
      );

      CREATE TRIGGER IF NOT EXISTS history_ai AFTER INSERT ON history BEGIN
        INSERT INTO history_fts(rowid, url, title) VALUES (new.id, new.url, new.title);
      END;
      CREATE TRIGGER IF NOT EXISTS history_ad AFTER DELETE ON history BEGIN
        INSERT INTO history_fts(history_fts, rowid, url, title) VALUES ('delete', old.id, old.url, old.title);
      END;
      CREATE TRIGGER IF NOT EXISTS history_au AFTER UPDATE ON history BEGIN
        INSERT INTO history_fts(history_fts, rowid, url, title) VALUES ('delete', old.id, old.url, old.title);
        INSERT INTO history_fts(rowid, url, title) VALUES (new.id, new.url, new.title);
      END;
    `,
  },
];

export const runMigrations = (): void => {
  const db = getDb();

  db.exec(`CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY);`);

  const row = db.prepare('SELECT version FROM schema_version LIMIT 1').get() as { version: number } | undefined;
  const current = row?.version ?? 0;

  // 昇順で適用
  const sorted = [...MIGRATIONS].sort((a, b) => a.version - b.version);
  for (const m of sorted) {
    if (m.version <= current) continue;
    const tx = db.transaction(() => {
      db.exec(m.sql);
      const exists = db.prepare('SELECT version FROM schema_version LIMIT 1').get();
      if (!exists) {
        db.prepare('INSERT INTO schema_version (version) VALUES (?)').run(m.version);
      } else {
        db.prepare('UPDATE schema_version SET version = ?').run(m.version);
      }
    });
    tx();
  }
};
