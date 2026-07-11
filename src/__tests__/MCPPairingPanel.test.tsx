import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { validatePairingParams, MCPPairingPanel } from "../panel/components/MCPPairingPanel";
import { PAIRING_STORAGE_KEY } from "../mcp/pairing";

const VALID_TOKEN = "a".repeat(64);
const VALID_HASH = `#token=${VALID_TOKEN}&port=65000`;

const mockSessionStorage: Record<string, unknown> = {};
const mockLocalStorage: Record<string, unknown> = {};

function makeArea(store: Record<string, unknown>) {
  return {
    set: vi.fn(async (data: Record<string, unknown>) => {
      Object.assign(store, data);
    }),
    get: vi.fn(async (keys: string | string[]) => {
      const arr = Array.isArray(keys) ? keys : [keys];
      return Object.fromEntries(arr.map((k) => [k, store[k]]));
    }),
    remove: vi.fn(async (keys: string | string[]) => {
      (Array.isArray(keys) ? keys : [keys]).forEach((k) => delete store[k]);
    }),
  };
}

vi.stubGlobal("chrome", {
  storage: { session: makeArea(mockSessionStorage), local: makeArea(mockLocalStorage) },
});

beforeEach(() => {
  Object.keys(mockSessionStorage).forEach((k) => delete mockSessionStorage[k]);
  Object.keys(mockLocalStorage).forEach((k) => delete mockLocalStorage[k]);
  window.location.hash = "";
});

describe("validatePairingParams", () => {
  it("returns no errors for a valid deep-link", () => {
    expect(validatePairingParams(VALID_HASH)).toHaveLength(0);
  });
  it("returns token-malformed when token is too short", () => {
    expect(validatePairingParams(`#token=short&port=65000`).map((e) => e.code)).toContain("token-malformed");
  });
  it("returns port-out-of-range when port is 99999", () => {
    expect(validatePairingParams(`#token=${VALID_TOKEN}&port=99999`).map((e) => e.code)).toContain("port-out-of-range");
  });
  it("returns both token-malformed AND port-out-of-range", () => {
    const codes = validatePairingParams(`#token=short&port=99999`).map((e) => e.code);
    expect(codes).toContain("token-malformed");
    expect(codes).toContain("port-out-of-range");
  });
  it("returns missing-params when both are absent", () => {
    expect(validatePairingParams("#")[0].code).toBe("missing-params");
  });
  it("rejects decimal, hex, and space-prefixed ports", () => {
    expect(validatePairingParams(`#token=${VALID_TOKEN}&port=1024.5`).map((e) => e.code)).toContain("port-out-of-range");
    expect(validatePairingParams(`#token=${VALID_TOKEN}&port=0x2000`).map((e) => e.code)).toContain("port-out-of-range");
    expect(validatePairingParams(`#token=${VALID_TOKEN}&port= 8080`).map((e) => e.code)).toContain("port-out-of-range");
  });
});

describe("storage migration (canonical mcp.pairing in session)", () => {
  it("folds legacy two-key local pairing into mcp.pairing (session) and drops the legacy keys", async () => {
    mockLocalStorage["mcp_pairing_token_v1"] = VALID_TOKEN;
    mockLocalStorage["mcp_pairing_port_v1"] = "65000";

    const { migrateLegacyStorage } = await import("../panel/components/MCPPairingPanel");
    await migrateLegacyStorage();

    expect(mockLocalStorage["mcp_pairing_token_v1"]).toBeUndefined();
    expect(mockLocalStorage["mcp_pairing_port_v1"]).toBeUndefined();
    expect(mockSessionStorage["mcp_pairing_token_v1"]).toBeUndefined();
    expect(mockSessionStorage[PAIRING_STORAGE_KEY]).toMatchObject({ token: VALID_TOKEN, port: 65000 });
  });
});

describe("MCPPairingPanel UI", () => {
  it("shows Connected + Disconnect when a pairing exists, and clears it on Disconnect", async () => {
    mockSessionStorage[PAIRING_STORAGE_KEY] = { token: VALID_TOKEN, port: 65000, pairedAt: 1 };

    render(<MCPPairingPanel />);

    await waitFor(() => expect(screen.getByText("Connected")).toBeInTheDocument());
    const disconnect = screen.getByRole("button", { name: /disconnect/i });
    fireEvent.click(disconnect);

    await waitFor(() => expect(screen.getByText("Disconnected")).toBeInTheDocument());
    expect(mockSessionStorage[PAIRING_STORAGE_KEY]).toBeUndefined();
  });

  it("shows Disconnected when there is no pairing", async () => {
    render(<MCPPairingPanel />);
    await waitFor(() => expect(screen.getByText("Disconnected")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: /disconnect/i })).toBeNull();
  });
});
