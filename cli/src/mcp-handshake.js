/**
 * Pure WS-handshake guards for the MCP bridge (MCP v1, task 2.8).
 *
 * Kept dependency-free and side-effect-free so it is unit-testable without a
 * running `ws` server. `mcp-bridge-ws.js` imports these and applies them to the
 * real socket (closing with {@link CLOSE_UNAUTHORIZED} on failure).
 */
import { randomBytes, timingSafeEqual } from 'node:crypto';

/** WS close code for a failed auth/origin handshake (RFC 6455 policy violation). */
export const CLOSE_UNAUTHORIZED = 1008;

const EXTENSION_ORIGIN_PREFIX = 'chrome-extension://';

/** 32-byte token as a 64-char hex string. */
export function generateToken(byteLength = 32) {
  return randomBytes(byteLength).toString('hex');
}

/** Constant-time string compare that never throws on length mismatch. */
export function tokensEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/**
 * Validate the first WS frame's token + the connection Origin.
 *
 * @returns {{ok: true} | {ok: false, code: number, reason: string}}
 */
export function verifyHandshake({ firstFrameToken, origin, expectedToken, extensionOrigin } = {}) {
  if (!tokensEqual(firstFrameToken, expectedToken)) {
    return { ok: false, code: CLOSE_UNAUTHORIZED, reason: 'invalid or missing token' };
  }
  if (typeof origin !== 'string' || !origin.startsWith(EXTENSION_ORIGIN_PREFIX)) {
    return { ok: false, code: CLOSE_UNAUTHORIZED, reason: 'origin is not a chrome-extension' };
  }
  if (extensionOrigin && origin !== extensionOrigin) {
    return { ok: false, code: CLOSE_UNAUTHORIZED, reason: 'origin does not match paired extension' };
  }
  return { ok: true };
}

/** The one-click pairing deep-link printed to stdout by the bridge. */
export function buildDeepLink({ extensionId, port, token }) {
  return `${EXTENSION_ORIGIN_PREFIX}${extensionId}/options.html#token=${token}&port=${port}`;
}
