# Architecture Overview

How React Debugger is structured under the hood. This page is for contributors — if you're using the extension, you don't need this.

> **Living doc.** Update as the architecture evolves. The canonical layer order rarely changes; specifics like message types do.

## The 4-context message-passing chain

Chrome extensions have three execution contexts (page, content, background) plus DevTools-extension-specific ones (devtools page, panel). React Debugger uses 4 of these:

```
┌─────────────────────────────────────────────────────────────────┐
│  Page world (src/inject/index.ts)                               │
│  • Hooks __react_devtools_global_hook__                         │
│  • Walks the React fiber tree                                   │
│  • Probes Redux store via __REDUX_DEVTOOLS_EXTENSION__          │
│  • Runs in the inspected page's JS realm                        │
└─────────────────────────────┬───────────────────────────────────┘
                              │ window.postMessage
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Content script (src/content/index.ts)                          │
│  • Bridges page world ↔ extension                               │
│  • Runs at document_start                                       │
│  • CLS observer lives here (PerformanceObserver)                │
└─────────────────────────────┬───────────────────────────────────┘
                              │ chrome.runtime.sendMessage
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Service worker (src/background/index.ts)                       │
│  • Message router                                               │
│  • Dies after 30s idle (Manifest v3 invariant)                  │
│  • Rehydrates state from chrome.storage                         │
└─────────────────────────────┬───────────────────────────────────┘
                              │ chrome.runtime.connect (port)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  DevTools panel (src/panel/)                                    │
│  • React UI with 8 tabs                                         │
│  • Polls SW for snapshots every 5 seconds                       │
│  • Renders Timeline, Performance, Memory, Side Effects, CLS,    │
│    Redux, UI&State, AI Analysis                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Why this many layers?

Each context has different powers and constraints:

| Context | Can do | Cannot do |
|---|---|---|
| **Page world** | Read React internals, mutate page state | Talk to extension storage / network |
| **Content script** | Inject scripts, observe DOM, postMessage to page | Read fiber tree directly (different JS realm) |
| **Service worker** | Network requests, chrome.storage, message routing | Persist in-memory state (dies on idle) |
| **DevTools panel** | Full React UI, access to inspected window via API | Live persistently across page reloads |

The chain exists because no single context can both **read React internals** AND **render a debugger UI** AND **persist data across page reloads**. We split the work.

## v2.0.3 hybrid render detection

The v2.0.3 release introduced a hybrid render snapshot architecture aligned with [bippy](https://github.com/AidenBai/bippy) (react-scan's render-detection engine):

1. **`onCommitFiberRoot`** fires synchronously at every React commit.
2. We do a **lightweight fiber walk** within a 2ms budget — just enough to capture component name, duration, change reason, and a `WeakRef` to the fiber.
3. The full analysis happens **later, in `POLL_DATA`** (every 5s in panel, 1s idle callback), using the captured snapshot instead of `fiber.alternate` (which React's double-buffering overwrites by then).

This eliminates the host-page jank that plagued v2.0.2 (where every commit triggered a full fiber tree walk).

## Key files map

| Concern | Files |
|---|---|
| **Fiber walking** | `src/inject/index.ts` lines 1325-1666 (`installReactHook`, `analyzeFiberTree`, `traverseFiber`, `didFiberRender`) |
| **Redux probing** | `src/inject/index.ts` lines 2131-2484 (`findReduxStore`, `installReduxHook`, `findAlternativeStateManagers`) |
| **CLS monitoring** | `src/content/index.ts` lines 200-280 (PerformanceObserver wiring) |
| **Message routing** | `src/background/index.ts` (whole file is the router) |
| **AI Analysis** | `src/services/{ai-client,snapshot-builder,token-optimizer}.ts` |
| **Subscription validation** | `worker/src/index.ts` (Cloudflare Worker) |
| **Panel tabs** | `src/panel/tabs/*.tsx` (one file per tab) |
| **Shared utilities** | `src/utils/{sanitize,messaging}.ts` |

## State persistence

State that survives the SW death (30s idle):

- `chrome.storage.local` — AI config, subscription key, paired credentials (if MCP v1 ships)
- `chrome.storage.session` — Per-tab `debugger_enabled_${tabId}` flags

State that does **NOT** survive:

- In-flight render snapshots
- Redux action history
- Memory sparkline data
- Anything in the inject script's module-level variables

This is why panels can show empty data right after browser-restart even if the extension is "enabled" — the inject script needs to run again to repopulate.

## Future architecture work

Active design at [`openspec/changes/`](https://github.com/hoainho/react-debugger-extension/tree/main/openspec/changes):

- **`mcp-server-v1/`** — adds a 5th context (a Node bridge process speaking MCP over stdio + WS to the extension), enabling LLM agent integration
- See the [v2.1+ roadmap](https://github.com/hoainho/react-debugger-extension/discussions/categories/announcements) for product-level direction
