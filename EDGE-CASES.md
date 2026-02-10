# Edge Cases - React Debugger Extension

This document catalogs 50 edge cases that may occur when using the React Debugger Chrome Extension. Each case includes the scenario, expected behavior, and potential failure modes.

---

## Category 1: Initialization & Detection (10 cases)

### EC-001: Extension loaded on non-React page
- **Scenario**: User opens DevTools on a page without React
- **Expected Behavior**: Extension shows "React not detected" message, no errors in console
- **Potential Failure**: Extension attempts to traverse non-existent fiber tree, causing errors

### EC-002: React loaded after page load (lazy loading)
- **Scenario**: React bundle is loaded dynamically after initial page load
- **Expected Behavior**: Extension detects React when it becomes available
- **Potential Failure**: Detection polling may have stopped before React loads

### EC-003: Multiple React versions on same page
- **Scenario**: Page has React 17 and React 18 loaded simultaneously (micro-frontends)
- **Expected Behavior**: Extension detects primary React version, shows warning about multiple versions
- **Potential Failure**: Fiber tree traversal may mix nodes from different React versions

### EC-004: React in iframe
- **Scenario**: React app runs inside an iframe
- **Expected Behavior**: Extension detects React in main frame only (by design)
- **Potential Failure**: Content script may inject into iframe, causing duplicate detection

### EC-005: Extension context invalidated during use
- **Scenario**: Extension is updated/reloaded while DevTools is open
- **Expected Behavior**: Extension gracefully handles context invalidation, shows reconnect message
- **Potential Failure**: Zombie event listeners continue running, causing console errors

### EC-006: DevTools opened before React mounts
- **Scenario**: User opens DevTools immediately on page load, before React initializes
- **Expected Behavior**: Extension waits for React, then initializes properly
- **Potential Failure**: Race condition between detection and panel initialization

### EC-007: React app with custom renderer
- **Scenario**: App uses react-three-fiber or react-native-web with custom reconciler
- **Expected Behavior**: Extension detects React but may not fully understand custom fiber types
- **Potential Failure**: Fiber traversal crashes on unknown fiber tags

### EC-008: Server-side rendered (SSR) hydration
- **Scenario**: Next.js/Remix app hydrates server-rendered HTML
- **Expected Behavior**: Extension detects React after hydration completes
- **Potential Failure**: Extension may capture hydration mismatches as errors

### EC-009: React Strict Mode double rendering
- **Scenario**: App runs in React.StrictMode (development)
- **Expected Behavior**: Extension correctly identifies double renders as intentional
- **Potential Failure**: Reports excessive re-renders for normal Strict Mode behavior

### EC-010: Production vs Development React builds
- **Scenario**: User debugs production build of React app
- **Expected Behavior**: Extension works but with limited component names (minified)
- **Potential Failure**: Component names show as single letters, making debugging difficult

---

## Category 2: Performance Monitoring (10 cases)

### EC-011: Rapid state updates (60fps animations)
- **Scenario**: App has requestAnimationFrame-driven state updates
- **Expected Behavior**: Extension throttles analysis to prevent blocking animation
- **Potential Failure**: Extension analysis causes frame drops

### EC-012: Large component tree (500+ components)
- **Scenario**: Complex dashboard with hundreds of components
- **Expected Behavior**: Extension limits traversal depth, shows partial tree
- **Potential Failure**: Full traversal blocks main thread for seconds

### EC-013: Deeply nested component hierarchy (50+ levels)
- **Scenario**: Recursive component structure (tree view, nested comments)
- **Expected Behavior**: Extension caps traversal at max depth
- **Potential Failure**: Stack overflow from recursive traversal

### EC-014: Component with thousands of children
- **Scenario**: Virtualized list renders 10,000 items
- **Expected Behavior**: Extension samples children, doesn't enumerate all
- **Potential Failure**: Memory exhaustion from tracking all children

### EC-015: Frequent context updates
- **Scenario**: Theme context or auth context updates frequently
- **Expected Behavior**: Extension tracks context changes without excessive overhead
- **Potential Failure**: Every context consumer triggers analysis

### EC-016: Concurrent React features (Suspense, transitions)
- **Scenario**: App uses React 18 concurrent features
- **Expected Behavior**: Extension handles interrupted renders gracefully
- **Potential Failure**: Partial render states cause inconsistent analysis

### EC-017: Memory pressure during monitoring
- **Scenario**: Browser is low on memory while extension is active
- **Expected Behavior**: Extension reduces data collection, warns user
- **Potential Failure**: Extension contributes to out-of-memory crash

### EC-018: Long-running session (8+ hours)
- **Scenario**: Developer leaves DevTools open all day
- **Expected Behavior**: Extension maintains stable memory usage
- **Potential Failure**: Memory leaks cause gradual performance degradation

### EC-019: Tab backgrounded while monitoring
- **Scenario**: User switches to another tab while extension is active
- **Expected Behavior**: Extension pauses heavy operations when tab is hidden
- **Potential Failure**: Background tab continues consuming resources

### EC-020: Multiple DevTools panels open
- **Scenario**: User opens DevTools in multiple windows for same tab
- **Expected Behavior**: Both panels receive same data
- **Potential Failure**: Duplicate message processing, race conditions

---

## Category 3: Redux Integration (8 cases)

### EC-021: Redux store not using Redux DevTools
- **Scenario**: App has Redux but no DevTools extension integration
- **Expected Behavior**: Extension detects store via window property scanning
- **Potential Failure**: Store detection fails, Redux tab shows empty

### EC-022: Multiple Redux stores
- **Scenario**: Micro-frontend with separate Redux stores per module
- **Expected Behavior**: Extension detects primary store, notes multiple stores exist
- **Potential Failure**: Extension tracks wrong store or mixes state

### EC-023: Redux store replaced (HMR)
- **Scenario**: Hot module replacement replaces Redux store
- **Expected Behavior**: Extension detects new store, updates connection
- **Potential Failure**: Extension holds reference to old store

### EC-024: Redux middleware that transforms actions
- **Scenario**: App uses redux-saga or custom middleware
- **Expected Behavior**: Extension shows actions as dispatched (post-middleware)
- **Potential Failure**: Action timeline shows confusing middleware-generated actions

### EC-025: Large Redux state (10MB+)
- **Scenario**: App stores large datasets in Redux
- **Expected Behavior**: Extension truncates state display, warns about size
- **Potential Failure**: Serializing large state blocks main thread

### EC-026: Circular references in Redux state
- **Scenario**: Redux state contains circular object references
- **Expected Behavior**: Extension detects and handles circular refs
- **Potential Failure**: JSON serialization throws, crashes state display

### EC-027: Redux state with non-serializable values
- **Scenario**: State contains functions, Symbols, or class instances
- **Expected Behavior**: Extension sanitizes values, shows placeholders
- **Potential Failure**: Serialization errors or misleading display

### EC-028: Redux Toolkit with Immer
- **Scenario**: App uses RTK with Immer for immutable updates
- **Expected Behavior**: Extension shows final state, not Immer drafts
- **Potential Failure**: Extension captures Immer proxy objects

---

## Category 4: Memory & Cleanup (8 cases)

### EC-029: Component unmounts during analysis
- **Scenario**: Component unmounts while extension is analyzing its fiber
- **Expected Behavior**: Extension handles stale fiber reference gracefully
- **Potential Failure**: Accessing unmounted fiber causes errors

### EC-030: Page navigation in SPA
- **Scenario**: User navigates to new route in single-page app
- **Expected Behavior**: Extension clears old route data, starts fresh analysis
- **Potential Failure**: Old route's issues persist in new route's display

### EC-031: Full page reload
- **Scenario**: User refreshes page with F5
- **Expected Behavior**: Extension reinitializes cleanly
- **Potential Failure**: Old state persists in background script

### EC-032: Tab closed while extension active
- **Scenario**: User closes tab with DevTools open
- **Expected Behavior**: All tab-specific data is cleaned up
- **Potential Failure**: Memory leak in background script Maps

### EC-033: Extension disabled then re-enabled
- **Scenario**: User toggles extension off and on in chrome://extensions
- **Expected Behavior**: Extension reinitializes without residual state
- **Potential Failure**: Stale listeners or state from previous session

### EC-034: Browser crash recovery
- **Scenario**: Browser crashes and restores session
- **Expected Behavior**: Extension starts fresh on restored tabs
- **Potential Failure**: Extension tries to resume invalid state

### EC-035: DevTools closed and reopened
- **Scenario**: User closes DevTools panel then reopens it
- **Expected Behavior**: Extension reconnects, shows current state
- **Potential Failure**: Panel shows stale data from before close

### EC-036: Memory snapshot during garbage collection
- **Scenario**: Extension takes memory snapshot while GC is running
- **Expected Behavior**: Snapshot reflects post-GC state
- **Potential Failure**: Inconsistent memory readings

---

## Category 5: UI & State Issues Detection (7 cases)

### EC-037: Array with duplicate keys
- **Scenario**: React list has items with same key prop
- **Expected Behavior**: Extension detects and reports duplicate key warning
- **Potential Failure**: Only first duplicate is reported

### EC-038: Index as key in dynamic list
- **Scenario**: List uses array index as key, items are reordered
- **Expected Behavior**: Extension warns about index-as-key anti-pattern
- **Potential Failure**: False positive for static lists where index is acceptable

### EC-039: Direct state mutation
- **Scenario**: Component mutates state object directly instead of using setState
- **Expected Behavior**: Extension detects mutation pattern, warns user
- **Potential Failure**: Mutation detection has false negatives for deep mutations

### EC-040: Missing useEffect cleanup
- **Scenario**: useEffect sets up subscription without cleanup function
- **Expected Behavior**: Extension warns about potential memory leak
- **Potential Failure**: False positive for effects that don't need cleanup

### EC-041: useEffect with missing dependencies
- **Scenario**: useEffect references variables not in dependency array
- **Expected Behavior**: Extension warns about stale closure risk
- **Potential Failure**: Cannot detect all closure issues statically

### EC-042: Prop drilling through many levels
- **Scenario**: Props passed through 10+ component levels
- **Expected Behavior**: Extension suggests using Context
- **Potential Failure**: Legitimate prop passing flagged as issue

### EC-043: Large props object
- **Scenario**: Component receives props with 100+ properties
- **Expected Behavior**: Extension truncates display, warns about prop size
- **Potential Failure**: Serializing large props causes lag

---

## Category 6: CLS & Layout Monitoring (7 cases)

### EC-044: Layout shift from lazy-loaded images
- **Scenario**: Images load without width/height, causing layout shift
- **Expected Behavior**: Extension captures CLS event, identifies image as source
- **Potential Failure**: Source element identification fails for dynamic content

### EC-045: Font loading causes layout shift
- **Scenario**: Web font loads and changes text dimensions
- **Expected Behavior**: Extension captures font-induced CLS
- **Potential Failure**: Font shifts may be too small to attribute

### EC-046: Dynamic content injection
- **Scenario**: Ad or third-party widget injects content, shifting layout
- **Expected Behavior**: Extension identifies injected element as CLS source
- **Potential Failure**: Cross-origin content may not be attributable

### EC-047: Skeleton loading patterns
- **Scenario**: App uses skeleton screens that transition to real content
- **Expected Behavior**: Extension distinguishes intentional transitions from problematic shifts
- **Potential Failure**: Skeleton-to-content transition flagged as CLS issue

### EC-048: Viewport resize
- **Scenario**: User resizes browser window
- **Expected Behavior**: Extension ignores user-initiated layout changes
- **Potential Failure**: Resize-triggered shifts counted as CLS

### EC-049: Scroll-triggered animations
- **Scenario**: Elements animate into view on scroll
- **Expected Behavior**: Extension filters out scroll-triggered shifts (hadRecentInput)
- **Potential Failure**: Scroll animations incorrectly flagged

### EC-050: Print layout changes
- **Scenario**: User triggers print dialog, causing layout recalculation
- **Expected Behavior**: Extension ignores print-related layout changes
- **Potential Failure**: Print layout shifts recorded as CLS

---

## Summary

| Category | Count | Key Concerns |
|----------|-------|--------------|
| Initialization & Detection | 10 | Race conditions, multiple React versions, SSR |
| Performance Monitoring | 10 | Large trees, rapid updates, memory pressure |
| Redux Integration | 8 | Store detection, large state, HMR |
| Memory & Cleanup | 8 | Navigation, tab lifecycle, leak prevention |
| UI & State Issues | 7 | False positives, detection accuracy |
| CLS & Layout | 7 | Attribution accuracy, intentional shifts |
| **Total** | **50** | |

---

## Testing Recommendations

For each edge case:
1. Create a minimal reproduction scenario
2. Verify expected behavior in Chrome DevTools
3. Check console for errors
4. Monitor memory usage over time
5. Test on both development and production React builds
