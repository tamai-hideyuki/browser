import { randomUUID } from 'node:crypto';
import type { BrowserWindow, WebContents, WebContentsView } from 'electron';
import { TabRepository } from '../storage/repositories/tab-repo';
import { resolveUrl } from '../navigation/url-resolver';
import { createWebView, type WebViewHostDeps } from './webview-host';
import type { Broadcaster } from '../ipc/broadcaster';
import type { SettingsService } from '../settings/settings-service';
import {
  DEFAULT_TAB_RUNTIME,
  type Tab,
  type TabId,
  type SpaceId,
  type PersistedTab,
  type Rect,
  type CreateTabInput,
} from '@shared/types/tab';

type TabRecord = {
  meta: Tab;
  view: WebContentsView | null;
};

export class TabManager {
  private records = new Map<TabId, TabRecord>();
  private activeTabId: TabId | null = null;
  private bounds: Rect = { x: 0, y: 0, width: 0, height: 0 };
  private defaultSpaceId: SpaceId;
  private readonly hostDeps: WebViewHostDeps;

  constructor(
    private window: BrowserWindow,
    private broadcaster: Broadcaster,
    private settings: SettingsService,
    defaultSpaceId: SpaceId,
  ) {
    this.defaultSpaceId = defaultSpaceId;
    this.hostDeps = {
      broadcaster,
      getMeta: (id) => this.records.get(id)?.meta,
      focusShell: () => this.window.webContents.focus(),
      openInNewTab: (url, background) => { this.create({ url, background }); },
      onCrashed: (id, crashedView) => this.handleCrash(id, crashedView),
    };
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

  // メニューの「デベロッパーツール」から使う。view が無ければ（discard 中など）undefined
  getActiveWebContents(): WebContents | undefined {
    if (!this.activeTabId) return undefined;
    return this.records.get(this.activeTabId)?.view?.webContents;
  }

  // ── 操作 ──────────────────────────────────────────────
  create(input: CreateTabInput): TabId {
    const id = randomUUID() as TabId;
    const spaceId = (input.spaceId ?? this.defaultSpaceId) as SpaceId;
    const state = input.state ?? 'today';
    const now = Date.now();

    const persisted: PersistedTab = {
      id,
      spaceId,
      url: resolveUrl(input.url, this.settings.getAll().general.defaultSearchEngine),
      title: '',
      faviconUrl: null,
      state,
      position: TabRepository.nextPosition(spaceId, state),
      lastActiveAt: now,
      createdAt: now,
      archivedAt: null,
    };
    const meta: Tab = { ...persisted, ...DEFAULT_TAB_RUNTIME };

    TabRepository.insert(persisted);
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
      if (prev?.view) this.detachView(prev.view);
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
      this.detachView(rec.view);
      try { rec.view.webContents.close(); } catch { /* 破棄済みなら無視 */ }
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
    this.setTabState(tabId, 'pinned', (meta) => meta.state !== 'pinned');
  }

  unpin(tabId: TabId): void {
    this.setTabState(tabId, 'today', (meta) => meta.state === 'pinned');
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

  // レンダラープロセスのクラッシュ通知を受けて view を手放す。
  // 次に activate/reload されたときに mountView が新しい view を作り直す。
  private handleCrash(tabId: TabId, crashedView: WebContentsView): void {
    const rec = this.records.get(tabId);
    // close() 等で既に入れ替わった view に対する遅延イベントは無視する
    if (!rec || rec.view !== crashedView) return;
    this.detachView(crashedView);
    rec.view = null;
  }

  // ── 内部 ──────────────────────────────────────────────
  private mountView(tabId: TabId): void {
    const rec = this.records.get(tabId);
    if (!rec || rec.view) return;
    rec.view = createWebView(tabId, rec.meta.url, this.hostDeps);
  }

  // View が既にウィンドウから外れていても安全に取り除く
  private detachView(view: WebContentsView): void {
    try { this.window.contentView.removeChildView(view); } catch { /* 未アタッチなら無視 */ }
  }

  private setTabState(
    tabId: TabId,
    state: 'today' | 'pinned',
    shouldApply: (meta: Tab) => boolean,
  ): void {
    const rec = this.records.get(tabId);
    if (!rec || !shouldApply(rec.meta)) return;
    const newPosition = TabRepository.nextPosition(rec.meta.spaceId, state);
    rec.meta.state = state;
    rec.meta.position = newPosition;
    TabRepository.setState(tabId, state, newPosition);
    this.broadcaster.emit({ kind: 'tab.updated', tab: rec.meta });
  }
}
