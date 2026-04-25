# 80. 設定 要件

## 概要
ユーザー設定 UI と、その永続化スキーマを定義する。

## 設定画面の起動
- `Cmd+,` （macOS 標準）
- コマンドバーから `/settings`
- `about:settings` URL

## 設定カテゴリ
| カテゴリ | 内容 |
|---|---|
| 一般 | 起動時の挙動 / デフォルト検索エンジン / 言語 |
| 外観 | テーマ / サイドバー幅 / フォント |
| Spaces | Space ごとの設定 |
| プロファイル | プロファイル管理（フェーズ2） |
| プライバシー | トラッカーブロック / Cookie / DNS |
| セキュリティ | HTTPS-only / 権限 |
| パフォーマンス | タブスリープ閾値 / メモリ上限 |
| ダウンロード | 保存先 / 確認動作 |
| ショートカット | キーバインド設定 |
| Boosts | Boost 一覧と編集 |
| AI | API キー / モデル / オプトイン |
| 拡張 | 拡張一覧（フェーズ2） |
| 同期 | アカウント / 同期項目（フェーズ3） |
| 詳細 | 実験的機能 / リセット |

## 設定スキーマ（抜粋）
```typescript
type Settings = {
  general: {
    onStartup: 'restore' | 'newTab' | 'specific';
    startupUrls?: string[];
    defaultSearchEngine: 'google' | 'duckduckgo' | 'bing' | 'kagi' | 'custom';
    customSearchUrl?: string;
    language: 'ja' | 'en';
  };
  appearance: {
    theme: 'light' | 'dark' | 'system';
    sidebarWidth: number;
    sidebarVisible: boolean;
    fontSize: 'small' | 'medium' | 'large';
  };
  privacy: {
    trackerBlocking: 'standard' | 'strict' | 'off';
    blockThirdPartyCookies: boolean;
    httpsMode: 'warn' | 'enforce';
    dohProvider: 'system' | 'cloudflare' | 'google' | 'nextdns' | 'custom';
    dohCustomUrl?: string;
  };
  performance: {
    tabSleepAfter: 15 | 60 | 720 | -1; // 分単位、-1 は無効
    archiveTabsAfter: 12 | 24 | 168 | 720 | -1; // 時間単位
    sleepPinnedTabs: boolean;
    cacheSizeMb: number;
  };
  downloads: {
    location: string; // パス
    promptForLocation: boolean;
    parallelLimit: number;
  };
  ai: {
    enabled: boolean;
    provider: 'anthropic' | 'openai' | 'local' | 'none';
    apiKey?: string; // Keychain 参照
    sendPageContent: 'never' | 'optIn' | 'always';
  };
  // ... 他カテゴリ
};
```

## 検索機能
- 設定画面の上部に検索バー
- 設定項目を全文検索
- 該当箇所へジャンプ + ハイライト

## デフォルトとリセット
- 各カテゴリに「デフォルトに戻す」ボタン
- 全体リセット：「すべての設定を初期化」（確認ダイアログ）
- リセットは UI / Boost / 履歴は対象外、設定値のみ

## エクスポート / インポート
- JSON 形式で全設定をエクスポート
- インポート時は競合をマージ
- 機微情報（API キー）はエクスポート対象外（明示的にチェックでのみ含める）

## 同期との関係
- 同期 ON 時は設定がデバイス間で同期
- 同期しない設定（マシン固有：ウィンドウ位置等）は明示的に除外

## 永続化
- 起動時必須の最小設定は `settings.json`
- それ以外は `data.db` の `settings` テーブル（KVS）
- 変更は debounce 200ms で書き込み

## 通知 / 確認
- 再起動が必要な設定変更時はバナー表示
- 危険な変更（Site Isolation オフ等）は二重確認

## 実験的機能（about:flags 相当）
- 詳細 → 実験的機能 で隠し機能をトグル
- 警告：「不安定になる可能性あり」
- 各フラグはコード内で参照可能

## 非機能要件
- 設定画面の起動：300ms 以内
- 設定変更の反映：即時（再起動が必要な場合は明示）

## スコープ外
- 管理者ロックされた設定（エンタープライズ向け）
- 設定の A/B テスト機構（フェーズ3 検討）
