# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [3.0.0] - 2026-07-11

### Added

- **UI redesign — DevTools-native visual pass (S4.5)**: the 9 legacy tabs consolidate into a 5-view shell (Dashboard / Profiler / State / Effects / Settings) with an active-underline nav + per-view count badges, segmented sub-tab strips, and a sticky header. New **Dashboard** landing view (severity KPI stat-tiles, React version/mode + Redux chip, render-pressure sparkline, top-offenders, page-load vitals). Issue cards + design tokens (`tokens.css`) + severity ramp unified across views. The classic 9-tab layout stays one toggle away.
- **Reusable `ChartCanvas` (S4.5 V4)** — inline-SVG area/line/bars with a faint grid + emphasized endpoint (no chart deps); backs the Memory heap-over-time timeline and the Performance render-distribution chart.
- **Headless visual-regression lane (S4.5 V6)** — Playwright `toHaveScreenshot` baselines for all 5 views + classic + the new charts/inspector (9 total), served offline from `dist/` with a stubbed `chrome.*`. Run with `npm run test:visual`; documented in `test/visual/README.md`.
- **`Star Check` CI workflow** (`.github/workflows/star-check.yml`) — runs on every PR and blocks merge if the author hasn't starred the repository. Auto-exempts maintainer (`@hoainho`), bots (Dependabot, gemini-code-assist, google-cla, github-actions, renovate), `tracked-plan`-labeled PRs (maintainer-driven milestone work), and `pre-star-rule`-labeled PRs (grandfathered pre-policy). Uses the public `GET /users/{login}/starred/{owner}/{repo}` API — no extra auth scope.
- **Detector registry foundation (M-B)** — pluggable `Detector<TIssue>` lifecycle interface (`id`, `category`, `budgetMs`, `confidence`, `prodCapable`, `init`, `onCommit`, `onIdle`, `drain`, `teardown`, `recover`). Per-detector try/catch isolation + staged-write transactionality + bounded LRU dedupe.
- **React version adapter** scaffolding for r17/r18/r19/r19.2 with version-aware fiber tag enums + `getDisplayName`. Handles `OffscreenComponent` / `LegacyHiddenComponent` / `IndeterminateComponent` landmines across React versions.
- **Settings storage** with zod schema validation, v0→v1 migration (from legacy `react_debugger_disabled_sites` array), and `chrome.storage.local` persistence under `react_debugger_settings_v1`.
- **Settings UI** — new panel tab with per-detector toggles + confidence badges + per-site override list.
- **Hero detector #1 — reconciler-keys**: detects `Math.random()` / `Date.now()` keys (emit on first commit) AND numeric-index keys with verified cross-commit reorder. Emits new `UNSTABLE_LIST_KEY` issue type. Confidence: high (defaults ON). Production-capable.
- **Unified fiber traversal core (M-D.1 / R2)**: `src/inject/core/fiber-traversal.ts` — one depth-first `walkFiber(root, visitors[])` driving multiple isolated visitors (per-visitor `skipSubtree` pruning, per-visitor try/catch so one throwing visitor never aborts the others, deadline-yield + resume). The three legacy walkers migrate onto it under live-React regression (maintainer step); the core lands first, additively.
- **Timeline snapshot session-persistence (M-D.5)**: `readSnapshots`/`writeSnapshots`/`clearSnapshots` over `chrome.storage.session` (`timeline_snapshots_v1`) — snapshots survive panel reload / tab switch but not page reload. Wired into the Timeline view in the S4 Profiler rebuild.
- **BYOK AI providers (M-D / R4)**: pluggable AI provider abstraction (`src/services/ai-provider.ts`) — HostedProxy (default, reproduces the current proxy request), OpenAIDirect, and AnthropicDirect, plus a `none` provider that leaves the free panel tools working. BYOK key stored under `react_debugger_byok_v1`. Request shaping + response parsing + provider selection are unit-tested without live network calls.
- **stale-closure-async detector (M-D.4)**: conservative source analysis flagging a `useCallback`/`useEffect` whose async body (`await`/`.then`/`setTimeout`) reads a `useState` variable missing from its dependency array. Emits new `STALE_CLOSURE_ASYNC`. Confidence: medium (opt-in; heuristic, not full exhaustive-deps). Ships with `test/fixtures/stale-closure-async/`.
- **Production-capability matrix (M-E.4)** + **Perf-Tracks version gate (M-E.2)**: buildCapabilityMatrix() derives each detector’s prod/dev capability + confidence from its metadata (README table + Settings "(dev only)" badge source); selectProfilingStrategy() routes React >=19.2 to the Performance Tracks API, else the legacy profiling hook (live 19.2 API = maintainer gate).
- **Opt-in anonymous telemetry (M-F.2)** (`src/services/telemetry.ts`) — default OFF; aggregates per-detector counters (fires/dismisses/fp-clicks) and hourly-batches them; a whitelist payload builder guarantees only `{detector, fires, dismisses, fpClicks, ext_version, react_version}` ever leave (payload-audit test proves no URLs / component names / user data). Endpoint deploy = maintainer gate.
- **2026 retrospective** (`docs/RETROSPECTIVE-2026.md`): stages S0–S6, human gates, and 2027 kickoff topics.
- **Quick-win detectors (M-F.1)**: inline-handler-cost (a React.memo child gets an inline function prop that changes identity every commit → memo bypassed; fiber identity tracking) and ref-mutation-during-render (conservative source analysis: ref.current mutated in the render body, effect bodies excluded). New INLINE_HANDLER_COST / REF_MUTATION_DURING_RENDER. Confidence medium/low, opt-in. (M-F.1 slip to 2 quick-wins invoked — useFormStatus-outside-form needs FP-prone form-ancestry, deferred.)
- **Hero detector #4 — suspense-waterfall (M-E)**: flags a Suspense boundary that re-suspends on >=3 consecutive commits (a data-fetch waterfall signature), with a "may be intentional" caveat. Tracks a per-boundary consecutive-suspension streak; emits new SUSPENSE_WATERFALL. Confidence: medium (opt-in). Ships with test/fixtures/suspense-waterfall/ + bench.
- **Hero detector #3 — context-cascade (M-D)**: flags a `Context.Provider` whose `value` is a fresh reference every commit AND has ≥2 consumers (the "new object literal in Provider value" mistake that re-renders every consumer). Tracks value-reference identity across commits + counts context consumers; emits new `CONTEXT_CASCADE` with a `useMemo` fix. Confidence: high (defaults ON). Ships with `test/fixtures/context-cascade/` + bench.
- **Hero detector #2 — hydration-mismatch (M-C)**: intercepts React's `console.error` hydration-failure family ("Hydration failed", "Text content did not match", "Expected server HTML…"), parses the server/client diff + component, and emits a new `HYDRATION_MISMATCH` issue with a determinism-fix suggestion. Confidence: high (defaults ON); **dev-only** (React strips hydration warnings from production). Ships with `test/fixtures/hydration-mismatch/` + a `parseHydrationError` bench. Also lands M-C.1 (WeakMap-cached `tryInferStateName`), M-C.2 (fair-share budget allocator with yield/resume), and M-C.3 (source-map lookup helper scaffold).
- **Registry `onIdle` driver** (`Registry.dispatchIdle`) — scheduled via `requestIdleCallback` after every commit, enables detectors to do deferred work off the hot path.
- **reconciler-keys fixtures + perf baseline (M-B.6.7)** — shared fixture set under `test/fixtures/unstable-keys/` (positive `Math.random()`/`Date.now()`/index-reorder cases + a stable-id negative case) driving `src/__tests__/reconciler-keys.fixtures.test.ts`, plus a `test/bench/detectors.bench.ts` benchmark that runs the detector's `onCommit` over a 1000-child keyed list. First baseline recorded at `bench/baselines/reconciler-keys.json` (~0.08ms/commit, under the 0.3ms budget) as the reference for future PR bench gates.

### Changed

- **Contributor claim policy hardened** — starring the repo is now a **hard precondition for merge**, enforced by CI. See [CONTRIBUTING.md → How to claim](.github/CONTRIBUTING.md#-how-to-claim-an-issue-required-before-opening-a-pr). The previous "comment `I'll take this`" rule stays honor-system + reviewer-checked.
- PR template adds a "Claim confirmation" section with checkboxes for the two required steps. Maintainer / tracked-plan PRs can delete this section.
- **closure-leak detector** migrated to registry pattern via Strategy A (thin adapter through `window.__REACT_DEBUGGER_CLOSURE_BRIDGE__`). Legacy `_installClosureTracking` body unchanged; existing behavior preserved end-to-end. Confidence: medium (defaults OFF).
- **scan-overlay detector** migrated to registry pattern. **`getBoundingClientRect()` moved from synchronous `onCommit` to deferred `onIdle`** — the biggest live perf-budget violation flagged by the M-A audit is now closed. Confidence: high (defaults ON). Behavior preserved with a one-idle-callback-tick delay.
- **Motion + accessibility pass (S4.5 V5)** — section-switch + issue-card reveal transitions gated behind a global `prefers-reduced-motion` catch-all; `:focus-visible` rings extended to links; WCAG 2.1 AA contrast fix (`--text-muted` `#484f58`→`#7d8590`, now clears 4.5:1 on both `--bg-primary` and `--bg-card`).
- **UI timeout magic numbers extracted to `src/panel/constants.ts`** — 6 named constants (`POLL_INTERVAL_MS`, `HEALTH_DEBOUNCE_MS`, `AI_ANALYSIS_TIMEOUT_MS`, `MEMORY_GC_INTERVAL_MS`, `RECONNECT_BACKOFF_MS`, `RECONNECT_MAX_DELAY_MS`) replace inline `setTimeout`/`setInterval` values across `Panel.tsx`, `TimelineTab.tsx`, `PerformanceTab.tsx`, `MemoryTab.tsx`, and `ReduxTab.tsx`. Zero behavior change; one place to tune from now on. Closes #31. Thanks to **@Kunall7890**.

### Fixed

- Periodic cleanup now drains the detector registry's per-detector buffers every 60s, preventing unbounded buffer growth if users opt in to medium/low-confidence detectors.
- **CLI bootstrap logs no longer leak to stdout** — `cli/bin/cli.js` routes human-readable install diagnostics to `stderr`, keeping the JSON-RPC stream clean for strict-mode MCP clients. The `printSuccess` logger binds `console.log` / `console.error` to preserve execution context in V8 strict mode (avoids `TypeError: Illegal invocation` on the success path). Closes #49. Thanks to **@AsifpMulla123** for their first merged PR to this repo (after authoring the original `MCP_USAGE.md` in PR #38).
- **MCP pairing token migrated from `chrome.storage.local` to `chrome.storage.session`** — the panel-level bearer token (long-lived, auth-equivalent) now lives in session storage and is wiped when the browser session ends. Includes a `migrateLegacyStorage()` helper that one-time-migrates any existing local entries and removes them, plus a URL-hash scrub via `window.history.replaceState` so the token never lingers in the address bar after parsing. Closes #42. Thanks to **@iMindCap** for the security fix (their 2nd PR to this repo, returning after #17).
- **Click-only divs/spans converted to keyboard-accessible buttons** — 5 elements across `IssueCard.tsx` and `AIAnalysisTab.tsx` now expose `role="button"`, `tabIndex={0}`, `aria-expanded` where relevant, and Enter/Space key handlers. Adds `:focus-visible` ring styling in `panel.css`. Includes an `e.target === e.currentTarget` guard so nested interactive children (e.g. the link inside an expandable card) don't double-fire the toggling handler. Closes #29. Thanks to **@Kunall7890**.

### Documentation

- **`MCP_USAGE.md` now includes a Continue.dev setup snippet** — alongside the existing Cline / Claude Desktop / Opencode entries. Three config variants documented: global `~/.continue/config.yaml`, workspace `.continue/config.yaml`, and legacy `~/.continue/config.json`. Includes a verify-the-install step. Closes #5. Thanks to **@Kunall7890** for the addition (extends @AsifpMulla123's original `MCP_USAGE.md` from PR #38).

### Contributors (this release)

- **@Kunall7890** (Kunal Jaiswal) — 3 PRs merged on launch day (2026-06-07): #58 (alert→inline errors), #61 (Continue.dev docs), #62 (timeout constants), #64 (a11y buttons). Plus 5 prior PRs including #18 (a11y prefers-reduced-motion). 10 merged PRs across GitHub (freeCodeCamp, Cloudflare Kinetics Editor, Memact Contracts).
- **@iMindCap** (Arael Amador) — 1 PR on launch day: #63 (MCP pairing token security migration). Plus 1 prior PR #17 (MCPPairingPanel error messages, 184 insertions).
- **@AsifpMulla123** (Asif Mulla) — 1 PR on launch day: #57 (CLI bootstrap stdout leak fix). Plus 1 prior PR #38 (original `MCP_USAGE.md` author, the foundation Kunall7890's #61 extends).

### Migration

- First run after upgrade: existing per-site disabled list (`react_debugger_disabled_sites`) is migrated to the new `Settings.perSite` shape. Migration is idempotent; legacy key is removed after successful migration.
- Default-policy applied on first install: high-confidence detectors (reconciler-keys, scan-overlay) default ON; medium/low (closure-leak) default OFF.
- 4 PRs that were already open when the Star Check policy landed (#17, #36, #37, #38) labeled `pre-star-rule` and grandfathered through the check.
- First run after upgrade from any pre-`storage.session` build: the MCP pairing token is automatically migrated from `chrome.storage.local` to `chrome.storage.session` via `migrateLegacyStorage()` (one-time, idempotent, removes the legacy key after success). Requires **Chrome 102+** for `chrome.storage.session` support (extension already requires Chrome 122+).

## [2.0.3] - 2026-02-28

### Improved

#### Zero-Lag Host Page Performance
- **Eliminated host page jank** caused by extension running analysis on every React commit
- `webNavigation.onCommitted` now filters by `transitionType` — only real navigations (typed, link, reload) trigger re-initialization, SPA `pushState` no longer floods `ENABLE_DEBUGGER`
- Added `enableInProgress` guard in content script to prevent duplicate `handleEnableDebugger` calls on rapid navigation
- Deferred heavy initialization (`installReduxHook`, `installErrorHandlers`, `forceReanalyze`) to idle callback (500ms) instead of running synchronously on enable
- `periodicCleanup` interval moved inside `ENABLE_DEBUGGER` handler and reduced frequency (30s → 60s)
- POLL_DATA `scheduleIdleWork` timeout increased from 50ms → 1000ms to reduce main thread contention
- Panel poll interval reduced from 2s → 5s

#### Hybrid Render Detection Architecture
- **New synchronous render snapshot system** — lightweight fiber tree walk in `onCommitFiberRoot` captures render info (component name, duration, render change details, `WeakRef` to fiber) within a 2ms budget
- Deferred `analyzeFiberTree` in POLL_DATA uses captured snapshot data instead of stale `fiber.alternate` (which gets overwritten by React's double-buffering after the next commit)
- `forceReanalyze` still uses live `didFiberRender()` as fallback when no snapshot is available
- Render detection now works reliably regardless of poll timing

#### Accurate Render Detection (aligned with react-scan/bippy)
- **Rewrote `didFiberRender`** to match [bippy](https://github.com/AidenBai/bippy)'s battle-tested approach used by react-scan
- For composite components (function, class, memo, forwardRef): primary check is `PerformedWork` flag (0x01) — the only flag React sets when it actually executes a render function
- Added `memoizedProps`/`memoizedState` reference-inequality fallback for React versions/builds where `PerformedWork` may not be set
- **Removed false-positive triggers**: `Update`, `Placement`, `Passive` flags, `actualDuration > 0`, and `lanes !== 0` no longer count as renders — these indicate side effects, not actual component re-renders

#### Scan Overlay (Visual Re-render Flash)
- Scan overlay now fires **synchronously at commit time** inside `onCommitFiberRoot` using `traverseFiber` — immediate visual feedback matching the original v2.0.0 behavior
- Removed duplicate scan overlay from deferred POLL_DATA handler that caused double-flash and delayed feedback
- Overlay correctly shows render intensity colors: green (×1), yellow (×2–3), orange (×5), red (×10+)

### Fixed
- Fixed scan overlay not appearing on large React apps (e.g., game apps with deep component trees) — previously limited by the 2ms snapshot capture budget
- Fixed overlay flashing continuously on every commit even when data hadn't changed — caused by overly broad `didFiberRender` detecting passive effects as renders
- Fixed build error from missing closing brace in `analyzeFiberTree` block structure
- Added `WeakRef` type declaration to resolve TypeScript lib target mismatch (WeakRef is ES2021+, available in all modern browsers)
- `stopAllMonitoring` now clears `pendingRenderSnapshots` buffer

### Technical Details

| Component | Before (v2.0.2) | After (v2.0.3) |
|-----------|----------------|----------------|
| `onCommitFiberRoot` | Full analysis on every commit | Lightweight snapshot only (~2ms) |
| `POLL_DATA` interval | 2s | 5s |
| `scheduleIdleWork` timeout | 50ms | 1000ms |
| `didFiberRender` checks | 7 conditions (many false positives) | PerformedWork + props/state fallback |
| Scan overlay trigger | Deferred in POLL_DATA (seconds late) | Synchronous at commit time |
| Navigation re-init | Every `pushState` | Real navigations only |
| `periodicCleanup` | Every 30s, on every message | Every 60s, only after enable |


## [2.0.0] - 2026-02-22

### Added

#### AI Analysis Tab
 AI-powered code analysis with security, performance, crash risk, and root cause detection
 Rate-limited to 3 free calls per 5-minute window
 Subscription key system for unlimited access with paywall UI
 Remote key validation via Cloudflare Worker (no secrets in source code)
 PRO badge and "Unlimited" status indicator for subscribers
 Contact email link for subscription inquiries

#### Exclusive Branding
 New proprietary logo: broken orbital rings + hexagonal core + diagnostic crosshair
 Replaced standard React atom icon with unique design across all sizes (16/48/128px)

### Changed

#### UI Overhaul
 Replaced all emoji indicators with CSS badge/indicator system
 New dark blue theme (GitHub Dark style) with cyan accent tokens
 Modernized all 10 tab components with consistent badge styling
 Added 375+ lines of new CSS for badges, indicators, status elements, and paywall

#### Panel Header
 Removed Recording ON/OFF toggle (redundant with extension bar tooltip enable)
 Simplified header to logo + version + Redux badge only

#### AI Settings
 Removed proxy URL and API key fields from settings (security: prevents credential exposure)
 Settings now show only Model selector + subscription key input
 Added contact email section (hoainho.work@gmail.com)

### Fixed

#### React Detection
 Fixed race condition: proactive ENABLE_DEBUGGER re-send on navigation
 Fixed async content script injection timing
 Added REACT_DETECTED re-send when React is already initialized
 Auto-enable debugger on panel open

#### DevTools
 Fixed `Extension context invalidated` error in devtools.js by removing dead PANEL_READY callback

#### Git Hygiene
 Untracked `node_modules/` and `dist/` from git (were previously committed)
 Added `worker/` to .gitignore

### Security
 Subscription key validation moved from local SHA-256 hash to remote Cloudflare Worker
 No API keys, hashes, or secrets stored in source code
 Real proxy API key hidden from extension UI


## [1.0.2] - 2026-02-10

### Fixed

#### Content Script (BUG-001, BUG-002, BUG-015)
- **Lazy initialization**: Script injection now only occurs when DevTools panel is opened (ENABLE_DEBUGGER message), not on every page load
- **Removed synchronous storage access**: Storage check moved from init() to message handler, eliminating blocking operations at document_start
- **Proper event listener cleanup**: Added `removePageMessageListener()` function to clean up window message listeners on disable
- **Error boundaries**: Wrapped message handler in try-catch to prevent extension errors from affecting host page

#### Inject Script (BUG-004, BUG-005, BUG-006-010, BUG-012, BUG-013)
- **Optimized React root detection**: Now checks known selectors (#root, #app, #__next) first before falling back to limited DOM scan (max 200 elements)
- **Replaced Redux polling with single-attempt detection**: Removed 20-second setInterval polling, now uses single check with one retry after 2 seconds
- **Bounded fiber tree traversal**: `traverseFiber` converted from recursive to iterative with 500 node limit
- **Increased analysis throttle**: Changed from 100ms to 250ms to reduce main thread blocking
- **Fixed memory leaks**: All Maps and Sets now cleared on DISABLE_DEBUGGER:
  - `renderCounts`
  - `lastRenderTimes`
  - `recentRenderTimestamps`
  - `reportedEffectIssues`
  - `reportedExcessiveRerenders`
  - `reportedSlowRenders`
  - `componentRenderIds`
  - `lastEffectStates`
  - `trackedClosures`
  - `staleClosureIssues`
  - `stateOverrides`
  - `overlayElements`
  - `renderFlashTimers`

#### Background Script (BUG-014, BUG-025)
- **Message validation**: Added `isValidMessage()` function to validate incoming messages before processing
- **Rate limiting**: Added 50ms throttle for FIBER_COMMIT messages to prevent flooding
- **Navigation state clearing**: Added `chrome.webNavigation.onCommitted` listener to reset tab state on page navigation
- **Safe tab messaging**: Created `safeSendToTab()` helper with `.catch()` to handle disconnected tabs gracefully
- **Memory cleanup**: `debuggerEnabledStates` Map now properly cleared on tab removal

### Added

- **Unit tests**: Added 43 new tests for utility functions (sanitize.ts, messaging.ts), bringing total to 170 tests
- **EDGE-CASES.md**: Documented 50 edge cases across 6 categories:
  - Initialization & Detection (10 cases)
  - Performance Monitoring (10 cases)
  - Redux Integration (8 cases)
  - Memory & Cleanup (8 cases)
  - UI & State Issues (7 cases)
  - CLS & Layout (7 cases)
- **Landing page**: Created modern dark-themed landing page at docs/index.html for GitHub Pages
- **CHANGELOG.md**: This file

### Changed

- **Fiber traversal limit**: Reduced from unlimited to 500 nodes per traversal
- **Analysis throttle**: Increased from 100ms to 250ms
- **Redux detection**: Changed from polling (20 attempts over 20 seconds) to single attempt with one retry

### Security

- **Error isolation**: Extension errors are now caught and logged without propagating to host page
- **Context validation**: Added `extensionContextValid` checks throughout content script

## [1.0.1] - 2026-01-15

### Fixed
- Minor bug fixes and stability improvements

## [1.0.0] - 2026-01-01

### Added
- Initial release
- UI & State Issues detection (missing keys, index as key, direct state mutation)
- Performance Analysis (render tracking, excessive re-render detection)
- Side Effects monitoring (missing cleanup, dependency issues)
- CLS Monitor (real-time Cumulative Layout Shift tracking)
- Redux DevTools integration (state tree, action dispatch)
- Memory monitoring (heap size tracking, leak detection)
- Timeline view (visual timeline of React events)
- Dark theme DevTools panel

---

## Bug Reference

The following bugs from the v1.0.2 audit were addressed:

| Bug ID | Severity | Description | Status |
|--------|----------|-------------|--------|
| BUG-001 | Critical | Content script injects heavy script on every page | ✅ Fixed |
| BUG-002 | Critical | Synchronous storage access blocks init | ✅ Fixed |
| BUG-004 | Critical | findReactRoots queries all DOM elements | ✅ Fixed |
| BUG-005 | Critical | Redux polling for 20 seconds | ✅ Fixed |
| BUG-006 | High | Unbounded Maps grow indefinitely | ✅ Fixed |
| BUG-007 | High | Reported issues Sets grow indefinitely | ✅ Fixed |
| BUG-008 | High | staleClosureIssues Map never cleaned | ✅ Fixed |
| BUG-009 | High | componentRenderIds Map grows indefinitely | ✅ Fixed |
| BUG-010 | High | lastEffectStates Map grows indefinitely | ✅ Fixed |
| BUG-012 | High | Fiber traversal has no depth limit | ✅ Fixed |
| BUG-013 | High | analyzeFiberTree runs on every commit | ✅ Fixed |
| BUG-014 | High | broadcastToPanel silently fails | ✅ Fixed |
| BUG-015 | High | Content script listeners without cleanup | ✅ Fixed |
| BUG-025 | Medium | Tab state not cleared on navigation | ✅ Fixed |

See `.sisyphus/audit/bugs.md` for the complete bug audit report.
