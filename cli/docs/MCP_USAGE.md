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