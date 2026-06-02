/**
 * React 18.x adapter
 *
 * Tag source: https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactWorkTags.js
 *             SHA: f1338f8080abd1386454a10bbf93d67bfe37ce85
 *
 * Key differences from r17:
 *   - OffscreenComponent: 22 (was 23)
 *   - LegacyHiddenComponent: 23 (was 24)
 *   - Block (22) removed
 *   - FundamentalComponent (20) removed
 *   - CacheComponent=24, TracingMarkerComponent=25 added
 *   - renderer.injectProfilingHooks: NOW PRESENT
 *   - hook.onPostCommitFiberRoot: added
 *   - hook.setStrictMode: added
 *   - getInternalModuleRanges, registerInternalModuleStart/Stop: added
 *
 * Key differences from r19:
 *   - IndeterminateComponent=2 still present (removed in r19)
 *   - HostHoistable, HostSingleton, IncompleteFunctionComponent, Throw: absent
 */

import type {
  ReactVersionAdapter,
  FiberTagMap,
  FiberNode,
  ReactRenderer,
  DevToolsProfilingHooks,
} from './types';
import { walkFiberImpl, walkHookLinkedList } from './utils';

// ---------------------------------------------------------------------------
// Fiber tags — React 18.x
// Source: https://github.com/facebook/react/blob/f1338f8080/packages/react-reconciler/src/ReactWorkTags.js
// ---------------------------------------------------------------------------
export const R18_FIBER_TAGS: FiberTagMap = {
  FunctionComponent: 0,
  ClassComponent: 1,
  IndeterminateComponent: 2,       // still present in r18; removed in r19
  HostRoot: 3,
  HostPortal: 4,
  HostComponent: 5,
  HostText: 6,
  Fragment: 7,
  Mode: 8,
  ContextConsumer: 9,
  ContextProvider: 10,
  ForwardRef: 11,
  Profiler: 12,
  SuspenseComponent: 13,
  MemoComponent: 14,
  SimpleMemoComponent: 15,
  LazyComponent: 16,
  IncompleteClassComponent: 17,
  DehydratedFragment: 18,
  SuspenseListComponent: 19,
  ScopeComponent: 21,
  OffscreenComponent: 22,          // shifted from 23 in r17
  LegacyHiddenComponent: 23,       // shifted from 24 in r17
  CacheComponent: 24,              // new in r18
  TracingMarkerComponent: 25,      // new in r18
  HostHoistable: null,             // not in r18
  HostSingleton: null,             // not in r18
  IncompleteFunctionComponent: null, // not in r18
  Throw: null,                     // not in r18
  ViewTransitionComponent: null,   // not in r18
  ActivityComponent: null,         // not in r18
};

// ---------------------------------------------------------------------------
// getDisplayName — r18 tag set
// ---------------------------------------------------------------------------
function getDisplayName(fiber: FiberNode): string | null {
  const { tag, type, elementType } = fiber;
  const T = R18_FIBER_TAGS;

  if (
    tag === T.FunctionComponent ||
    tag === T.IndeterminateComponent ||
    tag === T.ClassComponent ||
    tag === T.IncompleteClassComponent
  ) {
    return (type as any)?.displayName ?? (type as any)?.name ?? null;
  }
  if (tag === T.ForwardRef) {
    const inner = (type as any)?.render ?? type;
    const outer = elementType;
    return (
      (outer as any)?.displayName ??
      `ForwardRef(${(inner as any)?.displayName ?? (inner as any)?.name ?? 'Anonymous'})`
    );
  }
  if (tag === T.MemoComponent || tag === T.SimpleMemoComponent) {
    const inner = (type as any)?.type ?? type;
    return (
      (elementType as any)?.displayName ??
      (inner as any)?.displayName ??
      (inner as any)?.name ??
      null
    );
  }
  if (tag === T.HostRoot) {
    return fiber.stateNode?._debugRootType ?? null;
  }
  if (tag === T.HostComponent) return typeof type === 'string' ? type : null;
  if (tag === T.HostText) return null;
  if (tag === T.Fragment) return 'Fragment';
  if (tag === T.LazyComponent) return 'Lazy';
  if (tag === T.SuspenseComponent) return 'Suspense';
  if (tag === T.SuspenseListComponent) return 'SuspenseList';
  if (tag === T.Profiler) return 'Profiler';
  if (tag === T.OffscreenComponent) return 'Offscreen';
  if (tag === T.LegacyHiddenComponent) return 'LegacyHidden';
  if (tag === T.CacheComponent) return 'Cache';
  if (tag === T.TracingMarkerComponent) return 'TracingMarker';
  if (tag === T.Mode) return 'Mode';
  if (tag === T.ContextProvider) {
    const context = (type as any)?._context ?? type;
    return `${(context as any)?.displayName ?? 'Context'}.Provider`;
  }
  if (tag === T.ContextConsumer) {
    return `${(type as any)?.displayName ?? 'Context'}.Consumer`;
  }

  // Tags that CANNOT exist in r18 — hard error to surface misconfiguration
  if (tag === 26 || tag === 27 || tag === 28 || tag === 29 || tag === 30 || tag === 31) {
    throw new Error(
      `[react-adapters/r18] getDisplayName called with tag=${tag} which does not exist in React 18. ` +
        'Wrong adapter selected — check version detection.',
    );
  }

  return null;
}

// ---------------------------------------------------------------------------
// Adapter export
// ---------------------------------------------------------------------------
export const r18Adapter: ReactVersionAdapter = {
  FIBER_TAGS: R18_FIBER_TAGS,

  getFiberTag(fiber) {
    return fiber.tag;
  },

  getDisplayName,

  getHookValues(fiber) {
    return walkHookLinkedList(fiber.memoizedState);
  },

  walkFiber(fiber, visitor) {
    walkFiberImpl(fiber, visitor);
  },

  /**
   * r18: renderer.injectProfilingHooks IS present.
   * Source: https://github.com/facebook/react/blob/f1338f8080/packages/react-devtools-shared/src/backend/types.js
   *
   * IMPORTANT: Check ProfilingConflict before calling — react-scan occupies this
   * channel via hard replace and must not be overwritten.
   */
  injectProfilingHooks(renderer: ReactRenderer, hooks: DevToolsProfilingHooks): true | null {
    if (typeof renderer.injectProfilingHooks !== 'function') {
      // Guard: some r18 builds (e.g. react-dom/server) may not expose this
      return null;
    }
    renderer.injectProfilingHooks(hooks);
    return true;
  },

  supportsPerformanceTracks: false,
};
