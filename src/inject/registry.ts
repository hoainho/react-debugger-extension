import type {
  Detector,
  DetectorContext,
  DetectorId,
  MCPTabCategory,
} from '../types/registry';

export type { Detector, DetectorContext, DetectorId, MCPTabCategory };

/**
 * Options accepted by `createRegistry`. `emit` / `log` / `sanitize` are wired
 * into every `DetectorContext` constructed on `register()`. The factory MUST
 * NOT reach back into `src/inject/index.ts` — all host wiring flows through
 * these injected callables (T2 will assemble them on the inject side).
 */
export interface CreateRegistryOptions {
  emit: (payload: unknown) => void;
  log: (...args: unknown[]) => void;
  sanitize: (v: unknown) => unknown;
  performance?: { now(): number };
  dedupeCapDefault?: number;
}

/**
 * Summary entry returned by `registry.list()`. Surfaces enough metadata for
 * the Settings UI and CI bench harness without exposing detector internals.
 */
export interface RegistryListEntry {
  id: DetectorId;
  category: MCPTabCategory;
  confidence: 'high' | 'medium' | 'low';
  enabled: boolean;
  disabledReason?: string;
}

/**
 * Result entry from `registry.drainAll()`. One element per active detector
 * (regardless of whether it produced issues this cycle).
 */
export interface DrainAllEntry {
  detectorId: DetectorId;
  issues: unknown[];
}

/**
 * Public shape of the registry returned by `createRegistry`. T2 will wire
 * a singleton of this into the inject script.
 */
export interface Registry {
  register(detector: Detector): void;
  unregister(id: DetectorId): void;
  enable(id: DetectorId): void;
  disable(id: DetectorId): void;
  list(): RegistryListEntry[];
  dispatch(commit: { fiberRoot: unknown }): void;
  drainAll(): DrainAllEntry[];
}

const DEFAULT_DEDUPE_CAP = 1000;

/**
 * Bounded LRU. Insertion-ordered `Map` is the LRU: on every `has` / `add`
 * we delete-then-reinsert the key so it moves to the most-recent slot, and
 * when capacity is exceeded we evict the iterator's first (oldest) entry.
 *
 * Five-line trick rather than a dependency; we use no values, only key
 * recency, so a `Set` would do — `Map` is used because its `keys()`
 * iterator is well-specified to be insertion-ordered.
 */
class DedupeLRU {
  private readonly capacity: number;
  private readonly seen = new Map<string, true>();

  constructor(capacity: number) {
    this.capacity = capacity > 0 ? capacity : DEFAULT_DEDUPE_CAP;
  }

  /**
   * Returns `true` the first time `key` is offered, `false` thereafter.
   * Every call (hit or miss) bumps the key to most-recent.
   */
  offer(key: string): boolean {
    if (this.seen.has(key)) {
      this.seen.delete(key);
      this.seen.set(key, true);
      return false;
    }
    this.seen.set(key, true);
    if (this.seen.size > this.capacity) {
      const oldest = this.seen.keys().next().value as string | undefined;
      if (oldest !== undefined) this.seen.delete(oldest);
    }
    return true;
  }

  clear(): void {
    this.seen.clear();
  }
}

/**
 * Per-detector state held by the registry. `persistentStore`, `stagingBuffer`,
 * and `dedupe` are captured by the matching `ctx` closure built in
 * `makeEntry` — they are exposed on the entry only so the lifecycle helpers
 * (`commitStaging`, `discardStaging`, `unregister`) can act on them directly.
 */
interface DetectorEntry {
  detector: Detector;
  ctx: DetectorContext;
  persistentStore: Map<string, unknown>;
  stagingBuffer: Map<string, unknown>;
  dedupe: DedupeLRU;
  enabled: boolean;
  disabledReason?: string;
}

/**
 * Create a detector registry.
 *
 * The registry is the inject-script's coordinator for detector lifecycle,
 * per-detector error isolation, staged writes, and bounded dedupe. T2 wires
 * the singleton into `src/inject/index.ts`; this factory is intentionally
 * decoupled so the contract can be unit-tested in isolation.
 *
 * Example wiring (T2 will own this in `src/inject/index.ts`):
 * ```ts
 * const registry = createRegistry({
 *   emit: (payload) => window.postMessage({ source: 'react-debugger', payload }, '*'),
 *   log: (...args) => console.debug('[react-debugger]', ...args),
 *   sanitize: sanitizeValue,
 *   performance: window.performance,
 * });
 * registry.register(reconcilerKeysDetector);
 * // ...later, inside onCommitFiberRoot:
 * registry.dispatch({ fiberRoot });
 * // ...and inside POLL_DATA:
 * const all = registry.drainAll();
 * ```
 */
export function createRegistry(options: CreateRegistryOptions): Registry {
  const perf: { now(): number } =
    options.performance ?? { now: () => Date.now() };
  const dedupeCapDefault = options.dedupeCapDefault ?? DEFAULT_DEDUPE_CAP;
  const entries = new Map<DetectorId, DetectorEntry>();

  function makeEntry(detector: Detector): DetectorEntry {
    const persistentStore = new Map<string, unknown>();
    const stagingBuffer = new Map<string, unknown>();
    const dedupe = new DedupeLRU(dedupeCapDefault);

    const ctx: DetectorContext = {
      emit: (payload) => options.emit(payload),
      log: (...args) => options.log(...args),
      sanitize: (v) => options.sanitize(v),
      performance: perf,
      dedupe: (key) => dedupe.offer(key),
      write: <T>(key: string, value: T) => {
        stagingBuffer.set(key, value);
      },
      read: <T>(key: string): T | undefined => {
        if (persistentStore.has(key)) {
          return persistentStore.get(key) as T;
        }
        return undefined;
      },
    };

    return {
      detector,
      ctx,
      persistentStore,
      stagingBuffer,
      dedupe,
      enabled: true,
    };
  }

  function commitStaging(entry: DetectorEntry): void {
    if (entry.stagingBuffer.size === 0) return;
    for (const [k, v] of entry.stagingBuffer) {
      entry.persistentStore.set(k, v);
    }
    entry.stagingBuffer.clear();
  }

  function discardStaging(entry: DetectorEntry): void {
    entry.stagingBuffer.clear();
  }

  function runLifecycle(
    entry: DetectorEntry,
    phase: 'onCommit' | 'onIdle' | 'drain',
    invoke: () => void,
  ): boolean {
    try {
      invoke();
      commitStaging(entry);
      return true;
    } catch (err) {
      discardStaging(entry);
      const errorMessage = err instanceof Error ? err.message : String(err);
      try {
        entry.detector.recover?.();
      } catch (recoverErr) {
        // recover() must never break isolation, but DO surface the failure
        // through the injected log so operators can diagnose it.
        try {
          options.log(
            '[registry] recover() threw for',
            entry.detector.id,
            recoverErr,
          );
        } catch {
          // log throwing is exceedingly unlikely; preserve disable-marking.
        }
      }
      entry.enabled = false;
      entry.disabledReason = errorMessage;
      try {
        options.emit({
          type: 'DETECTOR_DISABLED',
          detectorId: entry.detector.id,
          error: errorMessage,
          phase,
        });
      } catch {
        // emit failure must not propagate.
      }
      return false;
    }
  }

  return {
    register(detector: Detector): void {
      if (entries.has(detector.id)) {
        throw new Error(
          `Detector with id '${detector.id}' is already registered`,
        );
      }
      const entry = makeEntry(detector);
      entries.set(detector.id, entry);
      detector.init(entry.ctx);
    },

    unregister(id: DetectorId): void {
      const entry = entries.get(id);
      if (!entry) return;
      try {
        entry.detector.teardown();
      } catch {
        // teardown errors are swallowed: caller has already decided to drop.
      }
      entry.dedupe.clear();
      entries.delete(id);
    },

    enable(id: DetectorId): void {
      const entry = entries.get(id);
      if (!entry) return;
      entry.enabled = true;
      entry.disabledReason = undefined;
    },

    disable(id: DetectorId): void {
      const entry = entries.get(id);
      if (!entry) return;
      entry.enabled = false;
      if (entry.disabledReason === undefined) {
        entry.disabledReason = 'manually disabled';
      }
    },

    list(): RegistryListEntry[] {
      const out: RegistryListEntry[] = [];
      for (const entry of entries.values()) {
        const listed: RegistryListEntry = {
          id: entry.detector.id,
          category: entry.detector.category,
          confidence: entry.detector.confidence,
          enabled: entry.enabled,
        };
        if (entry.disabledReason !== undefined) {
          listed.disabledReason = entry.disabledReason;
        }
        out.push(listed);
      }
      return out;
    },

    dispatch(commit: { fiberRoot: unknown }): void {
      for (const entry of entries.values()) {
        if (!entry.enabled) continue;
        if (!entry.detector.onCommit) continue;
        const deadline = perf.now() + entry.detector.budgetMs;
        runLifecycle(entry, 'onCommit', () => {
          entry.detector.onCommit!(commit.fiberRoot, deadline);
        });
      }
    },

    drainAll(): DrainAllEntry[] {
      const out: DrainAllEntry[] = [];
      for (const entry of entries.values()) {
        if (!entry.enabled) {
          out.push({ detectorId: entry.detector.id, issues: [] });
          continue;
        }
        let issues: unknown[] = [];
        runLifecycle(entry, 'drain', () => {
          issues = entry.detector.drain() as unknown[];
        });
        out.push({ detectorId: entry.detector.id, issues });
      }
      return out;
    },
  };
}
