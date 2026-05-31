# FAQ

Living frequently-asked-questions. If your question isn't here, [ask in Q&A](https://github.com/hoainho/react-debugger-extension/discussions/new?category=q-a) and the maintainer or a contributor will answer + add it here.

## Installation

### Q: `npx react-debugger` says "package not found at v0.0.1" — what's the right command?

The correct command is **`npx @nhonh/react-debugger`** (scoped). The unscoped `react-debugger` package is held by someone else at v0.0.1. We publish under `@nhonh/`.

### Q: Why is the install command an `npx` and not a Chrome Web Store link?

The Chrome Web Store listing is on the roadmap but not yet submitted. Right now `npx @nhonh/react-debugger` downloads the latest signed extension build from GitHub Releases and extracts it to your working directory. You then load it as an unpacked extension. This is the same install pattern react-scan uses pre-CWS.

### Q: What Node version do I need to run the npx CLI?

Node 18 or newer. The CLI is intentionally tiny (just downloads + unzips), so even older Node versions might work, but only 18+ is tested.

## Usage

### Q: I see "React not detected" on a React app — why?

Three usual causes:

1. **React 15 or older.** We require React 16+ (Fiber architecture).
2. **Page hasn't finished loading.** Refresh after opening DevTools.
3. **React in production mode without DevTools profiling hook.** Some build tools strip the DevTools global. Try a development build first.

### Q: Why does the Performance tab show 0 renders even though the page is clearly updating?

You probably opened DevTools *after* the renders happened. The extension only captures renders that occur *while the panel is open*. Refresh the page with DevTools open to capture the initial mount.

### Q: Why is the Redux tab empty when I have Redux?

We probe for the Redux store via `__REDUX_DEVTOOLS_EXTENSION__` (the same hook the official Redux DevTools uses). If your app doesn't enable that integration in your store setup, we can't find it. Add this to your store config:

```ts
import { configureStore } from '@reduxjs/toolkit';

const store = configureStore({
  reducer: rootReducer,
  devTools: process.env.NODE_ENV !== 'production', // ← this enables the hook
});
```

For Zustand/Jotai/MobX users: full support coming in v2.1. Today the Redux tab only finds true Redux stores.

### Q: The CLS tab shows 0 even when I see layout shifts — why?

CLS is captured at `document_start` via a `PerformanceObserver`. If you opened DevTools after the page loaded, you missed the initial-load shifts. Refresh with DevTools open.

## AI Analysis

### Q: How does AI Analysis work without me providing an OpenAI key?

The extension talks to a Cloudflare Worker (`proxy.hoainho.info`) which holds the API key server-side. You authenticate by subscription key (3 free analyses per 5-minute window without one). Your code/state snapshots leave your browser but the API key never lives on your machine.

### Q: Is my code being shared with OpenAI / Anthropic?

The snapshot we send is sanitized via `src/utils/sanitize.ts` — it includes component names, render counts, error messages, and Redux state structure. It does NOT include the raw source code of your components. See [SECURITY.md](https://github.com/hoainho/react-debugger-extension/blob/main/SECURITY.md) for the full data-flow description.

### Q: Why is AI Analysis paid?

Because LLM API calls cost real money per request. The 3-free-per-5-minutes tier covers casual usage; the subscription unlocks unlimited.

## Development / Contributing

### Q: How do I run the tests?

```bash
npm ci
npm run test:run    # one-shot
npm test            # watch mode
npm run test:coverage
```

Known test debt: 29 of 170 tests currently fail because they assert against emoji characters removed in v2.0.0. CI surfaces these as a `::warning::` rather than blocking merge. See [CONTRIBUTING.md](https://github.com/hoainho/react-debugger-extension/blob/main/.github/CONTRIBUTING.md#how-to-run-tests).

### Q: Why no ESLint?

Today we rely on TypeScript `strict: true` + `noUnusedLocals`/`noUnusedParameters` for catching most issues. ESLint is on the roadmap but hasn't been a priority because `tsc --noEmit` already catches the common problems. If you want to propose an ESLint config, [open an Idea](https://github.com/hoainho/react-debugger-extension/discussions/new?category=ideas).

### Q: Why TypeScript and not Flow / pure JS?

It's a one-person project. TypeScript has the best ecosystem support in 2026, and `strict: true` catches most bugs at compile time. No deeper philosophy than that.

## Architecture

### Q: Why does the extension hook into `__react_devtools_global_hook__` instead of using the Profiler API?

Two reasons:
1. **Coverage.** The Profiler API only fires for `<Profiler>`-wrapped components, requiring the developer to wrap. The DevTools hook fires for every commit.
2. **Render reasons.** The DevTools hook gives us access to `fiber.memoizedProps` / `memoizedState` (and the previous values via `alternate`), which is how we compute "why did this render?". The Profiler API only gives durations.

### Q: Why `chrome.storage.local` rather than `chrome.storage.session`?

`session` storage clears on browser close, which would lose the user's AI config + subscription key. `local` persists. For per-tab debugger-enabled flags we DO use `session`.

### Q: What's bippy and why did v2.0.3 align with it?

[bippy](https://github.com/AidenBai/bippy) is the render-detection library underlying react-scan (21k stars). It uses React's internal `PerformedWork` flag (`0x01`) as the primary "did this fiber render?" signal, which is the *only* flag React sets when it actually executes a render function. Previous versions of our `didFiberRender` checked 7 conditions, many of which produced false positives (Update/Placement/Passive flags indicate side effects, not renders). Aligning with bippy gave us correctness + eliminated jank.

## Project / Community

### Q: How do you decide what goes in Issues vs Discussions vs an OpenSpec change?

| Type | Goes in |
|---|---|
| Bug reports | [Issues](https://github.com/hoainho/react-debugger-extension/issues/new?template=bug_report.yml) |
| Concrete feature requests with clear scope | [Issues](https://github.com/hoainho/react-debugger-extension/issues/new?template=feature_request.yml) |
| Open-ended brainstorming, "what if we" | [Discussions / Ideas](https://github.com/hoainho/react-debugger-extension/discussions/new?category=ideas) |
| Usage questions | [Discussions / Q&A](https://github.com/hoainho/react-debugger-extension/discussions/new?category=q-a) |
| Major design changes touching multiple modules | [`openspec/changes/`](https://github.com/hoainho/react-debugger-extension/tree/main/openspec/changes) proposal |
| Maintainer-internal planning | [`.sisyphus/plans/`](https://github.com/hoainho/react-debugger-extension/tree/main/.sisyphus/plans) (gitignored) |
| Security vulnerabilities | [SECURITY.md](https://github.com/hoainho/react-debugger-extension/blob/main/SECURITY.md) — never public |

### Q: Why a 90-day growth campaign?

The project sat at 11 stars / 0 forks / 0 external contributors for 4 months. The current campaign (see [`openspec/changes/growth-and-contributor-attraction/`](https://github.com/hoainho/react-debugger-extension/tree/main/openspec/changes/growth-and-contributor-attraction)) is a structured 90-day push to fix discoverability, contributor on-ramp, and visual assets — measured against concrete metrics. Week 1 shipped May 2026.

### Q: Is this project still maintained?

Yes. As of May 2026 it has a single active maintainer (NhoNH) plus a growing pool of external contributors (2 PRs merged from external contributors in 24 hours, May 30-31 2026). Response SLA: 7 days on PRs, 14 days on issues. See [CONTRIBUTING.md](https://github.com/hoainho/react-debugger-extension/blob/main/.github/CONTRIBUTING.md#maintainer-sla).
