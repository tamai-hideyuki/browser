# 21. ブックマーク / 履歴 要件

## ブックマーク（≒ Pinned / Favorite）
本プロダクトでは「ブックマーク」は独立機能ではなく **Pinned Tab + Favorite** として実現する。

### Favorite（最上位ピン）
- すべての Space で共通表示
- サイドバー上部に大きなアイコンで横並び
- 上限：12 件（UI 制約）
- ファビコン優先表示

### Pinned Tab
- 各 Space ごと
- フォルダでグループ化可能（`Cmd+Shift+D`）
- フォルダのネスト：2 階層まで

### 操作
- 追加：`Cmd+D`（アクティブタブを Pinned へ）
- 削除：右クリック → 削除 or サイドバーから Today へドラッグ
- 並び替え：ドラッグ&ドロップ
- 編集：右クリック → 名前変更 / URL変更
- エクスポート：HTML 形式（Chrome / Firefox 互換）
- インポート：Chrome / Firefox / Safari / Arc のブックマーク

## 履歴
### 記録対象
- ナビゲーションが完了した URL（`did-finish-load`）
- プライベートウィンドウでの遷移は記録しない
- `about:` URL は記録しない

### 保存項目
| 項目 | 型 |
|---|---|
| `url` | TEXT |
| `title` | TEXT |
| `visited_at` | INTEGER (unix ms) |
| `visit_count` | INTEGER |
| `last_visit_at` | INTEGER |
| `favicon_url` | TEXT |
| `space_id` | TEXT (どの Space で訪問したか) |

### 検索
- SQLite FTS5 でタイトル・URL 全文検索
- フィルタ：期間 / Space / ドメイン
- インクリメンタル検索（タイプごとに即時結果）

### 表示
- `about:history` 画面で時系列表示
- 日付グルーピング（今日 / 昨日 / 今週 / 過去）
- ドメインクラスタリング（任意で切替）

### 削除
- 個別削除
- 期間指定一括削除（直近 1h / 1日 / 1週 / 全期間）
- ドメイン指定削除
- コマンド：`/clear-history`

### 保持期間
- デフォルト：90 日
- 設定：{30日, 90日, 1年, 無制限}
- 期限切れデータは起動時のバックグラウンド処理で物理削除

## インポート
### 対応元
- Arc（プロファイル DB から直接）
- Chrome / Edge / Brave（Bookmarks JSON, History SQLite）
- Firefox（places.sqlite）
- Safari（Bookmarks.plist, History.db）
- HTML エクスポート形式（Netscape Bookmark File）

### マッピング
- ブックマーク → Pinned（フォルダ構造維持）
- 履歴 → 履歴テーブルへマージ
- インポート時は既存データと重複検出（URL 一致でスキップ）

## エクスポート
- ブックマーク：HTML / JSON
- 履歴：CSV / JSON
- どちらも `about:settings` から実行

## 同期
- フェーズ1：ローカルのみ
- フェーズ3：エンドツーエンド暗号化同期（`40-profiles-sync.md`）

## 非機能要件
- 履歴 100 万エントリ規模で検索 100ms 以内
- ファビコンは別テーブルにキャッシュし、サイドバー描画でのI/Oを避ける

## スコープ外
- ソーシャル機能（共有・コラボ）
- ブックマークコメント・タグ（フェーズ3 検討）
