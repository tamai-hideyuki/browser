import { randomUUID } from 'node:crypto';
import { WebContentsView, type BrowserWindow } from 'electron';
import { TabRepository } from '../storage/repositories/tab-repo';
import { HistoryRepository } from '../storage/repositories/history-repo';
import { resolveUrl } from '../navigation/url-resolver';
import type { Broadcaster } from '../ipc/broadcaster';
import type { SettingsService } from '../settings/settings-service';
import type {
  Tab,
  TabId,
  SpaceId,
  Rect,
  CreateTabInput,
} from '@shared/types/tab';
import type { ShortcutAction } from '@shared/types/ipc';

type TabRecord = {
  meta: Tab;
  view: WebContentsView | null;
};

export class TabManager {
  private records = new Map<TabId, TabRecord>();
  private activeTabId: TabId | null = null;
  private bounds: Rect = { x: 0, y: 0, width: 0, height: 0 };
  private defaultSpaceId: SpaceId;

  constructor(
    private window: BrowserWindow,
    private broadcaster: Broadcaster,
    private settings: SettingsService,
    defaultSpaceId: SpaceId,
  ) {
    this.defaultSpaceId = defaultSpaceId;
  }

  // ── 起動時復元 ─────────────────────────────────────────
  hydrateFromDb(): { tabs: Tab[]; activeTabId: TabId | null } {
    const persisted = TabRepository.listAllOpen();
    for (const meta of persisted) {
      this.records.set(meta.id, { meta, view: null });
    }
    const newest = [...persisted].sort((a, b) => b.lastActiveAt - a.lastActiveAt)[0];
    return { tabs: persisted, activeTabId: newest?.id ?? null };
  }

  allOpenTabs(): Tab[] {
    return [...this.records.values()].map((r) => r.meta);
  }

  getActiveTabId(): TabId | null {
    return this.activeTabId;
  }

  // ── 操作 ──────────────────────────────────────────────
  create(input: CreateTabInput): TabId {
    const id = randomUUID() as TabId;
    const spaceId = (input.spaceId ?? this.defaultSpaceId) as SpaceId;
    const state = input.state ?? 'today';
    const position = TabRepository.nextPosition(spaceId, state);
    const now = Date.now();
    const url = resolveUrl(input.url, this.settings.getAll().general.defaultSearchEngine);

    const meta: Tab = {
      id,
      spaceId,
      url,
      title: '',
      faviconUrl: null,
      state,
      position,
      lastActiveAt: now,
      createdAt: now,
      archivedAt: null,
      loading: false,
      loadProgress: 0,
      audible: false,
      canGoBack: false,
      canGoForward: false,
    };

    TabRepository.insert({
      id,
      spaceId,
      url,
      title: '',
      faviconUrl: null,
      state,
      position,
      lastActiveAt: now,
      createdAt: now,
      archivedAt: null,
    });

    this.records.set(id, { meta, view: null });
    this.broadcaster.emit({ kind: 'tab.created', tab: meta });

    if (!input.background) {
      this.activate(id);
    }
    return id;
  }

  activate(tabId: TabId): void {
    const rec = this.records.get(tabId);
    if (!rec) return;
    if (this.activeTabId === tabId && rec.view) return;

    if (this.activeTabId && this.activeTabId !== tabId) {
      const prev = this.records.get(this.activeTabId);
      if (prev?.view) {
        try {
          this.window.contentView.removeChildView(prev.view);
        } catch {}
      }
    }

    if (!rec.view) {
      this.mountView(tabId);
    }

    if (rec.view) {
      this.window.contentView.addChildView(rec.view);
      rec.view.setBounds(this.bounds);
    }

    rec.meta.lastActiveAt = Date.now();
    TabRepository.updateLastActive(tabId, rec.meta.lastActiveAt);

    this.activeTabId = tabId;
    this.broadcaster.emit({ kind: 'tab.activated', tabId });
  }

  close(tabId: TabId): void {
    const rec = this.records.get(tabId);
    if (!rec) return;

    if (rec.view) {
      try { this.window.contentView.removeChildView(rec.view); } catch {}
      try { (rec.view.webContents as any).close?.(); } catch {}
      rec.view = null;
    }

    TabRepository.archive(tabId, Date.now());
    this.records.delete(tabId);
    this.broadcaster.emit({ kind: 'tab.closed', tabId });

    if (this.activeTabId === tabId) {
      this.activeTabId = null;
      const next = [...this.records.values()]
        .sort((a, b) => b.meta.lastActiveAt - a.meta.lastActiveAt)[0];
      if (next) {
        this.activate(next.meta.id);
      } else {
        this.broadcaster.emit({ kind: 'tab.activated', tabId: null });
      }
    }
  }

  navigate(tabId: TabId, rawUrl: string): void {
    const rec = this.records.get(tabId);
    if (!rec) return;
    if (!rec.view) this.mountView(tabId);
    const url = resolveUrl(rawUrl, this.settings.getAll().general.defaultSearchEngine);
    rec.view!.webContents.loadURL(url).catch(() => { /* did-fail-load で扱う */ });
  }

  goBack(tabId: TabId): void {
    const rec = this.records.get(tabId);
    if (!rec?.view) return;
    if (rec.view.webContents.navigationHistory.canGoBack()) {
      rec.view.webContents.navigationHistory.goBack();
    }
  }

  goForward(tabId: TabId): void {
    const rec = this.records.get(tabId);
    if (!rec?.view) return;
    if (rec.view.webContents.navigationHistory.canGoForward()) {
      rec.view.webContents.navigationHistory.goForward();
    }
  }

  reload(tabId: TabId, opts?: { ignoreCache?: boolean }): void {
    const rec = this.records.get(tabId);
    if (!rec) return;
    if (!rec.view) {
      this.mountView(tabId);
      return;
    }
    if (opts?.ignoreCache) rec.view.webContents.reloadIgnoringCache();
    else rec.view.webContents.reload();
  }

  stop(tabId: TabId): void {
    this.records.get(tabId)?.view?.webContents.stop();
  }

  setBounds(rect: Rect): void {
    this.bounds = rect;
    if (this.activeTabId) {
      const rec = this.records.get(this.activeTabId);
      rec?.view?.setBounds(rect);
    }
  }

  pin(tabId: TabId): void {
    const rec = this.records.get(tabId);
    if (!rec || rec.meta.state === 'pinned') return;
    const newPosition = TabRepository.nextPosition(rec.meta.spaceId, 'pinned');
    rec.meta.state = 'pinned';
    rec.meta.position = newPosition;
    TabRepository.setState(tabId, 'pinned', newPosition);
    this.broadcaster.emit({ kind: 'tab.updated', tab: rec.meta });
  }

  unpin(tabId: TabId): void {
    const rec = this.records.get(tabId);
    if (!rec || rec.meta.state !== 'pinned') return;
    const newPosition = TabRepository.nextPosition(rec.meta.spaceId, 'today');
    rec.meta.state = 'today';
    rec.meta.position = newPosition;
    TabRepository.setState(tabId, 'today', newPosition);
    this.broadcaster.emit({ kind: 'tab.updated', tab: rec.meta });
  }

  listArchived(limit?: number): Tab[] {
    return TabRepository.listArchived(limit);
  }

  restoreFromArchive(tabId: TabId): void {
    const meta = TabRepository.findById(tabId);
    if (!meta || meta.state !== 'archived') return;
    const newPosition = TabRepository.nextPosition(meta.spaceId, 'today');
    TabRepository.setState(tabId, 'today', newPosition);
    const restored: Tab = { ...meta, state: 'today', position: newPosition, archivedAt: null };
    this.records.set(tabId, { meta: restored, view: null });
    this.broadcaster.emit({ kind: 'tab.created', tab: restored });
  }

  deletePermanent(tabId: TabId): void {
    TabRepository.deletePermanent(tabId);
    // archived タブは records には居ないため emit のみ
    this.broadcaster.emit({ kind: 'tab.closed', tabId });
  }

  setActiveViewVisible(visible: boolean): void {
    if (!this.activeTabId) return;
    const rec = this.records.get(this.activeTabId);
    rec?.view?.setVisible(visible);
  }

  // ── 内部 ──────────────────────────────────────────────
  private mountView(tabId: TabId): void {
    const rec = this.records.get(tabId);
    if (!rec || rec.view) return;

    const view = new WebContentsView({
      webPreferences: {
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        webSecurity: true,
      },
    });

    rec.view = view;
    this.wireWebContentsEvents(tabId, view);
    view.webContents.loadURL(rec.meta.url).catch(() => {});
  }

  private wireWebContentsEvents(tabId: TabId, view: WebContentsView): void {
    const wc = view.webContents;

    wc.on('did-start-loading', () => {
      this.broadcaster.emit({
        kind: 'tab.loadingStateChanged',
        tabId,
        loading: true,
        progress: 0,
      });
    });

    wc.on('did-stop-loading', () => {
      this.broadcaster.emit({
        kind: 'tab.loadingStateChanged',
        tabId,
        loading: false,
        progress: 1,
      });
    });

    wc.on('page-title-updated', (_e, title) => {
      const rec = this.records.get(tabId);
      if (!rec) return;
      rec.meta.title = title;
      try { TabRepository.updateTitle(tabId, title); } catch {}
      try { HistoryRepository.updateTitleByUrl(rec.meta.url, title); } catch {}
      this.broadcaster.emit({ kind: 'tab.titleUpdated', tabId, title });
    });

    wc.on('page-favicon-updated', (_e, urls) => {
      const url = urls[0] ?? null;
      const rec = this.records.get(tabId);
      if (!rec) return;
      rec.meta.faviconUrl = url;
      try { TabRepository.updateFavicon(tabId, url); } catch {}
      this.broadcaster.emit({ kind: 'tab.faviconUpdated', tabId, faviconUrl: url });
    });

    wc.on('did-navigate', (_e, url) => {
      const rec = this.records.get(tabId);
      if (!rec) return;
      rec.meta.url = url;
      try { TabRepository.updateUrl(tabId, url); } catch {}
      if (!url.startsWith('about:') && !url.startsWith('chrome:') && !url.startsWith('data:')) {
        try { HistoryRepository.record(url, rec.meta.title, Date.now()); } catch {}
      }
      this.broadcaster.emit({
        kind: 'tab.urlUpdated',
        tabId,
        url,
        canGoBack: wc.navigationHistory.canGoBack(),
        canGoForward: wc.navigationHistory.canGoForward(),
      });
    });

    wc.on('did-navigate-in-page', (_e, url) => {
      const rec = this.records.get(tabId);
      if (!rec) return;
      rec.meta.url = url;
      this.broadcaster.emit({
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
      this.broadcaster.emit({
        kind: 'navigation.error',
        tabId,
        errorCode: String(errorCode),
        url: validatedURL,
      });
    });

    wc.on('before-input-event', (event, input) => {
      if (input.type !== 'keyDown') return;
      const isMac = process.platform === 'darwin';
      const meta = isMac ? input.meta : input.control;
      if (!meta) return;

      const k = input.key.toLowerCase();
      let action: ShortcutAction | null = null;
      if (k === 't') action = 'newTab';
      else if (k === 'l') action = 'editUrl';
      else if (k === 'w') action = 'closeTab';
      else if (k === 'r') action = input.shift ? 'reloadHard' : 'reload';
      else if (k === '[') action = 'back';
      else if (k === ']') action = 'forward';
      else if (k === ',') action = 'openSettings';

      if (action) {
        event.preventDefault();
        // shell の UI を出す系のショートカットは shell webContents にフォーカスを戻す
        // （webview が握っているフォーカスを奪わないと入力欄に打てない）
        if (action === 'newTab' || action === 'editUrl' || action === 'openSettings') {
          this.window.webContents.focus();
        }
        this.broadcaster.emit({ kind: 'shortcut', action });
      }
    });

    wc.setWindowOpenHandler(({ url, disposition }) => {
      // save-to-disk は Electron の型に出ないが実行時に来うる
      if ((disposition as string) === 'save-to-disk') return { action: 'allow' };
      this.create({
        url,
        background: disposition === 'background-tab',
      });
      return { action: 'deny' };
    });
  }
}
