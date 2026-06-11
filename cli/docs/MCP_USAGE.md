# MCP Server Usage Guide

> ⚠️ **Preview / unreleased.** The `mcp` subcommand documented here is part of the MCP Server v1 design and not yet shipped on npm. Track progress at milestones M1–M5.

This guide explains how to configure various Model Context Protocol (MCP) clients to use the React Debugger MCP server toolset.

## Claude Desktop

Add the following snippet to your Claude Desktop configuration file (typically located at `~/Library/Application Support/Claude/claude_desktop_config.json` on macOS or `%APPDATA%\Claude\claude_desktop_config.json` on Windows):

```json
{
  "mcpServers": {
    "react-debugger": {
      "command": "npx",
      "args": ["@nhonh/react-debugger@latest", "mcp"]
    }
  }
}
```

## Opencode

Add the following snippet to your Opencode configuration:

```json
{
  "mcpServers": {
    "react-debugger": {
      "command": "npx",
      "args": ["@nhonh/react-debugger@latest", "mcp"]
    }
  }
}
```

## Cursor

To use this AI integrated MCP client, add the configuration snippet below to you system's `mcp.json` file.

### Configuration File Paths

- **Windows:** `%USERPROFILE%\.cursor\mcp.json`
- **macOS/Linux** `~/.cursor.json`

### Configuration Snippet

```json
{
  "mcpServers": {
    "react-debugger": {
      "command": "npx",
      "args": ["-y", "@nhonh/react-debugger@latest", "mcp"]
    }
  }
}
```

## Cline

To use this React Debugger MCP server with Cline (VS Code extension), add the configuration snippet below to your system's `cline_mcp_settings.json` file.

### Configuration File Paths

- **Windows:** `%APPDATA%\Code\User\globalStorage\saoudrizwan.claude-dev\settings\cline_mcp_settings.json`
- **macOS/Linux:** `~/Library/Application Support/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json`

### Configuration Snippet

```json
{
  "mcpServers": {
    "react-debugger": {
      "command": "npx",
      "args": ["@nhonh/react-debugger@latest", "mcp"]
    }
  }
}
```
## Continue

[Continue](https://www.continue.dev/) is an open-source AI coding assistant for VS Code and JetBrains. It supports MCP servers natively via `config.yaml` (preferred) or the legacy `config.json`.

### Option A — Global config · `config.yaml` (recommended)

Add to `~/.continue/config.yaml` on macOS/Linux, or `%USERPROFILE%\.continue\config.yaml` on Windows:

```yaml
mcpServers:
  - name: react-debugger
    command: npx
    args:
      - -y
      - "@nhonh/react-debugger@latest"
      - mcp
```

### Option B — Workspace-scoped config

Create `.continue/mcpServers/react-debugger.yaml` at the root of your project:

```yaml
name: react-debugger
version: 1.0.0
schema: v1
mcpServers:
  - name: react-debugger
    command: npx
    args:
      - -y
      - "@nhonh/react-debugger@latest"
      - mcp
```

### Option C — Legacy `config.json`

If you haven't migrated to YAML yet, add to `~/.continue/config.json`:

```json
{
  "mcpServers": [
    {
      "name": "react-debugger",
      "command": "npx",
      "args": ["-y", "@nhonh/react-debugger@latest", "mcp"]
    }
  ]
}
```

### Verify the tools loaded

1. Open VS Code with the Continue extension installed.
2. Switch Continue to **Agent** mode (MCP tools only work in Agent mode, not Chat mode).
3. In the Continue chat panel, type:
