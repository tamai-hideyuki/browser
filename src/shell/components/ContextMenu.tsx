import React, { useEffect, useRef } from 'react';
import { useUiStore } from '../stores/ui-store';
import { useTabsStore } from '../stores/tabs-store';
import type { TabId } from '@shared/types/tab';

export const ContextMenu = () => {
  const ctx = useUiStore((s) => s.contextMenu);
  const close = useUiStore((s) => s.closeContextMenu);
  const tab = useTabsStore((s) => (ctx ? s.byId[ctx.tabId] : undefined));
  const ref = useRef<HTMLDivElement | null>(null);

  // クリック外しと ESC で閉じる
  useEffect(() => {
    if (!ctx) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('mousedown', onClick);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onClick);
      window.removeEventListener('keydown', onKey);
    };
  }, [ctx, close]);

  if (!ctx || !tab) return null;

  const isPinned = tab.state === 'pinned';
  const tabId = ctx.tabId as TabId;

  const run = (fn: () => void) => () => { fn(); close(); };

  return (
    <div
      ref={ref}
      className="context-menu"
      style={{ left: ctx.x, top: ctx.y }}
      onClick={(e) => e.stopPropagation()}
    >
      {isPinned ? (
        <button className="context-menu-item" onClick={run(() => useTabsStore.getState().unpinTab(tabId))}>
          ピン留めを解除
        </button>
      ) : (
        <button className="context-menu-item" onClick={run(() => useTabsStore.getState().pinTab(tabId))}>
          ピン留め
        </button>
      )}
      <button
        className="context-menu-item"
        onClick={run(() => {
          if (tab.url) navigator.clipboard.writeText(tab.url).catch(() => {});
        })}
      >
        URL をコピー
      </button>
      <button
        className="context-menu-item"
        onClick={run(() => useTabsStore.getState().reload(tabId))}
      >
        リロード
      </button>
      <div className="context-menu-divider" />
      <button
        className="context-menu-item danger"
        onClick={run(() => useTabsStore.getState().closeTab(tabId))}
      >
        閉じる
      </button>
    </div>
  );
};
