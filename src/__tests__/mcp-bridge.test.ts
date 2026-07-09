/**
 * MCP bridge coverage (MCP v1, tasks 2.4/2.6/2.8).
 * Pure handshake guards + a real `ws` server/client integration proving the
 * token+Origin gate closes bad connections with 1008 and accepts good ones.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { WebSocket } from 'ws';
import {
  verifyHandshake,
  generateToken,
  buildDeepLink,
  tokensEqual,
  CLOSE_UNAUTHORIZED,
} from '../../cli/src/mcp-handshake.js';
import { createBridgeServer } from '../../cli/src/mcp-bridge-ws.js';

describe('handshake guards (pure)', () => {
  const expectedToken = 'a'.repeat(64);
  const goodOrigin = 'chrome-extension://abcdefghijklmnop';

  it('accepts a correct token + chrome-extension origin', () => {
    expect(verifyHandshake({ firstFrameToken: expectedToken, origin: goodOrigin, expectedToken }))
      .toEqual({ ok: true });
  });
  it('rejects a wrong/missing token with 1008', () => {
    expect(verifyHandshake({ firstFrameToken: 'nope', origin: goodOrigin, expectedToken }).ok).toBe(false);
    expect(verifyHandshake({ origin: goodOrigin, expectedToken }).code).toBe(CLOSE_UNAUTHORIZED);
  });
  it('rejects a non-extension origin with 1008', () => {
    const r = verifyHandshake({ firstFrameToken: expectedToken, origin: 'https://evil.example', expectedToken });
    expect(r.ok).toBe(false);
    expect(r.code).toBe(CLOSE_UNAUTHORIZED);
  });
  it('enforces exact extension-origin match when pinned', () => {
    const r = verifyHandshake({
      firstFrameToken: expectedToken,
      origin: 'chrome-extension://someoneelse',
      expectedToken,
      extensionOrigin: goodOrigin,
    });
    expect(r.ok).toBe(false);
  });
  it('generateToken is 32 bytes hex; tokensEqual is length-safe', () => {
    expect(generateToken()).toHaveLength(64);
    expect(tokensEqual('x', 'xx')).toBe(false);
    expect(tokensEqual('abc', 'abc')).toBe(true);
  });
  it('buildDeepLink has the pairing shape', () => {
    expect(buildDeepLink({ extensionId: 'id123', port: 51234, token: 'tok' }))
      .toBe('chrome-extension://id123/options.html#token=tok&port=51234');
  });
});

describe('bridge WS server (integration)', () => {
  const token = generateToken();
  const extensionId = 'abcdefghijklmnop';
  const origin = `chrome-extension://${extensionId}`;
  /** @type {Awaited<ReturnType<typeof createBridgeServer>> | null} */
  let bridge: ReturnType<typeof createBridgeServer> | null = null;

  afterEach(async () => {
    if (bridge) await bridge.close();
    bridge = null;
  });

  function boot() {
    bridge = createBridgeServer({ token, extensionId });
    return new Promise<number>((resolve) => {
      bridge!.wss.once('listening', () => resolve(bridge!.port() as number));
    });
  }

  it('accepts a good token + origin and replies paired', async () => {
    const port = await boot();
    const ws = new WebSocket(`ws://127.0.0.1:${port}`, { origin });
    const msg = await new Promise<string>((resolve, reject) => {
      ws.on('open', () => ws.send(token));
      ws.on('message', (d) => resolve(String(d)));
      ws.on('close', (code) => reject(new Error(`closed ${code}`)));
      setTimeout(() => reject(new Error('timeout')), 3000);
    });
    expect(JSON.parse(msg)).toEqual({ type: 'paired' });
    ws.close();
  });

  it('closes 1008 on a bad token', async () => {
    const port = await boot();
    const ws = new WebSocket(`ws://127.0.0.1:${port}`, { origin });
    const code = await new Promise<number>((resolve) => {
      ws.on('open', () => ws.send('wrong-token'));
      ws.on('close', (c) => resolve(c));
    });
    expect(code).toBe(CLOSE_UNAUTHORIZED);
  });

  it('closes 1008 on a foreign origin', async () => {
    const port = await boot();
    const ws = new WebSocket(`ws://127.0.0.1:${port}`, { origin: 'https://evil.example' });
    const code = await new Promise<number>((resolve) => {
      ws.on('open', () => ws.send(token));
      ws.on('close', (c) => resolve(c));
    });
    expect(code).toBe(CLOSE_UNAUTHORIZED);
  });
});
