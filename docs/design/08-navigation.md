# 08. ナビゲーション

対応要件：[20-navigation.md](../requirements/20-navigation.md)

## 担当範囲
- URL 文字列の解決（コマンドバー入力 → 実 URL）
- タブごとの履歴スタック（戻る / 進む）
- ナビゲーションイベントのフック
- エラーページの提供
- ポップアップ / 新規タブ要求の制御

## URL 解決

```typescript
// src/main/navigation/url-resolver.ts
import type { Settings } from '@shared/types/settings';

export function resolveUrl(input: string, settings: Settings): string {
  const trimmed = input.trim();
  if (trimmed === '') return 'about:blank';

  // 内部 URL
  if (trimmed.startsWith('about:')) return trimmed;
  if (/^[a-z]+:\/\//i.test(trimmed)) return trimmed;

  // localhost / IP
  if (/^localhost(:\d+)?(\/.*)?$/.test(trimmed)) return `http://${trimmed}`;
  if (/^\d{1,3}(\.\d{1,3}){3}(:\d+)?(\/.*)?$/.test(trimmed)) return `http://${trimmed}`;

  // ドット含む（ドメインらしい）
  if (/\.[a-z]{2,}/i.test(trimmed) && !/\s/.test(trimmed)) return `https://${trimmed}`;

  // 検索クエリ
  return buildSearchUrl(trimmed, settings.general.defaultSearchEngine, settings.general.customSearchUrl);
}

export function buildSearchUrl(query: string, engine: string, customUrl?: string): string {
  const tpl = SEARCH_TEMPLATES[engine] ?? customUrl ?? SEARCH_TEMPLATES.google;
  return tpl.replace('%s', encodeURIComponent(query));
}

const SEARCH_TEMPLATES: Record<string, string> = {
  google:     'https://www.google.com/search?q=%s',
  duckduckgo: 'https://duckduckgo.com/?q=%s',
  bing:       'https://www.bing.com/search?q=%s',
  kagi:       'https://kagi.com/search?q=%s',
};
```

shell 側でも同関数を使えるよう、`src/shared/navigation/url-resolver.ts` に置いて両方で使う案も検討。M1 は main 側で一元化（コマンドバー実行時に `tab.create` 経由で main に渡す）。

## 内部 URL（about:）

| URL | 用途 | 実装 |
|---|---|---|
| `about:blank` | 空ページ | Chromium 標準 |
| `about:settings` | 設定画面 | 専用 renderer ページ |
| `about:history` | 履歴 | 同上 |
| `about:archive` | アーカイブ | 同上 |
| `about:downloads` | ダウンロード | 同上 |
| `about:debug` | 開発者向け | dev ビルドのみ |

`about:` ページは別 renderer（または同 shell の別ルート）として実装。Electron の `protocol.handle` で独自プロトコルを登録する。

```typescript
// src/main/app/protocol.ts
import { protocol, net } from 'electron';

export function registerAboutProtocol() {
  protocol.handle('about', async (req) => {
    const route = req.url.replace(/^about:\/\//, '').replace(/^about:/, '');
    const fileUrl = `file://${path.join(buildDir, 'about', route, 'index.html')}`;
    return net.fetch(fileUrl);
  });
}
```

## 履歴スタック

タブごとに保持。Chromium の WebContents が持つナビゲーション履歴とは別管理（より詳細な制御のため）。

```typescript
// src/main/navigation/history-stack.ts
export type NavEntry = {
  url: string;
  title: string;
  visitedAt: number;
};

export class NavHistoryStack {
  private stack: NavEntry[] = [];
  private cursor = -1;

  push(entry: NavEntry): void {
    // cursor 以降を破棄してから追加
    this.stack = this.stack.slice(0, this.cursor + 1);
    this.stack.push(entry);
    this.cursor = this.stack.length - 1;
    if (this.stack.length > 100) this.stack.shift(), this.cursor--;
  }

  canGoBack(): boolean { return this.cursor > 0; }
  canGoForward(): boolean { return this.cursor < this.stack.length - 1; }
  goBack(): NavEntry | null {
    if (!this.canGoBack()) return null;
    return this.stack[--this.cursor];
  }
  goForward(): NavEntry | null {
    if (!this.canGoForward()) return null;
    return this.stack[++this.cursor];
  }
  current(): NavEntry | null {
    return this.stack[this.cursor] ?? null;
  }
}
```

実装簡略化のため、M1 は **Chromium の navigation history をそのまま使う**選択肢も検討。`webContents.canGoBack()` / `goBack()` が標準提供されるため。本ドキュメントは独自スタックで設計しているが、実装時に再評価する。

## ナビゲーション操作

```typescript
// src/main/tabs/tab-manager.ts に追加
navigate(tabId: TabId, rawUrl: string): void {
  const rec = this.records.get(tabId);
  if (!rec) throw new TabNotFoundError(tabId);
  if (!rec.view) this.mountView(tabId);
  const url = resolveUrl(rawUrl, this.settings.getAll());
  rec.view!.webContents.loadURL(url);
}

goBack(tabId: TabId): void {
  const rec = this.records.get(tabId);
  if (rec?.view?.webContents.canGoBack()) {
    rec.view.webContents.goBack();
  }
}

goForward(tabId: TabId): void {
  const rec = this.records.get(tabId);
  if (rec?.view?.webContents.canGoForward()) {
    rec.view.webContents.goForward();
  }
}

reload(tabId: TabId, opts?: { ignoreCache?: boolean }): void {
  const rec = this.records.get(tabId);
  if (!rec) return;
  if (!rec.view) this.mountView(tabId);
  if (opts?.ignoreCache) rec.view!.webContents.reloadIgnoringCache();
  else rec.view!.webContents.reload();
}

stop(tabId: TabId): void {
  this.records.get(tabId)?.view?.webContents.stop();
}
```

## エラーページ

`did-fail-load` を購読し、専用エラーページを表示する。

```typescript
view.webContents.on('did-fail-load', (_e, errorCode, errorDescription, validatedURL, isMainFrame) => {
  if (!isMainFrame) return;
  if (errorCode === -3) return;  // ERR_ABORTED は無視（ユーザー操作）
  this.broadcaster.emit({ kind: 'navigation.error', tabId, errorCode: errorCodeToString(errorCode), url: validatedURL });
  // エラーページ HTML を data: URL でロード
  const html = renderErrorPage({ code: errorCode, desc: errorDescription, url: validatedURL });
  view.webContents.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
});
```

エラーページはシンプルな静的 HTML：
- エラーコード / 簡潔なメッセージ
- 元の URL
- 「再試行」ボタン（リンクで `javascript:location.reload()` 不可なので、shell 側のオーバーレイで対応する案も検討）
- 「ホームに戻る」

代替案：エラーページを shell の React コンポーネントとしてオーバーレイ表示する（より制御しやすい）。M1 はこちらを推奨。

```typescript
// shell 側
function ErrorOverlay() {
  const error = useTabsStore((s) => s.activeTabError);
  if (!error) return null;
  return (
    <div className="error-overlay">
      <h1>このページに到達できませんでした</h1>
      <p className="url">{error.url}</p>
      <p className="code">{error.code}</p>
      <button onClick={() => useTabsStore.getState().reload()}>再試行</button>
    </div>
  );
}
```

## ローディング表示

shell 側で `loading` / `loadProgress` を観察：
- サイドバーのタブ項目：ファビコン位置にスピナー
- アドレスバー（コマンドバー入力欄相当）の下に細い進捗バー（M1 では `loadProgress` をそのまま幅に）

```typescript
// 進捗の更新は did-start / did-receive-response / did-finish
view.webContents.on('did-start-loading', () => emit(0));
view.webContents.on('did-finish-load', () => emit(1));
// did-receive-response の細かい進捗は M1 では取らない（簡易に 0 / 0.5 / 1 の3段階）
```

## ポップアップ / 新規ウィンドウ

`webContents.setWindowOpenHandler` で全制御：

```typescript
view.webContents.setWindowOpenHandler(({ url, disposition }) => {
  // disposition: 'default' | 'foreground-tab' | 'background-tab' | 'new-window' | 'save-to-disk' | 'other'

  if (disposition === 'save-to-disk') {
    return { action: 'allow' };  // ダウンロード扱いに
  }

  // ユーザーアクション起点（target=_blank, Shift+Click 等）→ 新規タブ
  this.tabs.create({
    url,
    spaceId: this.activeSpaceId(),
    background: disposition === 'background-tab',
  });
  return { action: 'deny' };
});
```

スクリプト起点（ユーザー操作なし）の `window.open` は `webContents.on('will-navigate')` で検知してブロック可能。M1 はデフォルトの Chromium 挙動に従い、ポップアップブロッカーは導入しない。

## DNS / プリフェッチ
- DNS プリフェッチ：Chromium デフォルト ON（M1 では変更しない）
- リソースプリレンダ：M1 では無効
- DoH：M2 以降で `50-security-privacy.md` に基づき設定

## 履歴記録

`did-navigate`（main frame）でのみ記録：

```typescript
view.webContents.on('did-navigate', (_e, url) => {
  if (url.startsWith('about:') || url.startsWith('chrome:')) return;
  if (this.session === privateSession) return;  // M2 以降
  HistoryRepository.record({
    url,
    title: rec.meta.title,         // 直後の page-title-updated で更新される
    visitedAt: Date.now(),
    spaceId: rec.meta.spaceId,
  });
});
```

`page-title-updated` 時に直近のエントリのタイトルを `UPDATE` する：
```sql
UPDATE history SET title = ? WHERE id = (SELECT MAX(id) FROM history WHERE url = ?);
```

## トラックパッドスワイプ
- macOS：`webContents.on('swipe', ...)` で前後遷移
- 設定で ON/OFF（デフォルト ON）

## キーボード経由のナビゲーション
- `Cmd+[` / `Cmd+]`：前後（メニューアクセラレータで処理）
- `Cmd+R`：リロード
- `Cmd+Shift+R`：強制リロード
- `ESC`：停止

## 不変条件
- アクティブタブの WebContents 上のロード操作のみがエラー UI を発火
- バックグラウンドタブのロード失敗は静かに記録（ファビコンに小さな印を付ける程度）
- `archived` タブは navigate しない（mount からやり直し）

## テスト
- URL 解決のユニットテスト（多数のケース）
- 履歴記録のテスト（FTS5 への反映確認）
- ポップアップハンドリングの統合テスト
