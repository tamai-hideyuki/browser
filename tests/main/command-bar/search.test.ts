import { describe, it, expect } from 'vitest';
import { searchCandidates, type CommandBarSearchDeps } from '../../../src/main/command-bar/search';
import { DEFAULT_TAB_RUNTIME, type Tab, type TabId, type SpaceId } from '@shared/types/tab';
import type { HistoryEntry } from '@shared/types/history';

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
  ...DEFAULT_TAB_RUNTIME,
  ...overrides,
});

const makeHistory = (overrides: Partial<HistoryEntry> = {}): HistoryEntry => ({
  id: 1,
  url: 'https://github.com',
  title: 'GitHub',
  visitedAt: 1000,
  ...overrides,
});

const makeDeps = (overrides: Partial<CommandBarSearchDeps> = {}): CommandBarSearchDeps => ({
  openTabs: [],
  engine: 'google',
  recentHistory: () => [],
  searchHistory: () => [],
  ...overrides,
});

describe('searchCandidates', () => {
  describe('空クエリのとき', () => {
    it('直近の履歴だけを返す', () => {
      // 準備
      const deps = makeDeps({
        recentHistory: () => [makeHistory({ id: 1 }), makeHistory({ id: 2, url: 'https://a.com' })],
      });

      // 実行
      const result = searchCandidates('', deps);

      // 結果
      expect(result).toHaveLength(2);
      expect(result.every((c) => c.kind === 'history')).toBe(true);
    });

    it('空白のみのクエリも空クエリとして扱う', () => {
      // 準備
      const deps = makeDeps({ recentHistory: () => [makeHistory()] });

      // 実行
      const result = searchCandidates('   ', deps);

      // 結果
      expect(result).toHaveLength(1);
      expect(result[0]?.kind).toBe('history');
    });
  });

  describe('開いているタブのマッチング', () => {
    it('タイトルか URL に部分一致したタブが候補に入る', () => {
      // 準備
      const deps = makeDeps({
        openTabs: [
          makeTab({ id: 'a' as TabId, title: 'GitHub - home', url: 'https://github.com' }),
          makeTab({ id: 'b' as TabId, title: 'Unrelated', url: 'https://other.com' }),
        ],
      });

      // 実行
      const result = searchCandidates('github', deps);

      // 結果
      const openTabs = result.filter((c) => c.kind === 'open-tab');
      expect(openTabs).toHaveLength(1);
      expect(openTabs[0]).toMatchObject({ tabId: 'a' });
    });

    it('前方一致は部分一致よりスコアが高く、先に並ぶ', () => {
      // 準備
      const deps = makeDeps({
        openTabs: [
          makeTab({ id: 'partial' as TabId, title: 'my github page', url: 'https://a.com' }),
          makeTab({ id: 'prefix' as TabId, title: 'github top', url: 'https://b.com' }),
        ],
      });

      // 実行
      const result = searchCandidates('github', deps);

      // 結果
      const openTabs = result.filter((c) => c.kind === 'open-tab');
      expect(openTabs[0]).toMatchObject({ tabId: 'prefix', score: 1 });
      expect(openTabs[1]).toMatchObject({ tabId: 'partial', score: 0.8 });
    });
  });

  describe('URL らしい入力のとき', () => {
    it('url 候補が追加され、スキームが補完される', () => {
      // 準備
      const deps = makeDeps();

      // 実行
      const result = searchCandidates('example.com', deps);

      // 結果
      const urlCand = result.find((c) => c.kind === 'url');
      expect(urlCand).toMatchObject({ url: 'https://example.com' });
    });

    it('ただの単語なら url 候補は出ない', () => {
      // 準備
      const deps = makeDeps();

      // 実行
      const result = searchCandidates('hello', deps);

      // 結果
      expect(result.find((c) => c.kind === 'url')).toBeUndefined();
    });
  });

  describe('検索フォールバック', () => {
    it('どんなクエリでも search 候補が必ず末尾側に入る', () => {
      // 準備
      const deps = makeDeps({ engine: 'duckduckgo' });

      // 実行
      const result = searchCandidates('anything', deps);

      // 結果
      const search = result.find((c) => c.kind === 'search');
      expect(search).toMatchObject({ query: 'anything', engine: 'duckduckgo' });
      expect(result[result.length - 1]?.kind).toBe('search');
    });
  });

  describe('件数と並び', () => {
    it('スコア降順に並び、最大 8 件に切り詰める', () => {
      // 準備: open-tab 5 + history 10 + search 1 = 16 候補
      const deps = makeDeps({
        openTabs: Array.from({ length: 5 }, (_, i) =>
          makeTab({ id: `t${i}` as TabId, title: `github ${i}`, url: `https://g${i}.com` }),
        ),
        searchHistory: () =>
          Array.from({ length: 10 }, (_, i) => makeHistory({ id: i, url: `https://h${i}.com` })),
      });

      // 実行
      const result = searchCandidates('github', deps);

      // 結果
      expect(result).toHaveLength(8);
      const scores = result.map((c) => c.score);
      expect(scores).toEqual([...scores].sort((a, b) => b - a));
    });
  });
});
