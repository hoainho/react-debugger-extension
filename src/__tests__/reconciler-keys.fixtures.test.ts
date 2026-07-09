/**
 * Fixture-driven coverage for the reconciler-keys detector (M-B.6.7).
 *
 * The inline-fiber unit cases live in `reconciler-keys.test.ts`. This file
 * binds the detector to the shared fixture data in
 * `test/fixtures/unstable-keys/keys.ts` so the documented fixture set is the
 * source of truth for the positive (emit) and negative (zero) scenarios.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createReconcilerKeysDetector } from '../inject/detectors/reconciler-keys';
import { createRegistry } from '../inject/registry';
import type { FiberNode, FiberRoot } from '../inject/react-adapters/types';
import type { Issue } from '../types';
import type { Detector } from '../types/registry';
import {
  mathRandomKeys,
  dateNowKeys,
  indexKeysInitial,
  indexKeysReordered,
  stableIdKeys,
  stableIdKeysReordered,
} from '../../test/fixtures/unstable-keys/keys';

const HOST_COMPONENT_TAG = 5;

function makeFiber(partial: Partial<FiberNode>): FiberNode {
  return {
    tag: HOST_COMPONENT_TAG,
    key: null,
    type: 'div',
    elementType: 'div',
    stateNode: null,
    return: null,
    child: null,
    sibling: null,
    alternate: null,
    memoizedState: null,
    memoizedProps: null,
    pendingProps: null,
    flags: 0,
    updateQueue: null,
    ...partial,
  } as FiberNode;
}

/** Build a `<ul>` parent whose `<li>` children carry the given keys. */
function makeListRoot(childKeys: string[]): FiberRoot {
  const parent = makeFiber({ type: 'ul', elementType: 'ul' });
  let prev: FiberNode | null = null;
  for (const key of childKeys) {
    const child = makeFiber({ type: 'li', elementType: 'li', key, return: parent });
    if (prev === null) parent.child = child;
    else prev.sibling = child;
    prev = child;
  }
  const root = makeFiber({ type: 'root', elementType: 'root' });
  root.child = parent;
  parent.return = root;
  return { current: root };
}

function setupHarness(): {
  detector: Detector<Issue>;
  dispatch: (root: FiberRoot) => void;
  drain: () => Issue[];
} {
  const detector = createReconcilerKeysDetector();
  const registry = createRegistry({
    emit: () => {},
    log: () => {},
    sanitize: (v) => v,
    performance: { now: () => 0 },
  });
  registry.register(detector);
  return {
    detector,
    dispatch: (root) => registry.dispatch({ fiberRoot: root }),
    drain: () => {
      const all = registry.drainAll();
      const us = all.find((e) => e.detectorId === 'reconciler-keys');
      return (us?.issues as Issue[]) ?? [];
    },
  };
}

describe('reconciler-keys detector — fixture-driven', () => {
  let harness: ReturnType<typeof setupHarness>;
  beforeEach(() => {
    harness = setupHarness();
  });

  describe('positive fixtures emit exactly one UNSTABLE_LIST_KEY', () => {
    it('Math.random()-style keys (Case A)', () => {
      harness.dispatch(makeListRoot(mathRandomKeys));
      const issues = harness.drain();
      expect(issues).toHaveLength(1);
      expect(issues[0].type).toBe('UNSTABLE_LIST_KEY');
    });

    it('Date.now()-style keys (Case A)', () => {
      harness.dispatch(makeListRoot(dateNowKeys));
      const issues = harness.drain();
      expect(issues).toHaveLength(1);
      expect(issues[0].type).toBe('UNSTABLE_LIST_KEY');
    });

    it('numeric-index keys that reorder across commits (Case B)', () => {
      harness.dispatch(makeListRoot(indexKeysInitial));
      harness.dispatch(makeListRoot(indexKeysReordered));
      const issues = harness.drain();
      expect(issues).toHaveLength(1);
      expect(issues[0].type).toBe('UNSTABLE_LIST_KEY');
      expect(issues[0].message).toMatch(/reorder/);
    });
  });

  describe('negative fixture emits nothing', () => {
    it('stable id keys, even when reordered', () => {
      harness.dispatch(makeListRoot(stableIdKeys));
      harness.dispatch(makeListRoot(stableIdKeysReordered));
      const issues = harness.drain();
      expect(issues).toHaveLength(0);
    });
  });
});
