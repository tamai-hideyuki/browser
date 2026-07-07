import React, { useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { CommandBar } from './components/CommandBar';
import { WebViewArea } from './components/WebViewArea';
import { SettingsModal } from './components/SettingsModal';
import { ContextMenu } from './components/ContextMenu';
import { ArchiveModal } from './components/ArchiveModal';
import { useUiStore } from './stores/ui-store';
import { useTabsStore } from './stores/tabs-store';
import { useSettingsStore } from './stores/settings-store';
import { matchShortcut } from '@shared/shortcuts';
import type { Theme } from '@shared/types/settings';
import type { ShortcutAction } from '@shared/types/ipc';

const isMac = (): boolean =>
  navigator.platform.toLowerCase().includes('mac');

const applyThemeAttribute = (theme: Theme): void => {
  const resolved =
    theme === 'system'
      ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
      : theme;
  document.documentElement.dataset['theme'] = resolved;
};

const dispatchShortcut = (action: ShortcutAction): void => {
  const tabs = useTabsStore.getState();
  const ui = useUiStore.getState();
  const id = tabs.activeTabId;
  switch (action) {
    case 'newTab':       ui.openCommandBar('newTab'); break;
    case 'editUrl':      ui.openCommandBar('editUrl'); break;
    case 'closeTab':     if (id) tabs.closeTab(id); break;
    case 'reload':       if (id) tabs.reload(id, false); break;
    case 'reloadHard':   if (id) tabs.reload(id, true); break;
    case 'back':         if (id) tabs.goBack(id); break;
    case 'forward':      if (id) tabs.goForward(id); break;
    case 'openSettings': ui.openSettings(); break;
    case 'escape':       ui.closeCommandBar(); break;
  }
};

export const App = () => {
  const theme = useSettingsStore((s) => s.settings.appearance.theme);
  const overlayOpen = useUiStore((s) => s.commandBar.open || s.settingsOpen || s.archiveOpen);
  const activeTabHasError = useTabsStore((s) => !!(s.activeTabId && s.errorsByTabId[s.activeTabId]));

  // オーバーレイ表示中・エラー表示中は webview を隠す
  // （webview は常に shell の DOM の上に乗るネイティブビューなので、隠さないと下の UI が見えない）
  useEffect(() => {
    window.api.invoke('tab.setActiveViewVisible', { visible: !overlayOpen && !activeTabHasError });
  }, [overlayOpen, activeTabHasError]);

  // テーマ適用
  useEffect(() => {
    applyThemeAttribute(theme);
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const onChange = () => { if (theme === 'system') applyThemeAttribute(theme); };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [theme]);

  // shell renderer 自身でのキーボード（フォーカスが shell にあるとき）
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const action = matchShortcut({
        key: e.key,
        meta: isMac() ? e.metaKey : e.ctrlKey,
        shift: e.shiftKey,
      });

      if (e.key === 'Escape') {
        // モーダル類も閉じる
        useUiStore.getState().closeArchive();
        useUiStore.getState().closeSettings();
      }

      if (action) {
        e.preventDefault();
        dispatchShortcut(action);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // WebView にフォーカスがあるとき、main 側で捕捉されて IPC で送られてくる
  useEffect(() => {
    const off = window.api.on((event) => {
      if (event.kind === 'shortcut') {
        dispatchShortcut(event.action);
      }
    });
    return off;
  }, []);

  return (
    <div className="app">
      <Sidebar />
      <WebViewArea />
      <CommandBar />
      <SettingsModal />
      <ArchiveModal />
      <ContextMenu />
    </div>
  );
};
