# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
