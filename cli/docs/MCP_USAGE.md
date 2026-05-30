# MCP Server Usage Guide

This guide explains how to configure various Model Context Protocol (MCP) clients to use the React Debugger MCP server toolset.

## Claude Desktop

Add the following snippet to your Claude Desktop configuration file (typically located at `~/Library/Application Support/Claude/claude_desktop_config.json` on macOS or `%APPDATA%\Claude\claude_desktop_config.json` on Windows):

```json
{
  "mcpServers": {
    "react-debugger": {
      "command": "npx",
      "args": [
        "@nhonh/react-debugger@latest",
        "mcp"
      ]
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
      "args": [
        "@nhonh/react-debugger@latest",
        "mcp"
      ]
    }
  }
}

```

## Cline

To use this React Debugger MCP server with **Cline** (VS Code extension), add the following configuration to your Cline settings (`.cline/mcp.json` or your global VS Code `settings.json`):

```json
{
  "mcpServers": {
    "react-debugger": {
      "command": "npx",
      "args": [
        "@nhonh/react-debugger@latest",
        "mcp"
      ]
    }
  }
}

```
