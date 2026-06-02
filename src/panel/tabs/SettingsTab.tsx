import { useState, useEffect } from 'react';
import { read, write } from '@/settings/storage';
import { subscribe } from '@/settings/storage';
import { KNOWN_DETECTORS_DEFAULTS } from '@/settings/migrate';
import type { Settings } from '@/settings/types';

const CLOSURE_LEAK_TOOLTIP =
  'Tracking starts when enabled. Timers created before enable are invisible to the leak detector. Reload the page to capture all timers.';

function ConfidenceBadge({ level }: { level: 'high' | 'medium' | 'low' }) {
  return (
    <span
      className={`confidence-badge confidence-badge--${level}`}
      aria-label={`Confidence: ${level}`}
    >
      {level}
    </span>
  );
}

interface ToggleSwitchProps {
  checked: boolean;
  onChange: () => void;
  id: string;
}

function ToggleSwitch({ checked, onChange, id }: ToggleSwitchProps) {
  return (
    <label className="toggle-switch" htmlFor={id}>
      <input
        id={id}
        type="checkbox"
        className="toggle-switch__input"
        checked={checked}
        onChange={onChange}
      />
      <span className="toggle-switch__track" />
    </label>
  );
}

export function SettingsTab() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [newSiteOrigin, setNewSiteOrigin] = useState('');
  const [tooltipVisible, setTooltipVisible] = useState<string | null>(null);

  useEffect(() => {
    read().then(setSettings);
  }, []);

  useEffect(() => {
    const unsubscribe = subscribe((updated) => {
      setSettings(updated);
    });
    return unsubscribe;
  }, []);

  const handleGlobalToggle = async (detectorId: string) => {
    if (!settings) return;
    const current = settings.detectors[detectorId];
    const currentEnabled = current?.enabled ?? false;
    const updated: Settings = {
      ...settings,
      detectors: {
        ...settings.detectors,
        [detectorId]: {
          ...current,
          enabled: !currentEnabled,
        },
      },
    };
    setSettings(updated);
    await write(updated);
  };

  const handleAddSiteOverride = async () => {
    if (!settings || !newSiteOrigin.trim()) return;
    const origin = newSiteOrigin.trim();
    const perDetectorOverrides: Record<string, { enabled: boolean }> = {};
    for (const { id } of KNOWN_DETECTORS_DEFAULTS) {
      perDetectorOverrides[id] = { enabled: false };
    }
    const updated: Settings = {
      ...settings,
      perSite: {
        ...settings.perSite,
        [origin]: { detectors: perDetectorOverrides },
      },
    };
    setSettings(updated);
    setNewSiteOrigin('');
    await write(updated);
  };

  const handleRemoveSiteOverride = async (origin: string) => {
    if (!settings) return;
    const { [origin]: _removed, ...rest } = settings.perSite;
    const updated: Settings = { ...settings, perSite: rest };
    setSettings(updated);
    await write(updated);
  };

  const handleSiteDetectorToggle = async (origin: string, detectorId: string) => {
    if (!settings) return;
    const site = settings.perSite[origin] ?? { detectors: {} };
    const currentDetectors = site.detectors ?? {};
    const current = currentDetectors[detectorId];
    const currentEnabled = current?.enabled ?? false;
    const updated: Settings = {
      ...settings,
      perSite: {
        ...settings.perSite,
        [origin]: {
          ...site,
          detectors: {
            ...currentDetectors,
            [detectorId]: { ...current, enabled: !currentEnabled },
          },
        },
      },
    };
    setSettings(updated);
    await write(updated);
  };

  if (!settings) {
    return (
      <div className="tab-panel settings-tab">
        <div className="settings-loading">Loading settings…</div>
      </div>
    );
  }

  const perSiteEntries = Object.entries(settings.perSite);

  return (
    <div className="tab-panel settings-tab">
      <section className="settings-section">
        <h2 className="settings-section__title">Detectors</h2>
        <p className="settings-section__desc">
          Toggle which detectors are active globally.
        </p>

        <div className="detector-list">
          {KNOWN_DETECTORS_DEFAULTS.map(({ id, confidence }) => {
            const enabled = settings.detectors[id]?.enabled ?? false;
            const isClosureLeak = id === 'closure-leak';

            return (
              <div className="detector-row" key={id}>
                <div className="detector-row__info">
                  <span className="detector-row__id">{id}</span>
                  <ConfidenceBadge level={confidence} />
                  {isClosureLeak && (
                    <span
                      className="detector-row__help-icon"
                      role="img"
                      aria-label="Info"
                      tabIndex={0}
                      onMouseEnter={() => setTooltipVisible(id)}
                      onMouseLeave={() => setTooltipVisible(null)}
                      onFocus={() => setTooltipVisible(id)}
                      onBlur={() => setTooltipVisible(null)}
                    >
                      ⓘ
                      {tooltipVisible === id && (
                        <span className="detector-row__tooltip" role="tooltip">
                          {CLOSURE_LEAK_TOOLTIP}
                        </span>
                      )}
                    </span>
                  )}
                </div>
                <ToggleSwitch
                  id={`detector-toggle-${id}`}
                  checked={enabled}
                  onChange={() => handleGlobalToggle(id)}
                />
              </div>
            );
          })}
        </div>
      </section>

      <section className="settings-section">
        <h2 className="settings-section__title">Per-Site Overrides</h2>
        <p className="settings-section__desc">
          Override detector settings for a specific site.
        </p>

        <div className="site-override-add">
          <input
            type="url"
            className="site-override-input"
            placeholder="https://app.example.com"
            value={newSiteOrigin}
            onChange={(e) => setNewSiteOrigin(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddSiteOverride();
            }}
            aria-label="Site origin URL"
          />
          <button
            className="site-override-add-btn"
            onClick={handleAddSiteOverride}
            disabled={!newSiteOrigin.trim()}
          >
            Add
          </button>
        </div>

        {perSiteEntries.length === 0 ? (
          <p className="settings-empty-hint">No per-site overrides configured.</p>
        ) : (
          <div className="site-override-list">
            {perSiteEntries.map(([origin, siteConfig]) => (
              <div className="site-override-entry" key={origin}>
                <div className="site-override-entry__header">
                  <span className="site-override-entry__origin">{origin}</span>
                  <button
                    className="site-override-remove-btn"
                    onClick={() => handleRemoveSiteOverride(origin)}
                    aria-label={`Remove site override for ${origin}`}
                  >
                    Remove site override
                  </button>
                </div>

                <div className="detector-list detector-list--nested">
                  {KNOWN_DETECTORS_DEFAULTS.map(({ id, confidence }) => {
                    const siteEnabled =
                      siteConfig.detectors?.[id]?.enabled ?? false;
                    return (
                      <div className="detector-row" key={id}>
                        <div className="detector-row__info">
                          <span className="detector-row__id">{id}</span>
                          <ConfidenceBadge level={confidence} />
                        </div>
                        <ToggleSwitch
                          id={`site-detector-toggle-${origin}-${id}`}
                          checked={siteEnabled}
                          onChange={() => handleSiteDetectorToggle(origin, id)}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
