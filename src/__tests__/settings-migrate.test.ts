import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { DEFAULT_SETTINGS, SETTINGS_STORAGE_KEY } from '../settings/types';
import { migrate, KNOWN_DETECTORS_DEFAULTS } from '../settings/migrate';

const LEGACY_KEY = 'react_debugger_disabled_sites';

const makeStorageMock = () => {
  const store: Record<string, unknown> = {};

  const local = {
    get: vi.fn((key: string, cb: (res: Record<string, unknown>) => void) => {
      cb({ [key]: store[key] });
    }),
    set: vi.fn((items: Record<string, unknown>, cb?: () => void) => {
      Object.assign(store, items);
      cb?.();
    }),
    remove: vi.fn((key: string, cb?: () => void) => {
      delete store[key];
      cb?.();
    }),
  };

  return { local, store };
};

describe('settings-migrate', () => {
  let storageMock: ReturnType<typeof makeStorageMock>;

  beforeEach(() => {
    storageMock = makeStorageMock();
    vi.stubGlobal('chrome', {
      storage: { local: storageMock.local },
      runtime: { lastError: null },
    });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('TC1 – first-run migration: legacy sites → perSite + default policy applied + legacy key deleted', async () => {
    storageMock.store[LEGACY_KEY] = ['app.example.com'];

    const result = await migrate();

    expect(result.migrated).toBe(true);
    expect(result.legacyKeysRemoved).toEqual([LEGACY_KEY]);

    const site = result.settings.perSite['app.example.com'];
    expect(site).toBeDefined();
    expect(site?.detectors?.['reconciler-keys']).toEqual({ enabled: false });
    expect(site?.detectors?.['closure-leak']).toEqual({ enabled: false });
    expect(site?.detectors?.['scan-overlay']).toEqual({ enabled: false });

    expect(result.settings.detectors['reconciler-keys']?.enabled).toBe(true);
    expect(result.settings.detectors['closure-leak']?.enabled).toBe(false);
    expect(result.settings.detectors['scan-overlay']?.enabled).toBe(true);

    expect(storageMock.local.remove).toHaveBeenCalledWith(LEGACY_KEY, expect.any(Function));
    expect(storageMock.store[LEGACY_KEY]).toBeUndefined();
  });

  it('TC2 – idempotent: existing v1 in storage → returns migrated:false, no storage writes', async () => {
    const existingSettings = {
      version: 1,
      detectors: { 'reconciler-keys': { enabled: true } },
      perSite: {},
    };
    storageMock.store[SETTINGS_STORAGE_KEY] = existingSettings;

    const result = await migrate();

    expect(result.migrated).toBe(false);
    expect(result.legacyKeysRemoved).toEqual([]);
    expect(result.settings).toEqual(existingSettings);
    expect(storageMock.local.set).not.toHaveBeenCalled();
    expect(storageMock.local.remove).not.toHaveBeenCalled();
  });

  it('TC3 – fresh install: no legacy data, no v1 → writes DEFAULT with policy applied', async () => {
    const result = await migrate();

    expect(result.migrated).toBe(true);
    expect(result.settings.version).toBe(1);
    expect(Object.keys(result.settings.perSite)).toHaveLength(0);

    for (const { id, confidence } of KNOWN_DETECTORS_DEFAULTS) {
      const expected = confidence === 'high';
      expect(result.settings.detectors[id]?.enabled).toBe(expected);
    }

    expect(storageMock.local.set).toHaveBeenCalledOnce();
  });

  it('TC4 – corrupt legacy data: legacy value is a string → logs warning, treats as fresh install', async () => {
    storageMock.store[LEGACY_KEY] = 'not-an-array';

    const result = await migrate();

    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('SETTINGS_MIGRATION_BUILD_ERROR'),
      expect.anything()
    );

    expect(result.migrated).toBe(true);
    expect(Object.keys(result.settings.perSite)).toHaveLength(0);
  });

  it('TC5 – default policy correctness for fresh install', async () => {
    const result = await migrate();

    expect(result.settings.detectors['reconciler-keys']?.enabled).toBe(true);
    expect(result.settings.detectors['closure-leak']?.enabled).toBe(false);
    expect(result.settings.detectors['scan-overlay']?.enabled).toBe(true);
  });

  it('TC6 (bonus) – legacy key removed from storage after successful migration', async () => {
    storageMock.store[LEGACY_KEY] = ['removed.example.com'];

    await migrate();

    const getResult = await new Promise<Record<string, unknown>>((resolve) => {
      chrome.storage.local.get(LEGACY_KEY, resolve);
    });

    expect(getResult[LEGACY_KEY]).toBeUndefined();
  });

  it('TC7 – returns {migrated:false} when write fails (does not throw)', async () => {
    storageMock.local.set.mockImplementationOnce(
      (_items: Record<string, unknown>, cb?: () => void) => {
        cb?.();
      }
    );
    vi.stubGlobal('chrome', {
      storage: { local: storageMock.local },
      runtime: { lastError: { message: 'QuotaExceededError' } },
    });

    const result = await migrate();

    expect(result.migrated).toBe(false);
    expect(result.settings).toEqual(DEFAULT_SETTINGS);
    expect(result.legacyKeysRemoved).toEqual([]);
    expect(console.warn).toHaveBeenCalledWith(
      'SETTINGS_MIGRATION_WRITE_ERROR',
      expect.any(Error)
    );
  });
});
