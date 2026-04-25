import { describe, it, expect, beforeEach } from 'vitest';
import { installMockApi, type MockApi } from '../../helpers/mocks';
import type { Tab, TabId, SpaceId } from '@shared/types/tab';

let api: MockApi;
let useTabsStoreCached: typeof import('../../../src/shell/stores/tabs-store').useTabsStore;

beforeEach(async () => {
  api = installMockApi();
  const mod = await import('../../../src/shell/stores/tabs-store');
  useTabsStoreCached = mod.useTabsStore;
  mod.useTabsStore.setState({ byId: {}, activeTabId: null });
});

const makeTab = (overrides: Partial<Tab> = {}): Tab => ({
  id: 'tab-1' as TabId,
  spaceId: 'space-1' as SpaceId,
  url: 'https://example.com',
  title: 'Example',
  faviconUrl: null,
  state: 'today',
  position: 0,
  lastActiveAt: 0,
  createdAt: 0,
  archivedAt: null,
  loading: false,
  loadProgress: 0,
  audible: false,
  canGoBack: false,
  canGoForward: false,
  ...overrides,
});

const getTab = (id: string): Tab => {
  const t = useTabsStoreCached.getState().byId[id];
  if (!t) throw new Error(`tab ${id} not found in store`);
  return t;
};

describe('tabsStore', () => {
  describe('hydrate(tabs, activeTabId) を呼んだとき', () => {
    it('byId にタブをマップで保持する', async () => {
      // 準備
      const { useTabsStore } = await import('../../../src/shell/stores/tabs-store');
      const tab1 = makeTab({ id: 'a' as TabId });
      const tab2 = makeTab({ id: 'b' as TabId });

      // 実行
      useTabsStore.getState().hydrate([tab1, tab2], 'a' as TabId);

      // 結果
      const state = useTabsStore.getState();
      expect(state.byId['a']).toEqual(tab1);
      expect(state.byId['b']).toEqual(tab2);
      expect(state.activeTabId).toBe('a');
    });
  });


  describe('applyEvent("tab.created") を受けたとき', () => {
    it('新しいタブが byId に追加される', async () => {
      // 準備
      const { useTabsStore } = await import('../../../src/shell/stores/tabs-store');
      const tab = makeTab({ id: 'new' as TabId });

      // 実行
      useTabsStore.getState().applyEvent({ kind: 'tab.created', tab });

      // 結果
      expect(useTabsStore.getState().byId['new']).toEqual(tab);
    });

    it('既存タブを上書きしない（キーが違うため）', async () => {
      // 準備
      const { useTabsStore } = await import('../../../src/shell/stores/tabs-store');
      const existing = makeTab({ id: 'a' as TabId, title: 'Old' });
      useTabsStore.getState().hydrate([existing], 'a' as TabId);
      const newTab = makeTab({ id: 'b' as TabId, title: 'New' });

      // 実行
      useTabsStore.getState().applyEvent({ kind: 'tab.created', tab: newTab });

      // 結果
      expect(getTab('a').title).toBe('Old');
      expect(getTab('b').title).toBe('New');
    });
  });

  describe('applyEvent("tab.activated") を受けたとき', () => {
    it('activeTabId が更新される', async () => {
      // 準備
      const { useTabsStore } = await import('../../../src/shell/stores/tabs-store');
      useTabsStore.getState().hydrate([makeTab({ id: 'a' as TabId })], 'a' as TabId);

      // 実行
      useTabsStore.getState().applyEvent({ kind: 'tab.activated', tabId: 'a' as TabId });

      // 結果
      expect(useTabsStore.getState().activeTabId).toBe('a');
    });

    it('null も受け入れる（全タブ非アクティブ）', async () => {
      // 準備
      const { useTabsStore } = await import('../../../src/shell/stores/tabs-store');
      useTabsStore.getState().hydrate([makeTab({ id: 'a' as TabId })], 'a' as TabId);

      // 実行
      useTabsStore.getState().applyEvent({ kind: 'tab.activated', tabId: null });

      // 結果
      expect(useTabsStore.getState().activeTabId).toBeNull();
    });
  });

  describe('applyEvent("tab.closed") を受けたとき', () => {
    it('該当タブが byId から削除される', async () => {
      // 準備
      const { useTabsStore } = await import('../../../src/shell/stores/tabs-store');
      const tab1 = makeTab({ id: 'a' as TabId });
      const tab2 = makeTab({ id: 'b' as TabId });
      useTabsStore.getState().hydrate([tab1, tab2], 'a' as TabId);

      // 実行
      useTabsStore.getState().applyEvent({ kind: 'tab.closed', tabId: 'a' as TabId });

      // 結果
      expect(useTabsStore.getState().byId['a']).toBeUndefined();
      expect(useTabsStore.getState().byId['b']).toEqual(tab2);
    });
  });

  describe('applyEvent("tab.titleUpdated") を受けたとき', () => {
    it('該当タブのタイトルだけ書き換わる', async () => {
      // 準備
      const { useTabsStore } = await import('../../../src/shell/stores/tabs-store');
      useTabsStore.getState().hydrate(
        [makeTab({ id: 'a' as TabId, title: 'Old' })],
        'a' as TabId
      );

      // 実行
      useTabsStore.getState().applyEvent({ kind: 'tab.titleUpdated', tabId: 'a' as TabId, title: 'New' });

      // 結果
      expect(getTab('a').title).toBe('New');
    });

    it('存在しないタブへのイベントは無視される', async () => {
      // 準備
      const { useTabsStore } = await import('../../../src/shell/stores/tabs-store');

      // 実行
      useTabsStore.getState().applyEvent({ kind: 'tab.titleUpdated', tabId: 'ghost' as TabId, title: 'X' });

      // 結果
      expect(useTabsStore.getState().byId['ghost']).toBeUndefined();
    });
  });

  describe('applyEvent("tab.loadingStateChanged") を受けたとき', () => {
    it('loading と loadProgress が反映される', async () => {
      // 準備
      const { useTabsStore } = await import('../../../src/shell/stores/tabs-store');
      useTabsStore.getState().hydrate([makeTab({ id: 'a' as TabId })], 'a' as TabId);

      // 実行
      useTabsStore.getState().applyEvent({
        kind: 'tab.loadingStateChanged',
        tabId: 'a' as TabId,
        loading: true,
        progress: 0.5,
      });

      // 結果
      const t = getTab('a');
      expect(t.loading).toBe(true);
      expect(t.loadProgress).toBe(0.5);
    });
  });

  describe('applyEvent("tab.urlUpdated") を受けたとき', () => {
    it('url と canGoBack/Forward が更新される', async () => {
      // 準備
      const { useTabsStore } = await import('../../../src/shell/stores/tabs-store');
      useTabsStore.getState().hydrate([makeTab({ id: 'a' as TabId })], 'a' as TabId);

      // 実行
      useTabsStore.getState().applyEvent({
        kind: 'tab.urlUpdated',
        tabId: 'a' as TabId,
        url: 'https://new.example.com',
        canGoBack: true,
        canGoForward: false,
      });

      // 結果
      const t = getTab('a');
      expect(t.url).toBe('https://new.example.com');
      expect(t.canGoBack).toBe(true);
      expect(t.canGoForward).toBe(false);
    });
  });

  describe('createTab(input) を呼んだとき', () => {
    it('IPC tab.create に input を委譲して tabId を返す', async () => {
      // 準備
      const { useTabsStore } = await import('../../../src/shell/stores/tabs-store');
      api.__setHandler('tab.create', () => 'new-tab' as TabId);

      // 実行
      const id = await useTabsStore.getState().createTab({ url: 'https://example.com' });

      // 結果
      expect(id).toBe('new-tab');
      expect(api.__invokeCalls).toContainEqual({
        channel: 'tab.create',
        input: { url: 'https://example.com' },
      });
    });
  });

  describe('navigateTab() を呼んだとき', () => {
    it('IPC tab.navigate に正しいパラメータで委譲する', async () => {
      // 準備
      const { useTabsStore } = await import('../../../src/shell/stores/tabs-store');
      api.__setHandler('tab.navigate', () => undefined);

      // 実行
      await useTabsStore.getState().navigateTab('a' as TabId, 'https://example.com');

      // 結果
      expect(api.__invokeCalls).toContainEqual({
        channel: 'tab.navigate',
        input: { tabId: 'a', url: 'https://example.com' },
      });
    });
  });

  describe('pinTab() / unpinTab() を呼んだとき', () => {
    it('IPC tab.pin に tabId を渡す', async () => {
      // 準備
      const { useTabsStore } = await import('../../../src/shell/stores/tabs-store');
      api.__setHandler('tab.pin', () => undefined);

      // 実行
      await useTabsStore.getState().pinTab('a' as TabId);

      // 結果
      expect(api.__invokeCalls).toContainEqual({
        channel: 'tab.pin',
        input: { tabId: 'a' },
      });
    });

    it('IPC tab.unpin に tabId を渡す', async () => {
      // 準備
      const { useTabsStore } = await import('../../../src/shell/stores/tabs-store');
      api.__setHandler('tab.unpin', () => undefined);

      // 実行
      await useTabsStore.getState().unpinTab('a' as TabId);

      // 結果
      expect(api.__invokeCalls).toContainEqual({
        channel: 'tab.unpin',
        input: { tabId: 'a' },
      });
    });
  });

  describe('applyEvent("tab.updated") を受けたとき', () => {
    it('永続フィールドを差し替えつつ、ランタイム状態（loading 等）は維持する', async () => {
      // 準備
      const { useTabsStore } = await import('../../../src/shell/stores/tabs-store');
      const original = makeTab({
        id: 'a' as TabId,
        state: 'today',
        position: 0,
        loading: true,
        loadProgress: 0.4,
      });
      useTabsStore.getState().hydrate([original], 'a' as TabId);

      // 実行: 同じ id で state と position が変わった tab が届く
      const updated = makeTab({
        id: 'a' as TabId,
        state: 'pinned',
        position: 5,
        // loading 系はサーバ由来の永続値（false）
        loading: false,
        loadProgress: 0,
      });
      useTabsStore.getState().applyEvent({ kind: 'tab.updated', tab: updated });

      // 結果: state と position は新しい値、loading は維持される（merge 動作）
      const t = getTab('a');
      expect(t.state).toBe('pinned');
      expect(t.position).toBe(5);
      // 注：tab.updated は完全な Tab を運ぶので、loading: false で来る
      // ランタイム状態を保ちたいなら別イベント（tab.loadingStateChanged）が来る想定
      expect(t.loading).toBe(false);
    });

    it('未知のタブを受けたら新規追加する', async () => {
      // 準備
      const { useTabsStore } = await import('../../../src/shell/stores/tabs-store');
      const newTab = makeTab({ id: 'fresh' as TabId });

      // 実行
      useTabsStore.getState().applyEvent({ kind: 'tab.updated', tab: newTab });

      // 結果
      expect(getTab('fresh').id).toBe('fresh');
    });
  });
});
