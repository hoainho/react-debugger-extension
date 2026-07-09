import { useEffect, useState, useCallback } from "react";
import { PAIRING_STORAGE_KEY, type StoredPairing } from "../../mcp/pairing";

type ErrorCode = "token-malformed" | "port-out-of-range" | "missing-params" | "storage-failed";

interface PairingError {
  code: ErrorCode;
  message: string;
  fix: string;
}

function parseHash(hash: string): { token?: string; port?: string } {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  return {
    token: params.get("token") ?? undefined,
    port: params.get("port") ?? undefined,
  };
}

export function validatePairingParams(hash: string): PairingError[] {
  const { token, port } = parseHash(hash);
  const errors: PairingError[] = [];

  if (!token && !port) {
    errors.push({
      code: "missing-params",
      message: "Missing pairing parameters.",
      fix: "Use the full pairing link: #token=<64-hex>&port=<1024-65535>",
    });
    return errors;
  }

  if (!token || !/^[0-9a-fA-F]{64}$/.test(token)) {
    errors.push({
      code: "token-malformed",
      message: "Invalid token format.",
      fix: "Token must be exactly 64 hexadecimal characters (0-9, a-f).",
    });
  }

  if (!port || !/^\d+$/.test(port)) {
    errors.push({
      code: "port-out-of-range",
      message: "Port is out of range.",
      fix: "Port must be a number between 1024 and 65535.",
    });
  } else {
    const portNum = Number(port);
    if (portNum < 1024 || portNum > 65535) {
      errors.push({
        code: "port-out-of-range",
        message: "Port is out of range.",
        fix: "Port must be a number between 1024 and 65535.",
      });
    }
  }

  return errors;
}

const LEGACY_TOKEN_KEY = "mcp_pairing_token_v1";
const LEGACY_PORT_KEY = "mcp_pairing_port_v1";

/**
 * One-time migration to the canonical single-record contract. Any legacy
 * two-key pairing (`mcp_pairing_token_v1` / `_port_v1`, in local or an interim
 * session build) is folded into `mcp.pairing` in storage.session (#42), and the
 * legacy keys are removed from BOTH areas so the token never lingers in local.
 */
export async function migrateLegacyStorage() {
  if (typeof chrome === "undefined" || !chrome.storage) return;
  const [local, session] = await Promise.all([
    chrome.storage.local.get([LEGACY_TOKEN_KEY, LEGACY_PORT_KEY]),
    chrome.storage.session.get([LEGACY_TOKEN_KEY, LEGACY_PORT_KEY]),
  ]);
  const token = (local[LEGACY_TOKEN_KEY] ?? session[LEGACY_TOKEN_KEY]) as string | undefined;
  const port = (local[LEGACY_PORT_KEY] ?? session[LEGACY_PORT_KEY]) as string | number | undefined;
  if (!token && port === undefined) return;

  if (token && port !== undefined) {
    const record: StoredPairing = { token: String(token), port: Number(port), pairedAt: Date.now() };
    await chrome.storage.session.set({ [PAIRING_STORAGE_KEY]: record });
  }
  await chrome.storage.local.remove([LEGACY_TOKEN_KEY, LEGACY_PORT_KEY]);
  await chrome.storage.session.remove([LEGACY_TOKEN_KEY, LEGACY_PORT_KEY]);
}

async function savePairing(token: string, port: string) {
  const record: StoredPairing = { token, port: Number(port), pairedAt: Date.now() };
  await chrome.storage.session.set({ [PAIRING_STORAGE_KEY]: record });
}

export function MCPPairingPanel() {
  const [errors, setErrors] = useState<PairingError[]>([]);
  const [paired, setPaired] = useState(false);
  const [connected, setConnected] = useState(false);

  const refreshStatus = useCallback(async () => {
    if (typeof chrome === "undefined" || !chrome.storage?.session) return;
    const rec = await chrome.storage.session.get(PAIRING_STORAGE_KEY);
    setConnected(Boolean(rec?.[PAIRING_STORAGE_KEY]));
  }, []);

  const performPairing = useCallback(async () => {
    const hash = window.location.hash;
    if (!hash || hash === "#") {
      // No pairing hash — just reflect current status (already-paired or not).
      await refreshStatus();
      return;
    }
    const found = validatePairingParams(hash);
    if (found.length === 0) {
      const { token, port } = parseHash(hash);
      try {
        if (typeof chrome !== "undefined" && chrome.storage?.session) {
          await savePairing(token!, port!);
        }
        window.history.replaceState(null, "", window.location.pathname);
        setPaired(true);
        setErrors([]);
        await refreshStatus();
      } catch (err) {
        setErrors([{ code: "storage-failed", message: "Could not save pairing.", fix: (err as Error).message }]);
      }
    } else {
      setErrors(found);
      setPaired(false);
    }
  }, [refreshStatus]);

  useEffect(() => {
    if (typeof chrome !== "undefined" && chrome.storage) {
      migrateLegacyStorage().then(() => performPairing());
    } else {
      performPairing();
    }
  }, [performPairing]);

  const handleRetry = () => void performPairing();

  const handleDisconnect = async () => {
    if (typeof chrome !== "undefined" && chrome.storage?.session) {
      await chrome.storage.session.remove(PAIRING_STORAGE_KEY);
    }
    setConnected(false);
    setPaired(false);
  };

  return (
    <div className="pairing-panel-container">
      <div className="pairing-panel-status" role="status">
        <span className={connected ? "pairing-status-dot connected" : "pairing-status-dot disconnected"} aria-hidden="true" />
        {connected ? "Connected" : "Disconnected"}
        {connected && (
          <button type="button" className="pairing-panel-disconnect" onClick={handleDisconnect}>
            Disconnect
          </button>
        )}
      </div>

      {paired && <div className="pairing-panel-success">MCP pairing successful!</div>}

      {errors.length > 0 && (
        <div className="pairing-panel-errors">
          <h3>MCP Pairing Failed</h3>
          {errors.map((err) => (
            <div key={err.code} className="pairing-panel-error">
              <strong>{err.message}</strong>
              <p className="pairing-panel-error-fix">How to fix: {err.fix}</p>
            </div>
          ))}
          <button type="button" onClick={handleRetry}>Retry</button>
        </div>
      )}
    </div>
  );
}
