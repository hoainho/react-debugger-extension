/**
 * Local WebSocket bridge for the MCP server (MCP v1, tasks 2.4, 2.6, 2.8).
 *
 * Binds 127.0.0.1 on an ephemeral port, mints a 32-byte token at startup, and
 * requires every client to present that token in its first frame from a
 * `chrome-extension://` Origin (see mcp-handshake.js). Any failure closes the
 * socket with code 1008. The one-click deep-link is printed to STDOUT so the
 * JSON-RPC stdio channel (mcp.js) stays clean.
 */
import { WebSocketServer } from 'ws';
import { verifyHandshake, generateToken, buildDeepLink, CLOSE_UNAUTHORIZED } from './mcp-handshake.js';

const HANDSHAKE_TIMEOUT_MS = 5000;

/**
 * Create (but do not announce) a bridge WS server.
 *
 * @param {object} opts
 * @param {string} opts.token           expected first-frame token
 * @param {string} [opts.extensionId]   when set, Origin must equal chrome-extension://<id>
 * @param {string} [opts.host]          default 127.0.0.1
 * @param {number} [opts.port]          default 0 (ephemeral)
 * @param {(msg: string, ws: import('ws').WebSocket) => void} [opts.onClientMessage]
 */
export function createBridgeServer({ token, extensionId, host = '127.0.0.1', port = 0, onClientMessage } = {}) {
  if (!token) throw new Error('createBridgeServer requires a token');
  const extensionOrigin = extensionId ? `chrome-extension://${extensionId}` : undefined;
  const wss = new WebSocketServer({ host, port });

  wss.on('connection', (ws, req) => {
    let authed = false;
    const timer = setTimeout(() => {
      if (!authed) ws.close(CLOSE_UNAUTHORIZED, 'handshake timeout');
    }, HANDSHAKE_TIMEOUT_MS);

    ws.once('message', (data) => {
      const result = verifyHandshake({
        firstFrameToken: String(data),
        origin: req.headers.origin,
        expectedToken: token,
        extensionOrigin,
      });
      if (!result.ok) {
        clearTimeout(timer);
        ws.close(result.code, result.reason);
        return;
      }
      authed = true;
      clearTimeout(timer);
      ws.send(JSON.stringify({ type: 'paired' }));
      ws.on('message', (msg) => onClientMessage?.(String(msg), ws));
    });
  });

  return {
    wss,
    /** Resolved bound port (after 'listening'). */
    port: () => {
      const addr = wss.address();
      return addr && typeof addr === 'object' ? addr.port : undefined;
    },
    close: () =>
      new Promise((resolve) => {
        for (const client of wss.clients) client.terminate();
        wss.close(() => resolve());
      }),
  };
}

/**
 * Boot a bridge, print the pairing deep-link, and wire SIGTERM/SIGINT to a
 * <100ms clean shutdown. Returns the server handle.
 */
export async function startBridge({ extensionId, host, onClientMessage } = {}) {
  const token = generateToken();
  const server = createBridgeServer({ token, extensionId, host, port: 0, onClientMessage });
  await new Promise((resolve) => server.wss.once('listening', resolve));
  const port = server.port();
  // STDERR (not stdout): the human pairing affordance must not share the stdout
  // JSON-RPC stream the MCP StdioServerTransport uses — a strict client would
  // choke on a non-JSON line. The user still sees stderr in their terminal.
  process.stderr.write(
    `${buildDeepLink({ extensionId: extensionId ?? '<extension-id>', port, token })}\n`,
  );
  const shutdown = () => {
    server.close().then(() => process.exit(0));
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
  return { server, token, port };
}
