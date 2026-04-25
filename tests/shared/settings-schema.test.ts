import { describe, it, expect } from 'vitest';
import {
  SettingsSchema,
  DEFAULT_SETTINGS,
  buildSearchUrl,
  SearchEngines,
} from '@shared/types/settings';

describe('SettingsSchema', () => {
  describe('空の入力をパースしたとき', () => {
    it('全カテゴリにデフォルト値が補われる', () => {
      // 準備
      const input = {};

      // 実行
      const result = SettingsSchema.parse(input);

      // 結果
      expect(result.general.defaultSearchEngine).toBe('google');
      expect(result.appearance.theme).toBe('system');
      expect(result.appearance.sidebarWidth).toBe(240);
    });
  });

  describe('部分的な入力をパースしたとき', () => {
    it('指定された値だけ採用し、他はデフォルト', () => {
      // 準備
      const input = { appearance: { theme: 'dark' } };

      // 実行
      const result = SettingsSchema.parse(input);

      // 結果
      expect(result.appearance.theme).toBe('dark');
      expect(result.appearance.sidebarWidth).toBe(240);                  // デフォルト
      expect(result.general.defaultSearchEngine).toBe('google');         // デフォルト
    });
  });

  describe('不正な値が含まれるとき', () => {
    it('未知の検索エンジンは弾く', () => {
      // 準備
      const input = { general: { defaultSearchEngine: 'yahoo' } };

      // 実行・結果
      expect(() => SettingsSchema.parse(input)).toThrow();
    });

    it('範囲外のサイドバー幅は弾く', () => {
      // 実行・結果
      expect(() => SettingsSchema.parse({ appearance: { sidebarWidth: 100 } })).toThrow();
      expect(() => SettingsSchema.parse({ appearance: { sidebarWidth: 500 } })).toThrow();
    });

    it('範囲内のサイドバー幅は受け入れる', () => {
      // 準備
      const input = { appearance: { sidebarWidth: 240 } };

      // 実行
      const result = SettingsSchema.parse(input);

      // 結果
      expect(result.appearance.sidebarWidth).toBe(240);
    });

    it('未知のテーマは弾く', () => {
      // 準備
      const input = { appearance: { theme: 'sepia' } };

      // 実行・結果
      expect(() => SettingsSchema.parse(input)).toThrow();
    });
  });

  describe('DEFAULT_SETTINGS', () => {
    it('スキーマに準拠している（自分自身を再パース可能）', () => {
      // 実行
      const result = SettingsSchema.parse(DEFAULT_SETTINGS);

      // 結果
      expect(result).toEqual(DEFAULT_SETTINGS);
    });
  });
});

describe('buildSearchUrl', () => {
  describe('クエリ文字列を渡したとき', () => {
    it('Google のテンプレートに差し込む', () => {
      // 実行
      const url = buildSearchUrl('foo', 'google');

      // 結果
      expect(url).toBe('https://www.google.com/search?q=foo');
    });

    it('DuckDuckGo のテンプレートに差し込む', () => {
      // 実行
      const url = buildSearchUrl('foo', 'duckduckgo');

      // 結果
      expect(url).toBe('https://duckduckgo.com/?q=foo');
    });

    it('Bing のテンプレートに差し込む', () => {
      // 実行
      const url = buildSearchUrl('foo', 'bing');

      // 結果
      expect(url).toBe('https://www.bing.com/search?q=foo');
    });
  });

  describe('特殊文字が含まれるクエリ', () => {
    it('スペースは %20 にエンコードされる', () => {
      // 実行
      const url = buildSearchUrl('hello world', 'google');

      // 結果
      expect(url).toContain('hello%20world');
    });

    it('& は %26 にエンコードされる', () => {
      // 実行
      const url = buildSearchUrl('a&b', 'google');

      // 結果
      expect(url).toContain('%26');
    });

    it('日本語はパーセントエンコードされる', () => {
      // 実行
      const url = buildSearchUrl('テスト', 'google');

      // 結果
      expect(url).toContain('%E3%83%86%E3%82%B9%E3%83%88');
    });
  });
});

describe('SearchEngines', () => {
  it('全エンジンが name と urlTemplate を持つ', () => {
    // 準備
    const keys = Object.keys(SearchEngines) as Array<keyof typeof SearchEngines>;

    // 実行・結果
    for (const key of keys) {
      expect(SearchEngines[key].name).toBeTruthy();
      expect(SearchEngines[key].urlTemplate).toContain('%s');
    }
  });
});
