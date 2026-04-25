import { create } from 'zustand';
import type { Events } from '@shared/types/ipc';
import type { TabId } from '@shared/types/tab';

type ContextMenuState = { x: number; y: number; tabId: TabId } | null;

type State = {
  commandBar: { open: boolean; mode: 'newTab' | 'editUrl' };
  settingsOpen: boolean;
  archiveOpen: boolean;
  contextMenu: ContextMenuState;
};

type Actions = {
  openCommandBar(mode: 'newTab' | 'editUrl'): void;
  closeCommandBar(): void;
  openSettings(): void;
  closeSettings(): void;
  openArchive(): void;
  closeArchive(): void;
  openContextMenu(input: { x: number; y: number; tabId: TabId }): void;
  closeContextMenu(): void;
  applyEvent(event: Events): void;
};

export const useUiStore = create<State & Actions>((set) => ({
  commandBar: { open: false, mode: 'newTab' },
  settingsOpen: false,
  archiveOpen: false,
  contextMenu: null,

  openCommandBar(mode) {
    set({ commandBar: { open: true, mode } });
  },

  closeCommandBar() {
    set({ commandBar: { open: false, mode: 'newTab' } });
  },

  openSettings() {
    set({ settingsOpen: true });
  },

  closeSettings() {
    set({ settingsOpen: false });
  },

  openArchive() {
    set({ archiveOpen: true });
  },

  closeArchive() {
    set({ archiveOpen: false });
  },

  openContextMenu(input) {
    set({ contextMenu: input });
  },

  closeContextMenu() {
    set({ contextMenu: null });
  },

  applyEvent() {
    // 現状なし
  },
}));
