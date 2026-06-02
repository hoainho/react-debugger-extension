/**
 * React Version Adapter types
 *
 * Authoritative sources:
 * - ReactWorkTags: https://github.com/facebook/react/blob/05ca66ad9c/packages/react-reconciler/src/ReactWorkTags.js
 * - DevToolsHook type: https://github.com/facebook/react/blob/05ca66ad9c/packages/react-devtools-shared/src/backend/types.js#L250
 * - DevToolsProfilingHooks: https://github.com/facebook/react/blob/05ca66ad9c/packages/react-devtools-shared/src/backend/types.js#L55
 * - PROFILING_FLAG_*: https://github.com/facebook/react/blob/05ca66ad9c/packages/react-devtools-shared/src/constants.js#L34
 */

// ---------------------------------------------------------------------------
// Fiber tag maps — one per React minor range
// Numbers are STABLE within each range but SHIFT across ranges (see table below).
//
// CRITICAL collision:
//   OffscreenComponent: r17=23, r18+=22
//   LegacyHiddenComponent: r17=24, r18+=23
//   IndeterminateComponent: r17/r18=2, r19+=REMOVED
// ---------------------------------------------------------------------------

/** Fiber tags valid for React 17.x */
export interface FiberTagMap {
  FunctionComponent: number;
  ClassComponent: number;
  IndeterminateComponent: number | null; // null = removed in this version
  HostRoot: number;
  HostPortal: number;
  HostComponent: number;
  HostText: number;
  Fragment: number;
  Mode: number;
  ContextConsumer: number;
  ContextProvider: number;
  ForwardRef: number;
  Profiler: number;
  SuspenseComponent: number;
  MemoComponent: number;
  SimpleMemoComponent: number;
  LazyComponent: number;
  IncompleteClassComponent: number;
  DehydratedFragment: number;
  SuspenseListComponent: number;
  ScopeComponent: number;
  OffscreenComponent: number;
  LegacyHiddenComponent: number;
  CacheComponent: number | null;
  TracingMarkerComponent: number | null;
  HostHoistable: number | null;     // r19.0+
  HostSingleton: number | null;     // r19.0+
  IncompleteFunctionComponent: number | null; // r19.0+
  Throw: number | null;             // r19.0+
  ViewTransitionComponent: number | null; // r19.2+
  ActivityComponent: number | null;       // r19.2+
}

// ---------------------------------------------------------------------------
// Minimal fiber shape — only fields we read; stable across r17–r19.2
// Source: https://github.com/facebook/react/blob/05ca66ad9c/packages/react-reconciler/src/ReactFiberHooks.js#L194
// ---------------------------------------------------------------------------

export interface FiberNode {
  tag: number;
  key: string | null;
  type: any;
  elementType: any;
  stateNode: any;
  return: FiberNode | null;
  child: FiberNode | null;
  sibling: FiberNode | null;
  alternate: FiberNode | null;
  memoizedState: any;
  memoizedProps: any;
  pendingProps: any;
  flags: number;
  /** @deprecated pre-r17 alias for flags */
  effectTag?: number;
  actualDuration?: number;
  selfBaseDuration?: number;
  treeBaseDuration?: number;
  updateQueue: any;
}

/** Stable Hook struct shape across r17–r19.2
 * Source: https://github.com/facebook/react/blob/v17.0.2/packages/react-reconciler/src/ReactFiberHooks.old.js
 *         https://github.com/facebook/react/blob/05ca66ad9c/packages/react-reconciler/src/ReactFiberHooks.js#L194
 */
export interface FiberHook {
  memoizedState: any;
  baseState: any;
  baseQueue: any | null;
  queue: any | null;
  next: FiberHook | null;
}

export interface FiberRoot {
  current: FiberNode;
}

// ---------------------------------------------------------------------------
// ReactRenderer — the object React passes to hook.inject(renderer)
// Source: https://github.com/facebook/react/blob/05ca66ad9c/packages/react-devtools-shared/src/backend/types.js#L131
// ---------------------------------------------------------------------------
export interface ReactRenderer {
  version: string;
  reconcilerVersion?: string;
  /** present in r18+ */
  injectProfilingHooks?: (hooks: DevToolsProfilingHooks) => void;
  /** present in r18+ */
  getLaneLabelMap?: () => Map<number, string> | null;
  /** present in r19.2+ */
  scheduleRetry?: (fiber: object) => void;
}

// ---------------------------------------------------------------------------
// DevToolsProfilingHooks — the object passed to renderer.injectProfilingHooks()
// Source: https://github.com/facebook/react/blob/05ca66ad9c/packages/react-devtools-shared/src/backend/types.js#L55
// ---------------------------------------------------------------------------
export interface DevToolsProfilingHooks {
  markComponentRenderStarted: (fiber: FiberNode) => void;
  markComponentRenderStopped: () => void;
  markComponentPassiveEffectMountStarted: (fiber: FiberNode) => void;
  markComponentPassiveEffectMountStopped: () => void;
  markComponentPassiveEffectUnmountStarted: (fiber: FiberNode) => void;
  markComponentPassiveEffectUnmountStopped: () => void;
  markComponentLayoutEffectMountStarted: (fiber: FiberNode) => void;
  markComponentLayoutEffectMountStopped: () => void;
  markComponentLayoutEffectUnmountStarted: (fiber: FiberNode) => void;
  markComponentLayoutEffectUnmountStopped: () => void;
  markRenderStarted: (lanes: number) => void;
  markRenderYielded: () => void;
  markRenderStopped: () => void;
  markCommitStarted: (lanes: number) => void;
  markCommitStopped: () => void;
  markLayoutEffectsStarted: (lanes: number) => void;
  markLayoutEffectsStopped: () => void;
  markPassiveEffectsStarted: (lanes: number) => void;
  markPassiveEffectsStopped: () => void;
}

// ---------------------------------------------------------------------------
// PROFILING_FLAG_* bitmask constants
// Source: https://github.com/facebook/react/blob/05ca66ad9c/packages/react-devtools-shared/src/constants.js#L34
// ---------------------------------------------------------------------------
export const PROFILING_FLAG_BASIC_SUPPORT = 0b001;
export const PROFILING_FLAG_TIMELINE_SUPPORT = 0b010;
/** Only set when React version >= 19.2.0 */
export const PROFILING_FLAG_PERFORMANCE_TRACKS_SUPPORT = 0b100;

// ---------------------------------------------------------------------------
// Conflict detection signals
// ---------------------------------------------------------------------------
export interface ProfilingConflict {
  /** window.__REACT_SCAN__.ReactScanInternals is present
   * → react-scan has called renderer.injectProfilingHooks() — hard replace, do NOT re-inject
   * Source: https://github.com/aidenybai/react-scan/blob/main/packages/scan/src/types.ts
   */
  reactScan: boolean;
  /** 'getFiberRoots' in window.__REACT_DEVTOOLS_GLOBAL_HOOK__
   * → Real React DevTools profiler is attached (not just Fast Refresh stub)
   * Source: https://github.com/aidenybai/bippy/blob/main/packages/bippy/src/rdt-hook.ts
   */
  reactDevTools: boolean;
}

// ---------------------------------------------------------------------------
// Adapter interface — one implementation per React version range
// ---------------------------------------------------------------------------
export interface ReactVersionAdapter {
  /** Fiber tag numeric map for this version range */
  readonly FIBER_TAGS: FiberTagMap;

  /**
   * Returns fiber.tag (pass-through; adapter provides the correct FIBER_TAGS map).
   * Stable: fiber.tag has been a numeric field since React 16.
   */
  getFiberTag(fiber: FiberNode): number;

  /**
   * Returns display name for the fiber, or null for host/unknown fibers.
   * Algorithm stable since r16; tag cases differ per version.
   *
   * - Uses `throw new Error('not implemented')` only for fibers that CANNOT
   *   exist in this version range.
   * - Returns null for all other unrecognised tags (graceful degradation).
   */
  getDisplayName(fiber: FiberNode): string | null;

  /**
   * Returns the linked list of Hook structs for a function component fiber.
   * Hook struct shape (memoizedState/baseState/baseQueue/queue/next) is STABLE
   * across r17–r19.2.
   * Returns [] for class components and non-component fibers.
   *
   * NOTE: Never throws — degrade gracefully with empty array on unexpected input.
   */
  getHookValues(fiber: FiberNode): FiberHook[];

  /**
   * Depth-first fiber tree walk. Calls visitor for each fiber encountered.
   * fiber.child / fiber.sibling / fiber.return are STABLE across all versions.
   *
   * NOTE: Never throws — skip unreachable fibers silently.
   */
  walkFiber(fiber: FiberNode, visitor: (fiber: FiberNode) => void): void;

  /**
   * Calls renderer.injectProfilingHooks(hooks) on the given renderer object.
   * Returns true if successfully injected, null if not supported in this version.
   *
   * r17: always returns null (method doesn't exist on renderer).
   * r18+: calls renderer.injectProfilingHooks if present.
   *
   * IMPORTANT: Check ProfilingConflict BEFORE calling — if reactScan is active,
   * the channel is already occupied and re-injection will clobber react-scan.
   */
  injectProfilingHooks(
    renderer: ReactRenderer,
    hooks: DevToolsProfilingHooks,
  ): true | null;

  /**
   * Whether this React version supports Performance Timeline tracks for profiling.
   * True only for r19.2+.
   * Source: https://github.com/facebook/react/blob/05ca66ad9c/packages/react-devtools-shared/src/backend/fiber/renderer.js#L486
   */
  readonly supportsPerformanceTracks: boolean;
}
