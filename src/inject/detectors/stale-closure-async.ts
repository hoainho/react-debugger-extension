/**
 * stale-closure-async detector (M-D.4, v2).
 *
 * Conservative source-analysis detector for the classic async-stale-closure
 * bug: a `useCallback`/`useEffect` whose body performs an async operation
 * (`await`, `.then(`, `setTimeout`/`setInterval`) AND reads a `useState`
 * variable that is ABSENT from the hook's dependency array — so the async
 * callback closes over a stale value.
 *
 * Deliberately narrow to keep false-positives low (it is NOT a full
 * exhaustive-deps implementation): it only flags a state variable that is
 * (a) referenced in the async body and (b) missing from an explicit deps array.
 * A hook with the variable in its deps, or with no async marker, or with no
 * deps array, is never flagged.
 *
 * Runs on component-function source (`fn.toString()`), reusing the WeakMap
 * inferrer for state names. Pure analysis is exported for unit testing.
 */
import type { Detector, DetectorContext } from '../../types/registry';
import type { Issue } from '../../types';
import type { FiberNode, ReactVersionAdapter, FiberRoot } from '../react-adapters/types';
import { walkFiberImpl } from '../react-adapters/utils';
import { getAdapter } from '../react-adapters';
import { inferStateNames } from '../react-adapters/state-name';

const ASYNC_MARKER_RE = /\bawait\b|\.then\s*\(|\bsetTimeout\s*\(|\bsetInterval\s*\(/;
// useCallback(<cb up to its closing brace>, [<deps>])
const HOOK_RE = /\b(useCallback|useEffect)\s*\(([\s\S]*?)\}\s*,\s*\[([^\]]*)\]\s*\)/g;

export interface StaleFinding {
  hook: string;
  missingDep: string;
}

/**
 * Find async hook callbacks that reference a state var absent from their deps.
 * `stateNames` are the component's useState variable names.
 */
export function analyzeStaleAsyncClosures(source: string, stateNames: string[]): StaleFinding[] {
  if (!source || stateNames.length === 0) return [];
  const findings: StaleFinding[] = [];
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  const re = new RegExp(HOOK_RE.source, 'g');
  while ((m = re.exec(source)) !== null) {
    const [, hook, body, depsRaw] = m;
    if (!ASYNC_MARKER_RE.test(body)) continue;
    const deps = depsRaw
      .split(',')
      .map((d) => d.trim())
      .filter(Boolean);
    for (const name of stateNames) {
      const usedInBody = new RegExp(`\\b${name}\\b`).test(body);
      if (usedInBody && !deps.includes(name)) {
        const key = `${hook}:${name}`;
        if (!seen.has(key)) {
          seen.add(key);
          findings.push({ hook, missingDep: name });
        }
      }
    }
  }
  return findings;
}

export function createStaleClosureAsyncDetector(): Detector<Issue> {
  let ctx: DetectorContext | null = null;
  let adapter: ReactVersionAdapter | null = null;
  let buffer: Issue[] = [];
  let seq = 0;

  return {
    id: 'stale-closure-async',
    category: 'side-effects',
    budgetMs: 0.3,
    confidence: 'medium',
    prodCapable: false,

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

      walkFiberImpl(root.current, (fiber: FiberNode) => {
        if (context.performance.now() > deadline) return;
        const type = fiber.type;
        if (typeof type !== 'function') return;
        let source: string;
        try {
          source = type.toString();
        } catch {
          return;
        }
        const findings = analyzeStaleAsyncClosures(source, inferStateNames(type));
        if (findings.length === 0) return;
        const name = ad.getDisplayName(fiber) ?? 'Component';
        for (const f of findings) {
          const key = `${name}:${f.hook}:${f.missingDep}`;
          if (!context.dedupe(key)) continue;
          buffer.push({
            id: `stale-closure-async-${seq++}`,
            type: 'STALE_CLOSURE_ASYNC',
            severity: 'warning',
            component: name,
            message: `Async ${f.hook} closes over stale "${f.missingDep}" (missing from deps)`,
            suggestion: `Add "${f.missingDep}" to the ${f.hook} dependency array, or use a ref / functional updater to read the latest value.`,
            timestamp: Date.now(),
            fiberId: key,
            location: { componentName: name, componentPath: [name] },
          });
        }
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

export const staleClosureAsyncDetector = createStaleClosureAsyncDetector();
