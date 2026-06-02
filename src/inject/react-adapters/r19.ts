/**
 * React 19.0 / 19.1 adapter
 *
 * Tag source: https://github.com/facebook/react/blob/v19.0.0/packages/react-reconciler/src/ReactWorkTags.js
 *             SHA: 7aa5dda3b3e4c2baa905a59b922ae7ec14734b24
 *
 * Key differences from r18:
 *   - IndeterminateComponent (2) REMOVED — any tag===2 now means nothing
 *   - HostHoistable=26 added      (new element category for hoistable <link>/<meta>/<title>)
 *   - HostSingleton=27 added      (new element category for <html>/<head>/<body>)
 *   - IncompleteFunctionComponent=28 added
 *   - Throw=29 added
 *   - hook.supportsFlight: NOW PRESENT
 *   - hook.backends: Map<string, DevToolsBackend> added
 *   - ReactFiberDevToolsHook.js: injectProfilingHooks now exported from reconciler side
 *
 * Key differences from r19.2:
 *   - ViewTransitionComponent (30), ActivityComponent (31): absent
 *   - supportsPerformanceTracks: false
 *     (PROFILING_FLAG_PERFORMANCE_TRACKS_SUPPORT gated on gte('19.2.0'))
 *     Source: https://github.com/facebook/react/blob/05ca66ad9c/packages/react-devtools-shared/src/backend/fiber/renderer.js#L486
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
// Fiber tags — React 19.0.x / 19.1.x
// Source: https://github.com/facebook/react/blob/7aa5dda3b3/packages/react-reconciler/src/ReactWorkTags.js
// ---------------------------------------------------------------------------
export const R19_FIBER_TAGS: FiberTagMap = {
  FunctionComponent: 0,
  ClassComponent: 1,
  IndeterminateComponent: null,    // REMOVED in r19 (was 2)
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
  HostHoistable: 26,               // new in r19.0
  HostSingleton: 27,               // new in r19.0
  IncompleteFunctionComponent: 28, // new in r19.0
  Throw: 29,                       // new in r19.0
  ViewTransitionComponent: null,   // not in r19.0/r19.1
  ActivityComponent: null,         // not in r19.0/r19.1
};

// ---------------------------------------------------------------------------
// getDisplayName — r19 tag set
// Source pattern: https://github.com/facebook/react/blob/05ca66ad9c/packages/react-devtools-shared/src/backend/fiber/shared/DevToolsFiberInternalReactConstants.js#L356
// ---------------------------------------------------------------------------
function getDisplayName(fiber: FiberNode): string | null {
  const { tag, type, elementType } = fiber;
  const T = R19_FIBER_TAGS;

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
  // HostHoistable and HostSingleton: type is a string tag name
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
  if (tag === T.Mode) return 'Mode';
  if (tag === T.ContextProvider) {
    const context = (type as any)?._context ?? type;
    return `${(context as any)?.displayName ?? 'Context'}.Provider`;
  }
  if (tag === T.ContextConsumer) {
    return `${(type as any)?.displayName ?? 'Context'}.Consumer`;
  }

  // Tags that CANNOT exist in r19.0/r19.1 — hard error to surface misconfiguration
  if (tag === 30 || tag === 31) {
    throw new Error(
      `[react-adapters/r19] getDisplayName called with tag=${tag} (ViewTransition/Activity) ` +
        'which only exists in React 19.2+. Wrong adapter selected — check version detection.',
    );
  }

  return null;
}

// ---------------------------------------------------------------------------
// Adapter export
// ---------------------------------------------------------------------------
export const r19Adapter: ReactVersionAdapter = {
  FIBER_TAGS: R19_FIBER_TAGS,

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
   * r19.0: renderer.injectProfilingHooks is present.
   * Additionally, ReactFiberDevToolsHook.js now exports injectProfilingHooks
   * on the reconciler side (new in r19.0 vs r18 where it was renderer-side only).
   * Source: https://github.com/facebook/react/blob/7aa5dda3b3/packages/react-reconciler/src/ReactFiberDevToolsHook.js
   */
  injectProfilingHooks(renderer: ReactRenderer, hooks: DevToolsProfilingHooks): true | null {
    if (typeof renderer.injectProfilingHooks !== 'function') {
      return null;
    }
    renderer.injectProfilingHooks(hooks);
    return true;
  },

  /**
   * false for 19.0/19.1 — PROFILING_FLAG_PERFORMANCE_TRACKS_SUPPORT is only set
   * when gte(version, '19.2.0').
   * Source: https://github.com/facebook/react/blob/05ca66ad9c/packages/react-devtools-shared/src/backend/fiber/renderer.js#L486
   */
  supportsPerformanceTracks: false,
};
