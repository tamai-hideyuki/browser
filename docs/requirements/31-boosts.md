# 31. Boosts 要件

## 概要
Arc の Boost に相当する機能。特定のサイトに対して CSS / JS を注入し、見た目や挙動をパーソナライズする。

## Boost の構成
| フィールド | 型 | 説明 |
|---|---|---|
| `id` | UUID | 識別子 |
| `name` | string | ユーザーが付けた名前 |
| `match_pattern` | string | URL マッチパターン（後述） |
| `enabled` | boolean | 有効 / 無効 |
| `css` | string? | 注入CSS |
| `js` | string? | 注入JS |
| `run_at` | enum | `document_start` / `document_end` / `document_idle` |
| `created_at` | number | |
| `updated_at` | number | |

## URL マッチパターン
Chrome 拡張の match pattern 形式を採用：
- `https://example.com/*`
- `*://*.example.com/*`
- `https://example.com/path/*`

加えて、簡易UI として「このドメインに適用」「このページに適用」を提供。

## 注入タイミング
- **CSS**：`document_start` で `<style>` を `<head>` に追加
- **JS**：選択可能（`document_start` / `document_end` / `document_idle`）
- ページ遷移時は再注入（SPA は History API で検知）

## エディタ UI
- `about:boosts` でリスト表示
- 編集画面：CSS / JS のモナコエディタ
- リアルタイムプレビュー（変更を即座に対象タブに反映）
- スニペットライブラリ（よく使う CSS パターンのテンプレート）

## 適用範囲
- グローバル（全サイト）
- ドメイン一致（`*.example.com`）
- パス一致（`example.com/foo/*`）
- 完全一致（特定 URL のみ）

## セキュリティモデル
### 実行コンテキスト
- 注入 JS は **Isolated World** で実行（Chrome 拡張と同じ）
- ページの JS と DOM は共有するが、変数空間は分離
- ページ JS から Boost JS のグローバルにアクセス不可

### 権限
- Boost JS が利用できる API は標準 Web API のみ
- 拡張機能 API（`chrome.*`）は提供しない（フェーズ1）
- ストレージ：Boost ごとに独立した `localStorage` 風 API（後述）

### Boost ストレージ API
シェル経由で提供：
- `boost.storage.get(key)` / `set(key, value)` / `remove(key)`
- 各 Boost ごとに独立したキースペース
- 容量上限：1MB / Boost

### 危険な操作の禁止
- `eval` を含む JS は警告（実行は可能）
- 外部スクリプト読み込み（`<script src="...">` 動的追加）は警告

## 配布・共有（フェーズ2）
- Boost を JSON エクスポート
- URL からインポート（GitHub gist 等）
- 共有時は `js` 部分の有無を明示警告

## デバッグ
- DevTools の Console に Boost のエラー表示
- Boost ごとの ON/OFF をクイックトグル（コマンドバーから `/boost`）

## 永続化
- SQLite の `boosts` テーブル
- フィールドは「Boost の構成」と同一
- インポート / エクスポートは JSON

## 非機能要件
- 注入による初期表示遅延：50ms 以下
- ページ遷移時の再注入は同期的に完了
- マッチング判定は正規表現キャッシュ済み

## スコープ外
- フル拡張API互換（`chrome.*` 名前空間）
- バックグラウンドスクリプト（常駐型）
- 他ユーザー作 Boost のマーケットプレイス（フェーズ3）
