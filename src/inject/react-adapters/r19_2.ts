/**
 * React 19.2+ adapter
 *
 * Tag source: https://github.com/facebook/react/blob/v19.2.0/packages/react-reconciler/src/ReactWorkTags.js
 *             SHA: 7180fba91b1943c77523b818f9b42053ab350aff
 * Current main (≈v19.3-dev): https://github.com/facebook/react/blob/05ca66ad9c/packages/react-reconciler/src/ReactWorkTags.js
 *
 * Key differences from r19.0/r19.1:
 *   - ViewTransitionComponent=30 added
 *   - ActivityComponent=31 added
 *   - supportsPerformanceTracks: TRUE
 *     PROFILING_FLAG_PERFORMANCE_TRACKS_SUPPORT=0b100 gated on gte('19.2.0')
 *     Source: https://github.com/facebook/react/blob/05ca66ad9c/packages/react-devtools-shared/src/backend/fiber/renderer.js#L486
 *   - renderer.scheduleRetry added
 *     Source: https://github.com/facebook/react/blob/05ca66ad9c/packages/react-devtools-shared/src/backend/types.js#L194
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
// Fiber tags — React 19.2+
// Source: https://github.com/facebook/react/blob/7180fba91b/packages/react-reconciler/src/ReactWorkTags.js
// ---------------------------------------------------------------------------
export const R19_2_FIBER_TAGS: FiberTagMap = {
  FunctionComponent: 0,
  ClassComponent: 1,
  IndeterminateComponent: null,    // removed in r19
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
  OffscreenComponent: 22,
  LegacyHiddenComponent: 23,
  CacheComponent: 24,
  TracingMarkerComponent: 25,
  HostHoistable: 26,
  HostSingleton: 27,
  IncompleteFunctionComponent: 28,
  Throw: 29,
  ViewTransitionComponent: 30,     // new in r19.2
  ActivityComponent: 31,           // new in r19.2
};

// ---------------------------------------------------------------------------
// getDisplayName — r19.2 tag set
// Source pattern: https://github.com/facebook/react/blob/05ca66ad9c/packages/react-devtools-shared/src/backend/fiber/shared/DevToolsFiberInternalReactConstants.js#L356
// ---------------------------------------------------------------------------
function getDisplayName(fiber: FiberNode): string | null {
  const { tag, type, elementType } = fiber;
  const T = R19_2_FIBER_TAGS;

  if (
    tag === T.FunctionComponent ||
    tag === T.ClassComponent ||
    tag === T.IncompleteClassComponent ||
    tag === T.IncompleteFunctionComponent
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
  if (tag === T.HostComponent || tag === T.HostHoistable || tag === T.HostSingleton) {
    return typeof type === 'string' ? type : null;
  }
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
  if (tag === T.Throw) return 'Throw';
  if (tag === T.ViewTransitionComponent) return 'ViewTransition';
  if (tag === T.ActivityComponent) return 'Activity';
  if (tag === T.Mode) return 'Mode';
  if (tag === T.ContextProvider) {
    const context = (type as any)?._context ?? type;
    return `${(context as any)?.displayName ?? 'Context'}.Provider`;
  }
  if (tag === T.ContextConsumer) {
    return `${(type as any)?.displayName ?? 'Context'}.Consumer`;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Adapter export
// ---------------------------------------------------------------------------
export const r19_2Adapter: ReactVersionAdapter = {
  FIBER_TAGS: R19_2_FIBER_TAGS,

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

  injectProfilingHooks(renderer: ReactRenderer, hooks: DevToolsProfilingHooks): true | null {
    if (typeof renderer.injectProfilingHooks !== 'function') {
      return null;
    }
    renderer.injectProfilingHooks(hooks);
    return true;
  },

  /**
   * TRUE for r19.2+ — DevTools sets PROFILING_FLAG_PERFORMANCE_TRACKS_SUPPORT (0b100)
   * enabling Performance API tracks-based profiling timeline.
   *
   * Detection: `(profilingFlags & PROFILING_FLAG_PERFORMANCE_TRACKS_SUPPORT) !== 0`
   * Or equivalently: semver gte(rendererVersion, '19.2.0')
   *
   * Source: https://github.com/facebook/react/blob/05ca66ad9c/packages/react-devtools-shared/src/backend/fiber/renderer.js#L486
   * Constant: https://github.com/facebook/react/blob/05ca66ad9c/packages/react-devtools-shared/src/constants.js#L36
   */
  supportsPerformanceTracks: true,
};
