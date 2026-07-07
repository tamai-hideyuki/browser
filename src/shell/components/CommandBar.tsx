import React, { useEffect, useRef, useState } from 'react';
import { useUiStore } from '../stores/ui-store';
import { useTabsStore } from '../stores/tabs-store';
import type { Candidate } from '@shared/types/command-bar';
import { SearchEngines, buildSearchUrl, type SearchEngine } from '@shared/types/settings';

const kindLabel = (c: Candidate): string => {
  switch (c.kind) {
    case 'open-tab': return 'Open Tab';
    case 'history':  return 'History';
    case 'url':      return 'URL';
    case 'search':   return 'Search';
  }
};

const labelOf = (c: Candidate): { label: string; sub?: string } => {
  switch (c.kind) {
    case 'open-tab': return { label: c.title || c.url, sub: c.url };
    case 'history':  return { label: c.title || c.url, sub: c.url };
    case 'url':      return { label: c.url };
    case 'search': {
      const engineName = SearchEngines[c.engine as SearchEngine]?.name ?? c.engine;
      return { label: `${engineName} で "${c.query}" を検索` };
    }
  }
};

export const CommandBar = () => {
  const open = useUiStore((s) => s.commandBar.open);
  const mode = useUiStore((s) => s.commandBar.mode);
  const close = useUiStore((s) => s.closeCommandBar);
  const activeId = useTabsStore((s) => s.activeTabId);
  const activeTab = useTabsStore((s) => (s.activeTabId ? s.byId[s.activeTabId] : undefined));

  const [input, setInput] = useState('');
  const [cands, setCands] = useState<Candidate[]>([]);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // 開閉時の初期値
  useEffect(() => {
    if (open) {
      setInput(mode === 'editUrl' && activeTab ? activeTab.url : '');
      setActive(0);
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 0);
    }
  }, [open, mode, activeTab]);

  // 候補生成
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      const list = await window.api.invoke('commandBar.search', { query: input });
      if (!cancelled) {
        setCands(list);
        setActive(0);
      }
    }, 50);
    return () => { cancelled = true; clearTimeout(t); };
  }, [input, open]);

  if (!open) return null;

  // newTab モードなら新規タブ、editUrl モードならアクティブタブで開く
  const openOrNavigate = async (url: string) => {
    if (mode === 'newTab' || !activeId) {
      await useTabsStore.getState().createTab({ url });
    } else {
      await useTabsStore.getState().navigateTab(activeId, url);
    }
  };

  const execute = async (c: Candidate) => {
    switch (c.kind) {
      case 'open-tab':
        await useTabsStore.getState().activateTab(c.tabId);
        break;
      case 'history':
      case 'url':
        await openOrNavigate(c.url);
        break;
      case 'search':
        await openOrNavigate(buildSearchUrl(c.query, c.engine as SearchEngine));
        break;
    }
    close();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
      return;
    }
    if (e.key === 'ArrowDown' || (e.ctrlKey && e.key === 'n')) {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, Math.max(cands.length - 1, 0)));
      return;
    }
    if (e.key === 'ArrowUp' || (e.ctrlKey && e.key === 'p')) {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const sel = cands[active];
      if (sel) {
        void execute(sel);
      } else if (input.trim().length > 0) {
        // 候補がまだ無いときは入力値をそのまま開く
        void openOrNavigate(input.trim());
        close();
      }
    }
  };

  return (
    <div className="command-bar-overlay" onClick={close}>
      <div className="command-bar" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="command-bar-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={mode === 'editUrl' ? 'URL を編集...' : 'URL や検索ワードを入力...'}
          spellCheck={false}
          autoCorrect="off"
        />
        {cands.length > 0 && (
          <div className="command-bar-list">
            {cands.map((c, i) => {
              const { label, sub } = labelOf(c);
              return (
                <div
                  key={c.id}
                  className={`command-bar-item${i === active ? ' active' : ''}`}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => execute(c)}
                >
                  <span className="kind-tag">{kindLabel(c)}</span>
                  <div className="label-line">
                    <span className="label">{label}</span>
                    {sub && <span className="url">{sub}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
