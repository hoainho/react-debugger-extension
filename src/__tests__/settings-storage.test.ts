import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { DEFAULT_SETTINGS, SETTINGS_STORAGE_KEY } from '../settings/types';
import { read, write, subscribe } from '../settings/storage';

type StorageChangedListener = (
  changes: Record<string, chrome.storage.StorageChange>,
  areaName: string
) => void;

const makeStorageMock = () => {
  const store: Record<string, unknown> = {};
  const onChangedListeners: StorageChangedListener[] = [];

  const local = {
    get: vi.fn((key: string, cb: (res: Record<string, unknown>) => void) => {
      cb({ [key]: store[key] });
    }),
    set: vi.fn(
      (items: Record<string, unknown>, cb?: () => void) => {
        Object.assign(store, items);
        cb?.();
      }
    ),
  };

  const onChanged = {
    addListener: vi.fn((listener: StorageChangedListener) => {
      onChangedListeners.push(listener);
    }),
    removeListener: vi.fn((listener: StorageChangedListener) => {
      const idx = onChangedListeners.indexOf(listener);
      if (idx !== -1) onChangedListeners.splice(idx, 1);
    }),
    fireChange(changes: Record<string, chrome.storage.StorageChange>, area = 'local') {
      onChangedListeners.forEach((l) => l(changes, area));
    },
  };

  return { local, onChanged, store };
};

describe('settings-storage', () => {
  let storageMock: ReturnType<typeof makeStorageMock>;

  beforeEach(() => {
    storageMock = makeStorageMock();
    vi.stubGlobal('chrome', {
      storage: {
        local: storageMock.local,
        onChanged: storageMock.onChanged,
      },
      runtime: { lastError: null },
    });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('write then read returns the same settings object', async () => {
    const settings = {
      version: 1 as const,
      detectors: { unusedRenders: { enabled: true, budgetMs: 16 } },
      perSite: { 'example.com': { detectors: { unusedRenders: { enabled: false } } } },
    };

    await write(settings);
    const result = await read();

    expect(result).toEqual(settings);
  });

  it('read with corrupt storage value returns DEFAULT_SETTINGS and logs SETTINGS_PARSE_ERROR', async () => {
    storageMock.store[SETTINGS_STORAGE_KEY] = { version: 99, garbage: true };

    const result = await read();

    expect(result).toEqual(DEFAULT_SETTINGS);
    expect(console.warn).toHaveBeenCalledWith(
      'SETTINGS_PARSE_ERROR',
      expect.anything()
    );
  });

  it('read with missing key returns DEFAULT_SETTINGS without error log', async () => {
    const result = await read();

    expect(result).toEqual(DEFAULT_SETTINGS);
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('write with invalid schema throws', async () => {
    const invalid = { version: 2, detectors: 'not-an-object', perSite: {} };

    await expect(write(invalid as never)).rejects.toThrow();
  });

  it('subscribe fires callback when storage changes with valid value', async () => {
    const callback = vi.fn();
    subscribe(callback);

    const newSettings = { ...DEFAULT_SETTINGS };
    storageMock.onChanged.fireChange({
      [SETTINGS_STORAGE_KEY]: { newValue: newSettings },
    });

    expect(callback).toHaveBeenCalledWith(newSettings);
  });

  it('unsubscribe stops callback from firing', () => {
    const callback = vi.fn();
    const unsubscribe = subscribe(callback);

    unsubscribe();

    storageMock.onChanged.fireChange({
      [SETTINGS_STORAGE_KEY]: { newValue: DEFAULT_SETTINGS },
    });

    expect(callback).not.toHaveBeenCalled();
  });

  it('subscribe with corrupt storage change logs warning and does NOT invoke callback', () => {
    const callback = vi.fn();
    subscribe(callback);

    storageMock.onChanged.fireChange({
      [SETTINGS_STORAGE_KEY]: { newValue: { version: 'bad', detectors: null, perSite: null } },
    });

    expect(callback).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith(
      'SETTINGS_PARSE_ERROR',
      expect.anything()
    );
  });
});
