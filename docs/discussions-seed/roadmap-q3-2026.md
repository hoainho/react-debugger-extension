# Roadmap — Q3 2026 onward

> **Post in category:** Announcements
> **Recommended action after posting:** pin the discussion alongside the welcome post

---

This is the living roadmap. Numbers are intentions, not promises — solo-maintainer project, things shift. Updated on the first of every month.

## 🎯 Current focus: MCP Server v1 (Jun–Jul 2026)

Letting LLM coding agents (Claude Desktop, opencode, Cursor) drive the extension's debugging tools programmatically over the Model Context Protocol. Active design at [`openspec/changes/mcp-server-v1/`](https://github.com/hoainho/react-debugger-extension/tree/main/openspec/changes/mcp-server-v1).

| Milestone | Target date | Status |
|---|---|---|
| M1: Phase 0 — Transport spike | Week of 2026-06-06 | not started |
| M2: Phase A — End-to-end with 1 tool | Week of 2026-06-20 | not started |
| M3: Phase B-lite — 6 tools + 2 resources | Week of 2026-06-27 | not started |
| M4: Alpha ship | 2026-07-01 | not started |
| M5: Kill-gate decision | 2026-07-04 | not started |

**Kill criterion at M5:** if <50 distinct alpha-user keys hit the Worker quota, MCP v1 archives as `rejected` and v2.1 product roadmap resumes. This is an experiment, not a commitment.

[Track milestones on GitHub →](https://github.com/hoainho/react-debugger-extension/milestones)

## 📦 v2.1 — "Compiler-Aware & Standards-Aligned" (Q3 2026, ~6 weeks)

Catches the extension up to React 19.2 + React Compiler 1.0.

- React Compiler `compiledWithForget` badge per component
- Server Component environment badge (`Server` / `Client` / `Edge`)
- INP + FID Core Web Vitals (currently FCP/LCP/TTFB only)
- Why-did-this-render: deep reference-equality prop diff
- State tab (rename from Redux tab): native Zustand/Jotai support
- Chrome Performance panel track injection
- `include` / `exclude` component regex filters
- AI Analysis: streaming results (SSE instead of blocking spinner)

## 🚀 v2.2 — "Redux Killer + Cross-Browser" (Q4 2026, ~10 weeks)

Becomes a full Redux DevTools replacement. Ships Firefox + Edge.

- Time-travel debugging (`jumpToState`)
- Action skip / toggle
- State diff view (jsondiffpatch)
- RTK Query inspector
- Hook-level re-render attribution (WDYR pattern)
- `useOptimistic` + `useActionState` visualization
- Owner Stack breadcrumb
- Firefox + Edge MV3 ports
- Team license tier
- CLI audit mode (`npx @nhonh/react-debugger audit https://...`)

## 🌅 v2.3 — "Component Tree + Flamegraph" (Q1 2027, ~12 weeks)

Closes the biggest structural gap vs React DevTools.

- Full interactive Component Tree tab (virtualized)
- Hooks Inspector
- Profiler flamegraph
- Profiler import/export
- Source-map-to-component-line jump
- Redux action stack trace
- `$r` console integration
- Snapshot diff

## 🌌 v2.4 — "Streaming & Server" (Q2 2027, ~10 weeks)

First-class support for streaming React.

- Suspense / Activity timeline visualizer
- Server Actions tracing
- RSC streaming chunk arrival timeline
- Asset Reference debugging (`preload`, `preinit`, `prefetchDNS`)
- CLS → component attribution (not just DOM node)
- Extension toolbar badge for issue count

## 🔭 v3.0 — "Platform" (H2 2027, 6+ months)

Becomes a debugging platform, not just an extension.

- React Native debugger bridge (Hermes / Metro)
- Enterprise tier (SSO, audit logs, self-hosted team-license control plane)
- OTEL exporter for production monitoring
- i18n (community-translated UI: zh-CN, ja, es, pt-BR)
- Plugin API for 3rd-party tabs
- Recorder integration (React-aware user flows)
- AI Analysis 2.0 (configurable analyzers: a11y, SEO, i18n)

---

## How to influence the roadmap

- **Vote with reactions** on this post for the version you most want to see ship
- **Open an Idea** in the [Ideas category](https://github.com/hoainho/react-debugger-extension/discussions/categories/ideas) for specific features
- **Comment below** with priorities — what's missing, what should slip, what should accelerate

## Why timelines are soft

This is a solo-maintainer project right now. The 90-day growth campaign at [`openspec/changes/growth-and-contributor-attraction/`](https://github.com/hoainho/react-debugger-extension/tree/main/openspec/changes/growth-and-contributor-attraction) is partly about growing the contributor base so timelines firm up. If you want a specific item to ship faster — claim a [good-first-issue](https://github.com/hoainho/react-debugger-extension/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22), open a PR, and the relevant milestone gets a 1-week pull-in.

— NhoNH
