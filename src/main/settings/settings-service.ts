import { SettingsRepository } from '../storage/repositories/settings-repo';
import type { Broadcaster } from '../ipc/broadcaster';
import {
  SettingsSchema,
  DEFAULT_SETTINGS,
  type Settings,
  type SettingsPatch,
} from '@shared/types/settings';

export class SettingsService {
  private cache: Settings = DEFAULT_SETTINGS;

  constructor(private broadcaster: Broadcaster) {}

  init(): void {
    const raw = SettingsRepository.getRaw();
    const parsed = SettingsSchema.safeParse(raw);
    this.cache = parsed.success ? parsed.data : DEFAULT_SETTINGS;
    // 壊れた値があれば healthy な値で書き戻す
    if (!parsed.success) this.persistAll();
  }

  getAll(): Settings {
    return this.cache;
  }

  patch(p: SettingsPatch): void {
    const next: Settings = {
      general:     { ...this.cache.general,     ...(p.general     ?? {}) },
      appearance:  { ...this.cache.appearance,  ...(p.appearance  ?? {}) },
      performance: { ...this.cache.performance, ...(p.performance ?? {}) },
    };
    const validated = SettingsSchema.parse(next);
    this.cache = validated;

    // 変更されたカテゴリだけ DB に書く
    if (p.general)     SettingsRepository.setCategory('general',     validated.general);
    if (p.appearance)  SettingsRepository.setCategory('appearance',  validated.appearance);
    if (p.performance) SettingsRepository.setCategory('performance', validated.performance);

    this.broadcaster.emit({ kind: 'settings.updated', settings: validated });
  }

  private persistAll(): void {
    SettingsRepository.setCategory('general',     this.cache.general);
    SettingsRepository.setCategory('appearance',  this.cache.appearance);
    SettingsRepository.setCategory('performance', this.cache.performance);
  }
}
