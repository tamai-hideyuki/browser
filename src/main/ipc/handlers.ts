import { ipcMain } from 'electron';
import type { TabManager } from '../tabs/tab-manager';
import type { SettingsService } from '../settings/settings-service';
import { SpaceRepository } from '../storage/repositories/space-repo';
import { HistoryRepository } from '../storage/repositories/history-repo';
import { searchCandidates } from '../command-bar/search';
import type { Commands } from '@shared/types/ipc';

type Handler<K extends keyof Commands> = (
  input: Commands[K]['input']
) => Commands[K]['output'] | Promise<Commands[K]['output']>;

const register = <K extends keyof Commands>(channel: K, handler: Handler<K>): void => {
  ipcMain.handle(channel, async (_event, input) => handler(input));
};

export const registerHandlers = (tabs: TabManager, settings: SettingsService): void => {
  register('bootstrap.fetch', () => {
    const spaces = SpaceRepository.list();
    return {
      spaces,
      activeSpaceId: spaces[0]?.id ?? null,
      tabs: tabs.allOpenTabs(),
      activeTabId: tabs.getActiveTabId(),
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

  register('commandBar.search', ({ query }) =>
    searchCandidates(query, {
      openTabs: tabs.allOpenTabs(),
      engine: settings.getAll().general.defaultSearchEngine,
      recentHistory: (limit) => HistoryRepository.recent(limit),
      searchHistory: (q, limit) => HistoryRepository.search(q, limit),
    }));
};
