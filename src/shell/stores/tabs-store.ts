import { create } from 'zustand';
import type { Tab, TabId, CreateTabInput } from '@shared/types/tab';
import type { Events } from '@shared/types/ipc';

type State = {
  byId: Record<string, Tab>;
  activeTabId: TabId | null;
};

type Actions = {
  createTab(input: CreateTabInput): Promise<TabId>;
  activateTab(tabId: TabId): Promise<void>;
  closeTab(tabId: TabId): Promise<void>;
  navigateTab(tabId: TabId, url: string): Promise<void>;
  goBack(tabId: TabId): Promise<void>;
  goForward(tabId: TabId): Promise<void>;
  reload(tabId: TabId, ignoreCache?: boolean): Promise<void>;
  pinTab(tabId: TabId): Promise<void>;
  unpinTab(tabId: TabId): Promise<void>;
  hydrate(tabs: Tab[], activeTabId: TabId | null): void;
  applyEvent(event: Events): void;
};

export const useTabsStore = create<State & Actions>((set, get) => ({
  byId: {},
  activeTabId: null,

  async createTab(input) {
    return window.api.invoke('tab.create', input);
  },

  async activateTab(tabId) {
    set({ activeTabId: tabId });
    await window.api.invoke('tab.activate', { tabId });
  },

  async closeTab(tabId) {
    await window.api.invoke('tab.close', { tabId });
  },

  async navigateTab(tabId, url) {
    await window.api.invoke('tab.navigate', { tabId, url });
  },

  async goBack(tabId) {
    await window.api.invoke('tab.goBack', { tabId });
  },

  async goForward(tabId) {
    await window.api.invoke('tab.goForward', { tabId });
  },

  async reload(tabId, ignoreCache) {
    await window.api.invoke('tab.reload', { tabId, ignoreCache });
  },

  async pinTab(tabId) {
    await window.api.invoke('tab.pin', { tabId });
  },

  async unpinTab(tabId) {
    await window.api.invoke('tab.unpin', { tabId });
  },

  hydrate(tabs, activeTabId) {
    const byId: Record<string, Tab> = {};
    for (const t of tabs) byId[t.id] = t;
    set({ byId, activeTabId });
  },

  applyEvent(event) {
    switch (event.kind) {
      case 'tab.created': {
        set((s) => ({ byId: { ...s.byId, [event.tab.id]: event.tab } }));
        break;
      }
      case 'tab.activated': {
        set({ activeTabId: event.tabId });
        break;
      }
      case 'tab.closed': {
        set((s) => {
          const { [event.tabId]: _removed, ...rest } = s.byId;
          return { byId: rest };
        });
        break;
      }
      case 'tab.titleUpdated': {
        const cur = get().byId[event.tabId];
        if (!cur) break;
        set((s) => ({ byId: { ...s.byId, [event.tabId]: { ...cur, title: event.title } } }));
        break;
      }
      case 'tab.faviconUpdated': {
        const cur = get().byId[event.tabId];
        if (!cur) break;
        set((s) => ({ byId: { ...s.byId, [event.tabId]: { ...cur, faviconUrl: event.faviconUrl } } }));
        break;
      }
      case 'tab.urlUpdated': {
        const cur = get().byId[event.tabId];
        if (!cur) break;
        set((s) => ({
          byId: {
            ...s.byId,
            [event.tabId]: { ...cur, url: event.url, canGoBack: event.canGoBack, canGoForward: event.canGoForward },
          },
        }));
        break;
      }
      case 'tab.updated': {
        const cur = get().byId[event.tab.id];
        // ランタイム状態（loading 等）は維持しつつ、永続フィールドは差し替え
        const merged = cur ? { ...cur, ...event.tab } : event.tab;
        set((s) => ({ byId: { ...s.byId, [event.tab.id]: merged } }));
        break;
      }
      case 'tab.loadingStateChanged': {
        const cur = get().byId[event.tabId];
        if (!cur) break;
        set((s) => ({
          byId: {
            ...s.byId,
            [event.tabId]: { ...cur, loading: event.loading, loadProgress: event.progress },
          },
        }));
        break;
      }
      default:
        break;
    }
  },
}));
