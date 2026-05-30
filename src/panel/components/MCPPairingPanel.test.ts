import { describe, it, expect } from "vitest";
import { validatePairingParams } from "./MCPPairingPanel";

const VALID_TOKEN = "a".repeat(64);
const VALID_HASH = `#token=${VALID_TOKEN}&port=65000`;

describe("validatePairingParams", () => {
  it("returns no errors for a valid deep-link", () => {
    const errors = validatePairingParams(VALID_HASH);
    expect(errors).toHaveLength(0);
  });

  it("returns token-malformed when token is too short", () => {
    const hash = `#token=short&port=65000`;
    const errors = validatePairingParams(hash);
    const codes = errors.map((e) => e.code);
    expect(codes).toContain("token-malformed");
  });

  it("returns port-out-of-range when port is 99999", () => {
    const hash = `#token=${VALID_TOKEN}&port=99999`;
    const errors = validatePairingParams(hash);
    const codes = errors.map((e) => e.code);
    expect(codes).toContain("port-out-of-range");
  });

  it("returns both token-malformed AND port-out-of-range for short token + invalid port", () => {
    const hash = `#token=short&port=99999`;
    const errors = validatePairingParams(hash);
    const codes = errors.map((e) => e.code);
    expect(codes).toContain("token-malformed");
    expect(codes).toContain("port-out-of-range");
  });

  it("returns missing-params when both are absent", () => {
    const errors = validatePairingParams("#");
    expect(errors[0].code).toBe("missing-params");
  });
});