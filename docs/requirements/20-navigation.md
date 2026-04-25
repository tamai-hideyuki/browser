# 20. ナビゲーション 要件

## 概要
URL 解決・ページ遷移・履歴スタックを担当する。実際のリクエスト送信は Chromium の WebContents に委譲し、本層はその制御と前後関係の管理に責任を持つ。

## URL 解決
### 入力 → URL の変換
1. `about:` / `chrome:` / `file:` / `view-source:` 等のスキーム付き → そのまま
2. `https://` / `http://` 付き → そのまま
3. ドット含む文字列（`example.com`）→ `https://example.com`
4. ドットなしホスト（`localhost`, `myhost`）→ `http://<host>` （内部解決可なら）
5. IPアドレス → 適切なスキームを補完
6. それ以外 → デフォルト検索エンジンの URL に置換

### 特殊 URL
- `about:blank` … 空ページ
- `about:settings` … 設定画面
- `about:history` … 履歴
- `about:archive` … アーカイブ
- `about:boosts` … Boost 一覧
- `about:debug` … 開発者向け（dev ビルドのみ）

## ナビゲーション操作
| 操作 | 機能 |
|---|---|
| 戻る | `Cmd+[` / トラックパッド左スワイプ |
| 進む | `Cmd+]` / トラックパッド右スワイプ |
| リロード | `Cmd+R` |
| 強制リロード | `Cmd+Shift+R`（HTTPキャッシュ無視） |
| 停止 | ESC |

## 履歴スタック
- タブごとに独立した履歴スタックを保持
- 戻る / 進むはタブ単位
- スタック上限：100 エントリ（超過時は古いものから削除）
- セッション復元時にスタックも復元

## ナビゲーションイベント
WebView から以下のイベントを購読し、UI に反映：
- `did-start-navigation` … ロード開始
- `did-receive-response` … HTTPレスポンス受信
- `did-finish-load` … 読み込み完了
- `did-fail-load` … エラー
- `did-redirect-navigation` … リダイレクト
- `page-title-updated` … タイトル変更
- `page-favicon-updated` … ファビコン変更

## エラーページ
独自のエラーページを表示（Chromium デフォルトは使わない）：
- ネットワークエラー（`ERR_NAME_NOT_RESOLVED` 等）
- 証明書エラー
- 404 / 500（HTTPサーバから返ったもの）
- ブロック（マルウェア / フィッシング）

エラーページから「再試行」「設定確認」「報告」のアクションを提供。

## ローディング表示
- サイドバーのタブ項目にスピナー表示
- アドレスバー（コマンドバー入力欄相当）の左側に進捗バー
- 進捗：`did-start` 0% → response 30% → finish 100%

## ダウンロード判定
- HTTPレスポンスの `Content-Disposition: attachment` または既知バイナリMIMEはダウンロードへ
- 詳細は `22-downloads.md`

## クロスサイト遷移
- すべてのタブはサイト分離（Site Isolation）
- 異なるオリジンへの遷移時は新規プロセスへ
- Chromium のデフォルト挙動を踏襲

## ポップアップ・新規ウィンドウ
- `window.open` / `target=_blank` の挙動：
  - ユーザー操作起点 → 新規タブで開く（同じ Space）
  - スクリプト自動 → ブロック（設定で許可可能）
- Shift+Click → 新規ウィンドウ
- Cmd+Click → 新規タブ（バックグラウンド）

## プリフェッチ / プリレンダ
- DNSプリフェッチ：有効（Chromium デフォルト）
- リンクプリレンダ：無効（パフォーマンス・プライバシー観点）
- 設定で切替可

## 非機能要件
- URL 入力 → タブ表示開始まで 200ms 以内（ネットワーク除く）
- 履歴スタック保存はメモリ即時、永続化は debounce 1s

## スコープ外
- 独自リダイレクトルール（Boostsで対応）
- ナビゲーションログのエクスポート
