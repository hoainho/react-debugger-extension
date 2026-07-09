/**
 * Settings migration shim: upgrades v0 (react_debugger_disabled_sites array)
 * to v1 (Settings shape with perSite + detectors) in a single idempotent pass.
 *
 * Entry point for the extension is {@link migrate}. Called once per content
 * script lifecycle via a module-level guard in content/index.ts.
 *
 * @module settings/migrate
 */

import {
  DEFAULT_SETTINGS,
  Settings,
  SettingsSchema,
  SETTINGS_STORAGE_KEY,
} from './types';
import { write } from './storage';

// ─── Legacy key ──────────────────────────────────────────────────────────────

/** The legacy storage key that held a plain array of disabled origin strings. */
const LEGACY_STORAGE_KEY = 'react_debugger_disabled_sites' as const;

// ─── Known detectors + default-policy ────────────────────────────────────────

/**
 * Registry of all currently known detectors with their confidence tier.
 *
 * **Default-policy mapping**:
 * - `'high'`   → `enabled: true`  (reliable signal, no known false-positive modes)
 * - `'medium'` → `enabled: false` (known FP modes; user opts in explicitly)
 * - `'low'`    → `enabled: false` (experimental; user opts in explicitly)
 *
 * This list is intentionally exported and importable by future migration
 * versions (M-C / M-D / M-E / M-F) that will append entries here.
 */
export const KNOWN_DETECTORS_DEFAULTS: Array<{
  id: string;
  confidence: 'high' | 'medium' | 'low';
}> = [
  { id: 'reconciler-keys', confidence: 'high' },   // T7 hero
  { id: 'closure-leak', confidence: 'medium' },     // T8 extraction (known FP modes)
  { id: 'scan-overlay', confidence: 'high' },       // T9 extraction (visual only, no FP)
  { id: 'hydration-mismatch', confidence: 'high' }, // M-C hero #2 (dev-only)
  { id: 'context-cascade', confidence: 'high' },    // M-D hero #3
  { id: 'stale-closure-async', confidence: 'medium' }, // M-D.4 (heuristic; opt-in)
  { id: 'suspense-waterfall', confidence: 'medium' },  // M-E.3 hero #4 (may be intentional; opt-in)
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Builds the `detectors` map applying the default-policy:
 * high-confidence detectors are enabled; medium/low are disabled.
 */
function buildDefaultDetectors(): Record<string, { enabled: boolean }> {
  const detectors: Record<string, { enabled: boolean }> = {};
  for (const { id, confidence } of KNOWN_DETECTORS_DEFAULTS) {
    detectors[id] = { enabled: confidence === 'high' };
  }
  return detectors;
}

/**
 * Builds the `perSite` entry for a single origin that was previously in the
 * disabled-sites list: every known detector is set to `enabled: false`,
 * matching v0 semantics (the entire site was disabled).
 */
function buildDisabledSiteEntry(): { detectors: Record<string, { enabled: boolean }> } {
  const detectors: Record<string, { enabled: boolean }> = {};
  for (const { id } of KNOWN_DETECTORS_DEFAULTS) {
    detectors[id] = { enabled: false };
  }
  return { detectors };
}

// ─── Migration result type ────────────────────────────────────────────────────

/**
 * Returned by {@link migrate} after each invocation.
 *
 * - `migrated`: `true` when the v0→v1 write actually happened; `false` when
 *   v1 already existed (idempotent path) or when the migration build failed.
 * - `legacyKeysRemoved`: list of legacy storage keys deleted during this run.
 * - `settings`: the authoritative {@link Settings} object after migration.
 */
export type MigrateResult = {
  migrated: boolean;
  legacyKeysRemoved: string[];
  settings: Settings;
};

// ─── Core migration function ──────────────────────────────────────────────────

/**
 * Runs the v0→v1 settings migration exactly once (idempotent).
 *
 * **Step 1** – Check for existing v1 settings; return early if found.
 * **Step 2** – Read the legacy `react_debugger_disabled_sites` array.
 * **Step 3** – Build the new {@link Settings} with default-policy detectors
 *              and per-site overrides for every previously-disabled origin.
 * **Step 4** – Validate against {@link SettingsSchema}; abort if invalid.
 * **Step 5** – Write new settings via `storage.write()`.
 * **Step 6** – Remove the legacy key from chrome.storage.local.
 * **Step 7** – Return the migration result.
 *
 * NEVER throws — all error paths are logged and resolved with the safe default.
 */
export async function migrate(): Promise<MigrateResult> {
  // Step 1: Check for existing v1 settings (idempotent guard)
  const existingRaw = await new Promise<unknown>((resolve) => {
    chrome.storage.local.get(SETTINGS_STORAGE_KEY, (result) => {
      resolve(result[SETTINGS_STORAGE_KEY]);
    });
  });

  if (existingRaw !== undefined && existingRaw !== null) {
    const parsed = SettingsSchema.safeParse(existingRaw);
    if (parsed.success) {
      return { migrated: false, legacyKeysRemoved: [], settings: parsed.data };
    }
    // Existing value is present but invalid — fall through to rebuild
  }

  // Step 2: Read legacy disabled-sites array
  const legacyRaw = await new Promise<unknown>((resolve) => {
    chrome.storage.local.get(LEGACY_STORAGE_KEY, (result) => {
      resolve(result[LEGACY_STORAGE_KEY]);
    });
  });

  // Coerce legacy value — must be an array of strings; anything else → empty
  const legacyOrigins: string[] = Array.isArray(legacyRaw)
    ? legacyRaw.filter((v): v is string => typeof v === 'string')
    : [];

  if (!Array.isArray(legacyRaw) && legacyRaw !== undefined) {
    console.warn('SETTINGS_MIGRATION_BUILD_ERROR: legacy value is not an array, treating as empty', legacyRaw);
  }

  // Step 3: Build new Settings
  const perSite: Record<string, { detectors: Record<string, { enabled: boolean }> }> = {};
  for (const origin of legacyOrigins) {
    perSite[origin] = buildDisabledSiteEntry();
  }

  const newSettings: Settings = {
    version: 1,
    detectors: buildDefaultDetectors(),
    perSite,
  };

  // Step 4: Validate
  const validation = SettingsSchema.safeParse(newSettings);
  if (!validation.success) {
    console.warn('SETTINGS_MIGRATION_BUILD_ERROR', validation.error);
    return { migrated: false, legacyKeysRemoved: [], settings: DEFAULT_SETTINGS };
  }

  // Step 5: Write — if storage rejects, honour the NEVER-throws contract
  try {
    await write(validation.data);
  } catch (err) {
    console.warn('SETTINGS_MIGRATION_WRITE_ERROR', err);
    return { migrated: false, legacyKeysRemoved: [], settings: DEFAULT_SETTINGS };
  }

  // Step 6: Best-effort legacy delete — don't fail the migration if this throws
  const removed: string[] = [];
  try {
    await new Promise<void>((resolve, reject) => {
      chrome.storage.local.remove(LEGACY_STORAGE_KEY, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve();
        }
      });
    });
    removed.push(LEGACY_STORAGE_KEY);
  } catch (err) {
    console.warn('SETTINGS_MIGRATION_LEGACY_REMOVE_ERROR', err);
  }

  // Step 7: Return result
  return {
    migrated: true,
    legacyKeysRemoved: removed,
    settings: validation.data,
  };
}
