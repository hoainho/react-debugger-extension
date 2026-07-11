/**
 * Service-worker MCP client (MCP v1, tasks 2.11, 2.12).
 *
 * Reads the paired bridge creds from chrome.storage.local (`mcp.pairing`),
 * opens a WebSocket to 127.0.0.1:<port> using the SW's NATIVE WebSocket (no npm
 * `ws` dependency on the extension side), sends the token in the first frame,
 * pings every 20s to survive MV3 SW idle-eviction, and reconnects with
 * exponential backoff (1s → 30s cap) on close.
 *
 * The scheduling primitives (`backoffDelay`, `startKeepalive`) are pure/DI'd so
 * they are unit-testable without a live socket.
 */
import { readPairing as readPairingFrom, PAIRING_STORAGE_KEY, type StoredPairing } from '../mcp/pairing';

export const MCP_KEEPALIVE_MS = 20_000;
export const BACKOFF_BASE_MS = 1_000;
export const BACKOFF_CAP_MS = 30_000;

/** Exponential backoff from 1s, doubling per attempt, capped at 30s. */
export function backoffDelay(attempt: number): number {
  const n = attempt < 0 ? 0 : attempt;
  return Math.min(BACKOFF_CAP_MS, BACKOFF_BASE_MS * 2 ** n);
}

/** Minimal socket surface used by the keepalive scheduler (native WS satisfies it). */
export interface PingableSocket {
  send(data: string): void;
}

export interface KeepaliveTimers {
  setInterval: (fn: () => void, ms: number) => number;
  clearInterval: (id: number) => void;
}

/**
 * Schedule a keepalive ping every `intervalMs` while connected. Returns a stop
 * function that cancels the interval.
 */
export function startKeepalive(
  socket: PingableSocket,
  timers: KeepaliveTimers,
  intervalMs: number = MCP_KEEPALIVE_MS,
): () => void {
  const id = timers.setInterval(() => {
    socket.send(JSON.stringify({ type: 'ping', t: 'keepalive' }));
  }, intervalMs);
  return () => timers.clearInterval(id);
}

/** Read the paired bridge creds from storage.session (#42), or null if unpaired. */
export async function readPairing(): Promise<StoredPairing | null> {
  return readPairingFrom(chrome.storage.session as unknown as Parameters<typeof readPairingFrom>[0]);
}

/**
 * Open (and keep open) the bridge connection. Reconnects with backoff on close.
 * Uses native globals; not unit-tested here (SW/WebSocket integration is a
 * humanGate) — the scheduling helpers above carry the unit coverage.
 */
export function connectMcp(): void {
  let attempt = 0;
  let stopKeepalive: (() => void) | null = null;
  let socket: WebSocket | null = null;

  const open = async (): Promise<void> => {
    // Already connecting or connected — don't stack sockets (the onChanged
    // listener and the backoff timer can both call open()).
    if (socket && (socket.readyState === WebSocket.CONNECTING || socket.readyState === WebSocket.OPEN)) return;

    const pairing = await readPairing();
    if (!pairing) return; // not paired yet — the onChanged listener retries when pairing is saved

    const ws = new WebSocket(`ws://127.0.0.1:${pairing.port}`);
    socket = ws;

    ws.onopen = () => {
      attempt = 0;
      ws.send(pairing.token); // token in the first frame
      stopKeepalive = startKeepalive(ws, {
        setInterval: (fn, ms) => self.setInterval(fn, ms),
        clearInterval: (id) => self.clearInterval(id),
      });
    };

    ws.onclose = () => {
      stopKeepalive?.();
      stopKeepalive = null;
      if (socket === ws) socket = null;
      const delay = backoffDelay(attempt++);
      self.setTimeout(() => void open(), delay);
    };
  };

  // If the SW starts unpaired, connectMcp otherwise exits and never retries.
  // Connect as soon as the options page writes the pairing record to
  // storage.session — no extension restart needed.
  if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'session' && changes[PAIRING_STORAGE_KEY]?.newValue) void open();
    });
  }

  void open();
}
