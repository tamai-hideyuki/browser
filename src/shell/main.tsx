import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { useTabsStore } from './stores/tabs-store';
import { useUiStore } from './stores/ui-store';
import { useSettingsStore } from './stores/settings-store';

const bootstrap = async (): Promise<void> => {
  const data = await window.api.invoke('bootstrap.fetch', undefined);
  useSettingsStore.getState().hydrate(data.settings);
  useTabsStore.getState().hydrate(data.tabs, data.activeTabId);

  const root = createRoot(document.getElementById('root')!);
  root.render(<App />);

  window.api.on((event) => {
    useTabsStore.getState().applyEvent(event);
    useUiStore.getState().applyEvent(event);
    useSettingsStore.getState().applyEvent(event);
  });
};

bootstrap();
