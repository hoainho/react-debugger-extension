/**
 * inline-handler-cost detector (M-F.1 quick-win).
 *
 * A `React.memo` child re-renders anyway when a parent passes it an inline
 * function prop (new identity every render), defeating the memo. This tracks
 * each memo'd fiber's FUNCTION prop identities across commits and flags
 * INLINE_HANDLER_COST when a function prop's reference changes commit-to-commit
 * (the memo is being bypassed). Fiber-based identity tracking (like
 * context-cascade) — reliable, not a source-regex heuristic.
 */
import type { Detector, DetectorContext } from '../../types/registry';
import type { Issue } from '../../types';
import type { FiberNode, ReactVersionAdapter, FiberRoot } from '../react-adapters/types';
import { walkFiberImpl } from '../react-adapters/utils';
import { getAdapter } from '../react-adapters';

const STORE_PREFIX = 'inline-handler:';

/** Names of function-valued props whose identity changed from prev → curr. */
export function changedFunctionProps(
  prev: Record<string, unknown> | undefined,
  curr: Record<string, unknown> | null | undefined,
): string[] {
  if (!prev || !curr) return [];
  const changed: string[] = [];
  for (const [k, v] of Object.entries(curr)) {
    if (typeof v === 'function' && typeof prev[k] === 'function' && prev[k] !== v) {
      changed.push(k);
    }
  }
  return changed;
}

export function createInlineHandlerCostDetector(): Detector<Issue> {
  let ctx: DetectorContext | null = null;
  let adapter: ReactVersionAdapter | null = null;
  let buffer: Issue[] = [];
  let seq = 0;

  function isMemo(fiber: FiberNode, ad: ReactVersionAdapter): boolean {
    const t = ad.FIBER_TAGS;
    return fiber.tag === t.MemoComponent || fiber.tag === t.SimpleMemoComponent;
  }

  function pathKey(fiber: FiberNode, ad: ReactVersionAdapter): string {
    const path: string[] = [];
    let cur: FiberNode | null = fiber;
    let limit = 50;
    while (cur && limit-- > 0) {
      const name = ad.getDisplayName(cur);
      if (name) path.unshift(name);
      cur = cur.return;
    }
    return path.join('/') || `memo-${seq}`;
  }

  return {
    id: 'inline-handler-cost',
    category: 'performance',
    budgetMs: 0.3,
    confidence: 'medium',
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

      walkFiberImpl(root.current, (fiber) => {
        if (context.performance.now() > deadline) return;
        if (!isMemo(fiber, ad)) return;

        const key = STORE_PREFIX + pathKey(fiber, ad);
        const curr = (fiber.memoizedProps as Record<string, unknown> | null) ?? null;
        const prev = context.read<Record<string, unknown>>(key);
        // Persist only the function-typed props (identity refs) for next commit.
        const fnProps: Record<string, unknown> = {};
        if (curr) for (const [k, v] of Object.entries(curr)) if (typeof v === 'function') fnProps[k] = v;
        context.write<Record<string, unknown>>(key, fnProps);

        const changed = changedFunctionProps(prev, fnProps);
        if (changed.length === 0) return;
        const name = ad.getDisplayName(fiber) ?? 'MemoComponent';
        if (!context.dedupe(key)) return;
        buffer.push({
          id: `inline-handler-cost-${seq++}`,
          type: 'INLINE_HANDLER_COST',
          severity: 'warning',
          component: name,
          message: `Memoized <${name}> receives inline function prop(s) [${changed.join(', ')}] that change every render — memo is bypassed`,
          suggestion: 'Wrap the handler in useCallback (stable deps) so the memoized child can skip re-rendering.',
          timestamp: Date.now(),
          fiberId: key,
          location: { componentName: name, componentPath: [name] },
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

export const inlineHandlerCostDetector = createInlineHandlerCostDetector();
