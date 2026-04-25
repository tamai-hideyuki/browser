import React, { useState } from 'react';
import { useUiStore } from '../stores/ui-store';
import { useSettingsStore } from '../stores/settings-store';
import { SearchEngines, type SearchEngine, type Theme } from '@shared/types/settings';

type Category = 'general' | 'appearance' | 'performance';

const CATEGORIES: { id: Category; label: string }[] = [
  { id: 'general',     label: '一般' },
  { id: 'appearance',  label: '外観' },
  { id: 'performance', label: 'パフォーマンス' },
];

export const SettingsModal = () => {
  const open = useUiStore((s) => s.settingsOpen);
  const close = useUiStore((s) => s.closeSettings);
  const settings = useSettingsStore((s) => s.settings);
  const patch = useSettingsStore((s) => s.patch);
  const [active, setActive] = useState<Category>('general');

  if (!open) return null;

  return (
    <div className="settings-overlay" onClick={close}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <aside className="settings-rail">
          <div className="settings-title">設定</div>
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              className={`settings-rail-item${active === c.id ? ' active' : ''}`}
              onClick={() => setActive(c.id)}
            >
              {c.label}
            </button>
          ))}
        </aside>
        <main className="settings-body">
          {active === 'general' && (
            <section className="settings-section">
              <h2>一般</h2>
              <Field label="デフォルト検索エンジン">
                <select
                  value={settings.general.defaultSearchEngine}
                  onChange={(e) => patch({ general: { defaultSearchEngine: e.target.value as SearchEngine } })}
                >
                  {(Object.keys(SearchEngines) as SearchEngine[]).map((k) => (
                    <option key={k} value={k}>{SearchEngines[k].name}</option>
                  ))}
                </select>
              </Field>
              <Field label="新規タブの URL">
                <input
                  type="text"
                  value={settings.general.newTabUrl}
                  onChange={(e) => patch({ general: { newTabUrl: e.target.value } })}
                  placeholder="about:blank"
                />
              </Field>
            </section>
          )}

          {active === 'appearance' && (
            <section className="settings-section">
              <h2>外観</h2>
              <Field label="テーマ">
                <div className="settings-radio-group">
                  {(['light', 'dark', 'system'] as Theme[]).map((t) => (
                    <label key={t} className="settings-radio">
                      <input
                        type="radio"
                        name="theme"
                        checked={settings.appearance.theme === t}
                        onChange={() => patch({ appearance: { theme: t } })}
                      />
                      {t === 'light' ? 'ライト' : t === 'dark' ? 'ダーク' : 'システム'}
                    </label>
                  ))}
                </div>
              </Field>
              <Field label={`サイドバー幅: ${settings.appearance.sidebarWidth}px`}>
                <input
                  type="range"
                  min={180}
                  max={400}
                  value={settings.appearance.sidebarWidth}
                  onChange={(e) => patch({ appearance: { sidebarWidth: Number(e.target.value) } })}
                />
              </Field>
            </section>
          )}

          {active === 'performance' && (
            <section className="settings-section">
              <h2>パフォーマンス</h2>
              <Field label="タブをスリープさせるまでの時間">
                <select
                  value={settings.performance.tabSleepAfterMin}
                  onChange={(e) => patch({ performance: { tabSleepAfterMin: Number(e.target.value) as 15 | 60 | 720 | -1 } })}
                >
                  <option value={15}>15 分</option>
                  <option value={60}>1 時間</option>
                  <option value={720}>12 時間</option>
                  <option value={-1}>無効</option>
                </select>
              </Field>
              <p className="settings-hint">スリープは現在未実装です（M1 後半で対応）</p>
            </section>
          )}
        </main>
      </div>
    </div>
  );
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="settings-field">
    <span className="settings-label">{label}</span>
    <div className="settings-control">{children}</div>
  </label>
);
