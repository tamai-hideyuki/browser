import React, { useEffect, useRef } from 'react';
import { useTabsStore } from '../stores/tabs-store';
import { useUiStore } from '../stores/ui-store';
import { useSettingsStore } from '../stores/settings-store';
import type { Tab, TabId } from '@shared/types/tab';

// ── Icons ────────────────────────────────────────────────────
const Icon = ({ d, size = 14 }: { d: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const ChevronLeft  = () => <Icon d="M15 18l-6-6 6-6" />;
const ChevronRight = () => <Icon d="M9 18l6-6-6-6" />;
const Reload       = () => <Icon d="M3 12a9 9 0 0 1 15.5-6.4L21 8M21 3v5h-5M21 12a9 9 0 0 1-15.5 6.4L3 16M3 21v-5h5" />;
const Gear         = () => <Icon d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM19 12a7 7 0 0 0-.1-1.1l2.1-1.6-2-3.5-2.5 1a7 7 0 0 0-1.9-1.1l-.4-2.7h-4l-.4 2.7c-.7.3-1.3.6-1.9 1.1l-2.5-1-2 3.5L5.1 11A7 7 0 0 0 5 12c0 .4 0 .7.1 1.1l-2.1 1.6 2 3.5 2.5-1c.6.4 1.2.8 1.9 1.1l.4 2.7h4l.4-2.7c.7-.3 1.3-.6 1.9-1.1l2.5 1 2-3.5-2.1-1.6c.1-.4.1-.7.1-1.1z" />;
const Search       = () => <Icon d="M11 19a8 8 0 1 1 5.3-14 8 8 0 0 1-5.3 14zM21 21l-4.3-4.3" />;
const Plus         = () => <Icon d="M12 5v14M5 12h14" />;
const Archive      = () => <Icon d="M21 8v13H3V8M1 3h22v5H1zM10 12h4" />;
const Close        = () => <Icon d="M18 6L6 18M6 6l12 12" size={12} />;

// ── Favicon ──────────────────────────────────────────────────
const Favicon = ({ tab, size = 16 }: { tab: Tab; size?: number }) => {
  if (tab.loading) {
    return <span className="tab-favicon" style={{ width: size, height: size }}><span className="spinner" /></span>;
  }
  if (tab.faviconUrl) {
    return (
      <span className="tab-favicon" style={{ width: size, height: size }}>
        <img
          src={tab.faviconUrl}
          alt=""
          style={{ width: size, height: size }}
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
        />
      </span>
    );
  }
  const ch = (() => {
    try { return new URL(tab.url).hostname.charAt(0).toUpperCase() || '·'; }
    catch { return '·'; }
  })();
  return <span className="tab-favicon" style={{ width: size, height: size }}>{ch}</span>;
};

// ── Components ───────────────────────────────────────────────
const FavoriteTile = ({ tab }: { tab: Tab }) => {
  const activate = useTabsStore((s) => s.activateTab);
  const activeId = useTabsStore((s) => s.activeTabId);
  const openContextMenu = useUiStore((s) => s.openContextMenu);
  const isActive = activeId === tab.id;
  return (
    <button
      className={`favorite-tile${isActive ? ' active' : ''}`}
      onClick={() => activate(tab.id as TabId)}
      onContextMenu={(e) => {
        e.preventDefault();
        openContextMenu({ x: e.clientX, y: e.clientY, tabId: tab.id as TabId });
      }}
      title={tab.title || tab.url}
    >
      <Favicon tab={tab} size={28} />
    </button>
  );
};

const TabItem = ({ tab }: { tab: Tab }) => {
  const activeId = useTabsStore((s) => s.activeTabId);
  const activate = useTabsStore((s) => s.activateTab);
  const close = useTabsStore((s) => s.closeTab);
  const openContextMenu = useUiStore((s) => s.openContextMenu);
  const isActive = activeId === tab.id;

  return (
    <div
      className={`tab-item${isActive ? ' active' : ''}`}
      onClick={() => activate(tab.id as TabId)}
      onAuxClick={(e) => e.button === 1 && close(tab.id as TabId)}
      onContextMenu={(e) => {
        e.preventDefault();
        openContextMenu({ x: e.clientX, y: e.clientY, tabId: tab.id as TabId });
      }}
      title={tab.url}
    >
      <Favicon tab={tab} />
      <span className="tab-title">{tab.title || tab.url || 'New Tab'}</span>
      <button
        className="tab-close"
        onClick={(e) => { e.stopPropagation(); close(tab.id as TabId); }}
        aria-label="Close tab"
      >
        <Close />
      </button>
    </div>
  );
};

// ── Sidebar ──────────────────────────────────────────────────
export const Sidebar = () => {
  const tabs = useTabsStore((s) => s.byId);
  const activeId = useTabsStore((s) => s.activeTabId);
  const goBack = useTabsStore((s) => s.goBack);
  const goForward = useTabsStore((s) => s.goForward);
  const reload = useTabsStore((s) => s.reload);
  const sidebarWidth = useSettingsStore((s) => s.settings.appearance.sidebarWidth);
  const patchSettings = useSettingsStore((s) => s.patch);
  const openCommandBar = useUiStore((s) => s.openCommandBar);
  const openSettings = useUiStore((s) => s.openSettings);

  const allTabs = Object.values(tabs);
  const todayTabs   = allTabs.filter((t) => t.state === 'today').sort((a, b) => a.position - b.position);
  const pinnedTabs  = allTabs.filter((t) => t.state === 'pinned').sort((a, b) => a.position - b.position);
  const favorites   = pinnedTabs.slice(0, 12);
  const restPinned  = pinnedTabs.slice(12);

  const activeTab = activeId ? tabs[activeId] : undefined;

  const handleResizeStart = (e: React.MouseEvent) => {
    const startX = e.clientX;
    const startW = sidebarWidth;
    const onMove = (ev: MouseEvent) => {
      const w = Math.max(180, Math.min(400, startW + (ev.clientX - startX)));
      patchSettings({ appearance: { sidebarWidth: w } });
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const sidebarRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!activeId) return;
    const el = sidebarRef.current?.querySelector(`[data-tab-id="${activeId}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeId]);

  const urlOrPlaceholder = activeTab?.url || 'Search or enter URL';

  return (
    <div className="sidebar" style={{ width: sidebarWidth }} ref={sidebarRef}>
      {/* ── Top toolbar ─────────────────────────────────── */}
      <div className="sidebar-toolbar">
        <button
          className="tool-btn"
          disabled={!activeTab?.canGoBack}
          onClick={() => activeId && goBack(activeId)}
          title="戻る (Cmd+[)"
        ><ChevronLeft /></button>
        <button
          className="tool-btn"
          disabled={!activeTab?.canGoForward}
          onClick={() => activeId && goForward(activeId)}
          title="進む (Cmd+])"
        ><ChevronRight /></button>
        <button
          className="tool-btn"
          disabled={!activeId}
          onClick={() => activeId && reload(activeId)}
          title="リロード (Cmd+R)"
        ><Reload /></button>
        <div style={{ flex: 1 }} />
        <button className="tool-btn" onClick={openSettings} title="設定 (Cmd+,)">
          <Gear />
        </button>
      </div>

      {/* ── Search bar ──────────────────────────────────── */}
      <button
        className="search-bar"
        onClick={() => openCommandBar(activeTab ? 'editUrl' : 'newTab')}
        title="クリックで開く (Cmd+L / Cmd+T)"
      >
        <span className="search-bar-icon"><Search /></span>
        <span className="search-bar-text">{urlOrPlaceholder}</span>
      </button>

      {/* ── Scrollable main area ────────────────────────── */}
      <div className="sidebar-main">
        {/* Favorites */}
        {favorites.length > 0 && (
          <div className="favorites-grid">
            {favorites.map((t) => <FavoriteTile key={t.id} tab={t} />)}
          </div>
        )}

        {/* Pinned */}
        {restPinned.length > 0 && (
          <div className="sidebar-section">
            <div className="section-label">Pinned</div>
            {restPinned.map((t) => (
              <div key={t.id} data-tab-id={t.id}><TabItem tab={t} /></div>
            ))}
          </div>
        )}

        {/* New Tab */}
        <button className="new-tab-btn" onClick={() => openCommandBar('newTab')} title="新規タブ (Cmd+T)">
          <Plus /> <span>New Tab</span>
        </button>

        {/* Today */}
        <div className="sidebar-section today-section">
          {todayTabs.map((t) => (
            <div key={t.id} data-tab-id={t.id}><TabItem tab={t} /></div>
          ))}
          {todayTabs.length === 0 && (
            <div className="empty-hint">Cmd+T で新規タブを開く</div>
          )}
        </div>
      </div>

      {/* ── Bottom toolbar ──────────────────────────────── */}
      <div className="sidebar-bottom">
        <button
          className="tool-btn"
          onClick={() => useUiStore.getState().openArchive()}
          title="アーカイブ"
        ><Archive /></button>
        <div className="spaces-dots">
          <button
            className="space-dot active"
            aria-label="Default Space"
            title="Default（複数 Space は未実装）"
            disabled
          />
        </div>
        <button
          className="tool-btn"
          title="新規 Space（未実装）"
          disabled
        ><Plus /></button>
      </div>

      <div className="resize-handle" onMouseDown={handleResizeStart} />
    </div>
  );
};
