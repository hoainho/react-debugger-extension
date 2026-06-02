/**
 * Settings types, zod schema, and constants for the React Debugger Extension.
 *
 * Design rationale:
 * - `version: 1` enables future migrations (T5 migration layer reads this).
 * - `detectors` is a global per-detector config keyed by detector ID.
 * - `perSite` overrides global config for a specific hostname.
 * - DEFAULT_SETTINGS intentionally uses empty maps — default policy (which
 *   detectors are on/off by confidence level) is enforced in T5 migration +
 *   T6 Settings UI, NOT here. T4 is the storage primitive only.
 *
 * @see https://vitejs.dev/guide/features.html — build context note
 */

import { z } from 'zod';

// ─── Storage key ────────────────────────────────────────────────────────────

/**
 * The chrome.storage.local key under which settings are persisted.
 * Versioned (`_v1`) to allow clean migrations if the schema changes.
 */
export const SETTINGS_STORAGE_KEY = 'react_debugger_settings_v1' as const;

// ─── Types ───────────────────────────────────────────────────────────────────

/**
 * Per-detector configuration: whether it's active and an optional render-
 * budget threshold in milliseconds.
 */
export type DetectorConfig = {
  enabled: boolean;
  budgetMs?: number;
};

/**
 * Per-site override block. Allows disabling or tuning detectors for a
 * specific hostname without touching global defaults.
 */
export type SiteConfig = {
  detectors?: Record<string, DetectorConfig>;
};

/**
 * The canonical shape of extension settings stored in chrome.storage.local.
 *
 * - `version`: schema version; currently always `1`. Used by the T5 migration
 *   layer to detect old formats.
 * - `detectors`: global detector configuration map keyed by detector ID.
 * - `perSite`: per-hostname overrides keyed by hostname (e.g. "example.com").
 */
export type Settings = {
  version: 1;
  detectors: Record<string, DetectorConfig>;
  perSite: Record<string, SiteConfig>;
};

// ─── Zod Schema ──────────────────────────────────────────────────────────────

/**
 * Zod schema for {@link DetectorConfig}.
 * `budgetMs` is optional; must be a positive number when present.
 */
const DetectorConfigSchema = z.object({
  enabled: z.boolean(),
  budgetMs: z.number().positive().optional(),
});

/**
 * Zod schema for {@link SiteConfig}.
 */
const SiteConfigSchema = z.object({
  detectors: z.record(z.string(), DetectorConfigSchema).optional(),
});

/**
 * Zod schema that validates the full {@link Settings} shape.
 *
 * Used by `storage.read()` to guard against corrupt data and by
 * `storage.write()` to prevent writing malformed settings.
 *
 * Typed as `z.ZodType<Settings>` so callers can reference the output type
 * without importing zod internals.
 */
export const SettingsSchema: z.ZodType<Settings> = z.object({
  version: z.literal(1),
  detectors: z.record(z.string(), DetectorConfigSchema),
  perSite: z.record(z.string(), SiteConfigSchema),
});

// ─── Defaults ────────────────────────────────────────────────────────────────

/**
 * Safe default returned when no settings are stored or the stored value is
 * corrupt. Empty maps mean "no overrides" — the runtime applies built-in
 * detector defaults (handled in T5/T6, not here).
 */
export const DEFAULT_SETTINGS: Settings = {
  version: 1,
  detectors: {},
  perSite: {},
} as const;
