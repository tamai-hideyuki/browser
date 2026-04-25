# 07. コマンドバー

対応要件：[12-command-bar.md](../requirements/12-command-bar.md)

## 起動と表示

`Cmd+T` または `Cmd+L` で発火。
- `Cmd+T`：新規タブモード（Enter で新規タブ生成）
- `Cmd+L`：URL編集モード（Enter で現在タブを遷移）
- `ESC`：閉じる

`uiStore.commandBarOpen = true` でオーバーレイ表示。

## コンポーネント構造

```
<CommandBarOverlay>           ← position: fixed, backdrop-blur
  <CommandBarPanel>           ← 中央上部
    <Input />                 ← 入力欄
    <CandidateList>           ← max 8 件
      <CandidateGroup title="Open Tabs">
        <CandidateRow>
      <CandidateGroup title="History">
      <CandidateGroup title="Bookmarks">
      <CandidateGroup title="Actions">
      <CandidateGroup title="Search">
    <Footer>                  ← ヒント表示
```

## 入力パイプライン

```
入力文字列
    │
    ▼
[Parser]   ─── prefix 検出（'/' で action モード等）
    │
    ▼
[Classifier] ── URL らしさ判定
    │
    ▼
[Aggregator] ── 並列で 5 ソースに問い合わせ
    │           ├─ openTabs (in-memory, instant)
    │           ├─ history (SQLite FTS5 via IPC)
    │           ├─ bookmarks (in-memory, instant)
    │           ├─ actions (registry filter)
    │           └─ search (常に1件: フォールバック)
    │
    ▼
[Ranker] ──── スコアリング
    │
    ▼
[Limiter] ─── 最大 8 件
    │
    ▼
[Renderer] ── React UI
```

## Parser / Classifier

```typescript
// src/shell/components/CommandBar/parser.ts
export type ParsedQuery =
  | { kind: 'action'; name: string; rest: string }      // '/' プレフィクス
  | { kind: 'url';    url: string }                      // URL とみなせる
  | { kind: 'free';   text: string };                    // それ以外

export function parse(input: string): ParsedQuery {
  const trimmed = input.trim();
  if (trimmed.startsWith('/')) {
    const [name, ...rest] = trimmed.slice(1).split(/\s+/);
    return { kind: 'action', name: name ?? '', rest: rest.join(' ') };
  }
  if (looksLikeUrl(trimmed)) {
    return { kind: 'url', url: normalizeUrl(trimmed) };
  }
  return { kind: 'free', text: trimmed };
}

function looksLikeUrl(s: string): boolean {
  if (/^[a-z]+:\/\//i.test(s)) return true;
  if (/^(localhost|\d{1,3}(\.\d{1,3}){3})(:\d+)?(\/.*)?$/.test(s)) return true;
  if (/\s/.test(s)) return false;
  if (/\.[a-z]{2,}/i.test(s)) return true;
  return false;
}

function normalizeUrl(s: string): string {
  if (/^[a-z]+:\/\//i.test(s)) return s;
  if (/^localhost|^\d/.test(s)) return `http://${s}`;
  return `https://${s}`;
}
```

## Candidate 型

```typescript
// src/shared/types/command-bar.ts
export type Candidate =
  | { kind: 'open-tab';  id: string; tabId: TabId; title: string; url: string; favicon: string | null; score: number }
  | { kind: 'history';   id: string; url: string; title: string; favicon: string | null; visitedAt: number; score: number }
  | { kind: 'bookmark';  id: string; tabId: TabId; title: string; url: string; favicon: string | null; score: number }
  | { kind: 'action';    id: string; name: string; description: string; score: number; run: () => void }
  | { kind: 'url';       id: string; url: string; score: number }
  | { kind: 'search';    id: string; query: string; engine: string; score: number };
```

## Aggregator

並列で各ソースから候補を取得し、マージする。

```typescript
async function aggregate(parsed: ParsedQuery, raw: string): Promise<Candidate[]> {
  const tasks: Promise<Candidate[]>[] = [];

  // open-tabs と bookmarks は in-memory、即時
  tasks.push(Promise.resolve(searchOpenTabs(raw)));
  tasks.push(Promise.resolve(searchBookmarks(raw)));

  // history は IPC（SQLite FTS5）
  if (raw.length >= 2) {
    tasks.push(window.api.invoke('commandBar.search', { query: raw }).then(toHistoryCandidates));
  } else {
    tasks.push(Promise.resolve([]));
  }

  // actions
  if (parsed.kind === 'action') {
    tasks.push(Promise.resolve(searchActions(parsed.name)));
  } else {
    tasks.push(Promise.resolve(searchActionsByDescription(raw)));
  }

  const all = (await Promise.all(tasks)).flat();

  // URL / Search は常に末尾に最大 1 件ずつ追加
  if (parsed.kind === 'url') {
    all.push({ kind: 'url', id: `url:${parsed.url}`, url: parsed.url, score: 0.5 });
  }
  if (parsed.kind === 'free' && raw.length > 0) {
    all.push({ kind: 'search', id: `search:${raw}`, query: raw, engine: settings.searchEngine, score: 0.3 });
  }

  return all;
}
```

## Ranker

各候補は元ソース内でローカルスコアを持つ（0..1）。マージ時に種別重みをかけて最終スコアを算出。

| 種別 | ベース重み |
|---|---|
| open-tab | 1.0 |
| action | 0.95 |
| bookmark | 0.85 |
| history | 0.6 |
| url | 0.5 |
| search | 0.3 |

ローカルスコアの算出：
- 完全一致：1.0
- prefix 一致：0.9
- substring：0.7
- fuzzy（Levenshtein 距離 / fuse.js のスコア）：0.3〜0.6

`finalScore = baseWeight * localScore + recencyBoost`
- `recencyBoost`：直近 1 時間内訪問の history は +0.1

## Action Registry

```typescript
// src/shell/components/CommandBar/actions.ts
export type Action = {
  name: string;
  description: string;
  keywords: string[];
  run: () => void | Promise<void>;
  available?: () => boolean;
};

const registry: Action[] = [];

export function registerAction(a: Action) {
  registry.push(a);
}

export function listActions(): Action[] {
  return registry.filter(a => !a.available || a.available());
}
```

### M1 で実装するアクション

| name | description |
|---|---|
| `pin` | 現在のタブをピン留め |
| `unpin` | ピン留め解除 |
| `archive` | 現在のタブをアーカイブ |
| `duplicate` | タブを複製 |
| `copy-url` | URL をコピー |
| `find` | ページ内検索 |
| `clear-history` | 履歴クリア |
| `new-space` | 新規 Space |
| `switch-space` | Space 切替（rest を引数に） |
| `settings` | 設定画面を開く |
| `reload` / `hard-reload` | リロード |

## キーボード操作

```typescript
function CommandBar() {
  const [input, setInput] = useState('');
  const [cands, setCands] = useState<Candidate[]>([]);
  const [active, setActive] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      const c = await aggregate(parse(input), input);
      const ranked = c.sort((a, b) => b.score - a.score).slice(0, 8);
      if (!cancelled) {
        setCands(ranked);
        setActive(0);
      }
    }, 50);  // debounce
    return () => { cancelled = true; clearTimeout(t); };
  }, [input]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown' || (e.ctrlKey && e.key === 'n')) { e.preventDefault(); setActive(i => Math.min(i+1, cands.length-1)); }
    if (e.key === 'ArrowUp'   || (e.ctrlKey && e.key === 'p')) { e.preventDefault(); setActive(i => Math.max(i-1, 0)); }
    if (e.key === 'Enter') { e.preventDefault(); execute(cands[active] ?? fallback(input)); }
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    if (e.key === 'Tab') { e.preventDefault(); fillInput(cands[active]); }
  }

  // ...
}
```

## execute（候補実行）

```typescript
function execute(c: Candidate) {
  switch (c.kind) {
    case 'open-tab':
      useTabsStore.getState().activateTab(c.tabId);
      break;
    case 'history':
    case 'url':
      if (mode === 'cmd-t') {
        useTabsStore.getState().createTab({ url: c.url });
      } else {
        useTabsStore.getState().navigateTab(activeTabId, c.url);
      }
      break;
    case 'search': {
      const url = buildSearchUrl(c.query, c.engine);
      if (mode === 'cmd-t') useTabsStore.getState().createTab({ url });
      else useTabsStore.getState().navigateTab(activeTabId, url);
      break;
    }
    case 'action':
      c.run();
      break;
    case 'bookmark':
      // open-tab か createTab、Pinned を即 activate
      break;
  }
  close();
}
```

## main 側：history.search ハンドラ

```typescript
registerHandler('commandBar.search', async ({ query }) => {
  const escaped = escapeFts5(query);
  const rows = getDb().prepare(`
    SELECT h.id, h.url, h.title, h.visited_at,
           bm25(history_fts) AS rank
    FROM history_fts
    JOIN history h ON h.id = history_fts.rowid
    WHERE history_fts MATCH ?
    ORDER BY rank
    LIMIT 20
  `).all(escaped);
  return rows.map(r => ({
    kind: 'history' as const,
    id: `history:${r.id}`,
    url: r.url,
    title: r.title,
    favicon: null,                  // 別途 lookup
    visitedAt: r.visited_at,
    score: scoreFromRank(r.rank, r.visited_at),
  }));
});

function escapeFts5(q: string): string {
  // 特殊文字の除去、prefix マッチ化
  const cleaned = q.replace(/["()*]/g, ' ').trim();
  return cleaned.split(/\s+/).map(t => `${t}*`).join(' ');
}
```

## 入力遅延の最適化
- 入力 → 候補表示 100ms 以内目標
- in-memory ソース（open-tabs / actions）は即時
- history は debounce 50ms + IPC 平均 30ms 以内
- 候補リストの差分更新（`React.memo` + `key={id}`）

## URL 入力時の見た目
URL とみなされた入力は、`<Input>` 自体をスキーマ強調表示（オプション、M2 以降）。

## 履歴の自動補完（オートサジェスト）
入力欄の右側に inline の灰色テキストで予想を表示（M1 簡易対応）：
```
入力:  github.c
表示:  github.com/...
```
top の候補がドメイン一致の場合のみ表示。

## モード表示
入力欄の左に小さなバッジ：
- `Cmd+T` モード → 「New Tab」
- `Cmd+L` モード → 「Go to」

## 不変条件
- コマンドバーが open のとき、フォーカスは Input にある
- close したらフォーカスは元の場所に戻る
- 入力中は WebView へのキー入力を遮断（オーバーレイで覆う）

## テスト
- ユニット：parser、ranker をプロパティテスト
- 統合：候補生成のレイテンシをベンチで継続計測
