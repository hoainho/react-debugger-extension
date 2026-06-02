/**
 * Detector registry type contracts.
 *
 * These interfaces define the contract between the inject-script registry
 * (`src/inject/registry.ts`) and all future detector modules. Every detector
 * shipped under the self-roadmap H2-2026 plan conforms to `Detector<TIssue>`.
 *
 * First detector through this interface: T7 reconciler-keys.
 * Canary extractions: T8 closure-leak, T9 scan-overlay.
 *
 * See `openspec/changes/self-roadmap-h2-2026/specs/detector-registry/spec.md`
 * for the WHEN/THEN scenarios this contract is designed to satisfy.
 */

/**
 * Stable string identifier for a detector. Used as the key in the registry's
 * active set and as the `detectorId` field on emitted issue payloads.
 */
export type DetectorId = string;

/**
 * Mirrors the MCP / Panel tab grouping for detector categorisation. Each
 * detector declares which UI tab its issues feed.
 */
export type MCPTabCategory =
  | 'performance'
  | 'memory'
  | 'cls'
  | 'side-effects'
  | 'redux'
  | 'ui-state';

/**
 * Lifecycle-scoped context handed to every detector at `init` time. The
 * registry constructs a fresh `DetectorContext` per registered detector so
 * each detector gets its own staging buffer, persistent store, and dedupe LRU.
 *
 * Mutations via `write` are staged for the duration of the current lifecycle
 * call and only commit if the call returns without throwing — see C6 in
 * the task harness for the transactionality contract.
 */
export interface DetectorContext {
  /**
   * Emit a sanitized payload upstream (typically to the panel / MCP). The
   * registry injects this from `createRegistry({ emit })`.
   */
  emit(payload: unknown): void;

  /**
   * Diagnostic logging hook. The registry injects this from
   * `createRegistry({ log })`. Detector code SHOULD NOT call `console.*`
   * directly — route through `ctx.log` so the host can mute / redirect.
   */
  log(...args: unknown[]): void;

  /**
   * Sanitize a single value before emission. Wired to the project's
   * existing `sanitizeValue` primitive (see `src/utils/sanitize.ts`).
   */
  sanitize: (value: unknown) => unknown;

  /**
   * High-resolution timing source, dependency-injected for testability.
   * Defaults to the host page's `window.performance` when the registry is
   * created without an override.
   */
  performance: { now(): number };

  /**
   * Bounded-LRU dedupe. Returns `true` on first sighting of `key`, `false`
   * on every subsequent sighting (until the key is evicted by LRU pressure).
   * Capacity is `dedupeCapDefault` from `createRegistry` options (default 1000).
   */
  dedupe(key: string): boolean;

  /**
   * Staged write. The value lands in a per-call staging buffer that commits
   * to the persistent store on lifecycle-call return, or is discarded on
   * throw. Reads via `read` only see persisted values — writes within the
   * same call are NOT visible to reads within the same call (intentional
   * foot-gun avoidance).
   */
  write<T>(key: string, value: T): void;

  /**
   * Read from the persistent store. Returns `undefined` for unknown keys
   * and for keys that were written-but-not-yet-committed within the same
   * lifecycle call.
   */
  read<T>(key: string): T | undefined;
}

/**
 * Detector contract. Every detector module exports an object (or factory
 * result) conforming to this interface and registers itself with the
 * registry at inject-script init time.
 *
 * Lifecycle order, per commit:
 *   1. `init(ctx)` — once, at `register()` time. Synchronous. Allocate
 *      observers, capture refs.
 *   2. `onCommit(fiberRoot, deadline)` — once per React commit, if defined.
 *      MUST respect the `deadline` (host-page `performance.now()` cutoff)
 *      and bail out before exceeding `budgetMs`.
 *   3. `onIdle(deadline)` — optional, runs in `requestIdleCallback` for
 *      deferred work. MUST respect `deadline.timeRemaining()`.
 *   4. `drain()` — pull and clear the detector's accumulated issues. Called
 *      from the panel's POLL_DATA cycle and the MCP `get_issues` tool.
 *      Pure (no side effects other than clearing the internal buffer).
 *   5. `teardown()` — release all hooks, timers, observers. After teardown
 *      the detector emits nothing and is re-registerable.
 *   6. `recover()` — optional. Called by the registry after a throw inside
 *      a lifecycle call, before the detector is marked
 *      `disabled-for-session`. Use to revert partial mutations.
 *
 * The `fiberRoot` parameter on `onCommit` is typed `unknown` because the
 * registry runs in the host-page world where React's internal types are
 * not available; detectors that need to walk fibers cast at their own
 * boundary.
 *
 * First detector through this interface: T7 reconciler-keys.
 * Canary extractions: T8 closure-leak, T9 scan-overlay.
 */
export interface Detector<TIssue = unknown> {
  /** Stable identifier (e.g. `'reconciler-keys'`). Unique within a registry. */
  readonly id: DetectorId;

  /** UI tab grouping for the detector's emitted issues. */
  readonly category: MCPTabCategory;

  /**
   * Per-commit time budget in milliseconds. The registry computes the
   * deadline as `performance.now() + budgetMs` and passes it to `onCommit`.
   */
  readonly budgetMs: number;

  /**
   * Self-declared signal confidence. Surfaced via `registry.list()` for the
   * Settings UI and the CI bench harness.
   */
  readonly confidence: 'high' | 'medium' | 'low';

  /**
   * Whether the detector is safe to run in production builds. Detectors
   * that depend on React DEV-only internals MUST declare `false`.
   */
  readonly prodCapable: boolean;

  /**
   * One-time initialisation. Called synchronously by `registry.register()`.
   * The `ctx` reference is stable for the lifetime of the registration.
   */
  init(ctx: DetectorContext): void;

  /**
   * Per-commit hook. `fiberRoot` is the React internal root (typed
   * `unknown` because React types are not in scope here). `deadline` is the
   * `performance.now()` cutoff the detector should respect.
   */
  onCommit?(fiberRoot: unknown, deadline: number): void;

  /**
   * Idle-time hook. Use for non-critical deferred work that should yield
   * to user input.
   */
  onIdle?(deadline: IdleDeadline): void;

  /** Drain accumulated issues and clear the internal buffer. */
  drain(): TIssue[];

  /** Release all resources. Idempotent. */
  teardown(): void;

  /**
   * Optional partial-mutation recovery. Called by the registry between a
   * thrown lifecycle call and `disabled-for-session` marking.
   */
  recover?(): void;
}
