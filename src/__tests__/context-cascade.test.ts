/**
 * context-cascade detector coverage (M-D.3, hero #3).
 * Pure helpers + hand-built provider/consumer fibers through the registry.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  createContextCascadeDetector,
  shouldFlagCascade,
  countContextConsumers,
  providerContext,
} from '../inject/detectors/context-cascade';
import { createRegistry } from '../inject/registry';
import { getAdapter } from '../inject/react-adapters';
import type { FiberNode, FiberRoot } from '../inject/react-adapters/types';
import type { Issue } from '../types';
import type { Detector } from '../types/registry';

const T = getAdapter().FIBER_TAGS;
const CTX = { displayName: 'Theme' }; // stands in for a Context object

function fib(p: Partial<FiberNode>): FiberNode {
  return {
    tag: 0, key: null, type: null, elementType: null, stateNode: null,
    return: null, child: null, sibling: null, alternate: null,
    memoizedState: null, memoizedProps: null, pendingProps: null,
    flags: 0, updateQueue: null, ...p,
  } as FiberNode;
}

/** provider(value=ref) with `consumerCount` consumers of CTX beneath it. */
function providerTree(valueRef: unknown, consumerCount: number): FiberRoot {
  const provider = fib({
    tag: T.ContextProvider,
    type: { _context: CTX },
    memoizedProps: { value: valueRef },
  });
  let prev: FiberNode | null = null;
  for (let i = 0; i < consumerCount; i++) {
    const consumer = fib({
      tag: 0,
      dependencies: { firstContext: { context: CTX, next: null } },
      return: provider,
    } as Partial<FiberNode>);
    if (prev === null) provider.child = consumer;
    else prev.sibling = consumer;
    prev = consumer;
  }
  const root = fib({ tag: T.HostRoot ?? 3, type: 'root' });
  root.child = provider;
  provider.return = root;
  return { current: root };
}

describe('pure helpers', () => {
  it('shouldFlagCascade: only when prev exists, ref changed, >=2 consumers', () => {
    expect(shouldFlagCascade(undefined, {}, 5)).toBe(false); // first sighting
    const ref = {};
    expect(shouldFlagCascade(ref, ref, 5)).toBe(false); // same reference
    expect(shouldFlagCascade({}, {}, 1)).toBe(false); // changed but <2 consumers
    expect(shouldFlagCascade({}, {}, 2)).toBe(true);
  });

  it('countContextConsumers counts only matching-context consumers in subtree', () => {
    const root = providerTree({ color: 'a' }, 2);
    const provider = root.current.child as FiberNode;
    expect(providerContext(provider)).toBe(CTX);
    expect(countContextConsumers(provider, CTX, T.ContextConsumer)).toBe(2);
    expect(countContextConsumers(provider, { other: 1 }, T.ContextConsumer)).toBe(0);
  });
});

describe('detector emit/zero', () => {
  let detector: Detector<Issue>;
  let harness: { dispatch: (r: FiberRoot) => void; drain: () => Issue[] };

  beforeEach(() => {
    detector = createContextCascadeDetector();
    const registry = createRegistry({ emit: () => {}, log: () => {}, sanitize: (v) => v, performance: { now: () => 0 } });
    registry.register(detector);
    harness = {
      dispatch: (r) => registry.dispatch({ fiberRoot: r }),
      drain: () => {
        const e = registry.drainAll().find((x) => x.detectorId === 'context-cascade');
        return (e?.issues as Issue[]) ?? [];
      },
    };
  });

  it('flags a new-value-every-commit provider with >=2 consumers', () => {
    harness.dispatch(providerTree({ color: 'a' }, 2)); // first sighting: records ref
    harness.dispatch(providerTree({ color: 'a' }, 2)); // new object literal → ref changed
    const issues = harness.drain();
    expect(issues).toHaveLength(1);
    expect(issues[0].type).toBe('CONTEXT_CASCADE');
    expect(issues[0].suggestion).toMatch(/useMemo/);
  });

  it('stays quiet when the value reference is stable (memoized)', () => {
    const stable = { color: 'a' };
    harness.dispatch(providerTree(stable, 2));
    harness.dispatch(providerTree(stable, 2)); // SAME ref reused
    expect(harness.drain()).toHaveLength(0);
  });

  it('stays quiet when the ref changes but only 1 consumer', () => {
    harness.dispatch(providerTree({ color: 'a' }, 1));
    harness.dispatch(providerTree({ color: 'a' }, 1));
    expect(harness.drain()).toHaveLength(0);
  });
});
