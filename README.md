# Browser (prototype)

Arc 風 ブラウザのプロトタイプ。Electron + TypeScript + React + Vite + Zustand + better-sqlite3。

## ディレクトリ
```
src/
├── main/        # メインプロセス（Node.js / Electron）
├── preload/     # contextBridge
├── shell/      # ブラウザシェル UI（React）
└── shared/     # 両側で共有する型定義
docs/
├── requirements/  # 要件書
└── design/       # 詳細設計
legacy/         # 旧学習用 CLI（参考）
```

詳細は [docs/requirements/](docs/requirements/) と [docs/design/](docs/design/) を参照。

## セットアップ
```bash
npm install
npm run rebuild        # better-sqlite3 を Electron 用に再ビルド
```

## 開発
```bash
npm run dev
```
Vite dev サーバ + esbuild watch + Electron が同時起動する。
ファイル変更で自動リロードされる。

### 操作
| 操作 | 動作 |
|---|---|
| `Cmd+T` | コマンドバー（新規タブモード） |
| `Cmd+L` | コマンドバー（URL 編集モード） |
| `Cmd+W` | アクティブタブを閉じる（アーカイブ行き） |
| `Cmd+R` | リロード |
| `Cmd+Shift+R` | 強制リロード |
| `Cmd+[` / `Cmd+]` | 戻る / 進む |

サイドバー右端をドラッグで幅変更。

## ビルド
```bash
npm run build
npm run start          # 製品ビルドを起動
npm run package        # macOS 用 .dmg を生成
```

## 型チェック
```bash
npm run typecheck
```

## 既知の制約（プロトタイプ範囲）
- Space は単一固定（"Default"）
- Pinned / Favorite UI 未実装（state は持つ）
- アーカイブ画面・Space 切替・複数 Space ・ドラッグ&ドロップ なし
- 設定 UI なし（最小限の値はコード内固定）
- discard / 自動アーカイブ未実装（全タブ メモリ常駐）
- Boosts / AI / 拡張 / プロファイル / 同期 すべて未実装

[99-roadmap.md](docs/requirements/99-roadmap.md) の M1 範囲のうち、コア機能に絞った状態。

## トラブルシュート
### `npm run dev` で `Cannot find module 'better-sqlite3'` 等
```bash
npm run rebuild
```
で Electron バージョンに合わせてネイティブモジュールを再ビルドする。

### 開発時に WebView がサイドバーに被る
ウィンドウをリサイズすると `ResizeObserver` が再発火して矩形を再計算する。
