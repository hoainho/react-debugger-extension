import { useEffect, useState } from "react";

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

const TOKEN_KEY = "mcp_pairing_token_v1";
const PORT_KEY = "mcp_pairing_port_v1";

export async function migrateLegacyStorage() {
  if (typeof chrome === "undefined" || !chrome.storage) return;
  const local = await chrome.storage.local.get([TOKEN_KEY, PORT_KEY]);
  if (local[TOKEN_KEY] || local[PORT_KEY]) {
    await chrome.storage.session.set({
      [TOKEN_KEY]: local[TOKEN_KEY],
      [PORT_KEY]: local[PORT_KEY],
    });
    await chrome.storage.local.remove([TOKEN_KEY, PORT_KEY]);
  }
}

async function savePairing(token: string, port: string) {
  await chrome.storage.session.set({
    [TOKEN_KEY]: token,
    [PORT_KEY]: port,
  });
}

export function MCPPairingPanel() {
  const [errors, setErrors] = useState<PairingError[]>([]);
  const [paired, setPaired] = useState(false);

  const performPairing = async () => {
    const hash = window.location.hash;
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
      } catch (err) {
        setErrors([{
          code: "storage-failed",
          message: "Could not save pairing.",
          fix: (err as Error).message,
        }]);
      }
    } else {
      setErrors(found);
      setPaired(false);
    }
  };

  useEffect(() => {
    if (typeof chrome !== "undefined" && chrome.storage) {
      migrateLegacyStorage().then(() => performPairing());
    } else {
      performPairing();
    }
  }, []);

  const handleRetry = () => {
    performPairing();
  };

  if (paired) {
    return (
      <div className="pairing-panel-container">
        MCP pairing successful!
      </div>
    );
  }

  if (errors.length === 0) return <></>;

  return (
    <div className="pairing-panel-container">
      <h3>MCP Pairing Failed</h3>
      {errors.map((err) => (
        <div key={err.code} className="pairing-panel-error">
          <strong>{err.message}</strong>
          <p className="pairing-panel-error-fix">
            How to fix: {err.fix}
          </p>
        </div>
      ))}
      <button onClick={handleRetry}>Retry</button>
    </div>
  );
}
