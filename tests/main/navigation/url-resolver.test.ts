import { describe, it, expect } from 'vitest';
import { resolveUrl } from '../../../src/main/navigation/url-resolver';

describe('resolveUrl', () => {
  describe('入力がスキーム付き URL のとき', () => {
    it('そのまま返す', () => {
      // 準備
      const input = 'https://example.com/path';

      // 実行
      const result = resolveUrl(input);

      // 結果
      expect(result).toBe('https://example.com/path');
    });

    it('http スキームを保持する', () => {
      // 準備
      const input = 'http://example.com';

      // 実行
      const result = resolveUrl(input);

      // 結果
      expect(result).toBe('http://example.com');
    });

    it('about: スキームを保持する', () => {
      // 準備
      const input = 'about:blank';

      // 実行
      const result = resolveUrl(input);

      // 結果
      expect(result).toBe('about:blank');
    });

    it('file: スキームを保持する', () => {
      // 準備
      const input = 'file:///Users/foo/bar.html';

      // 実行
      const result = resolveUrl(input);

      // 結果
      expect(result).toBe('file:///Users/foo/bar.html');
    });
  });

  describe('入力がドメインらしい文字列のとき', () => {
    it('TLD 付きドメインに https:// を補う', () => {
      // 準備
      const input = 'example.com';

      // 実行
      const result = resolveUrl(input);

      // 結果
      expect(result).toBe('https://example.com');
    });

    it('サブドメイン付きドメインにも https:// を補う', () => {
      // 準備
      const input = 'docs.example.com/path';

      // 実行
      const result = resolveUrl(input);

      // 結果
      expect(result).toBe('https://docs.example.com/path');
    });

    it('localhost は http:// で扱う', () => {
      // 準備
      const cases: Array<[string, string]> = [
        ['localhost', 'http://localhost'],
        ['localhost:3000', 'http://localhost:3000'],
        ['localhost:3000/path', 'http://localhost:3000/path'],
      ];

      // 実行・結果
      for (const [input, expected] of cases) {
        expect(resolveUrl(input)).toBe(expected);
      }
    });

    it('IPv4 アドレスは http:// で扱う', () => {
      // 準備
      const cases: Array<[string, string]> = [
        ['192.168.1.1', 'http://192.168.1.1'],
        ['192.168.1.1:8080', 'http://192.168.1.1:8080'],
      ];

      // 実行・結果
      for (const [input, expected] of cases) {
        expect(resolveUrl(input)).toBe(expected);
      }
    });
  });

  describe('入力が検索クエリのとき', () => {
    it('スペースを含む文字列は検索クエリとみなす', () => {
      // 準備
      const input = 'hello world';

      // 実行
      const result = resolveUrl(input);

      // 結果
      expect(result).toContain('search');
      expect(result).toContain('hello');
    });

    it('TLD のない単一ワードは検索クエリとみなす', () => {
      // 準備
      const input = 'foobar';

      // 実行
      const result = resolveUrl(input);

      // 結果
      expect(result).toContain('search');
      expect(result).toContain('foobar');
    });

    it('デフォルトでは Google 検索 URL を返す', () => {
      // 準備
      const input = 'typescript';

      // 実行
      const result = resolveUrl(input);

      // 結果
      expect(result).toBe('https://www.google.com/search?q=typescript');
    });

    it('指定した検索エンジンを使う', () => {
      // 準備
      const input = 'foo';

      // 実行・結果
      expect(resolveUrl(input, 'duckduckgo')).toBe('https://duckduckgo.com/?q=foo');
      expect(resolveUrl(input, 'bing')).toBe('https://www.bing.com/search?q=foo');
    });

    it('検索クエリは URL エンコードされる', () => {
      // 準備
      const input = 'hello world & friends';

      // 実行
      const result = resolveUrl(input);

      // 結果
      expect(result).toContain('hello%20world');
      expect(result).toContain('%26');                  // &
    });

    it('日本語の検索クエリも正しくエンコードされる', () => {
      // 準備
      const input = 'テスト';

      // 実行
      const result = resolveUrl(input);

      // 結果
      expect(result).toContain('%E3%83%86');
    });
  });

  describe('入力が空 / 不正のとき', () => {
    it('空文字は about:blank にフォールバックする', () => {
      // 実行・結果
      expect(resolveUrl('')).toBe('about:blank');
      expect(resolveUrl('   ')).toBe('about:blank');
    });
  });

  describe('境界ケース', () => {
    it('前後の空白はトリムされる', () => {
      // 準備
      const input = '  https://example.com  ';

      // 実行
      const result = resolveUrl(input);

      // 結果
      expect(result).toBe('https://example.com');
    });

    it('ドット 1 つでも TLD 風なら URL とみなす', () => {
      // 準備
      const input = 'a.io';

      // 実行
      const result = resolveUrl(input);

      // 結果
      expect(result).toBe('https://a.io');
    });

    it('短すぎる "ドメイン風" は検索扱い', () => {
      // 準備: TLD x が 1 文字なので URL 判定しない
      const input = 'foo.x';

      // 実行
      const result = resolveUrl(input);

      // 結果
      expect(result).toContain('search');
    });
  });
});
