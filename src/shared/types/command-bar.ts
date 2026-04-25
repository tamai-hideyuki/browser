import type { TabId } from './tab';

export type Candidate =
  | { kind: 'open-tab'; id: string; tabId: TabId; title: string; url: string; favicon: string | null; score: number }
  | { kind: 'history';  id: string; url: string; title: string; favicon: string | null; visitedAt: number; score: number }
  | { kind: 'url';      id: string; url: string; score: number }
  | { kind: 'search';   id: string; query: string; engine: string; score: number };
