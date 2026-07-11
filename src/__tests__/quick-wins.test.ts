/**
 * M-F.1 quick-win detectors: inline-handler-cost + ref-mutation-during-render.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  createInlineHandlerCostDetector,
  changedFunctionProps,
} from '../inject/detectors/inline-handler-cost';
import {
  createRefMutationDuringRenderDetector,
  analyzeRefMutationInRender,
} from '../inject/detectors/ref-mutation-during-render';
import { createRegistry } from '../inject/registry';
import { getAdapter } from '../inject/react-adapters';
import type { FiberNode, FiberRoot } from '../inject/react-adapters/types';
import type { Issue } from '../types';
import type { Detector } from '../types/registry';
import { refMutationInRender, refMutationInEffect, refMutationInEffectNoDeps } from '../../test/fixtures/quick-wins/sources';

const T = getAdapter().FIBER_TAGS;

function drainFor(registry: ReturnType<typeof createRegistry>, id: string): Issue[] {
  const e = registry.drainAll().find((x) => x.detectorId === id);
  return (e?.issues as Issue[]) ?? [];
}

describe('inline-handler-cost', () => {
  it('changedFunctionProps flags only function props whose identity changed', () => {
    const a = () => {};
    const b = () => {};
    expect(changedFunctionProps({ onClick: a }, { onClick: b })).toEqual(['onClick']);
    expect(changedFunctionProps({ onClick: a }, { onClick: a })).toEqual([]); // stable
    expect(changedFunctionProps({ x: 1 } as never, { x: 2 } as never)).toEqual([]); // non-function ignored
  });

  it('flags a memo child receiving an inline function prop that changes every commit', () => {
    const detector = createInlineHandlerCostDetector();
    const registry = createRegistry({ emit: () => {}, log: () => {}, sanitize: (v) => v, performance: { now: () => 0 } });
    registry.register(detector);
    const memoRoot = (onClick: () => void): FiberRoot => {
      const memo = { tag: T.MemoComponent, type: null, key: null, memoizedProps: { onClick }, child: null, sibling: null, return: null } as unknown as FiberNode;
      const root = { tag: 3, type: 'root', child: memo, sibling: null, return: null, key: null } as unknown as FiberNode;
      (memo as { return: FiberNode }).return = root;
      return { current: root };
    };
    registry.dispatch({ fiberRoot: memoRoot(() => {}) }); // commit 1: record
    registry.dispatch({ fiberRoot: memoRoot(() => {}) }); // commit 2: new identity → flag
    const issues = drainFor(registry, 'inline-handler-cost');
    expect(issues).toHaveLength(1);
    expect(issues[0].type).toBe('INLINE_HANDLER_COST');
    expect(issues[0].message).toMatch(/onClick/);
  });

  it('stays quiet when the memo child gets a stable function prop', () => {
    const detector = createInlineHandlerCostDetector();
    const registry = createRegistry({ emit: () => {}, log: () => {}, sanitize: (v) => v, performance: { now: () => 0 } });
    registry.register(detector);
    const stable = () => {};
    const memoRoot = (): FiberRoot => {
      const memo = { tag: T.MemoComponent, type: null, key: null, memoizedProps: { onClick: stable }, child: null, sibling: null, return: null } as unknown as FiberNode;
      const root = { tag: 3, type: 'root', child: memo, sibling: null, return: null, key: null } as unknown as FiberNode;
      (memo as { return: FiberNode }).return = root;
      return { current: root };
    };
    registry.dispatch({ fiberRoot: memoRoot() });
    registry.dispatch({ fiberRoot: memoRoot() });
    expect(drainFor(registry, 'inline-handler-cost')).toHaveLength(0);
  });
});

describe('ref-mutation-during-render', () => {
  it('analyzer flags render-body ref mutation but not effect-body mutation', () => {
    expect(analyzeRefMutationInRender(refMutationInRender)).toBe(true);
    expect(analyzeRefMutationInRender(refMutationInEffect)).toBe(false);
    // deps-less effect body must also be treated as a legit mutation site.
    expect(analyzeRefMutationInRender(refMutationInEffectNoDeps)).toBe(false);
  });

  let detector: Detector<Issue>;
  let registry: ReturnType<typeof createRegistry>;
  beforeEach(() => {
    detector = createRefMutationDuringRenderDetector();
    registry = createRegistry({ emit: () => {}, log: () => {}, sanitize: (v) => v, performance: { now: () => 0 } });
    registry.register(detector);
  });

  function fiberFor(source: string): FiberRoot {
    const fn = function Comp() {};
    (fn as { toString: () => string }).toString = () => source;
    const fiber = { tag: 0, type: fn, key: null, child: null, sibling: null, return: null, memoizedProps: null } as unknown as FiberNode;
    const root = { tag: 3, type: 'root', child: fiber, sibling: null, return: null, key: null } as unknown as FiberNode;
    (fiber as { return: FiberNode }).return = root;
    return { current: root };
  }

  it('emits on the render-body mutation fixture', () => {
    registry.dispatch({ fiberRoot: fiberFor(refMutationInRender) });
    const issues = drainFor(registry, 'ref-mutation-during-render');
    expect(issues).toHaveLength(1);
    expect(issues[0].type).toBe('REF_MUTATION_DURING_RENDER');
  });

  it('stays quiet on the effect-body mutation fixture', () => {
    registry.dispatch({ fiberRoot: fiberFor(refMutationInEffect) });
    expect(drainFor(registry, 'ref-mutation-during-render')).toHaveLength(0);
  });
});
