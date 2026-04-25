import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockBroadcaster, type MockBroadcaster } from '../../helpers/mocks';

// SettingsRepository を mock（実 DB は使わない）
const mockSettingsStore = new Map<string, unknown>();
vi.mock('../../../src/main/storage/repositories/settings-repo', () => ({
  SettingsRepository: {
    getRaw: vi.fn(() => Object.fromEntries(mockSettingsStore)),
    setCategory: vi.fn((key: string, value: unknown) => {
      mockSettingsStore.set(key, value);
    }),
  },
}));

// db.ts も連鎖して better-sqlite3 を読みに行くので mock
vi.mock('../../../src/main/storage/db', () => ({
  getDb: vi.fn(),
  closeDb: vi.fn(),
}));

import { SettingsService } from '../../../src/main/settings/settings-service';

describe('SettingsService', () => {
  let broadcaster: MockBroadcaster;
  let service: SettingsService;

  beforeEach(() => {
    mockSettingsStore.clear();
    broadcaster = createMockBroadcaster();
    service = new SettingsService(broadcaster as any);
  });

  describe('init() を呼んだとき', () => {
    it('DB に値がなければデフォルト設定が読み込まれる', () => {
      // 準備: 空の DB（beforeEach で clear 済み）

      // 実行
      service.init();

      // 結果
      expect(service.getAll().general.defaultSearchEngine).toBe('google');
      expect(service.getAll().appearance.theme).toBe('system');
    });

    it('DB に保存された値があればそれを優先する', () => {
      // 準備
      mockSettingsStore.set('appearance', { theme: 'dark', sidebarWidth: 300 });
      mockSettingsStore.set('general', { defaultSearchEngine: 'duckduckgo', newTabUrl: 'about:blank' });

      // 実行
      service.init();

      // 結果
      expect(service.getAll().appearance.theme).toBe('dark');
      expect(service.getAll().appearance.sidebarWidth).toBe(300);
      expect(service.getAll().general.defaultSearchEngine).toBe('duckduckgo');
    });

    it('壊れた値が混じっていてもデフォルトにフォールバックする', () => {
      // 準備
      mockSettingsStore.set('appearance', { theme: 'invalid-theme' });

      // 実行
      service.init();

      // 結果: バリデーション失敗 → DEFAULT_SETTINGS にフォールバック
      expect(service.getAll().appearance.theme).toBe('system');
    });
  });

  describe('patch() を呼んだとき', () => {
    beforeEach(() => {
      service.init();
    });

    it('指定したカテゴリのフィールドだけ更新される', () => {
      // 実行
      service.patch({ appearance: { theme: 'dark' } });

      // 結果: テーマが変わり、他は維持
      const s = service.getAll();
      expect(s.appearance.theme).toBe('dark');
      expect(s.appearance.sidebarWidth).toBe(240);                       // 既定値のまま
      expect(s.general.defaultSearchEngine).toBe('google');
    });

    it('複数カテゴリを同時に更新できる', () => {
      // 実行
      service.patch({
        appearance: { theme: 'light' },
        general: { defaultSearchEngine: 'bing' },
      });

      // 結果
      const s = service.getAll();
      expect(s.appearance.theme).toBe('light');
      expect(s.general.defaultSearchEngine).toBe('bing');
    });

    it('settings.updated イベントを発火する', () => {
      // 実行
      service.patch({ appearance: { theme: 'dark' } });

      // 結果
      const events = broadcaster.emittedEvents.filter((e) => e.kind === 'settings.updated');
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        kind: 'settings.updated',
        settings: expect.objectContaining({
          appearance: expect.objectContaining({ theme: 'dark' }),
        }),
      });
    });

    it('変更されたカテゴリだけ DB に書き込まれる', () => {
      // 実行
      service.patch({ appearance: { theme: 'dark' } });

      // 結果: appearance だけ書き込まれる
      expect(mockSettingsStore.has('appearance')).toBe(true);
      expect(mockSettingsStore.has('general')).toBe(false);
      expect(mockSettingsStore.has('performance')).toBe(false);
    });

    it('不正な値はバリデーションで弾かれる', () => {
      // 実行・結果
      expect(() =>
        service.patch({ appearance: { sidebarWidth: 100 } as any })
      ).toThrow();

      // 結果: 内部状態は元のまま
      expect(service.getAll().appearance.sidebarWidth).toBe(240);
    });
  });

  describe('getAll() を連続で呼んだとき', () => {
    it('同じインスタンスが返る（patch するまで）', () => {
      // 準備
      service.init();

      // 実行
      const a = service.getAll();
      const b = service.getAll();

      // 結果
      expect(a).toBe(b);
    });

    it('patch 後は新しいインスタンスが返る', () => {
      // 準備
      service.init();
      const before = service.getAll();

      // 実行
      service.patch({ appearance: { theme: 'dark' } });
      const after = service.getAll();

      // 結果
      expect(after).not.toBe(before);
    });
  });
});
