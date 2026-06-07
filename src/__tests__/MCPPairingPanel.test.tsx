import { beforeEach, describe, expect, it, vi } from "vitest";
import { validatePairingParams } from "../panel/components/MCPPairingPanel";

const VALID_TOKEN = "a".repeat(64);
const VALID_HASH = `#token=${VALID_TOKEN}&port=65000`;

const mockSessionStorage: Record<string, unknown> = {};
const mockLocalStorage: Record<string, unknown> = {};

vi.stubGlobal("chrome", {
  storage: {
    session: {
      set: vi.fn(async (data: Record<string, unknown>) => {
        Object.assign(mockSessionStorage, data);
      }),
      get: vi.fn(async (keys: string[]) => {
        return Object.fromEntries(keys.map((k) => [k, mockSessionStorage[k]]));
      }),
    },
    local: {
      set: vi.fn(async (data: Record<string, unknown>) => {
        Object.assign(mockLocalStorage, data);
      }),
      get: vi.fn(async (keys: string[]) => {
        return Object.fromEntries(keys.map((k) => [k, mockLocalStorage[k]]));
      }),
      remove: vi.fn(async (keys: string[]) => {
        keys.forEach((k) => delete mockLocalStorage[k]);
      }),
    },
  },
});

beforeEach(() => {
  Object.keys(mockSessionStorage).forEach((k) => delete mockSessionStorage[k]);
  Object.keys(mockLocalStorage).forEach((k) => delete mockLocalStorage[k]);
});

describe("validatePairingParams", () => {
  it("returns no errors for a valid deep-link", () => {
    expect(validatePairingParams(VALID_HASH)).toHaveLength(0);
  });

  it("returns token-malformed when token is too short", () => {
    const codes = validatePairingParams(`#token=short&port=65000`).map((e) => e.code);
    expect(codes).toContain("token-malformed");
  });

  it("returns port-out-of-range when port is 99999", () => {
    const codes = validatePairingParams(`#token=${VALID_TOKEN}&port=99999`).map((e) => e.code);
    expect(codes).toContain("port-out-of-range");
  });

  it("returns both token-malformed AND port-out-of-range", () => {
    const codes = validatePairingParams(`#token=short&port=99999`).map((e) => e.code);
    expect(codes).toContain("token-malformed");
    expect(codes).toContain("port-out-of-range");
  });

  it("returns missing-params when both are absent", () => {
    expect(validatePairingParams("#")[0].code).toBe("missing-params");
  });

  it("rejects decimal ports like 1024.5", () => {
    const codes = validatePairingParams(`#token=${VALID_TOKEN}&port=1024.5`).map((e) => e.code);
    expect(codes).toContain("port-out-of-range");
  });

  it("rejects hex ports like 0x2000", () => {
    const codes = validatePairingParams(`#token=${VALID_TOKEN}&port=0x2000`).map((e) => e.code);
    expect(codes).toContain("port-out-of-range");
  });

  it("rejects ports with leading spaces", () => {
    const codes = validatePairingParams(`#token=${VALID_TOKEN}&port= 8080`).map((e) => e.code);
    expect(codes).toContain("port-out-of-range");
  });
});

describe("storage migration", () => {
  it("token does not appear in chrome.storage.local after migration", async () => {
    mockLocalStorage["mcp_pairing_token_v1"] = VALID_TOKEN;
    mockLocalStorage["mcp_pairing_port_v1"] = "65000";

    const { migrateLegacyStorage } = await import("../panel/components/MCPPairingPanel");
    await migrateLegacyStorage();

    expect(mockLocalStorage["mcp_pairing_token_v1"]).toBeUndefined();
    expect(mockLocalStorage["mcp_pairing_port_v1"]).toBeUndefined();
    expect(mockSessionStorage["mcp_pairing_token_v1"]).toBe(VALID_TOKEN);
  });
});
