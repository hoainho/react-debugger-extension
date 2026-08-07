import { describe, it, expect } from "vitest";
import {
  generateToken,
  tokensEqual,
  verifyHandshake,
  buildDeepLink,
  CLOSE_UNAUTHORIZED,
} from "../path/to/mcp-handshake";

describe("MCP Handshake Utilities", () => {
  // 🔐 generateToken
  describe("generateToken", () => {
    it("generates a 64-character hex string by default", () => {
      const token = generateToken();
      expect(token).toHaveLength(64);
      expect(/^[a-f0-9]+$/.test(token)).toBe(true);
    });

    it("generates correct length for custom byte size", () => {
      const token = generateToken(16); // 16 bytes = 32 hex chars
      expect(token).toHaveLength(32);
    });
  });

  // ⚖️ tokensEqual
  describe("tokensEqual", () => {
    it("returns true for identical strings", () => {
      expect(tokensEqual("abc", "abc")).toBe(true);
    });

    it("returns false for different strings", () => {
      expect(tokensEqual("abc", "xyz")).toBe(false);
    });

    it("returns false for different lengths", () => {
      expect(tokensEqual("abc", "abcd")).toBe(false);
    });

    it("returns false for non-string inputs", () => {
      expect(tokensEqual(null as any, "abc")).toBe(false);
      expect(tokensEqual("abc", undefined as any)).toBe(false);
    });
  });

  // 🤝 verifyHandshake
  describe("verifyHandshake", () => {
    const validToken = "secure-token";
    const validOrigin = "chrome-extension://abc123";

    it("accepts valid token and origin", () => {
      const result = verifyHandshake({
        firstFrameToken: validToken,
        expectedToken: validToken,
        origin: validOrigin,
      });

      expect(result).toEqual({ ok: true });
    });

    it("rejects invalid token", () => {
      const result = verifyHandshake({
        firstFrameToken: "wrong",
        expectedToken: validToken,
        origin: validOrigin,
      });

      expect(result).toEqual({
        ok: false,
        code: CLOSE_UNAUTHORIZED,
        reason: "invalid or missing token",
      });
    });

    it("rejects non-extension origin", () => {
      const result = verifyHandshake({
        firstFrameToken: validToken,
        expectedToken: validToken,
        origin: "http://evil.com",
      });

      expect(result).toEqual({
        ok: false,
        code: CLOSE_UNAUTHORIZED,
        reason: "origin is not a chrome-extension",
      });
    });

    it("rejects mismatched extension origin", () => {
      const result = verifyHandshake({
        firstFrameToken: validToken,
        expectedToken: validToken,
        origin: "chrome-extension://wrong",
        extensionOrigin: validOrigin,
      });

      expect(result).toEqual({
        ok: false,
        code: CLOSE_UNAUTHORIZED,
        reason: "origin does not match paired extension",
      });
    });
  });

  // 🔗 buildDeepLink
  describe("buildDeepLink", () => {
    it("builds correct deep link URL", () => {
      const url = buildDeepLink({
        extensionId: "abc123",
        port: 3000,
        token: "token123",
      });

      expect(url).toBe(
        "chrome-extension://abc123/options.html#token=token123&port=3000"
      );
    });
  });
});
