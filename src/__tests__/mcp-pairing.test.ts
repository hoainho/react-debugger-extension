/**
 * MCP pairing hash parse + apply coverage (MCP v1, task 2.10).
 */
import { describe, it, expect, vi } from 'vitest';
import {
  parsePairingHash,
  applyPairingFromHash,
  PAIRING_STORAGE_KEY,
  type StoredPairing,
} from '../mcp/pairing';

const TOKEN = 'a1b2c3d4'.repeat(8); // 64 hex chars

describe('parsePairingHash', () => {
  it('parses a well-formed pairing hash (with and without leading #)', () => {
    expect(parsePairingHash(`#token=${TOKEN}&port=51234`)).toEqual({ token: TOKEN, port: 51234 });
    expect(parsePairingHash(`token=${TOKEN}&port=1`)).toEqual({ token: TOKEN, port: 1 });
  });

  it('rejects missing token or port', () => {
    expect(parsePairingHash(`#port=51234`)).toBeNull();
    expect(parsePairingHash(`#token=${TOKEN}`)).toBeNull();
    expect(parsePairingHash('')).toBeNull();
  });

  it('rejects a malformed token (not 32-byte hex)', () => {
    expect(parsePairingHash(`#token=short&port=51234`)).toBeNull();
    expect(parsePairingHash(`#token=${'z'.repeat(64)}&port=51234`)).toBeNull();
  });

  it('rejects an out-of-range or non-numeric port', () => {
    expect(parsePairingHash(`#token=${TOKEN}&port=0`)).toBeNull();
    expect(parsePairingHash(`#token=${TOKEN}&port=70000`)).toBeNull();
    expect(parsePairingHash(`#token=${TOKEN}&port=abc`)).toBeNull();
  });
});

describe('applyPairingFromHash', () => {
  it('stores {port,token,pairedAt} under mcp.pairing and clears the hash', async () => {
    const store = new Map<string, StoredPairing>();
    const clearHash = vi.fn();
    const result = await applyPairingFromHash({
      hash: `#token=${TOKEN}&port=51234`,
      now: 1_762_000_000_000,
      setStorage: (k, v) => void store.set(k, v),
      clearHash,
    });
    expect(result).toEqual({ token: TOKEN, port: 51234, pairedAt: 1_762_000_000_000 });
    expect(store.get(PAIRING_STORAGE_KEY)).toEqual(result);
    expect(clearHash).toHaveBeenCalledOnce();
  });

  it('stores nothing and does not clear the hash on an invalid hash', async () => {
    const clearHash = vi.fn();
    const setStorage = vi.fn();
    const result = await applyPairingFromHash({
      hash: '#garbage',
      now: 1,
      setStorage,
      clearHash,
    });
    expect(result).toBeNull();
    expect(setStorage).not.toHaveBeenCalled();
    expect(clearHash).not.toHaveBeenCalled();
  });
});
