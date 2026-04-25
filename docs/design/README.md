# 詳細設計（M1 / MVP）

[要件書](../requirements/README.md) を実装に落とすための詳細設計。スコープは [99-roadmap.md](../requirements/99-roadmap.md) の M1 のみ。

## 確定済みスタック
| 項目 | 採用 |
|---|---|
| シェルフレームワーク | Electron |
| 言語 | TypeScript |
| UI | React + Vite |
| 状態管理 | Zustand |
| DB | better-sqlite3 |
| バリデーション | zod |
| テスト | vitest |
| ビルド | Vite (renderer) + esbuild (main) |

## ファイル一覧
| # | ファイル | 内容 | 対応する要件 |
|---|---|---|---|
| 00 | [project-structure](00-project-structure.md) | ディレクトリ・ビルド・ツール構成 | 01 |
| 01 | [process-model](01-process-model.md) | main / renderer / WebView の責務 | 01, 30 |
| 02 | [ipc-contract](02-ipc-contract.md) | IPC メッセージ TS 型定義 | 30 |
| 03 | [data-model](03-data-model.md) | SQLite スキーマ・Repository | 41 |
| 04 | [state-management](04-state-management.md) | Zustand ストア設計 | 10, 11 |
| 05 | [tab-lifecycle](05-tab-lifecycle.md) | タブ状態遷移・discard | 11, 30, 60 |
| 06 | [sidebar](06-sidebar.md) | サイドバー UI コンポーネント | 10, 11 |
| 07 | [command-bar](07-command-bar.md) | 候補生成・ランキング | 12 |
| 08 | [navigation](08-navigation.md) | URL 解決・履歴スタック | 20 |
| 09 | [settings](09-settings.md) | 設定スキーマ・永続化 | 80 |
| 10 | [key-flows](10-key-flows.md) | 主要フローのシーケンス図 | 横断 |

## 読む順序
1. [00-project-structure](00-project-structure.md) → 何をどこに書くか
2. [01-process-model](01-process-model.md) → プロセス境界の理解
3. [02-ipc-contract](02-ipc-contract.md) → 通信契約
4. [03-data-model](03-data-model.md) → 永続化の型
5. [04-state-management](04-state-management.md) 以降は領域別に必要な順で

## 更新ルール
- 実装と設計がズレたら、設計書を真実源として更新
- 要件書（`docs/requirements/`）が更新されたら、対応する設計書も連動して見直す
- M1 完了時に M2 用の設計書を別途追加
