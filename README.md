# React Debugger — Chrome DevTools Extension

[![npm version](https://img.shields.io/npm/v/%40nhonh%2Freact-debugger.svg)](https://www.npmjs.com/package/@nhonh/react-debugger)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![CI](https://github.com/hoainho/react-debugger-extension/actions/workflows/ci.yml/badge.svg)](https://github.com/hoainho/react-debugger-extension/actions/workflows/ci.yml)
[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/hoainho/react-debugger-extension)

> **Chrome DevTools panel for React debugging:** Timeline, Performance, Memory, Side Effects, Redux, CLS, and AI-powered analysis — all in one tab.

**Extension version:** 2.0.3 · **CLI version:** 2.1.2 · **Author:** [NhoNH](https://github.com/hoainho) · **License:** MIT

## Demo

[![React Debugger Demo](https://raw.githubusercontent.com/hoainho/react-debugger-extension/main/docs/video/react-ext-demo.gif)](https://raw.githubusercontent.com/hoainho/react-debugger-extension/main/docs/video/react-ext-demo-3x.mp4)

---

## Why this extension

If you debug React apps in production today, you're probably switching between four tools to chase one bug:

- **React DevTools** — component tree, but no timeline
- **Chrome Performance tab** — renders, but no React context
- **Redux DevTools** — state, but isolated from render cycle
- **Console + Memory tab** — leaks, but manual hunting

**React Debugger unifies all of this into a single DevTools tab** with seven analyzers and an optional AI layer for security/perf/crash insight.

## Features

| Tab | What it does |
|---|---|
| **Timeline** | Visual history of every render, state change, effect, and error |
| **UI & State** | Detects direct state mutation, missing keys, `index` as key, stale closures |
| **Performance** | Render counts, render reasons (props/state/context), Core Web Vitals overlay |
| **Memory** | Heap-size sparkline, growth-rate alerts, leak-detection heuristics |
| **Side Effects** | `useEffect` auditor: missing cleanups, bad dependency arrays |
| **CLS** | Real-time Cumulative Layout Shift score + per-element attribution |
| **Redux** | State tree, action history, manual action dispatch (no separate Redux DevTools needed) |
| **AI Analysis** | LLM-powered security, performance, and crash-risk scan. 3 free analyses per session; unlimited with a subscription key. Requires no API key from you. |

### Recent release: v2.0.3 — Zero-Lag Performance

The current release shipped a major perf overhaul aligned with [bippy](https://github.com/AidenBai/bippy) (react-scan's render-detection engine):

- **Eliminated host-page jank.** `webNavigation.onCommitted` filters by `transitionType` so SPA `pushState` no longer floods `ENABLE_DEBUGGER`. Heavy init deferred to idle callback.
- **Hybrid render snapshot architecture.** Lightweight fiber walk in `onCommitFiberRoot` captures render info within a 2ms budget, then deferred analysis uses the snapshot instead of stale `fiber.alternate`.
- **Accurate render detection.** Rewrote `didFiberRender` to use React's `PerformedWork` flag (0x01) as the primary signal, eliminating false positives from `Update`/`Placement`/`Passive` flags.
- **Synchronous scan overlay** at commit time — immediate visual feedback with intensity colors (green ×1 → red ×10+).

See [CHANGELOG.md](./CHANGELOG.md) for the full history.

---

## Installation

### Option 1 — Quick install via npx (recommended)

```bash
npx @nhonh/react-debugger
```

This downloads and extracts the latest extension build to your current directory. Then load it in Chrome:

1. Open `chrome://extensions/`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select the extracted folder

### Option 2 — Build from source

You need **Node 20+** and **Chrome 122+**.

```bash
git clone https://github.com/hoainho/react-debugger-extension.git
cd react-debugger-extension
npm ci
npm run build
```

Then load the `dist/` folder in Chrome via the same `chrome://extensions/` → **Load unpacked** flow.

### Option 3 — Download ZIP from Releases

1. Grab `react-debugger.zip` from [GitHub Releases](https://github.com/hoainho/react-debugger-extension/releases/latest)
2. Extract and load via `chrome://extensions/` → **Load unpacked**

---

## Quick Start

1. Open any React 16+ application
2. Press `F12` (or `Cmd+Option+I` / `Ctrl+Shift+I`)
3. Find the **"React Debugger"** tab in the DevTools panel strip
4. The extension auto-detects React and starts collecting data immediately

For detailed walkthroughs of each tab, debugging strategies by skill level, and threshold reference tables, see **[DEBUGGING-GUIDE.md](./DEBUGGING-GUIDE.md)**.

For 50 documented edge cases across 6 categories (Initialization, Performance Monitoring, Redux Integration, Memory & Cleanup, UI & State, CLS & Layout), see **[EDGE-CASES.md](./EDGE-CASES.md)**.

---

## Comparison

| | React Debugger | React DevTools | why-did-you-render | react-scan |
|---|:---:|:---:|:---:|:---:|
| Component tree | partial | ✅ | — | ✅ |
| Render tracking | ✅ | ✅ profiler | ✅ | ✅ |
| Memory profile | ✅ | — | — | — |
| Side-effect audit | ✅ | — | partial | — |
| Redux state | ✅ | — | — | — |
| CLS monitoring | ✅ | — | — | — |
| AI analysis | ✅ | — | — | — |
| In-DevTools panel | ✅ | ✅ | — | — |

**The wedge:** React Debugger is the only Chrome DevTools panel that combines all seven analyzers in one tab.

---

## Development

```bash
npm ci                  # one-time install
npm run dev             # rebuild on change (watch mode)
npm run build           # production build → dist/
npm run test:run        # one-shot Vitest run
npm run package         # build + zip → react-debugger.zip
```

After every rebuild during dev, click the refresh icon on the extension card at `chrome://extensions/` and reload the inspected page.

### Project structure

```
react-debugger-extension/
├── src/
│   ├── background/      # Service worker
│   ├── content/         # Content script (CLS monitoring)
│   ├── inject/          # Page script (React fiber hook, bippy-aligned)
│   ├── devtools/        # DevTools page entry
│   ├── panel/
│   │   ├── components/  # Reusable components
│   │   ├── tabs/        # 8 tab components incl. AI Analysis
│   │   └── styles/      # CSS (with prefers-reduced-motion support)
│   ├── services/        # AI client, token optimizer, snapshot builder
│   ├── types/           # TypeScript types
│   ├── utils/           # Utilities (sanitize, messaging)
│   └── __tests__/       # Vitest unit tests (170 tests across 9 files)
├── cli/                 # @nhonh/react-debugger npm package
├── worker/              # Cloudflare Worker (AI subscription key validation)
├── test/
│   └── fixtures/basic/  # E2E fixture app for Playwright (Vite + React 18)
├── docs/                # Landing page (hoainho.github.io/react-debugger-extension)
└── openspec/            # In-flight design proposals (growth campaign, MCP server v1)
```

---

## Troubleshooting

### Extension doesn't show in DevTools

1. Verify you loaded the `dist/` folder, not the repo root
2. Reload the inspected page after loading the extension
3. Check `chrome://extensions/` for errors

### React not detected

- The page must use React 16+ with the Fiber architecture
- Refresh the page — content script attaches at `document_start`
- Check the console for errors from the extension
- React must be in development mode for some features (e.g., render reasons)

### No issues detected

- The extension only surfaces issues when found — a quiet panel is a healthy app
- Try the examples in [DEBUGGING-GUIDE.md](./DEBUGGING-GUIDE.md)

### Performance regression on the host page

v2.0.3 specifically targeted host-page lag. If you still see it, please [open a bug](https://github.com/hoainho/react-debugger-extension/issues/new?template=bug_report.yml) with Chrome version, extension version, and the inspected page URL.

---

## Contributing

We welcome contributions of all sizes. The fastest way in:

1. Browse [good-first-issue items](https://github.com/hoainho/react-debugger-extension/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22) — each one has scope, file pointers, and acceptance criteria
2. Claim with a comment: `@hoainho I'll take this`
3. Read **[CONTRIBUTING.md](./.github/CONTRIBUTING.md)** for local setup, conventional commits, and the PR review SLA

We also have [`help wanted` items](https://github.com/hoainho/react-debugger-extension/issues?q=is%3Aissue+is%3Aopen+label%3A%22help+wanted%22) for larger contributions.

### Community

- 💬 [GitHub Discussions](https://github.com/hoainho/react-debugger-extension/discussions) — questions, ideas, general chat
- 🐛 [Issues](https://github.com/hoainho/react-debugger-extension/issues) — bug reports, feature requests
- 🔒 [Security policy](./SECURITY.md) — responsible disclosure (90-day timeline)
- 📜 [Code of Conduct](./.github/CODE_OF_CONDUCT.md) — Contributor Covenant v2.1

---

## What's Next

Active design work lives in [openspec/changes/](./openspec/changes/):

- **`mcp-server-v1/`** — adding a Model Context Protocol server so LLM coding agents (Claude Desktop, opencode, Cursor) can drive the extension's debugging tools programmatically. Currently in spec phase; first contributor PRs are already landing scaffolding.
- **`growth-and-contributor-attraction/`** — 90-day plan to grow the project and contributor base. Week 1 (license + on-ramp) shipped May 2026.

---

## License

[MIT](./LICENSE) — Copyright © 2025-2026 NhoNH.

> React and the React logo are trademarks of Meta Platforms, Inc. This extension is not affiliated with or endorsed by Meta or the React team.
