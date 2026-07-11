/**
 * MCP server entrypoint for the react-debugger bridge (MCP v1, tasks 2.3, 2.7).
 *
 * `createMcpServer()` builds an `@modelcontextprotocol/sdk` McpServer with the
 * v1 tool surface (only a placeholder `get_fiber_node` at this scaffolding
 * stage). `runMcp()` boots the local WS bridge (mcp-bridge-ws.js) and connects
 * the MCP server over stdio so an agent client (Claude Desktop / opencode) can
 * drive it. Bridge diagnostics go to stdout; the stdio JSON-RPC stream is left
 * untouched for the SDK transport.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { startBridge } from './mcp-bridge-ws.js';

// Help lives in a dependency-free module so `mcp --help` never loads the SDK.
export { printMcpHelp } from './mcp-help.js';

const SERVER_INFO = { name: 'react-debugger', version: '2.2.0' };

/**
 * Build the MCP server and register the v1 tool surface.
 * @param {{ onGetFiberNode?: (args: { tabId?: number, maxDepth: number, cursor?: string }) => unknown }} [opts]
 */
export function createMcpServer({ onGetFiberNode } = {}) {
  const server = new McpServer(SERVER_INFO);

  server.registerTool(
    'get_fiber_node',
    {
      description:
        'Read the React fiber tree of the inspected tab. v1 scaffolding returns null until the SW route lands (task 3.1).',
      inputSchema: {
        tabId: z.number().int().optional(),
        maxDepth: z.number().int().min(1).max(10).default(3),
        cursor: z.string().optional(),
      },
    },
    async (args) => {
      const result = onGetFiberNode ? await onGetFiberNode(args) : null;
      return { content: [{ type: 'text', text: JSON.stringify(result ?? null) }] };
    },
  );

  return server;
}

/**
 * Boot the WS bridge and connect the MCP server over stdio.
 * @param {{ extensionId?: string }} [opts]
 */
export async function runMcp({ extensionId } = {}) {
  const server = createMcpServer();
  const { server: bridge } = await startBridge({ extensionId });
  await server.connect(new StdioServerTransport());
  return { server, bridge };
}
