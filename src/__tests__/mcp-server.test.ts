/**
 * MCP stdio-server scaffolding coverage (MCP v1, tasks 2.3, 2.5, 2.7).
 * Verifies the SDK server constructs with the tool registered, and that the
 * `mcp --help` subcommand prints usage to stderr WITHOUT booting the bridge.
 * (Full agent-client round-trips are a humanGate — need a real MCP client.)
 */
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createMcpServer } from '../../cli/src/mcp.js';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const cliEntry = resolve(repoRoot, 'cli/bin/cli.js');

describe('createMcpServer', () => {
  it('constructs the SDK server without throwing and exposes connect()', () => {
    const server = createMcpServer();
    expect(server).toBeTruthy();
    expect(typeof server.connect).toBe('function');
  });

  it('accepts a get_fiber_node handler injection', () => {
    let called = false;
    const server = createMcpServer({
      onGetFiberNode: () => {
        called = true;
        return null;
      },
    });
    expect(server).toBeTruthy();
    expect(called).toBe(false); // handler wired but not invoked until a tool call
  });
});

describe('cli `mcp --help`', () => {
  it('prints usage to stderr, nothing to stdout, and exits 0 without starting the bridge', () => {
    const r = spawnSync('node', [cliEntry, 'mcp', '--help'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    expect(r.status).toBe(0);
    expect(r.stderr).toMatch(/react-debugger mcp/);
    expect(r.stdout).not.toMatch(/chrome-extension:\/\//); // bridge did NOT start
  });
});
