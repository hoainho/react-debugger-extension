/**
 * context-cascade detector (M-D.3, hero #3).
 *
 * Flags a `Context.Provider` whose `value` prop is a FRESH reference on every
 * commit AND that has >= 2 consumers — the classic "new object literal in the
 * Provider value" mistake that re-renders every consumer each commit. Emits
 * `CONTEXT_CASCADE` with a `useMemo` suggestion.
 *
 * Cross-commit value-reference identity is tracked via `ctx.write`/`ctx.read`
 * (the registry store persists the actual reference, so `prev === current`
 * detects "same object reused" vs "new object each render"). Uses the existing
 * `walkFiberImpl` (decoupled from the R2 unified traversal).
 *
 * The emit decision and consumer counting are pure/exported for unit testing.
 */
import type { Detector, DetectorContext } from '../../types/registry';
import type { Issue } from '../../types';
import type { FiberNode, ReactVersionAdapter, FiberRoot } from '../react-adapters/types';
import { walkFiberImpl } from '../react-adapters/utils';
import { getAdapter } from '../react-adapters';

const STORE_PREFIX = 'ctxval:';

/** The Context object a Provider fiber provides (`type._context`), if any. */
export function providerContext(fiber: FiberNode): unknown {
  return (fiber.type as { _context?: unknown } | null)?._context ?? null;
}

/**
 * Count fibers in `providerFiber`'s subtree that consume `contextObj` — either
 * `ContextConsumer`-tag fibers of that context, or hook consumers whose
 * `dependencies.firstContext` chain references it.
 */
export function countContextConsumers(
  providerFiber: FiberNode,
  contextObj: unknown,
  consumerTag: number,
): number {
  let count = 0;
  walkFiberImpl(providerFiber, (fiber) => {
    if (fiber === providerFiber) return;
    if (fiber.tag === consumerTag && providerContext(fiber) === contextObj) {
      count++;
      return;
    }
    let dep = (fiber as { dependencies?: { firstContext?: unknown } }).dependencies?.firstContext as
      | { context?: unknown; next?: unknown }
      | undefined
      | null;
    let guard = 50;
    while (dep && guard-- > 0) {
      if (dep.context === contextObj) {
        count++;
        break;
      }
      dep = dep.next as typeof dep;
    }
  });
  return count;
}

/** Emit iff a prior value existed, the reference changed, and >=2 consumers. */
export function shouldFlagCascade(
  prevRef: unknown,
  currentRef: unknown,
  consumerCount: number,
): boolean {
  if (prevRef === undefined) return false; // first sighting — can't compare yet
  return prevRef !== currentRef && consumerCount >= 2;
}

export function createContextCascadeDetector(): Detector<Issue> {
  let ctx: DetectorContext | null = null;
  let adapter: ReactVersionAdapter | null = null;
  let buffer: Issue[] = [];
  let seq = 0;

  function buildPath(fiber: FiberNode, ad: ReactVersionAdapter): string[] {
    const path: string[] = [];
    let cur: FiberNode | null = fiber;
    let limit = 50;
    while (cur && limit-- > 0) {
      const name = ad.getDisplayName(cur);
      if (name) path.unshift(name);
      cur = cur.return;
    }
    return path;
  }

  return {
    id: 'context-cascade',
    category: 'ui-state',
    budgetMs: 0.3,
    confidence: 'high',
    prodCapable: true,

    init(injected: DetectorContext): void {
      ctx = injected;
      try {
        adapter = getAdapter();
      } catch {
        adapter = null;
      }
    },

    onCommit(fiberRoot: unknown, deadline: number): void {
      const context = ctx;
      const ad = adapter;
      if (context === null || ad === null) return;
      const root = fiberRoot as FiberRoot | null;
      if (!root || !root.current) return;
      const providerTag = ad.FIBER_TAGS.ContextProvider;
      const consumerTag = ad.FIBER_TAGS.ContextConsumer;

      walkFiberImpl(root.current, (fiber) => {
        if (context.performance.now() > deadline) return;
        if (fiber.tag !== providerTag) return;

        const contextObj = providerContext(fiber);
        const path = buildPath(fiber, ad);
        const name = ad.getDisplayName(fiber) ?? 'Context.Provider';
        const key = STORE_PREFIX + (path.length ? path.join('/') : name);
        const currentRef = (fiber.memoizedProps as { value?: unknown } | null)?.value;
        const prevRef = context.read<unknown>(key);
        context.write<unknown>(key, currentRef);

        if (!shouldFlagCascade(prevRef, currentRef, countContextConsumers(fiber, contextObj, consumerTag))) {
          return;
        }
        if (!context.dedupe(key)) return;
        buffer.push({
          id: `context-cascade-${seq++}`,
          type: 'CONTEXT_CASCADE',
          severity: 'warning',
          component: name,
          message: 'Context Provider value is a new reference every commit — all consumers re-render',
          suggestion: 'Wrap the Provider value in useMemo (or split the context) so its reference is stable.',
          timestamp: Date.now(),
          fiberId: key,
          location: { componentName: name, componentPath: path },
        });
      });
    },

    drain(): Issue[] {
      const out = buffer;
      buffer = [];
      return out;
    },

    teardown(): void {
      buffer = [];
      seq = 0;
      ctx = null;
      adapter = null;
    },
  };
}

export const contextCascadeDetector = createContextCascadeDetector();
