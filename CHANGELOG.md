# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
