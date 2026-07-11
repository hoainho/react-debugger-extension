/**
 * MCP pairing-credential parsing + storage (MCP v1, tasks 2.10).
 *
 * The bridge prints a deep-link `chrome-extension://<id>/options.html#token=...&port=...`.
 * The options page parses that hash, persists the creds, and scrubs the hash so
 * the token never lingers in the address bar. All side effects (storage, hash
 * clearing, clock) are injected so the core is unit-testable without Chrome.
 */

export const PAIRING_STORAGE_KEY = 'mcp.pairing';

/** 32-byte token rendered as 64 lowercase/uppercase hex chars (see generateToken). */
const TOKEN_RE = /^[0-9a-f]{64}$/i;

export interface PairingCreds {
  token: string;
  port: number;
}

export interface StoredPairing extends PairingCreds {
  pairedAt: number;
}

/**
 * Extract `{token, port}` from a `#token=...&port=...` hash, or `null` when the
 * hash is missing either field, the port is not a valid TCP port, or the token
 * is not a 32-byte hex string.
 */
export function parsePairingHash(hash: string): PairingCreds | null {
  if (typeof hash !== 'string') return null;
  const body = hash.startsWith('#') ? hash.slice(1) : hash;
  const params = new URLSearchParams(body);
  const token = params.get('token');
  const portRaw = params.get('port');
  if (!token || !portRaw) return null;
  if (!TOKEN_RE.test(token)) return null;
  if (!/^\d+$/.test(portRaw)) return null;
  const port = Number(portRaw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) return null;
  return { token, port };
}

/** Minimal chrome.storage-area surface (session is the canonical area per #42). */
export interface PairingStorageArea {
  get(keys: string | string[]): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(keys: string | string[]): Promise<void>;
}

/** Read the stored pairing record, or null when unpaired. */
export async function readPairing(area: PairingStorageArea): Promise<StoredPairing | null> {
  const record = await area.get(PAIRING_STORAGE_KEY);
  const value = record?.[PAIRING_STORAGE_KEY] as StoredPairing | undefined;
  return value ?? null;
}

export interface ApplyPairingOptions {
  hash: string;
  now: number;
  setStorage: (key: string, value: StoredPairing) => Promise<void> | void;
  clearHash: () => void;
}

/**
 * Parse the hash, persist `{port, token, pairedAt}` under {@link PAIRING_STORAGE_KEY},
 * and clear the hash. Returns the stored record, or `null` if the hash was invalid
 * (in which case nothing is stored and the hash is left untouched).
 */
export async function applyPairingFromHash(options: ApplyPairingOptions): Promise<StoredPairing | null> {
  const creds = parsePairingHash(options.hash);
  if (!creds) return null;
  const stored: StoredPairing = { ...creds, pairedAt: options.now };
  await options.setStorage(PAIRING_STORAGE_KEY, stored);
  options.clearHash();
  return stored;
}
