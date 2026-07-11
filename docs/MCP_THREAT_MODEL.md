# MCP Bridge — Threat Model (v1)

Scope: the local WebSocket bridge (`cli/src/mcp-bridge-ws.js`), the MCP stdio
server (`cli/src/mcp.js`), the extension pairing/SW client, and the AI-Analysis
Worker proxy. v1 is **read-only + AI Analysis**; there are no write/mutation
tools. This document names the five threats gating the alpha and their
mitigations, with the test that locks each one.

| # | Threat | Vector | Mitigation | Locked by |
|---|--------|--------|------------|-----------|
| T1 | **Local-process attacker** reads or drives the bridge | Any local process connects to the bridge's `127.0.0.1:<port>` | Bind `127.0.0.1` only (never `0.0.0.0`); require a 32-byte random token in the first WS frame; timing-safe compare; 5s handshake timeout closing `1008` | `mcp-bridge.test.ts` (bad/missing token → 1008) |
| T2 | **Malicious page CSWSH** — a visited web page opens a WS to the bridge | Browser page script `new WebSocket('ws://127.0.0.1:<port>')` | Reject any `Origin` that is not `chrome-extension://`, and (when pinned) not the paired extension's exact origin; close `1008` before any data flows | `mcp-bridge.test.ts` ("closes 1008 on a foreign origin") |
| T3 | **Compromised / curious MCP client** exfiltrates secrets in fiber/state payloads | Agent calls a read tool; response contains tokens, passwords, cookies from app state | Default-on redaction: `sanitizeForMcp` = structural `sanitizeValue` + `redactSecrets` (masks sensitive keys and token-shaped hex/base64/JWT strings) on every tool/resource response | `mcp-tools.test.ts` (secret redaction incl. token-shaped values) |
| T4 | **Runaway agent** burns API quota / cost | An agent loops AI-Analysis tool calls | Per-key daily KV quota (free/pro tiers); `429 + Retry-After`; surfaced to MCP as `-32001 RateLimited` with `retryAfterSeconds`; per-tab busy flag → `-32002 BUSY` prevents concurrent AI calls | `worker-quota.test.ts` (cap+1 → 429) · `mcp-tools.test.ts` (error mapping) |
| T5 | **Token leakage at rest / in the URL** | Pairing token persisted to disk or left in the address bar | Token lives in `chrome.storage.session` only (wiped at session end, never `local`); the options bootstrap scrubs the `#token=...` hash via `history.replaceState`; legacy `local` keys are migrated out and removed | `MCPPairingPanel.test.tsx` (migration drops legacy keys; token not in `local`) · `mcp-pairing.test.ts` (hash cleared on apply) |

## Residual risks (documented, accepted for v1)

- **No CDP / nativeMessaging** — bridge is extension-chain + local WS only; no OS-level packaging attack surface.
- **Single inspected tab per session** — no multi-frame/iframe fan-out in v1.
- **KV read-modify-write is not strictly atomic** — a rare double-count fails safe (toward the cap). Acceptable for a per-key daily counter.
- **Best-effort client matrix** — v1 gates Claude Desktop + opencode only; other MCP clients are documented, not security-gated.

## Verification status

All five mitigations are unit/integration-locked in the extension's Vitest suite.
The **end-to-end** exercise (loaded extension + spawned bridge + real MCP client)
is a maintainer gate — see `test/e2e/mcp-get-fiber-node.spec.ts` (`npm run test:e2e`),
which requires a real Chromium with the unpacked extension and is not run in CI's
unit lane.
