# Glossary

Domain terms used across the extension UI, docs, and discussions. If you've ever wondered "what does that label mean?", check here.

## React internals

**Fiber**
A unit of work in React's reconciler. Every React element (component instance, DOM element, text node, etc.) has a corresponding fiber. The fiber tree mirrors the component tree but with extra metadata: pending props/state, effect lists, lanes, flags. Our extension walks this tree to detect renders.

**Commit / commit phase**
The moment React applies pending changes to the actual DOM. `onCommitFiberRoot` fires once per commit. Multiple `setState` calls in one event handler are usually batched into a single commit.

**Render / render phase**
The phase where React calls your component function to compute the new output. Distinct from "commit" — a component can render without committing (e.g., concurrent renders that get discarded).

**`fiber.alternate`**
React maintains two fibers per element: the current one and the work-in-progress one. After a commit, they swap. The "alternate" is what was current before this commit — we use it to compute "what changed?". Watch out: after the next commit, your saved reference points to stale data.

**`PerformedWork` flag (`0x01`)**
A bit React sets on a fiber when it actually executed the render function. The most reliable signal that "yes, this component re-rendered" — used by [bippy](https://github.com/AidenBai/bippy) and adopted in our v2.0.3.

**Render reason**
Why a component re-rendered. Three categories: `props changed`, `state changed`, `context changed`. Our Performance tab surfaces this per render.

**StrictMode**
A React debugging tool that intentionally double-mounts components in development to surface bugs caused by impure rendering or missing effect cleanup. Has no effect in production builds.

## Performance

**LCP (Largest Contentful Paint)**
Core Web Vital. Time from page navigation to the largest element in the viewport finishing render. Target: <2.5s. Surfaced in our Performance tab.

**FCP (First Contentful Paint)**
Core Web Vital. Time to first DOM content render. Target: <1.8s.

**TTFB (Time to First Byte)**
Time from navigation to first response byte. Target: <800ms.

**INP (Interaction to Next Paint)**
Core Web Vital that replaced FID in 2024. Worst observed input-response latency during the page's lifetime. Target: <200ms. Coming to our Performance tab in v2.1.

**FID (First Input Delay)**
Deprecated Core Web Vital (replaced by INP), but still measured for backward compat. Time from first user interaction to the browser processing it.

**CLS (Cumulative Layout Shift)**
Core Web Vital. Sum of all unexpected layout shifts during page lifetime. Target: <0.1. We have a dedicated CLS tab.

**Jank**
Perceptible lag in the UI. Usually caused by long synchronous JavaScript work blocking the main thread. Our v2.0.3 release was specifically about eliminating jank caused by the extension itself.

## Extension architecture

**Page world**
The JavaScript realm of the inspected page. Our inject script runs here to access React internals. Cannot directly call `chrome.*` APIs.

**Content script**
A script that runs in an isolated JavaScript realm but with access to the page's DOM. Runs at `document_start` for us. Bridges the page world ↔ the extension.

**Service worker (SW)**
The background script in Manifest V3. Routes messages, holds short-lived state. Dies after 30 seconds of idle.

**DevTools panel**
The React UI we render in the DevTools strip. Has access to `chrome.devtools.*` APIs. Lives as long as DevTools is open.

**Manifest V3 (MV3)**
The current Chrome extension API version. Replaces persistent background pages with ephemeral service workers. Stricter CSP. Required for new extensions since 2024.

## State management

**Redux store**
The single source of truth for state in Redux apps. We probe for it via `__REDUX_DEVTOOLS_EXTENSION__`, the same hook the official Redux DevTools uses.

**Selector**
A function that extracts a slice of Redux state. `useSelector(state => state.user.name)`. Selectors should return referentially-stable values when nothing relevant changed — otherwise components re-render unnecessarily.

**`shallowEqual`**
A comparison function from `react-redux` that checks if two objects have the same top-level keys with the same values. Used as the second arg to `useSelector` to prevent re-renders on irrelevant state changes.

**`createSelector`**
A memoization wrapper from `reselect` (and now Redux Toolkit). Caches selector output keyed by input identity.

**Time-travel debugging**
Replaying past Redux actions to see how state evolved. Planned for our Redux tab in v2.2.

## AI Analysis

**Snapshot**
The bundle of data we send to the AI for analysis. Built by `snapshot-builder.ts`. Includes component render counts, error patterns, Redux state structure — but NOT raw component source code.

**Token optimizer**
Logic in `token-optimizer.ts` that trims the snapshot to fit within LLM context limits while preserving signal.

**Subscription key**
A user-provided key that unlocks unlimited AI Analysis. Validated server-side by our Cloudflare Worker against a SHA-256 hash list — we never store the raw key.

**Free tier**
3 AI Analysis calls per 5-minute window without a subscription key.

## Process / project

**OpenSpec change**
A multi-file design proposal under `openspec/changes/<name>/`. Required for non-trivial architectural changes per our [HARNESS.md](https://github.com/hoainho/react-debugger-extension/blob/main/docs/HARNESS.md). Includes `proposal.md`, `design.md`, `tasks.md`, and `specs/` slices.

**Sisyphus plan**
A maintainer-facing implementation plan under `.sisyphus/plans/` (gitignored). Tracks work in progress. The "boulder" file points at the active plan.

**Lane / change type**
Risk classification per the [harness](https://github.com/hoainho/react-debugger-extension/blob/main/docs/HARNESS.md): `tiny`, `normal`, or `high-risk` lane × `user-feature`, `bug-fix`, `infra`, `refactor`, `docs`, or `dependency-bump` type. Determines required validation + review.

**Review Gate**
A required step in the harness: a fresh review agent must verify each acceptance criterion before a change can be archived. Bypassable only for tiny `docs` lane changes.

**MCP (Model Context Protocol)**
Anthropic's open standard for LLM-tool communication. Coming to React Debugger in v2.1 — see `openspec/changes/mcp-server-v1/`.

---

## Contributing a term

Spot something missing or unclear? Edit this page (collaborator access required) or [open a Q&A discussion](https://github.com/hoainho/react-debugger-extension/discussions/new?category=q-a) and we'll add it.
