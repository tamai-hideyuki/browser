# 03. データモデル

対応要件：[41-storage.md](../requirements/41-storage.md)

## DB 接続

```typescript
// src/main/storage/db.ts
import Database from 'better-sqlite3';
import { app } from 'electron';
import path from 'node:path';

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;
  const dbPath = path.join(app.getPath('userData'), 'data.db');
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');
  return db;
}

export function closeDb(): void {
  db?.close();
  db = null;
}
```

## スキーマ（M1 用）

`src/main/storage/migrations/001_init.sql` に以下を配置。

```sql
-- スキーマバージョン管理
CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY
);
INSERT OR IGNORE INTO schema_version (version) VALUES (1);

-- Space
CREATE TABLE spaces (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  icon         TEXT,
  theme_json   TEXT,
  position     INTEGER NOT NULL,
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
);
CREATE INDEX idx_spaces_position ON spaces(position);

-- タブ（Pinned / Today / Archived 全部入り）
CREATE TABLE tabs (
  id                TEXT PRIMARY KEY,
  space_id          TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  url               TEXT NOT NULL,
  title             TEXT NOT NULL DEFAULT '',
  favicon_url       TEXT,
  state             TEXT NOT NULL CHECK (state IN ('today', 'pinned', 'archived')),
  position          INTEGER NOT NULL,
  parent_folder_id  TEXT,
  last_active_at    INTEGER NOT NULL,
  created_at        INTEGER NOT NULL,
  archived_at       INTEGER
);
CREATE INDEX idx_tabs_space_state_position ON tabs(space_id, state, position);
CREATE INDEX idx_tabs_last_active_at ON tabs(last_active_at);

-- 履歴
CREATE TABLE history (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  url          TEXT NOT NULL,
  title        TEXT NOT NULL DEFAULT '',
  visited_at   INTEGER NOT NULL,
  space_id     TEXT REFERENCES spaces(id) ON DELETE SET NULL
);
CREATE INDEX idx_history_visited_at ON history(visited_at DESC);
CREATE INDEX idx_history_url ON history(url);

-- 履歴の全文検索
CREATE VIRTUAL TABLE history_fts USING fts5(
  url,
  title,
  content='history',
  content_rowid='id'
);

-- history テーブルの変更を fts5 に同期するトリガ
CREATE TRIGGER history_ai AFTER INSERT ON history BEGIN
  INSERT INTO history_fts(rowid, url, title) VALUES (new.id, new.url, new.title);
END;
CREATE TRIGGER history_ad AFTER DELETE ON history BEGIN
  INSERT INTO history_fts(history_fts, rowid, url, title) VALUES ('delete', old.id, old.url, old.title);
END;
CREATE TRIGGER history_au AFTER UPDATE ON history BEGIN
  INSERT INTO history_fts(history_fts, rowid, url, title) VALUES ('delete', old.id, old.url, old.title);
  INSERT INTO history_fts(rowid, url, title) VALUES (new.id, new.url, new.title);
END;

-- 設定（KVS）
CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL          -- JSON 文字列
);

-- ファビコンキャッシュ（メタデータのみ。実体はファイル）
CREATE TABLE favicons (
  origin       TEXT PRIMARY KEY,    -- 'https://example.com'
  file_path    TEXT NOT NULL,
  fetched_at   INTEGER NOT NULL
);
```

## TS 型（共通）

```typescript
// src/shared/types/space.ts
export type SpaceTheme = {
  kind: 'gradient';
  colors: [string, string, string?];      // hex
} | {
  kind: 'solid';
  color: string;
};

export type Space = {
  id: SpaceId;
  name: string;
  icon: string | null;
  theme: SpaceTheme | null;
  position: number;
  createdAt: number;
  updatedAt: number;
};
```

`Tab` 型は [02-ipc-contract.md](02-ipc-contract.md) を参照。

## Repository パターン

DB アクセスは Repository に集約。サービス層から SQL を直接書かない。

### TabRepository
```typescript
// src/main/storage/repositories/tab-repo.ts
import type { Tab, TabId, SpaceId, TabState } from '@shared/types/tab';
import { getDb } from '../db';

export const TabRepository = {
  insert(tab: Omit<Tab, 'loading' | 'loadProgress' | 'audible' | 'discarded'>): void {
    getDb().prepare(`
      INSERT INTO tabs (
        id, space_id, url, title, favicon_url, state, position,
        parent_folder_id, last_active_at, created_at, archived_at
      ) VALUES (
        @id, @spaceId, @url, @title, @faviconUrl, @state, @position,
        @parentFolderId, @lastActiveAt, @createdAt, @archivedAt
      )
    `).run(tab);
  },

  findById(id: TabId): Tab | undefined {
    const row = getDb().prepare('SELECT * FROM tabs WHERE id = ?').get(id);
    return row ? rowToTab(row) : undefined;
  },

  listBySpace(spaceId: SpaceId, state: TabState): Tab[] {
    const rows = getDb().prepare(`
      SELECT * FROM tabs
      WHERE space_id = ? AND state = ?
      ORDER BY position ASC
    `).all(spaceId, state);
    return rows.map(rowToTab);
  },

  listAllOpen(): Tab[] {
    // archived 以外。起動時の復元に使う
    const rows = getDb().prepare(`
      SELECT * FROM tabs
      WHERE state IN ('today', 'pinned')
      ORDER BY space_id, state, position
    `).all();
    return rows.map(rowToTab);
  },

  update(id: TabId, patch: Partial<Tab>): void {
    const fields: string[] = [];
    const params: Record<string, unknown> = { id };
    for (const [k, v] of Object.entries(patch)) {
      const col = camelToSnake(k);
      fields.push(`${col} = @${k}`);
      params[k] = v;
    }
    if (fields.length === 0) return;
    getDb().prepare(`UPDATE tabs SET ${fields.join(', ')} WHERE id = @id`).run(params);
  },

  delete(id: TabId): void {
    getDb().prepare('DELETE FROM tabs WHERE id = ?').run(id);
  },

  reorderInSection(spaceId: SpaceId, state: TabState, idsInOrder: TabId[]): void {
    const stmt = getDb().prepare(
      'UPDATE tabs SET position = ? WHERE id = ? AND space_id = ? AND state = ?'
    );
    const tx = getDb().transaction((ids: TabId[]) => {
      ids.forEach((id, i) => stmt.run(i, id, spaceId, state));
    });
    tx(idsInOrder);
  },
};
```

### SpaceRepository / HistoryRepository / SettingsRepository

同様のパターン。冗長なので骨格のみ列挙：

| Repository | 主要メソッド |
|---|---|
| SpaceRepository | `list()`, `findById()`, `insert()`, `update()`, `delete()`, `reorder()` |
| HistoryRepository | `record(entry)`, `search(query, limit)`, `recent(limit)`, `deleteByIds(ids)`, `clear(since?)` |
| SettingsRepository | `get<K>(key)`, `set<K>(key, value)`, `getAll()` |

### 型変換ヘルパ

```typescript
// src/main/storage/repositories/_helpers.ts
function camelToSnake(s: string): string {
  return s.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase());
}

function rowToTab(row: any): Tab {
  return {
    id: row.id,
    spaceId: row.space_id,
    url: row.url,
    title: row.title,
    faviconUrl: row.favicon_url,
    state: row.state,
    position: row.position,
    parentFolderId: row.parent_folder_id,
    lastActiveAt: row.last_active_at,
    createdAt: row.created_at,
    archivedAt: row.archived_at,
    // ランタイム状態は別管理
    loading: false,
    loadProgress: 0,
    audible: false,
    discarded: true,
  };
}
```

## マイグレーション

### Runner
```typescript
// src/main/storage/migrations/runner.ts
import fs from 'node:fs';
import path from 'node:path';
import { getDb } from '../db';

const MIGRATIONS_DIR = path.join(__dirname, '.');

export function runMigrations(): void {
  const db = getDb();
  const current = (db.prepare('SELECT version FROM schema_version').get() as any)?.version ?? 0;

  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => /^\d+_.+\.sql$/.test(f))
    .sort();

  for (const file of files) {
    const version = parseInt(file.split('_')[0], 10);
    if (version <= current) continue;
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    const tx = db.transaction(() => {
      db.exec(sql);
      db.prepare('UPDATE schema_version SET version = ?').run(version);
    });
    tx();
  }
}
```

### マイグレーション規則
- ファイル名：`NNN_description.sql`（連番ゼロ埋め）
- 1 ファイル = 1 トランザクション = 1 バージョン
- ロールバックスクリプトは作らない（前バージョンへの復元は自動バックアップから）
- `DROP COLUMN` は SQLite 制約に注意（テーブル再作成パターン）

## バックアップ

起動時に `data.db` を `data.db.backup-YYYYMMDD` としてコピー。直近 7 日分保持。

```typescript
// src/main/storage/backup.ts
import fs from 'node:fs/promises';
import path from 'node:path';
import { app } from 'electron';

export async function backupOnStartup(): Promise<void> {
  const dir = app.getPath('userData');
  const src = path.join(dir, 'data.db');
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const dst = path.join(dir, `data.db.backup-${stamp}`);
  if (!(await exists(dst))) {
    await fs.copyFile(src, dst);
  }
  await pruneOldBackups(dir);
}
```

## トランザクション方針
- 複数テーブル更新を伴う操作は `db.transaction()` で囲む
- 例：タブ並び替え（複数タブの position を更新）、Space 削除（タブも一括削除）

## 性能の留意点
- prepared statement はモジュールレベルでキャッシュ（毎回 `prepare` しない）
- `INSERT INTO history` は debounce 1 秒で複数件まとめる
- FTS5 検索は `MATCH` 演算子のクエリ構築をエスケープ（特殊文字 `"`、`*`、`(`、`)`）
- 100 万件規模での検索ベンチを CI に組み込む

## アクセス層の階層
```
Service (TabManager 等)
    ↓
Repository (TabRepository 等)
    ↓
better-sqlite3
```
- Service は IPC ハンドラから呼ばれる
- Repository は Service からのみ呼ばれる
- IPC ハンドラから Repository を直接呼ぶのは禁止（ビジネスロジックが分散するため）
