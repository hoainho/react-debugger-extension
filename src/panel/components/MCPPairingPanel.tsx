import { useEffect, useState } from "react";

type ErrorCode = "token-malformed" | "port-out-of-range" | "missing-params";

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

export function MCPPairingPanel() {
  const [errors, setErrors] = useState<PairingError[]>([]);
  const [paired, setPaired] = useState(false);

  const performPairing = () => {
    const hash = window.location.hash;
    const found = validatePairingParams(hash);

    if (found.length === 0) {
      const { token, port } = parseHash(hash);
      if (typeof chrome !== "undefined" && chrome.storage?.local) {
        chrome.storage.local.set({ mcpToken: token, mcpPort: port });
      }
      setPaired(true);
      setErrors([]);
    } else {
      setErrors(found);
      setPaired(false);
    }
  };

  useEffect(() => {
    performPairing();
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