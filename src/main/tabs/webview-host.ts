import { WebContentsView } from 'electron';
import { TabRepository } from '../storage/repositories/tab-repo';
import { HistoryRepository } from '../storage/repositories/history-repo';
import { matchShortcut } from '@shared/shortcuts';
import type { Broadcaster } from '../ipc/broadcaster';
import type { Tab, TabId } from '@shared/types/tab';

// TabManager から渡される依存。meta は records 内のオブジェクトへの
// 参照を共有しており、ここでの書き込みがそのまま TabManager 側に反映される。
export type WebViewHostDeps = {
  broadcaster: Broadcaster;
  getMeta(tabId: TabId): Tab | undefined;
  focusShell(): void;
  openInNewTab(url: string, background: boolean): void;
};

// タブ 1 つ分の WebContentsView を生成し、webContents イベントを配線して返す
export const createWebView = (
  tabId: TabId,
  initialUrl: string,
  deps: WebViewHostDeps,
): WebContentsView => {
  const view = new WebContentsView({
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  });
  wireWebContentsEvents(tabId, view, deps);
  view.webContents.loadURL(initialUrl).catch(() => { /* did-fail-load で扱う */ });
  return view;
};

const logDbError = (op: string, err: unknown): void => {
  console.error(`[webview-host] ${op} failed:`, err);
};

const wireWebContentsEvents = (
  tabId: TabId,
  view: WebContentsView,
  deps: WebViewHostDeps,
): void => {
  const wc = view.webContents;
  const { broadcaster } = deps;

  wc.on('did-start-loading', () => {
    broadcaster.emit({ kind: 'tab.loadingStateChanged', tabId, loading: true, progress: 0 });
  });

  wc.on('did-stop-loading', () => {
    broadcaster.emit({ kind: 'tab.loadingStateChanged', tabId, loading: false, progress: 1 });
  });

  wc.on('page-title-updated', (_e, title) => {
    const meta = deps.getMeta(tabId);
    if (!meta) return;
    meta.title = title;
    try { TabRepository.updateTitle(tabId, title); } catch (err) { logDbError('updateTitle', err); }
    try { HistoryRepository.updateTitleByUrl(meta.url, title); } catch (err) { logDbError('history.updateTitleByUrl', err); }
    broadcaster.emit({ kind: 'tab.titleUpdated', tabId, title });
  });

  wc.on('page-favicon-updated', (_e, urls) => {
    const url = urls[0] ?? null;
    const meta = deps.getMeta(tabId);
    if (!meta) return;
    meta.faviconUrl = url;
    try { TabRepository.updateFavicon(tabId, url); } catch (err) { logDbError('updateFavicon', err); }
    broadcaster.emit({ kind: 'tab.faviconUpdated', tabId, faviconUrl: url });
  });

  wc.on('did-navigate', (_e, url) => {
    const meta = deps.getMeta(tabId);
    if (!meta) return;
    meta.url = url;
    try { TabRepository.updateUrl(tabId, url); } catch (err) { logDbError('updateUrl', err); }
    if (!url.startsWith('about:') && !url.startsWith('chrome:') && !url.startsWith('data:')) {
      try { HistoryRepository.record(url, meta.title, Date.now()); } catch (err) { logDbError('history.record', err); }
    }
    broadcaster.emit({
      kind: 'tab.urlUpdated',
      tabId,
      url,
      canGoBack: wc.navigationHistory.canGoBack(),
      canGoForward: wc.navigationHistory.canGoForward(),
    });
  });

  wc.on('did-navigate-in-page', (_e, url) => {
    const meta = deps.getMeta(tabId);
    if (!meta) return;
    meta.url = url;
    broadcaster.emit({
      kind: 'tab.urlUpdated',
      tabId,
      url,
      canGoBack: wc.navigationHistory.canGoBack(),
      canGoForward: wc.navigationHistory.canGoForward(),
    });
  });

  wc.on('did-fail-load', (_e, errorCode, _desc, validatedURL, isMainFrame) => {
    if (!isMainFrame) return;
    if (errorCode === -3) return;
    broadcaster.emit({
      kind: 'navigation.error',
      tabId,
      errorCode: String(errorCode),
      url: validatedURL,
    });
  });

  wc.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    const isMac = process.platform === 'darwin';
    const action = matchShortcut({
      key: input.key,
      meta: isMac ? input.meta : input.control,
      shift: input.shift,
    });
    // Escape はページ側の操作（全画面解除など）のため素通しする
    if (!action || action === 'escape') return;

    event.preventDefault();
    // shell の UI を出す系のショートカットは shell webContents にフォーカスを戻す
    // （webview が握っているフォーカスを奪わないと入力欄に打てない）
    if (action === 'newTab' || action === 'editUrl' || action === 'openSettings') {
      deps.focusShell();
    }
    broadcaster.emit({ kind: 'shortcut', action });
  });

  wc.setWindowOpenHandler(({ url, disposition }) => {
    // save-to-disk は Electron の型に出ないが実行時に来うる
    if ((disposition as string) === 'save-to-disk') return { action: 'allow' };
    deps.openInNewTab(url, disposition === 'background-tab');
    return { action: 'deny' };
  });
};
