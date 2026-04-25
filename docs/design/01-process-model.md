# 01. プロセスモデル

対応要件：[01-architecture.md](../requirements/01-architecture.md), [30-webview-integration.md](../requirements/30-webview-integration.md)

## Electron の 3 プロセス

```
┌─────────────────────────────────────────────────────┐
│ Main Process (Node.js)                              │
│ - app/window/tabs/storage/ipc/settings              │
│ - 唯一のソース・オブ・トゥルース                    │
│ - ファイル・DB・OS 統合                             │
└──────┬──────────────────────────────┬───────────────┘
       │ contextBridge                │ webContents API
       │ (preload)                    │
┌──────▼─────────────────┐  ┌─────────▼────────────────┐
│ Shell Renderer         │  │ WebContentsView × N      │
│ React + Zustand        │  │ - 各タブ = 1 インスタンス│
│ - サイドバー / UI 枠   │  │ - サイト分離（process    │
│ - WebView は持たない   │  │   per site instance）    │
│ contextIsolation: true │  │ - sandbox: true          │
│ sandbox: true          │  │                          │
└────────────────────────┘  └──────────────────────────┘
```

## プロセスごとの責務

### Main Process
- ウィンドウ・タブ・WebContentsView の生成と破棄
- SQLite 接続と全永続化
- 設定の読み書き
- IPC ハンドラ登録（`ipcMain.handle`）
- ナビゲーションイベントの集約と shell へのブロードキャスト
- OS 統合（メニュー / ショートカット / ファイル）
- セッション管理（Cookie / Cache）
- 自動更新（M2 以降）

### Preload Script
- `contextBridge.exposeInMainWorld('api', ...)` で型安全 API を window に注入
- 直接 Node API を露出しない
- 1 ファイルにまとめる（`src/preload/index.ts`）

### Shell Renderer
- ブラウザの「枠」UI のみ
- サイドバー・コマンドバー・タブヘッダ・エラーオーバーレイ
- WebView のコンテンツ自体は持たない（main 側の WebContentsView がオーバーレイ表示）
- IPC は preload 経由のみ。`require` 不可

### WebContentsView（タブ）
- 1 タブ = 1 インスタンス
- 中身は外部 Web ページ
- `sandbox: true`、`contextIsolation: true`
- サイト分離有効
- 直接シェルにアクセスする手段なし（Boost 用 isolated world のみ後フェーズで提供）

## ウィンドウ構造

`BrowserWindow` 1 つに対し：
- メインの `webContents`：Shell Renderer をロード
- N 個の `WebContentsView`：タブ。アクティブタブのみ最前面に配置

```
BrowserWindow
 ├─ webContents (shell)  ← React UI
 └─ contentView
     ├─ shell の DOM 領域全体
     └─ WebContentsView × N (アクティブのみ表示)
         └─ 配置: { x: sidebarWidth, y: 0, width: ..., height: ... }
```

WebContentsView の bounds はシェルから IPC で動的に通知される（サイドバー幅変更時など）。

## セキュリティ既定値

すべての `webPreferences` で以下を強制：
```typescript
{
  contextIsolation: true,
  sandbox: true,
  nodeIntegration: false,
  webSecurity: true,
  allowRunningInsecureContent: false,
  experimentalFeatures: false,
}
```

main プロセスは `app.enableSandbox()` を起動時に呼ぶ。

## プロセス間の通信パターン

### コマンド（renderer → main、応答あり）
```typescript
// renderer
const tabId = await window.api.tab.create({ url: 'https://...' });

// main
ipcMain.handle('tab.create', async (_event, payload) => {
  return tabManager.create(payload);
});
```

### イベント（main → renderer、ブロードキャスト）
```typescript
// main
mainWindow.webContents.send('tab.event', { tabId, type: 'title-updated', payload });

// renderer
window.api.on('tab.event', (e) => store.applyTabEvent(e));
```

### renderer → renderer
原則禁止。main を経由する。

## クラッシュ分離

| プロセスがクラッシュ | 影響 | 復旧 |
|---|---|---|
| Main | アプリ全体停止 | 自動再起動（`90-update-telemetry.md` の crash report 経由） |
| Shell Renderer | UI のみ停止、タブの WebContents は生存 | shell renderer のみ reload |
| WebContentsView (タブ) | 該当タブのみ | エラーページ + 再読込ボタン |

shell renderer のクラッシュ時、main は WebContentsView を保持しているため、reload 後にタブ状態を復元できる。

## 起動シーケンス（概略）
詳細は [10-key-flows.md](10-key-flows.md) を参照。

1. main: `app.whenReady` → DB 接続 → 設定読込
2. main: `BrowserWindow` 生成、preload 注入
3. main: shell renderer URL を load
4. shell: 起動時 IPC で全状態（tabs / spaces / settings）を取得
5. shell: ストアにハイドレート
6. shell: 直近アクティブタブの WebContentsView を生成依頼
7. main: WebContentsView 生成 + URL ロード
8. ユーザー操作可能

## 開発時のリロード

- shell renderer：Vite HMR で即時
- main：`scripts/dev-main.mjs` がファイル変更検知で Electron 再起動
- preload：main の再起動と連動

## 開放的決定事項（M1 PoC で確定）
- WebContentsView か `<webview>` タグか：WebContentsView を第一選択（より軽量・安定）
- shell ↔ main の IPC は invoke/handle のみか、ストリーム転送が必要なケースの扱い
