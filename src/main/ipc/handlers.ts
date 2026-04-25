import { ipcMain } from 'electron';
import type { TabManager } from '../tabs/tab-manager';
import type { SettingsService } from '../settings/settings-service';
import { SpaceRepository } from '../storage/repositories/space-repo';
import { HistoryRepository } from '../storage/repositories/history-repo';
import { resolveUrl } from '../navigation/url-resolver';
import type { Commands } from '@shared/types/ipc';
import type { Candidate } from '@shared/types/command-bar';
import type { TabId } from '@shared/types/tab';

type Handler<K extends keyof Commands> = (
  input: Commands[K]['input']
) => Commands[K]['output'] | Promise<Commands[K]['output']>;

const register = <K extends keyof Commands>(channel: K, handler: Handler<K>): void => {
  ipcMain.handle(channel, async (_event, input) => handler(input));
};

export const registerHandlers = (tabs: TabManager, settings: SettingsService): void => {
  register('bootstrap.fetch', () => {
    const spaces = SpaceRepository.list();
    const allTabs = tabs.allOpenTabs();
    const activeTabId = tabs.getActiveTabId();
    return {
      spaces,
      activeSpaceId: spaces[0]?.id ?? null,
      tabs: allTabs,
      activeTabId,
      settings: settings.getAll(),
    };
  });

  register('settings.get',   () => settings.getAll());
  register('settings.patch', (patch) => { settings.patch(patch); });

  register('tab.create',    (input) => tabs.create(input));
  register('tab.activate',  ({ tabId }) => tabs.activate(tabId));
  register('tab.close',     ({ tabId }) => tabs.close(tabId));
  register('tab.navigate',  ({ tabId, url }) => tabs.navigate(tabId, url));
  register('tab.goBack',    ({ tabId }) => tabs.goBack(tabId));
  register('tab.goForward', ({ tabId }) => tabs.goForward(tabId));
  register('tab.reload',    ({ tabId, ignoreCache }) => tabs.reload(tabId, { ignoreCache }));
  register('tab.stop',      ({ tabId }) => tabs.stop(tabId));
  register('tab.setBounds', ({ bounds }) => tabs.setBounds(bounds));
  register('tab.setActiveViewVisible', ({ visible }) => tabs.setActiveViewVisible(visible));
  register('tab.pin',      ({ tabId }) => tabs.pin(tabId));
  register('tab.unpin',    ({ tabId }) => tabs.unpin(tabId));
  register('tab.restore',  ({ tabId }) => tabs.restoreFromArchive(tabId));
  register('tab.deletePermanent', ({ tabId }) => tabs.deletePermanent(tabId));
  register('archive.list', ({ limit }) => tabs.listArchived(limit));

  register('history.search', ({ query, limit }) => HistoryRepository.search(query, limit ?? 20));

  register('commandBar.search', ({ query }) => {
    const q = query.trim();
    const candidates: Candidate[] = [];

    if (q.length === 0) {
      const recent = HistoryRepository.recent(8);
      for (const h of recent) {
        candidates.push({
          kind: 'history',
          id: `history:${h.id}`,
          url: h.url,
          title: h.title,
          favicon: null,
          visitedAt: h.visitedAt,
          score: 0.5,
        });
      }
      return candidates;
    }

    // open tabs (in-memory)
    const lower = q.toLowerCase();
    for (const tab of tabs.allOpenTabs()) {
      const t = (tab.title || '').toLowerCase();
      const u = tab.url.toLowerCase();
      if (t.includes(lower) || u.includes(lower)) {
        candidates.push({
          kind: 'open-tab',
          id: `open:${tab.id}`,
          tabId: tab.id as TabId,
          title: tab.title || tab.url,
          url: tab.url,
          favicon: tab.faviconUrl,
          score: t.startsWith(lower) || u.startsWith(lower) ? 1 : 0.8,
        });
      }
    }

    // history
    const hits = HistoryRepository.search(q, 10);
    for (const h of hits) {
      candidates.push({
        kind: 'history',
        id: `history:${h.id}`,
        url: h.url,
        title: h.title,
        favicon: null,
        visitedAt: h.visitedAt,
        score: 0.6,
      });
    }

    const engine = settings.getAll().general.defaultSearchEngine;

    // url fallback
    const looksUrl = /^[a-z]+:\/\//i.test(q) || /\.[a-z]{2,}/i.test(q) || /^localhost/i.test(q);
    if (looksUrl) {
      candidates.push({
        kind: 'url',
        id: `url:${q}`,
        url: resolveUrl(q, engine),
        score: 0.5,
      });
    }

    // search fallback
    candidates.push({
      kind: 'search',
      id: `search:${q}`,
      query: q,
      engine,
      score: 0.3,
    });

    return candidates.sort((a, b) => b.score - a.score).slice(0, 8);
  });
};
