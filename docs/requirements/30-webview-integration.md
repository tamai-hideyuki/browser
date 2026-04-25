# 30. WebView 統合 要件

## 概要
Chromium ベース WebView を埋め込み、Web ページのレンダリングを委譲する。本層は WebView の生成・破棄・通信・イベントハンドリングに責任を持つ。

## 採用技術
- **Tauri 採用時**：OS の WebView（macOS: WKWebView, Windows: WebView2, Linux: WebKitGTK）
- **Electron 採用時**：`BrowserView` / `WebContentsView`（Chromium）
- 両者の差は M0 PoC で評価。本要件は両対応で記述する。

> Tauri は OS 提供 WebView のため、macOS では WebKit、Windows では Chromium となり挙動差がある。Electron は全 OS で Chromium 統一。Web 互換性を優先するなら Electron 寄り。

## WebView ライフサイクル
| 状態 | 説明 |
|---|---|
| `created` | インスタンス生成。URL 未読込 |
| `loading` | ページ読込中 |
| `loaded` | 読込完了 |
| `discarded` | メモリ解放済み（メタ情報のみ保持） |
| `crashed` | レンダラプロセスクラッシュ |
| `destroyed` | 破棄済み |

### Discard（タブスリープ）
- 一定時間アクティブでない `today` タブを discard し、メモリ解放
- discard 時：URL / タイトル / スクロール位置 / フォーム未入力テキストを保存
- 再アクティブ化時に復元
- `60-performance.md` 参照

## イベント API
WebView から購読するイベント（メインプロセスで集約 → IPC でシェルへ）：

### ナビゲーション系
- `did-start-navigation` → URL / isMainFrame
- `did-redirect-navigation`
- `did-finish-navigation`
- `did-fail-load` → errorCode / errorDescription
- `did-finish-load`

### ページ情報系
- `page-title-updated` → タイトル
- `page-favicon-updated` → ファビコンURL
- `did-change-theme-color` → テーマカラー（メタタグ）

### ユーザー操作系
- `before-input-event` → キー入力（ショートカット競合判定）
- `context-menu` → 右クリック

### プロセス・セキュリティ系
- `render-process-gone` → クラッシュ / kill
- `unresponsive` → ハング検出
- `responsive` → 復帰
- `certificate-error`

### メディア系
- `media-started-playing` / `media-paused`
- `audio-state-changed` → ミュートUI に反映

## メインプロセス → WebView の制御 API
- `loadURL(url)`
- `reload(opts: {ignoreCache?: boolean})`
- `stop()`
- `goBack()` / `goForward()`
- `executeJavaScript(code)` → Boost / DevTools 用
- `setZoomLevel(level)`
- `setUserAgent(ua)`
- `capturePage(rect?)` → プレビュー / スクショ用
- `print(opts)`
- `findInPage(text, opts)` / `stopFindInPage()`
- `discard()` / `restore()`

## IPC 設計
### シェル → メイン
- `tab.create({url, spaceId})` → `{tabId}`
- `tab.activate(tabId)`
- `tab.close(tabId)`
- `tab.navigate(tabId, url)`
- `tab.goBack(tabId)` / `goForward`
- `tab.executeAction(tabId, action)` → リロード等

### メイン → シェル
- `tab.event` { tabId, event, payload } の単一チャネル
- イベント名は上記 WebView イベントを再パブリッシュ
- ペイロードは型定義で `shared/types/ipc.ts` に集約

## サイト分離
- Chromium デフォルトの Site Isolation 有効
- `process-per-site-instance` を採用
- クロスオリジン iframe は別プロセス

## クッキー / ストレージ
- WebView ごとの Session でプロファイル分離
- 詳細は `41-storage.md`

## ネットワーク介入
- `webRequest` API でリクエスト/レスポンスをフック
- 用途：
  - トラッカーブロック（`50-security-privacy.md`）
  - User-Agent 設定
  - Boost のリソース置換
- パフォーマンス影響を計測し、不要なフックは外す

## DevTools
- 各 WebView に DevTools を接続可能
- `Cmd+Option+I` でアクティブタブの DevTools を別ウィンドウで起動
- リモートデバッグポート（dev ビルドのみ）

## クラッシュ処理
- `render-process-gone` → エラーページ表示 + 再読込ボタン
- 5 分以内に同タブで 3 回クラッシュした場合、自動再読込を停止
- クラッシュレポートは `90-update-telemetry.md` に従い送信（オプトイン）

## 非機能要件
- 新規タブ生成からURL読込開始まで 100ms 以内
- discard → restore の体感所要時間 200ms 以内
- IPC ラウンドトリップ 5ms 以内（同一マシン）

## スコープ外
- 独自 WebView エンジンの実装
- Chromium のフォーク / カスタムビルド
