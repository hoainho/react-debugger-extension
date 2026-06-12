# MCP Latency Benchmark — Windows Investigation Notes

## Environment

| Key | Value |
|-----|-------|
| OS | Windows 11 Home Single Language |
| OS Release | 10.0.26200 |
| Node | v24.1.0 |
| Chrome | 149.0.7827.103 |
| Package | @nhonh/react-debugger@2.1.2 |

## Investigation Summary

Benchmark could not be completed. The `react-debugger mcp` subcommand
in v2.1.2 is an **interactive installer** that creates a local `/mcp`
directory — it is not a stdio JSON-RPC server.

When invoked, it prompts:
> "Directory .../mcp is not empty. Overwrite?"

This means Phase A (the MCP stdio server) has not been published to
npm yet. There is no stdio transport to benchmark in the current
published package.

## Windows-Specific Issues Found

Two Windows-specific bugs were discovered while attempting the benchmark:

**Bug 1 — `spawn EINVAL` with `npx.cmd` + piped stdio**
Spawning `.cmd` files on Windows with `stdio: ["pipe","pipe","pipe"]`
throws `EINVAL` unless `shell: true` is set. Linux/macOS are not
affected.

**Bug 2 — `ENOENT` when spawning npm global binary without `.cmd`**
`where react-debugger` returns both a plain path and a `.cmd` path.
Spawning the plain path without `shell: true` throws `ENOENT` because
Windows npm globals are `.cmd` wrappers. The `.cmd` variant must be
used explicitly, or `shell: true` must be set.

## Recommendation

Once Phase A ships a stdio-capable `react-debugger mcp --stdio` command,
re-run `node scripts/bench-mcp-latency.mjs --runs 50` on Windows.
The benchmark script is ready and documents both Windows-specific
spawn quirks above with fixes applied.

## Files Contributed

- `scripts/bench-mcp-latency.mjs` — reusable cross-platform benchmark runner
- `evidence/phase0-latency-windows.json` — run metadata (all failed,
  root cause documented above)
- `evidence/phase0-latency-windows-notes.md` — this file
