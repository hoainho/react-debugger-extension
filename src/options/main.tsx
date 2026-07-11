import React from 'react';
import ReactDOM from 'react-dom/client';
import { MCPPairingPanel } from '../panel/components/MCPPairingPanel';
import { applyPairingFromHash } from '../mcp/pairing';

/**
 * Options-page bootstrap (MCP v1, task 2.2/2.10). Consumes the bridge deep-link
 * hash (`#token=...&port=...`), persists creds to chrome.storage.local under
 * `mcp.pairing`, scrubs the hash so the token never lingers in the address bar,
 * then mounts the pairing UI.
 */
async function bootstrap(): Promise<void> {
  await applyPairingFromHash({
    hash: window.location.hash,
    now: Date.now(),
    // storage.session (not local) — the token is auth-equivalent and must not
    // survive the browser session (security fix #42).
    setStorage: (key, value) => chrome.storage.session.set({ [key]: value }),
    clearHash: () =>
      window.history.replaceState(null, '', window.location.pathname + window.location.search),
  });

  const root = document.getElementById('root');
  if (root) {
    ReactDOM.createRoot(root).render(
      <React.StrictMode>
        <MCPPairingPanel />
      </React.StrictMode>,
    );
  }
}

void bootstrap();
