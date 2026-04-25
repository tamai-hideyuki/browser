import { z } from 'zod';

export const SearchEngineSchema = z.enum(['google', 'duckduckgo', 'bing']);
export type SearchEngine = z.infer<typeof SearchEngineSchema>;

export const SearchEngines: Record<SearchEngine, { name: string; urlTemplate: string }> = {
  google:     { name: 'Google',     urlTemplate: 'https://www.google.com/search?q=%s' },
  duckduckgo: { name: 'DuckDuckGo', urlTemplate: 'https://duckduckgo.com/?q=%s' },
  bing:       { name: 'Bing',       urlTemplate: 'https://www.bing.com/search?q=%s' },
};

export const buildSearchUrl = (query: string, engine: SearchEngine): string => {
  const tpl = SearchEngines[engine].urlTemplate;
  return tpl.replace('%s', encodeURIComponent(query));
};

export const ThemeSchema = z.enum(['light', 'dark', 'system']);
export type Theme = z.infer<typeof ThemeSchema>;

export const SettingsSchema = z.object({
  general: z.object({
    defaultSearchEngine: SearchEngineSchema.default('google'),
    newTabUrl:           z.string().default('about:blank'),
  }).default({}),
  appearance: z.object({
    theme:        ThemeSchema.default('system'),
    sidebarWidth: z.number().int().min(180).max(400).default(240),
  }).default({}),
  performance: z.object({
    tabSleepAfterMin: z.union([z.literal(15), z.literal(60), z.literal(720), z.literal(-1)]).default(60),
  }).default({}),
});

export type Settings = z.infer<typeof SettingsSchema>;
export const DEFAULT_SETTINGS: Settings = SettingsSchema.parse({});

// 部分パッチ用（任意の階層を許す deep partial）
export type SettingsPatch = {
  general?: Partial<Settings['general']>;
  appearance?: Partial<Settings['appearance']>;
  performance?: Partial<Settings['performance']>;
};
