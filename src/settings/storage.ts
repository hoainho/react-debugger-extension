/**
 * chrome.storage.local wrapper for extension settings.
 *
 * Runs in panel context (DOM). NEVER throws on read — all errors are logged
 * and DEFAULT_SETTINGS is returned. Throws on write only when the value
 * fails schema validation (caller responsibility per spec C2).
 *
 * Design note: subscribe() uses chrome.storage.onChanged rather than polling
 * so the panel reacts immediately to changes made by other extension contexts.
 */

import {
  DEFAULT_SETTINGS,
  Settings,
  SettingsSchema,
  SETTINGS_STORAGE_KEY,
} from './types';

/**
 * Reads settings from chrome.storage.local.
 *
 * - Returns `DEFAULT_SETTINGS` when the key is absent.
 * - Returns `DEFAULT_SETTINGS` and logs `SETTINGS_PARSE_ERROR` when the
 *   stored value fails schema validation.
 * - NEVER throws.
 */
export async function read(): Promise<Settings> {
  return new Promise<Settings>((resolve) => {
    chrome.storage.local.get(SETTINGS_STORAGE_KEY, (result) => {
      const raw = result[SETTINGS_STORAGE_KEY];

      if (raw === undefined || raw === null) {
        resolve(DEFAULT_SETTINGS);
        return;
      }

      const parsed = SettingsSchema.safeParse(raw);
      if (!parsed.success) {
        console.warn('SETTINGS_PARSE_ERROR', parsed.error);
        resolve(DEFAULT_SETTINGS);
        return;
      }

      resolve(parsed.data);
    });
  });
}

/**
 * Persists settings to chrome.storage.local after validating against
 * {@link SettingsSchema}.
 *
 * @throws {ZodError} When `settings` fails schema validation. The caller is
 *   responsible for handling this — do not write invalid settings.
 */
export async function write(settings: Settings): Promise<void> {
  SettingsSchema.parse(settings);

  return new Promise<void>((resolve, reject) => {
    chrome.storage.local.set({ [SETTINGS_STORAGE_KEY]: settings }, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve();
    });
  });
}

/**
 * Subscribes to settings changes via chrome.storage.onChanged.
 *
 * Fires `callback` with the validated new settings whenever our storage key
 * changes. Skips the callback (and logs a warning) if the incoming value fails
 * schema validation.
 *
 * @param callback - Invoked with the new {@link Settings} on every valid change.
 * @returns An unsubscribe function that removes the listener.
 */
export function subscribe(callback: (settings: Settings) => void): () => void {
  const listener = (
    changes: Record<string, chrome.storage.StorageChange>,
    areaName: string
  ): void => {
    if (areaName !== 'local') return;
    if (!(SETTINGS_STORAGE_KEY in changes)) return;

    const newValue = changes[SETTINGS_STORAGE_KEY]?.newValue;

    const parsed = SettingsSchema.safeParse(newValue);
    if (!parsed.success) {
      console.warn('SETTINGS_PARSE_ERROR', parsed.error);
      return;
    }

    callback(parsed.data);
  };

  chrome.storage.onChanged.addListener(listener);

  return () => {
    chrome.storage.onChanged.removeListener(listener);
  };
}
