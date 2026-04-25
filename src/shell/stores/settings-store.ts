import { create } from 'zustand';
import type { Settings, SettingsPatch } from '@shared/types/settings';
import { DEFAULT_SETTINGS } from '@shared/types/settings';
import type { Events } from '@shared/types/ipc';

type State = {
  settings: Settings;
};

type Actions = {
  hydrate(s: Settings): void;
  patch(p: SettingsPatch): Promise<void>;
  applyEvent(event: Events): void;
};

let pendingPatch: SettingsPatch = {};
let patchTimer: ReturnType<typeof setTimeout> | null = null;

const deepMerge = (a: SettingsPatch, b: SettingsPatch): SettingsPatch => ({
  general:     { ...a.general,     ...b.general } as SettingsPatch['general'],
  appearance:  { ...a.appearance,  ...b.appearance } as SettingsPatch['appearance'],
  performance: { ...a.performance, ...b.performance } as SettingsPatch['performance'],
});

export const useSettingsStore = create<State & Actions>((set, get) => ({
  settings: DEFAULT_SETTINGS,

  hydrate(s) {
    set({ settings: s });
  },

  async patch(p) {
    // 楽観的更新
    set((state) => ({
      settings: {
        general:     { ...state.settings.general,     ...(p.general     ?? {}) },
        appearance:  { ...state.settings.appearance,  ...(p.appearance  ?? {}) },
        performance: { ...state.settings.performance, ...(p.performance ?? {}) },
      },
    }));

    // debounce で main へ送信（連続変更を束ねる）
    pendingPatch = deepMerge(pendingPatch, p);
    if (patchTimer) clearTimeout(patchTimer);
    patchTimer = setTimeout(() => {
      const toSend = pendingPatch;
      pendingPatch = {};
      patchTimer = null;
      window.api.invoke('settings.patch', toSend).catch(() => {
        // 失敗時：main から fetch して整合
        window.api.invoke('settings.get', undefined).then((s) => get().hydrate(s));
      });
    }, 200);
  },

  applyEvent(event) {
    if (event.kind === 'settings.updated') {
      // pendingPatch があるときは無視（自分の更新がエコーで戻ってきただけ）
      if (patchTimer) return;
      set({ settings: event.settings });
    }
  },
}));
