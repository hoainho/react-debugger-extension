/**
 * ref-mutation-during-render detector (M-F.1 quick-win).
 *
 * Mutating `ref.current` during render (instead of in an effect/event handler)
 * is impure and unsafe under concurrent React. This CONSERVATIVE source analyzer
 * removes the bodies of `useEffect` / `useLayoutEffect` (where such mutation is
 * legitimate) and flags a remaining `ref.current = …` assignment as a likely
 * render-body mutation. Heuristic → confidence LOW, opt-in; the fixtures define
 * exactly what it catches.
 */
import type { Detector, DetectorContext } from '../../types/registry';
import type { Issue } from '../../types';
import type { ReactVersionAdapter, FiberRoot } from '../react-adapters/types';
import { walkFiberImpl } from '../react-adapters/utils';
import { getAdapter } from '../react-adapters';

// Strip useEffect / useLayoutEffect bodies — legit ref-mutation site. The deps
// array is optional so a deps-less effect (`useEffect(() => {...})`, runs every
// commit) is stripped too, avoiding a false positive on ref mutations inside it.
const EFFECT_RE = /use(?:Layout)?Effect\s*\(([\s\S]*?)\}(?:\s*,\s*\[[^\]]*\])?\s*\)/g;
// A `x.current = …` assignment (not `==`).
const REF_ASSIGN_RE = /\b\w+\.current\s*=(?!=)/;

/** True when a render-body ref.current assignment survives after effect bodies are removed. */
export function analyzeRefMutationInRender(source: string): boolean {
  if (typeof source !== 'string' || !source) return false;
  const withoutEffects = source.replace(EFFECT_RE, '');
  return REF_ASSIGN_RE.test(withoutEffects);
}

export function createRefMutationDuringRenderDetector(): Detector<Issue> {
  let ctx: DetectorContext | null = null;
  let adapter: ReactVersionAdapter | null = null;
  let buffer: Issue[] = [];
  let seq = 0;

  return {
    id: 'ref-mutation-during-render',
    category: 'side-effects',
    budgetMs: 0.3,
    confidence: 'low',
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

      walkFiberImpl(root.current, (fiber) => {
        if (context.performance.now() > deadline) return;
        const type = fiber.type;
        if (typeof type !== 'function') return;
        let source: string;
        try {
          source = type.toString();
        } catch {
          return;
        }
        if (!analyzeRefMutationInRender(source)) return;
        const name = ad.getDisplayName(fiber) ?? 'Component';
        const key = `ref-mutation:${name}`;
        if (!context.dedupe(key)) return;
        buffer.push({
          id: `ref-mutation-during-render-${seq++}`,
          type: 'REF_MUTATION_DURING_RENDER',
          severity: 'warning',
          component: name,
          message: `${name} appears to mutate a ref (ref.current = …) during render — impure, unsafe under concurrent React`,
          suggestion: 'Move the ref mutation into a useEffect / event handler, or derive the value instead.',
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

export const refMutationDuringRenderDetector = createRefMutationDuringRenderDetector();
