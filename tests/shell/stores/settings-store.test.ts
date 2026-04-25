import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { installMockApi, type MockApi } from '../../helpers/mocks';
import { DEFAULT_SETTINGS, type Settings } from '@shared/types/settings';

let api: MockApi;

beforeEach(async () => {
  vi.useFakeTimers();
  api = installMockApi();
  api.__setHandler('settings.patch', () => undefined);
  api.__setHandler('settings.get',   () => DEFAULT_SETTINGS);

  const mod = await import('../../../src/shell/stores/settings-store');
  mod.useSettingsStore.setState({ settings: DEFAULT_SETTINGS });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('settingsStore', () => {
  describe('hydrate(s) を呼んだとき', () => {
    it('store の settings が引数の値で初期化される', async () => {
      // 準備
      const { useSettingsStore } = await import('../../../src/shell/stores/settings-store');
      const next: Settings = {
        ...DEFAULT_SETTINGS,
        appearance: { ...DEFAULT_SETTINGS.appearance, theme: 'dark' },
      };

      // 実行
      useSettingsStore.getState().hydrate(next);

      // 結果
      expect(useSettingsStore.getState().settings.appearance.theme).toBe('dark');
    });
  });

  describe('patch(p) を呼んだとき', () => {
    it('呼び出し直後に楽観的に状態が反映される', async () => {
      // 準備
      const { useSettingsStore } = await import('../../../src/shell/stores/settings-store');

      // 実行
      void useSettingsStore.getState().patch({ appearance: { theme: 'dark' } });

      // 結果（IPC 完了を待たず、即時反映されている）
      expect(useSettingsStore.getState().settings.appearance.theme).toBe('dark');
    });

    it('200ms debounce 後にだけ IPC が呼ばれる', async () => {
      // 準備
      const { useSettingsStore } = await import('../../../src/shell/stores/settings-store');

      // 実行
      void useSettingsStore.getState().patch({ appearance: { theme: 'dark' } });

      // 結果: 200ms 経過前は IPC が呼ばれていない
      expect(api.__invokeCalls.filter((c) => c.channel === 'settings.patch')).toHaveLength(0);

      // 実行（時間を進める）
      await vi.advanceTimersByTimeAsync(199);
      expect(api.__invokeCalls.filter((c) => c.channel === 'settings.patch')).toHaveLength(0);

      await vi.advanceTimersByTimeAsync(2);

      // 結果: ちょうど 200ms 超で IPC が 1 回発行される
      const patchCalls = api.__invokeCalls.filter((c) => c.channel === 'settings.patch');
      expect(patchCalls).toHaveLength(1);
    });

    it('連続した patch は 1 回の IPC にまとめられる', async () => {
      // 準備
      const { useSettingsStore } = await import('../../../src/shell/stores/settings-store');

      // 実行: 100ms 間隔で複数回 patch
      void useSettingsStore.getState().patch({ appearance: { theme: 'dark' } });
      await vi.advanceTimersByTimeAsync(50);
      void useSettingsStore.getState().patch({ appearance: { sidebarWidth: 300 } });
      await vi.advanceTimersByTimeAsync(50);
      void useSettingsStore.getState().patch({ general: { defaultSearchEngine: 'bing' } });

      await vi.advanceTimersByTimeAsync(250);

      // 結果: IPC は 1 回だけ、全変更がマージされて送信
      const patchCalls = api.__invokeCalls.filter((c) => c.channel === 'settings.patch');
      expect(patchCalls).toHaveLength(1);
      expect(patchCalls[0]!.input).toMatchObject({
        appearance: { theme: 'dark', sidebarWidth: 300 },
        general: { defaultSearchEngine: 'bing' },
      });
    });
  });

  describe('settings.updated イベントを受けたとき', () => {
    it('debounce 中の自分の変更のエコーは無視される', async () => {
      // 準備
      const { useSettingsStore } = await import('../../../src/shell/stores/settings-store');

      // 実行: 楽観的に dark に切替（IPC は debounce 中）
      void useSettingsStore.getState().patch({ appearance: { theme: 'dark' } });

      // 実行: その途中に main から古い値の echo が届く
      const echoed: Settings = {
        ...DEFAULT_SETTINGS,
        appearance: { ...DEFAULT_SETTINGS.appearance, theme: 'light' },
      };
      useSettingsStore.getState().applyEvent({ kind: 'settings.updated', settings: echoed });

      // 結果: ローカルの楽観値（dark）が維持される
      expect(useSettingsStore.getState().settings.appearance.theme).toBe('dark');
    });

    it('debounce 完了後の更新イベントは反映される', async () => {
      // 準備
      const { useSettingsStore } = await import('../../../src/shell/stores/settings-store');
      void useSettingsStore.getState().patch({ appearance: { theme: 'dark' } });
      await vi.advanceTimersByTimeAsync(250);   // debounce 完了

      // 実行: main から別マシンや別操作由来の更新が届く
      const fromElsewhere: Settings = {
        ...DEFAULT_SETTINGS,
        appearance: { ...DEFAULT_SETTINGS.appearance, theme: 'light' },
      };
      useSettingsStore.getState().applyEvent({ kind: 'settings.updated', settings: fromElsewhere });

      // 結果: 受信した値で上書きされる
      expect(useSettingsStore.getState().settings.appearance.theme).toBe('light');
    });
  });
});
