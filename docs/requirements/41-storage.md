# 41. ストレージ / 永続化 要件

## ストレージ階層
| 種別 | 媒体 | 用途 |
|---|---|---|
| アプリDB | SQLite | タブ・履歴・ブックマーク・Boosts・設定 |
| 設定ファイル | JSON | 起動時必須の最小設定（テーマ等） |
| Web ストレージ | Chromium 管理 | Cookie / LocalStorage / IndexedDB / CacheStorage |
| ファビコンキャッシュ | ディスク | 画像ファイル |
| ダウンロード履歴 | SQLite | `22-downloads.md` |

## SQLite スキーマ概略
※実装時に正規化・インデックスを精査する。

```sql
-- プロファイル
CREATE TABLE profiles (
  id TEXT PRIMARY KEY,
  name TEXT,
  icon TEXT,
  created_at INTEGER
);

-- Space
CREATE TABLE spaces (
  id TEXT PRIMARY KEY,
  profile_id TEXT REFERENCES profiles(id),
  name TEXT,
  icon TEXT,
  theme_json TEXT,
  position INTEGER,
  created_at INTEGER
);

-- タブ
CREATE TABLE tabs (
  id TEXT PRIMARY KEY,
  space_id TEXT REFERENCES spaces(id),
  url TEXT,
  title TEXT,
  favicon_url TEXT,
  state TEXT, -- today / pinned / archived
  position INTEGER,
  parent_folder_id TEXT,
  last_active_at INTEGER,
  created_at INTEGER,
  archived_at INTEGER
);

-- 履歴
CREATE TABLE history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  url TEXT,
  title TEXT,
  visited_at INTEGER,
  space_id TEXT
);
CREATE INDEX idx_history_visited_at ON history(visited_at);
CREATE VIRTUAL TABLE history_fts USING fts5(url, title, content='history');

-- Boosts
CREATE TABLE boosts (
  id TEXT PRIMARY KEY,
  name TEXT,
  match_pattern TEXT,
  enabled INTEGER,
  css TEXT,
  js TEXT,
  run_at TEXT,
  created_at INTEGER,
  updated_at INTEGER
);

-- ダウンロード
CREATE TABLE downloads (
  id TEXT PRIMARY KEY,
  url TEXT,
  saved_path TEXT,
  size INTEGER,
  mime TEXT,
  state TEXT,
  started_at INTEGER,
  completed_at INTEGER
);

-- 設定（KVS）
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT
);
```

## ファイル配置
### macOS
```
~/Library/Application Support/<AppName>/
  ├── settings.json          # 起動時最小設定
  ├── shortcuts.json         # キーボードショートカット
  ├── profiles/
  │   └── <profile-id>/
  │       ├── data.db        # SQLite
  │       ├── webview/       # Chromium データ（Cookie等）
  │       ├── favicons/
  │       └── boosts-storage/
  └── crash-reports/
```

### Windows
```
%LOCALAPPDATA%\<AppName>\...
```

### Linux
```
~/.config/<AppName>/...
```

## バックアップ・移行
- 設定画面から「データのエクスポート」：`tar.gz` で全プロファイルを書き出す
- インポート：競合時はユーザーに確認
- 自動バックアップ：起動時に `data.db` をスナップショット（直近 7 日分保持）

## マイグレーション
- スキーマバージョンを `settings` に保存
- 起動時に旧バージョンなら順次マイグレーション
- マイグレーション失敗時は自動ロールバック + バックアップから復元

## Web ストレージ（Chromium 管理領域）
- プロファイルごとに独立した Session を WebView に割り当て
- Cookie / LocalStorage / IndexedDB はプロファイル間で完全分離
- 「サイトデータを削除」機能：ドメイン単位 / 全削除
- 「Cookie 自動削除」設定：終了時に削除 / N 日後に削除 / 削除しない

## キャッシュ管理
- HTTP キャッシュ：Chromium 任せ（容量上限はデフォルト準拠）
- 設定で「キャッシュサイズ上限」を調整可能（256MB〜2GB）
- 「キャッシュをクリア」機能あり

## 暗号化
- アプリ DB 自体は平文（OS のディスク暗号化に依存）
- 同期データは E2EE（`40-profiles-sync.md`）
- パスワード等の機微情報は OS Keychain / Credential Manager に保存

## 非機能要件
- 起動時の DB 接続：100ms 以内
- 履歴 100 万件で全文検索 100ms 以内
- ディスク IO はバックグラウンドスレッド優先

## スコープ外
- リモート DB / クラウド DB（フェーズ3で同期、ローカルDB自体は維持）
- 暗号化アプリDB（OS 暗号化で十分とみなす）
