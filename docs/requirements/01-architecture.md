# 01. アーキテクチャ要件

## 技術選定
| レイヤ | 採用 | 理由 |
|---|---|---|
| シェルフレームワーク | **Tauri 2.x** （第一候補） / Electron （第二候補） | Tauriはバイナリ軽量・OS WebView活用。EltronはChromium同梱で互換性高く実績豊富 |
| レンダラ | 埋め込み Chromium（`WebContentsView` / `WKWebView` 等） | Web互換性をベンダに委譲 |
| シェルUI | TypeScript + React or Solid + Vite | エコシステム成熟・宣言的UIで状態管理が楽 |
| 状態管理 | Zustand or Jotai | Redux はオーバースペック |
| 永続化 | SQLite (better-sqlite3 / sqlx) | 履歴・タブ・ブックマークの構造化保存に最適 |
| IPC | Tauri commands / Electron IPC | フレームワーク標準 |

> 最終決定は `99-roadmap.md` の M0 で PoC を経て確定する。

## プロセスモデル
```
┌─────────────────────────────────────────────────┐
│  Main Process (Rust / Node)                     │
│  - ウィンドウ管理 / IPC / SQLite / 設定         │
└──────┬──────────────────────────────┬───────────┘
       │                              │
┌──────▼──────────┐         ┌─────────▼──────────┐
│ Shell Renderer  │         │ Web Renderer × N   │
│ サイドバー / UI │         │ ページ毎に分離     │
│ (React / TS)    │         │ (Chromium)         │
└─────────────────┘         └────────────────────┘
```

- **Main Process**：唯一のソース・オブ・トゥルース。永続化・OS統合・タブ生成。
- **Shell Renderer**：ブラウザのChrome（UI枠）。WebView を持たない。
- **Web Renderer**：各タブ＝独立した WebView インスタンス。サイト分離。

## モジュール構成（シェル側）
```
src/
├── main/                  # メインプロセス
│   ├── window/            # ウィンドウ生命周期
│   ├── tabs/              # タブ・WebView管理
│   ├── storage/           # SQLite ラッパ
│   ├── ipc/               # IPC ルーティング
│   └── settings/          # 設定読み書き
├── shell/                 # レンダラ：ブラウザUI
│   ├── sidebar/
│   ├── command-bar/
│   ├── tabs/
│   └── theme/
└── shared/                # 共通型・定数
    └── types/
```

## 依存方向の原則
- `shell` は IPC を介してのみ `main` に依存。直接 import は禁止。
- `shared/types` は両側から参照可。実装は含めない。
- WebView の中身（Webページ自身）からシェルへの直接アクセスは Boost 用 API のみ許可。

## ビルド・配布
- 開発：`pnpm dev` でホットリロード
- リリース：macOS は `.dmg` 署名・公証込み、Windows は `.msi`、Linux は `.AppImage`
- 自動更新は `90-update-telemetry.md` を参照

## 既存コードの扱い
- 現在の `src/http`, `src/tokenizer`, `src/tree`, `src/render` は学習用CLI。
- フェーズ1着手時に `legacy/` へ退避するか、別リポジトリに分離する。
- 本プロジェクトでは **Chromium に委譲するため再利用しない**。

## 開放的決定事項
- Tauri vs Electron の最終決定（M0 PoC で確定）
- Chromium バージョン追従戦略（Electron 採用時のみ問題）
- Rust / Node どちらをメインプロセス言語にするか
