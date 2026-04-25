import React, { useEffect, useState } from 'react';
import { useUiStore } from '../stores/ui-store';
import { useTabsStore } from '../stores/tabs-store';
import type { Tab, TabId } from '@shared/types/tab';

const formatDate = (ms: number | null): string => {
  if (!ms) return '';
  const d = new Date(ms);
  return d.toLocaleString('ja-JP', { dateStyle: 'short', timeStyle: 'short' });
};

const hostOf = (url: string): string => {
  try { return new URL(url).hostname; }
  catch { return url; }
};

export const ArchiveModal = () => {
  const open = useUiStore((s) => s.archiveOpen);
  const close = useUiStore((s) => s.closeArchive);
  const [items, setItems] = useState<Tab[]>([]);
  const [loading, setLoading] = useState(false);

  const reload = async () => {
    setLoading(true);
    try {
      const list = await window.api.invoke('archive.list', { limit: 200 });
      setItems(list);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) void reload();
  }, [open]);

  if (!open) return null;

  const restore = async (tabId: TabId) => {
    await window.api.invoke('tab.restore', { tabId });
    setItems((prev) => prev.filter((t) => t.id !== tabId));
    await useTabsStore.getState().activateTab(tabId);
    close();
  };

  const remove = async (tabId: TabId) => {
    await window.api.invoke('tab.deletePermanent', { tabId });
    setItems((prev) => prev.filter((t) => t.id !== tabId));
  };

  return (
    <div className="settings-overlay" onClick={close}>
      <div className="archive-modal" onClick={(e) => e.stopPropagation()}>
        <header className="archive-header">
          <h2>アーカイブ</h2>
          <span className="archive-count">{items.length} 件</span>
        </header>
        <div className="archive-body">
          {loading && items.length === 0 && (
            <div className="archive-empty">読み込み中…</div>
          )}
          {!loading && items.length === 0 && (
            <div className="archive-empty">アーカイブされたタブはありません</div>
          )}
          {items.map((tab) => (
            <div key={tab.id} className="archive-item">
              <div className="archive-item-icon">
                {tab.faviconUrl ? (
                  <img src={tab.faviconUrl} alt="" />
                ) : (
                  <span>{hostOf(tab.url).charAt(0).toUpperCase() || '·'}</span>
                )}
              </div>
              <div className="archive-item-meta">
                <div className="archive-item-title">{tab.title || hostOf(tab.url)}</div>
                <div className="archive-item-url">{tab.url}</div>
                <div className="archive-item-time">アーカイブ: {formatDate(tab.archivedAt)}</div>
              </div>
              <div className="archive-item-actions">
                <button
                  className="archive-action restore"
                  onClick={() => restore(tab.id as TabId)}
                  title="復元"
                >復元</button>
                <button
                  className="archive-action danger"
                  onClick={() => remove(tab.id as TabId)}
                  title="完全に削除"
                >削除</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
