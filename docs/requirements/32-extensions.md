# 32. 拡張機能 要件（フェーズ2 以降）

## 方針
フェーズ1 では拡張機能をサポートしない。Boosts で大半のカスタマイズニーズに対応する想定。
フェーズ2 以降で「主要 Chrome 拡張のサブセット互換」を目指す。

## サポート目標
### 優先実装したい拡張カテゴリ
1. 広告ブロック（uBlock Origin）
2. パスワードマネージャ（1Password / Bitwarden）
3. 翻訳（DeepL, Google翻訳）
4. リーダー / ハイライト（Pocket, Raindrop）
5. 開発者ツール（React DevTools, Vue DevTools）

### 必要な API サブセット
- `chrome.runtime`
- `chrome.storage` (local / sync)
- `chrome.tabs`
- `chrome.webRequest` / `chrome.declarativeNetRequest`（広告ブロック必須）
- `chrome.contextMenus`
- `chrome.commands`（ショートカット）
- `chrome.scripting`
- Manifest V3 を主要対応、V2 はベストエフォート

## 配布チャネル
- **オプション A**：Chrome Web Store からのインストール許可（`crx` 互換）
- **オプション B**：独自ストアのみ（厳選キュレーション）
- **オプション C**：開発者モード（`unpacked` ロード）のみ

第一候補は A（互換性優先）。ただしストア API は Google が他ブラウザ向けに開放していないため、ユーザーが crx URL を直接指定する形を取る可能性が高い。

## サンドボックス
- Electron 採用時：Chromium の拡張サンドボックスをそのまま利用
- Tauri 採用時：独自のサンドボックス実装が必要（実現性低）→ Electron 採用が事実上必須となる可能性

## UI
- `about:extensions` で一覧・有効/無効・アンインストール
- ツールバーアイコン領域：サイドバー上部の Pinned 横、または別領域
- ポップアップは Arc のスタイルに合わせて設計

## 権限・セキュリティ
- インストール時に要求権限を表示
- ホストパーミッションごとに「許可するドメイン」を限定可能
- `webRequest` 系は広告ブロック以外用途では警告
- 拡張のクラッシュは他タブ・シェルに波及しない

## 非機能要件
- 拡張インストール後の起動オーバーヘッド：1 拡張あたり < 50ms
- 拡張による Web ページ遅延：< 10% （ベンチで継続計測）

## スコープ外
- すべての Chrome 拡張のフル互換（V2 完全互換は目指さない）
- Firefox 拡張（WebExtension）の同時サポート
- ネイティブメッセージング

## 公開課題
- ライセンス・法務（Chrome Web Store からの直接インストール可否）
- セキュリティレビュー体制（独自ストア採用時）
- 採用判断は M3 で再検討
