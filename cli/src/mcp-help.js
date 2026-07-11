/**
 * `mcp` subcommand usage text — deliberately dependency-free (no
 * `@modelcontextprotocol/sdk` import) so `mcp --help` can print without loading
 * the MCP server module. Loading the SDK just to show help crashed on some Node
 * runtimes (observed on Node 20 CI: `TypeError: … reading 'map'` at SDK import),
 * exiting non-zero. Keeping help SDK-free makes `--help` robust everywhere.
 */

/** Print the `mcp` subcommand usage to stderr (keeps stdout/JSON-RPC clean). */
export function printMcpHelp() {
  process.stderr.write(
    [
      'react-debugger mcp — run the MCP bridge for AI agents',
      '',
      'Usage:',
      '  npx @nhonh/react-debugger mcp [--extension-id <id>]',
      '',
      'The bridge binds 127.0.0.1 on an ephemeral port, prints a one-click',
      'chrome-extension://<id>/options.html#token=...&port=... pairing link to',
      'stdout, and speaks MCP over stdio. Add it to your client mcp.json.',
      '',
    ].join('\n'),
  );
}
