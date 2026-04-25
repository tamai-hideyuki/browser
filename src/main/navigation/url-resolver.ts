import { buildSearchUrl, type SearchEngine } from '@shared/types/settings';

// "localhost:3000" のような host:port を URL スキームと誤認しないよう、
// 受け付けるスキームを明示的に列挙する
const KNOWN_SCHEMES =
  /^(https?|about|file|ftp|wss?|chrome|mailto|tel|data|javascript|view-source):/i;

export const resolveUrl = (input: string, engine: SearchEngine = 'google'): string => {
  const trimmed = input.trim();
  if (trimmed === '') return 'about:blank';

  if (KNOWN_SCHEMES.test(trimmed)) return trimmed;
  if (/^localhost(:\d+)?(\/.*)?$/i.test(trimmed)) return `http://${trimmed}`;
  if (/^\d{1,3}(\.\d{1,3}){3}(:\d+)?(\/.*)?$/.test(trimmed)) return `http://${trimmed}`;
  if (/\.[a-z]{2,}/i.test(trimmed) && !/\s/.test(trimmed)) return `https://${trimmed}`;

  return buildSearchUrl(trimmed, engine);
};
