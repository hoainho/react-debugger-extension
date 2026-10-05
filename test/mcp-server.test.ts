import { describe, it, expect, vi, beforeEach } from "vitest";

// 🔥 MOCKS
const registerToolMock = vi.fn();
const connectMock = vi.fn();

vi.mock("@modelcontextprotocol/sdk/server/mcp.js", () => ({
  McpServer: vi.fn().mockImplementation(() => ({
    registerTool: registerToolMock,
    connect: connectMock,
  })),
}));

vi.mock("@modelcontextprotocol/sdk/server/stdio.js", () => ({
  StdioServerTransport: vi.fn(),
}));

const startBridgeMock = vi.fn();
vi.mock("../path/to/mcp-bridge-ws.js", () => ({
  startBridge: startBridgeMock,
}));

// AFTER mocks
import { createMcpServer, runMcp } from "../path/to/mcp-server";

describe("createMcpServer", () => {
  beforeEach(() => {
    registerToolMock.mockClear();
  });

  it("registers get_fiber_node tool", () => {
    createMcpServer();

    expect(registerToolMock).toHaveBeenCalledWith(
      "get_fiber_node",
      expect.objectContaining({
        description: expect.stringContaining("React fiber tree"),
        inputSchema: expect.any(Object),
      }),
      expect.any(Function)
    );
  });

  it("uses default handler (returns null)", async () => {
    createMcpServer();

    const handler = registerToolMock.mock.calls[0][2];

    const result = await handler({});

    expect(result).toEqual({
      content: [{ type: "text", text: "null" }],
    });
  });

  it("calls custom onGetFiberNode handler", async () => {
    const mockHandler = vi.fn().mockResolvedValue({ id: 1 });

    createMcpServer({ onGetFiberNode: mockHandler });

    const handler = registerToolMock.mock.calls[0][2];

    const result = await handler({ maxDepth: 3 });

    expect(mockHandler).toHaveBeenCalledWith({ maxDepth: 3 });
    expect(result).toEqual({
      content: [{ type: "text", text: JSON.stringify({ id: 1 }) }],
    });
  });
});

describe("runMcp", () => {
  beforeEach(() => {
    connectMock.mockClear();
    startBridgeMock.mockResolvedValue({ server: "bridge-instance" });
  });

  it("starts bridge and connects MCP server", async () => {
    const result = await runMcp({ extensionId: "abc123" });

    expect(startBridgeMock).toHaveBeenCalledWith({
      extensionId: "abc123",
    });

    expect(connectMock).toHaveBeenCalled();

    expect(result).toEqual({
      server: expect.any(Object),
      bridge: "bridge-instance",
    });
  });
});
