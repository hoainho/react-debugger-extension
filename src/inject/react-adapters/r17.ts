/**
 * React 17.x adapter
 *
 * Tag source: https://github.com/facebook/react/blob/v17.0.2/packages/react-reconciler/src/ReactWorkTags.js
 * Hook type:  https://github.com/facebook/react/blob/v17.0.2/packages/react-reconciler/src/ReactFiberHooks.old.js
 *
 * Key differences from r18+:
 *   - Block=22, OffscreenComponent=23, LegacyHiddenComponent=24 (all shifted in r18)
 *   - FundamentalComponent=20 (removed in r18)
 *   - IndeterminateComponent=2 (removed in r19)
 *   - renderer.injectProfilingHooks: absent → injectProfilingHooks() returns null
 *   - hook.onPostCommitFiberRoot: absent
 *   - hook.setStrictMode: absent
 *   - hook.supportsFlight: absent
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
// Fiber tags — React 17.x
// Source: https://github.com/facebook/react/blob/12adaffef7/packages/react-reconciler/src/ReactWorkTags.js
// ---------------------------------------------------------------------------
export const R17_FIBER_TAGS: FiberTagMap = {
  FunctionComponent: 0,
  ClassComponent: 1,
  IndeterminateComponent: 2,       // removed in r19
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
  // FundamentalComponent: 20 — removed in r18, not in FiberTagMap interface
  ScopeComponent: 21,
  OffscreenComponent: 23,          // NOTE: 22=Block in r17; Offscreen is 23
  LegacyHiddenComponent: 24,       // NOTE: shifts to 23 in r18
  CacheComponent: null,            // not in r17
  TracingMarkerComponent: null,    // not in r17
  HostHoistable: null,             // not in r17
  HostSingleton: null,             // not in r17
  IncompleteFunctionComponent: null, // not in r17
  Throw: null,                     // not in r17
  ViewTransitionComponent: null,   // not in r17
  ActivityComponent: null,         // not in r17
};

// ---------------------------------------------------------------------------
// getDisplayName — r17 tag set
// ---------------------------------------------------------------------------
function getDisplayName(fiber: FiberNode): string | null {
  const { tag, type, elementType } = fiber;
  const T = R17_FIBER_TAGS;

  if (tag === T.FunctionComponent || tag === T.IndeterminateComponent) {
    return (type as any)?.displayName ?? (type as any)?.name ?? null;
  }
  if (tag === T.ClassComponent || tag === T.IncompleteClassComponent) {
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
    const debugRootType = fiber.stateNode?._debugRootType;
    return debugRootType ?? null;
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
  if (tag === T.Mode) return 'Mode';
  if (tag === T.ContextProvider) {
    const context = (type as any)?._context ?? type;
    return `${(context as any)?.displayName ?? 'Context'}.Provider`;
  }
  if (tag === T.ContextConsumer) {
    return `${(type as any)?.displayName ?? 'Context'}.Consumer`;
  }

  // Tags that CANNOT exist in r17 — hard error to surface misconfiguration
  if (tag === 26 || tag === 27 || tag === 28 || tag === 29 || tag === 30 || tag === 31) {
    throw new Error(
      `[react-adapters/r17] getDisplayName called with tag=${tag} which does not exist in React 17. ` +
        'Wrong adapter selected — check version detection.',
    );
  }

  return null;
}

// ---------------------------------------------------------------------------
// Adapter export
// ---------------------------------------------------------------------------
export const r17Adapter: ReactVersionAdapter = {
  FIBER_TAGS: R17_FIBER_TAGS,

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
   * r17: renderer.injectProfilingHooks does NOT exist.
   * Returns null (graceful degradation — caller should skip profiling hooks setup).
   * Source: https://github.com/facebook/react/blob/12adaffef7/packages/react-devtools-shared/src/backend/types.js
   * (method is absent from ReactRenderer type at v17.0.2)
   */
  injectProfilingHooks(_renderer: ReactRenderer, _hooks: DevToolsProfilingHooks): null {
    return null;
  },

  supportsPerformanceTracks: false,
};
