import { describe, it, expect, beforeEach, afterEach } from "vitest";
import WebSocket from "ws";
import { createBridgeServer } from "../path/to/your/file";

let server: any;
let port: number;
const TOKEN = "test-token-123";
const EXT_ID = "abc123";

beforeEach(async () => {
  server = createBridgeServer({
    token: TOKEN,
    extensionId: EXT_ID,
  });

  await new Promise((resolve) =>
    server.wss.once("listening", resolve)
  );

  port = server.port();
});

afterEach(async () => {
  await server.close();
});

describe("WebSocket Bridge Handshake", () => {
  // ✅ SUCCESS CASE
  it("accepts valid handshake and sends paired message", async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`, {
      headers: {
        origin: `chrome-extension://${EXT_ID}`,
      },
    });

    const message = await new Promise<string>((resolve, reject) => {
      ws.on("open", () => {
        ws.send(TOKEN);
      });

      ws.on("message", (data) => {
        resolve(data.toString());
      });

      ws.on("error", reject);
    });

    expect(JSON.parse(message)).toEqual({ type: "paired" });

    ws.close();
  });

  // ❌ WRONG TOKEN
  it("rejects invalid token", async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`, {
      headers: {
        origin: `chrome-extension://${EXT_ID}`,
      },
    });

    const closeCode = await new Promise<number>((resolve) => {
      ws.on("open", () => {
        ws.send("wrong-token");
      });

      ws.on("close", (code) => resolve(code));
    });

    expect(closeCode).toBe(1008);
  });

  // ❌ WRONG ORIGIN
  it("rejects invalid origin", async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`, {
      headers: {
        origin: `http://malicious-site.com`,
      },
    });

    const closeCode = await new Promise<number>((resolve) => {
      ws.on("open", () => {
        ws.send(TOKEN);
      });

      ws.on("close", (code) => resolve(code));
    });

    expect(closeCode).toBe(1008);
  });

  // ❌ TIMEOUT (no handshake)
  it("closes connection if no handshake is sent", async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`, {
      headers: {
        origin: `chrome-extension://${EXT_ID}`,
      },
    });

    const closeCode = await new Promise<number>((resolve) => {
      ws.on("close", (code) => resolve(code));
    });

    expect(closeCode).toBe(1008);
  });
});
