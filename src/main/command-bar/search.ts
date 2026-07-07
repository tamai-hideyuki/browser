import { resolveUrl } from '../navigation/url-resolver';
import type { Candidate } from '@shared/types/command-bar';
import type { HistoryEntry } from '@shared/types/history';
import type { Tab } from '@shared/types/tab';
import type { SearchEngine } from '@shared/types/settings';

// DB・設定への依存は呼び出し側（IPC ハンドラ）が注入する。
// この関数自体は純粋なロジックなので、Electron なしでテストできる。
export type CommandBarSearchDeps = {
  openTabs: Tab[];
  engine: SearchEngine;
  recentHistory(limit: number): HistoryEntry[];
  searchHistory(query: string, limit: number): HistoryEntry[];
};

const MAX_CANDIDATES = 8;

export const searchCandidates = (query: string, deps: CommandBarSearchDeps): Candidate[] => {
  const q = query.trim();

  // 空クエリ: 直近の履歴をそのまま出す
  if (q.length === 0) {
    return deps.recentHistory(MAX_CANDIDATES).map((h) => historyCandidate(h, 0.5));
  }

  const candidates: Candidate[] = [];

  // open tabs (in-memory)
  const lower = q.toLowerCase();
  for (const tab of deps.openTabs) {
    const t = (tab.title || '').toLowerCase();
    const u = tab.url.toLowerCase();
    if (t.includes(lower) || u.includes(lower)) {
      candidates.push({
        kind: 'open-tab',
        id: `open:${tab.id}`,
        tabId: tab.id,
        title: tab.title || tab.url,
        url: tab.url,
        favicon: tab.faviconUrl,
        score: t.startsWith(lower) || u.startsWith(lower) ? 1 : 0.8,
      });
    }
  }

  // history
  for (const h of deps.searchHistory(q, 10)) {
    candidates.push(historyCandidate(h, 0.6));
  }

  // url fallback
  const looksUrl = /^[a-z]+:\/\//i.test(q) || /\.[a-z]{2,}/i.test(q) || /^localhost/i.test(q);
  if (looksUrl) {
    candidates.push({
      kind: 'url',
      id: `url:${q}`,
      url: resolveUrl(q, deps.engine),
      score: 0.5,
    });
  }

  // search fallback
  candidates.push({
    kind: 'search',
    id: `search:${q}`,
    query: q,
    engine: deps.engine,
    score: 0.3,
  });

  return candidates.sort((a, b) => b.score - a.score).slice(0, MAX_CANDIDATES);
};

const historyCandidate = (h: HistoryEntry, score: number): Candidate => ({
  kind: 'history',
  id: `history:${h.id}`,
  url: h.url,
  title: h.title,
  favicon: null,
  visitedAt: h.visitedAt,
  score,
});
