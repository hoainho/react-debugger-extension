import { describe, it, expect } from "vitest";
import { validatePairingParams } from "../panel/components/MCPPairingPanel";

const VALID_TOKEN = "a".repeat(64);
const VALID_HASH = `#token=${VALID_TOKEN}&port=65000`;

describe("validatePairingParams", () => {
  it("returns no errors for a valid deep-link", () => {
    const errors = validatePairingParams(VALID_HASH);
    expect(errors).toHaveLength(0);
  });

  it("returns token-malformed when token is too short", () => {
    const hash = `#token=short&port=65000`;
    const codes = validatePairingParams(hash).map((e) => e.code);
    expect(codes).toContain("token-malformed");
  });

  it("returns port-out-of-range when port is 99999", () => {
    const hash = `#token=${VALID_TOKEN}&port=99999`;
    const codes = validatePairingParams(hash).map((e) => e.code);
    expect(codes).toContain("port-out-of-range");
  });

  it("returns both token-malformed AND port-out-of-range", () => {
    const hash = `#token=short&port=99999`;
    const codes = validatePairingParams(hash).map((e) => e.code);
    expect(codes).toContain("token-malformed");
    expect(codes).toContain("port-out-of-range");
  });

  it("returns missing-params when both are absent", () => {
    const errors = validatePairingParams("#");
    expect(errors[0].code).toBe("missing-params");
  });

  it("rejects decimal ports like 1024.5", () => {
    const hash = `#token=${VALID_TOKEN}&port=1024.5`;
    const codes = validatePairingParams(hash).map((e) => e.code);
    expect(codes).toContain("port-out-of-range");
  });

  it("rejects hex ports like 0x2000", () => {
    const hash = `#token=${VALID_TOKEN}&port=0x2000`;
    const codes = validatePairingParams(hash).map((e) => e.code);
    expect(codes).toContain("port-out-of-range");
  });

  it("rejects ports with leading spaces", () => {
    const hash = `#token=${VALID_TOKEN}&port= 8080`;
    const codes = validatePairingParams(hash).map((e) => e.code);
    expect(codes).toContain("port-out-of-range");
  });
});