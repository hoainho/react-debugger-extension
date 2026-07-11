/**
 * UI mode flag + 9->5 view map coverage (S4-4 / M-E.1).
 */
import { describe, it, expect } from 'vitest';
import {
  readUiMode,
  writeUiMode,
  VIEW_MAP,
  V2_VIEWS,
  LEGACY_TABS,
  legacyTabsForView,
  UI_MODE_KEY,
  type UiModeStorageArea,
} from '../panel/ui-mode';

function area(): UiModeStorageArea & { store: Map<string, unknown> } {
  const store = new Map<string, unknown>();
  return {
    store,
    async get(k) { return { [k]: store.get(k) }; },
    async set(items) { for (const [k, v] of Object.entries(items)) store.set(k, v); },
  };
}

describe('ui mode flag', () => {
  it('defaults to classic and round-trips', async () => {
    const a = area();
    expect(await readUiMode(a)).toBe('classic'); // safe default for existing installs
    await writeUiMode(a, 'v2');
    expect(a.store.get(UI_MODE_KEY)).toBe('v2');
    expect(await readUiMode(a)).toBe('v2');
    await writeUiMode(a, 'classic');
    expect(await readUiMode(a)).toBe('classic');
  });
});

describe('9->5 view map (M-E.1 consolidation)', () => {
  it('has exactly 5 views', () => {
    expect(V2_VIEWS).toHaveLength(5);
  });

  it('covers every legacy tab exactly once — none dropped, none duplicated', () => {
    const mapped = V2_VIEWS.flatMap((v) => legacyTabsForView(v));
    expect(mapped.slice().sort()).toEqual([...LEGACY_TABS].sort()); // same set
    expect(new Set(mapped).size).toBe(mapped.length); // no duplicates
    expect(mapped).toHaveLength(9);
  });

  it('keeps the 6 MCP Issue.tab categories present (contract: values unchanged)', () => {
    const mcpTabs = ['performance', 'memory', 'cls', 'side-effects', 'redux', 'ui-state'];
    for (const tab of mcpTabs) {
      expect(LEGACY_TABS).toContain(tab);
    }
  });

  it('legacyTabsForView returns [] for an unknown view', () => {
    expect(legacyTabsForView('nope')).toEqual([]);
    expect(VIEW_MAP.profiler).toContain('timeline');
  });
});
