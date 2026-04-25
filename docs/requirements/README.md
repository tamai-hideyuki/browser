# 要件書

Arc ブラウザ相当の体験を目指すブラウザの要件定義。責務ごとにファイルを分割している。

## 読む順序
1. **[00-overview.md](00-overview.md)** から開始（ビジョン・スコープ）
2. **[01-architecture.md](01-architecture.md)** で全体構造を把握
3. **[99-roadmap.md](99-roadmap.md)** でマイルストーンを確認
4. 興味のあるドメインのファイルへ

## ファイル一覧

### 全体
| # | ファイル | 内容 |
|---|---|---|
| 00 | [overview](00-overview.md) | ビジョン・スコープ・用語 |
| 01 | [architecture](01-architecture.md) | プロセスモデル・モジュール構成・技術選定 |

### UI シェル
| # | ファイル | 内容 |
|---|---|---|
| 10 | [shell-ui](10-shell-ui.md) | ウィンドウ・サイドバー・テーマ |
| 11 | [tabs-spaces](11-tabs-spaces.md) | タブ・Space・アーカイブ・Little Arc |
| 12 | [command-bar](12-command-bar.md) | コマンドバー |
| 13 | [shortcuts](13-shortcuts.md) | キーボードショートカット |

### Web 周辺
| # | ファイル | 内容 |
|---|---|---|
| 20 | [navigation](20-navigation.md) | URL 解決・履歴スタック・エラー |
| 21 | [bookmarks-history](21-bookmarks-history.md) | ピン・履歴・インポート |
| 22 | [downloads](22-downloads.md) | ダウンロード管理 |
| 23 | [media](23-media.md) | 動画・音声・PIP・メディアキー |
| 24 | [pdf-print](24-pdf-print.md) | PDF 閲覧・印刷 |
| 25 | [os-integration](25-os-integration.md) | デフォルトブラウザ・URL ハンドラ・共有 |
| 26 | [onboarding](26-onboarding.md) | 初回起動 UX・インポート導線 |

### WebView / 拡張
| # | ファイル | 内容 |
|---|---|---|
| 30 | [webview-integration](30-webview-integration.md) | Chromium 埋め込み・IPC |
| 31 | [boosts](31-boosts.md) | サイトごとの CSS / JS 注入 |
| 32 | [extensions](32-extensions.md) | 拡張機能（フェーズ2 以降） |

### データ
| # | ファイル | 内容 |
|---|---|---|
| 40 | [profiles-sync](40-profiles-sync.md) | プロファイル・同期 |
| 41 | [storage](41-storage.md) | SQLite スキーマ・ファイル配置 |

### 横断
| # | ファイル | 内容 |
|---|---|---|
| 50 | [security-privacy](50-security-privacy.md) | サンドボックス・トラッカーブロック |
| 60 | [performance](60-performance.md) | メモリ・起動・タブスリープ |
| 70 | [ai-features](70-ai-features.md) | 要約・Ask on Page・モデル選択 |
| 80 | [settings](80-settings.md) | 設定 UI とスキーマ |
| 90 | [update-telemetry](90-update-telemetry.md) | 自動更新・クラッシュ・統計 |

### ロードマップ
| # | ファイル | 内容 |
|---|---|---|
| 99 | [roadmap](99-roadmap.md) | M0〜M3 のマイルストーン |

## 更新ルール
- 実装と要件書がズレた場合、要件書を真実源として更新する
- 各 PR では関連ファイル番号（例：`refs #21`）を必ず参照
- マイルストーン終了時に全体をレビュー
