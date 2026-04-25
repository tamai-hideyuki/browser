import type { CreateTabInput, Rect, Tab, TabId } from './tab';
import type { Space } from './space';
import type { SpaceId } from './tab';
import type { HistoryEntry } from './history';
import type { Candidate } from './command-bar';
import type { Settings, SettingsPatch } from './settings';

export type ShortcutAction =
  | 'newTab'
  | 'editUrl'
  | 'closeTab'
  | 'reload'
  | 'reloadHard'
  | 'back'
  | 'forward'
  | 'openSettings'
  | 'escape';

export type BootstrapPayload = {
  spaces: Space[];
  activeSpaceId: SpaceId | null;
  tabs: Tab[];
  activeTabId: TabId | null;
  settings: Settings;
};

export type Commands = {
  'bootstrap.fetch':       { input: void;                                    output: BootstrapPayload };
  'tab.create':            { input: CreateTabInput;                          output: TabId };
  'tab.activate':          { input: { tabId: TabId };                        output: void };
  'tab.close':             { input: { tabId: TabId };                        output: void };
  'tab.navigate':          { input: { tabId: TabId; url: string };           output: void };
  'tab.goBack':            { input: { tabId: TabId };                        output: void };
  'tab.goForward':         { input: { tabId: TabId };                        output: void };
  'tab.reload':            { input: { tabId: TabId; ignoreCache?: boolean }; output: void };
  'tab.stop':              { input: { tabId: TabId };                        output: void };
  'tab.setBounds':         { input: { bounds: Rect };                        output: void };
  'tab.setActiveViewVisible': { input: { visible: boolean };                  output: void };
  'tab.pin':               { input: { tabId: TabId };                        output: void };
  'tab.unpin':             { input: { tabId: TabId };                        output: void };
  'tab.restore':           { input: { tabId: TabId };                        output: void };
  'tab.deletePermanent':   { input: { tabId: TabId };                        output: void };
  'archive.list':          { input: { limit?: number };                      output: Tab[] };
  'history.search':        { input: { query: string; limit?: number };       output: HistoryEntry[] };
  'commandBar.search':     { input: { query: string };                       output: Candidate[] };
  'settings.get':          { input: void;                                    output: Settings };
  'settings.patch':        { input: SettingsPatch;                           output: void };
};

export type Events =
  | { kind: 'tab.created';              tab: Tab }
  | { kind: 'tab.activated';            tabId: TabId | null }
  | { kind: 'tab.closed';               tabId: TabId }
  | { kind: 'tab.titleUpdated';         tabId: TabId; title: string }
  | { kind: 'tab.faviconUpdated';       tabId: TabId; faviconUrl: string | null }
  | { kind: 'tab.urlUpdated';           tabId: TabId; url: string; canGoBack: boolean; canGoForward: boolean }
  | { kind: 'tab.updated';              tab: Tab }
  | { kind: 'tab.loadingStateChanged';  tabId: TabId; loading: boolean; progress: number }
  | { kind: 'navigation.error';         tabId: TabId; errorCode: string; url: string }
  | { kind: 'settings.updated';         settings: Settings }
  | { kind: 'shortcut';                 action: ShortcutAction };

export type CommandChannel = keyof Commands;
export type CommandInput<K extends CommandChannel>  = Commands[K]['input'];
export type CommandOutput<K extends CommandChannel> = Commands[K]['output'];

export type ApiBridge = {
  invoke<K extends CommandChannel>(
    channel: K,
    input: CommandInput<K>
  ): Promise<CommandOutput<K>>;
  on(handler: (event: Events) => void): () => void;
};

declare global {
  interface Window {
    api: ApiBridge;
  }
}
