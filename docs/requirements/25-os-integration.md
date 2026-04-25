# 25. OS 統合 要件

## 概要
ブラウザがアプリ単体で完結せず、OS の他アプリやサービスと連携する仕組み。Arc の体験は OS 統合の質に強く依存する。

## デフォルトブラウザ登録
### 機能
- 設定 → 一般 →「デフォルトブラウザに設定」ボタン
- 起動時にデフォルトブラウザでないことを検出 → バナー表示（オプトアウト可）
- インストール時にも案内

### macOS
- `app.setAsDefaultProtocolClient('http')` / `'https'`
- システム環境設定の関連付けに登録される
- 確認ダイアログは macOS 側が出す

### Windows
- レジストリ書き込み（インストーラ経由）
- Windows 10+ ではユーザー操作必須（プログラム経由で勝手に変更不可）
- 設定アプリのデフォルトアプリ画面を開く案内

### Linux
- xdg-mime / xdg-settings での登録
- ディストリビューション差はベストエフォート

## URL プロトコルハンドラ
登録するプロトコル：
- `http`, `https`：標準
- `mailto`, `webcal`：他アプリへ転送（メールクライアント等）→ M2 以降
- 独自：`browser://`（ディープリンク）→ アプリ起動時の引数に埋め込み

### ディープリンク仕様（独自）
| URL | 動作 |
|---|---|
| `browser://open?url=https://...` | 指定 URL を新規タブで開く |
| `browser://space/<id>` | 指定 Space に切替 |
| `browser://settings/<category>` | 設定画面を該当カテゴリで開く |
| `browser://search?q=<query>` | コマンドバーを開いた状態で起動 |

他アプリ・コマンドラインから操作可能：
```
$ open "browser://open?url=https://example.com"
```

## ファイル関連付け
登録する MIME / 拡張子：
| 拡張子 | MIME | 動作 |
|---|---|---|
| `.html`, `.htm` | text/html | ブラウザで開く |
| `.pdf` | application/pdf | ブラウザで開く（[24-pdf-print.md](24-pdf-print.md)） |
| `.webloc` (mac) | URL ショートカット | URL を抽出して開く |
| `.url` (win) | 同上 | 同上 |

ローカルファイルのドラッグ&ドロップにも対応。

## 共有（Share）
### macOS Share Extension
他アプリから「共有 →（このブラウザ）」で URL や選択テキストを送信できる：
- URL → 新規タブで開く
- テキスト → コマンドバーに「テキストで検索」状態で起動
- 画像 → 新規タブで画像検索

実装：macOS の Share Extension（Swift で書いた小さな拡張、メインアプリにバンドル）。
M1 では実装スコープ外。M2 以降。

### Windows Share
M2 以降検討。

### ブラウザから OS への共有
ページの「共有」メニュー（Web Share API）：
- Web Share API をサイトが使っている場合、OS のシェアシートを表示
- macOS では `NSSharingServicePicker` 相当
- Web Share API は Chromium 標準対応

## macOS Services メニュー
他アプリのテキスト選択 → サービス →「ブラウザで検索」「ブラウザで開く」を提供。
M2 以降。

## Spotlight 統合（macOS）
履歴・ブックマークを Spotlight で検索可能にする：
- Core Spotlight API でインデックス化
- プライバシー観点でデフォルト OFF
- 設定でオプトイン

M2 以降。

## ジャンプリスト（Windows）
タスクバー右クリックで：
- 新規ウィンドウ
- プライベートウィンドウ
- 直近の Space 切替
- よく使うサイト

M2 以降。

## ドックメニュー（macOS）
ドックアイコン右クリックで：
- 新規ウィンドウ
- プライベートウィンドウ
- 開いているタブ一覧（M2）

M1 では基本のみ。

## メニューバー / アプリメニュー
標準的なアプリメニューを提供：
- アプリ名 / 設定 / 終了
- ファイル：新規タブ / 新規ウィンドウ / 開く / 保存 / 印刷 / 閉じる
- 編集：取り消し / やり直し / コピー / ペースト / 検索
- 表示：ズーム / フルスクリーン / リロード / 開発者ツール
- 履歴：戻る / 進む / 履歴を表示 / アーカイブ
- ブックマーク：追加 / 表示
- ウィンドウ：最小化 / ズーム / 全タブ表示 / Space切替
- ヘルプ：ドキュメント / フィードバック / バージョン情報

ショートカットは [13-shortcuts.md](13-shortcuts.md) と一致。

## Touch Bar（macOS）
M2 以降。Apple Silicon の MacBook には搭載なし、優先度低。

## 通知センター
- ダウンロード完了通知
- AI 機能の生成完了（M2）
- ブラウザの重要更新

実装：`new Notification(...)` または Electron `Notification` クラス。

## クリップボード統合
- 標準的なコピー / ペースト
- リッチテキスト・HTML・画像の双方向
- ペーストボード履歴は OS に委譲

## デバイス間連携
### macOS Handoff
他 Mac / iPhone で開いていたページを引き継ぎ可能（NSUserActivity）。
M3 以降。

### URL 共有（Phone → Mac）
独自同期の一部として M3 で実装（[40-profiles-sync.md](40-profiles-sync.md)）。

## OS 認証
- Touch ID / Windows Hello でブラウザロック解除（M3 以降）
- パスキー対応：WebAuthn は Chromium 標準

## システム設定の追従
- ライト/ダークモード（システム連動）
- アクセントカラー
- フォントサイズ
- 「視差効果を減らす」「透明度を減らす」設定

## エクスポート用 OS API
- 画像書き出し（NSPasteboard / クリップボード）
- スクリーンショット保存

## 起動時引数
コマンドライン引数で制御可能：
- `--url <url>`：起動時にタブを開く
- `--space <id>`：指定 Space を起動時にアクティブ
- `--private`：プライベートウィンドウで起動

## 単一インスタンス / 多重起動
- デフォルト：単一インスタンス（既存ウィンドウにフォーカス）
- 二重起動時は引数（URL）を既存インスタンスに転送
- Electron の `requestSingleInstanceLock` を使用

## 非機能要件
- 起動時引数の解析・転送：100ms 以内
- 共有受信からタブ表示まで：500ms 以内
- システムテーマ変更の追従：即時

## 開放的決定事項
- macOS Share Extension の実装言語と署名
- Spotlight 統合のプライバシーデフォルト

## スコープ外（M1）
- macOS Share Extension
- Windows Share
- Spotlight / Services / Touch Bar
- Handoff
