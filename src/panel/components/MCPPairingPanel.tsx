import React, { useEffect, useState } from "react";

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

  const portNum = port !== undefined ? Number(port) : NaN;
  if (!port || isNaN(portNum) || portNum < 1024 || portNum > 65535) {
    errors.push({
      code: "port-out-of-range",
      message: "Port is out of range.",
      fix: "Port must be a number between 1024 and 65535.",
    });
  }

  return errors;
}

export const MCPPairingPanel: React.FC = () => {
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
      <div style={{ padding: 16, color: "green" }}>
        MCP pairing successful!
      </div>
    );
  }

  if (errors.length === 0) return null;

  return (
    <div style={{ padding: 16 }}>
      <h3>MCP Pairing Failed</h3>
      {errors.map((err) => (
        <div
          key={err.code}
          style={{
            marginBottom: 12,
            padding: 12,
            border: "1px solid #f00",
            borderRadius: 6,
            background: "#fff0f0",
          }}
        >
          <strong>{err.message}</strong>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#555" }}>
            How to fix: {err.fix}
          </p>
        </div>
      ))}
      <button onClick={handleRetry}>Retry</button>
    </div>
  );
};