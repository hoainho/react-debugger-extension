/**
 * stale-closure-async detector coverage (M-D.4).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  analyzeStaleAsyncClosures,
  createStaleClosureAsyncDetector,
} from '../inject/detectors/stale-closure-async';
import { createRegistry } from '../inject/registry';
import type { FiberNode, FiberRoot } from '../inject/react-adapters/types';
import type { Issue } from '../types';
import type { Detector } from '../types/registry';
import {
  positivePromise,
  positiveAwait,
  negativeInDeps,
  negativeNoAsync,
} from '../../test/fixtures/stale-closure-async/sources';

describe('analyzeStaleAsyncClosures', () => {
  it('flags an async hook referencing a state var missing from deps', () => {
    expect(analyzeStaleAsyncClosures(positivePromise, ['count'])).toEqual([
      { hook: 'useCallback', missingDep: 'count' },
    ]);
    expect(analyzeStaleAsyncClosures(positiveAwait, ['value'])).toEqual([
      { hook: 'useEffect', missingDep: 'value' },
    ]);
  });

  it('does not flag when the var is in deps', () => {
    expect(analyzeStaleAsyncClosures(negativeInDeps, ['count'])).toEqual([]);
  });

  it('does not flag when there is no async operation', () => {
    expect(analyzeStaleAsyncClosures(negativeNoAsync, ['count'])).toEqual([]);
  });

  it('returns nothing when there are no state names', () => {
    expect(analyzeStaleAsyncClosures(positivePromise, [])).toEqual([]);
  });
});

describe('detector emit/zero via fiber source', () => {
  let detector: Detector<Issue>;
  let harness: { dispatch: (r: FiberRoot) => void; drain: () => Issue[] };

  function componentFiber(name: string, source: string): FiberRoot {
    const fn = { [name]: function () {} }[name] as unknown as (...a: unknown[]) => unknown;
    (fn as { toString: () => string }).toString = () => source;
    const fiber = {
      tag: 0, key: null, type: fn, elementType: fn, stateNode: null,
      return: null, child: null, sibling: null, alternate: null,
      memoizedState: null, memoizedProps: null, pendingProps: null, flags: 0, updateQueue: null,
    } as unknown as FiberNode;
    const root = { tag: 3, type: 'root', child: fiber, sibling: null, return: null, key: null } as unknown as FiberNode;
    (fiber as { return: FiberNode }).return = root;
    return { current: root };
  }

  beforeEach(() => {
    detector = createStaleClosureAsyncDetector();
    const registry = createRegistry({ emit: () => {}, log: () => {}, sanitize: (v) => v, performance: { now: () => 0 } });
    registry.register(detector);
    harness = {
      dispatch: (r) => registry.dispatch({ fiberRoot: r }),
      drain: () => {
        const e = registry.drainAll().find((x) => x.detectorId === 'stale-closure-async');
        return (e?.issues as Issue[]) ?? [];
      },
    };
  });

  it('emits STALE_CLOSURE_ASYNC for the positive fixture', () => {
    harness.dispatch(componentFiber('Widget', positivePromise));
    const issues = harness.drain();
    expect(issues).toHaveLength(1);
    expect(issues[0].type).toBe('STALE_CLOSURE_ASYNC');
    expect(issues[0].message).toMatch(/count/);
  });

  it('emits nothing for the in-deps negative fixture', () => {
    harness.dispatch(componentFiber('Widget', negativeInDeps));
    expect(harness.drain()).toHaveLength(0);
  });
});
