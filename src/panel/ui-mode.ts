/**
 * UI mode + 9->5 view map (S4 / M-E.1).
 *
 * The redesign consolidates the 9 legacy tabs into 5 views. It ships behind a
 * feature flag: existing installs default to `classic` (the 9-tab layout) so
 * nothing changes under them; the new 5-view shell is opt-in until it's ready
 * to flip. This module owns the flag storage + the view map; the Panel shell
 * renders from it. Kept pure/DI'd for unit testing.
 *
 * CONTRACT (M-E.1): the legacy tab IDs / MCP `Issue.tab` values are UNCHANGED —
 * consolidation is a presentation grouping, not a data/enum change.
 */

export type UiMode = 'classic' | 'v2';
export const UI_MODE_KEY = 'ui_mode_v1';

/** The 9 legacy tab ids (stable — MCP Issue.tab values + AI/settings panes). */
export const LEGACY_TABS = [
  'timeline',
  'performance',
  'memory',
  'cls',
  'side-effects',
  'ui-state',
  'redux',
  'ai-analysis',
  'settings',
] as const;
export type LegacyTab = (typeof LEGACY_TABS)[number];

/** The 5 consolidated views → the legacy panes each contains. */
export const VIEW_MAP: Record<string, LegacyTab[]> = {
  dashboard: ['ai-analysis'],
  profiler: ['timeline', 'performance', 'memory'],
  'state-viewer': ['ui-state', 'redux'],
  effects: ['side-effects', 'cls'],
  settings: ['settings'],
};

export const V2_VIEWS = Object.keys(VIEW_MAP);

/** Legacy panes for a v2 view (empty array for an unknown view). */
export function legacyTabsForView(view: string): LegacyTab[] {
  return VIEW_MAP[view] ?? [];
}

export interface UiModeStorageArea {
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
}

/** Read the UI mode; defaults to `classic` (safe for existing installs). */
export async function readUiMode(area: UiModeStorageArea): Promise<UiMode> {
  const rec = await area.get(UI_MODE_KEY);
  return rec?.[UI_MODE_KEY] === 'v2' ? 'v2' : 'classic';
}

export async function writeUiMode(area: UiModeStorageArea, mode: UiMode): Promise<void> {
  await area.set({ [UI_MODE_KEY]: mode });
}
