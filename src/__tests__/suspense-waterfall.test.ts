/**
 * suspense-waterfall detector coverage (M-E.3, hero #4).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  createSuspenseWaterfallDetector,
  isBoundarySuspended,
  nextStreak,
  shouldFlagWaterfall,
  WATERFALL_THRESHOLD,
} from '../inject/detectors/suspense-waterfall';
import { createRegistry } from '../inject/registry';
import { getAdapter } from '../inject/react-adapters';
import type { FiberNode, FiberRoot } from '../inject/react-adapters/types';
import type { Issue } from '../types';
import type { Detector } from '../types/registry';

const T = getAdapter().FIBER_TAGS;

describe('pure helpers', () => {
  it('isBoundarySuspended: memoizedState set → suspended', () => {
    expect(isBoundarySuspended({ memoizedState: {} } as FiberNode)).toBe(true);
    expect(isBoundarySuspended({ memoizedState: null } as FiberNode)).toBe(false);
  });
  it('nextStreak increments while suspended, resets otherwise', () => {
    expect(nextStreak(undefined, true)).toBe(1);
    expect(nextStreak(2, true)).toBe(3);
    expect(nextStreak(2, false)).toBe(0);
  });
  it('shouldFlagWaterfall at the >=3 threshold', () => {
    expect(shouldFlagWaterfall(2)).toBe(false);
    expect(shouldFlagWaterfall(WATERFALL_THRESHOLD)).toBe(true);
  });
});

describe('detector emit/zero', () => {
  let detector: Detector<Issue>;
  let harness: { dispatch: (r: FiberRoot) => void; drain: () => Issue[] };

  function boundaryRoot(suspended: boolean): FiberRoot {
    const boundary = {
      tag: T.SuspenseComponent, key: null, type: null, elementType: null, stateNode: null,
      return: null, child: null, sibling: null, alternate: null,
      memoizedState: suspended ? { dehydrated: null } : null,
      memoizedProps: null, pendingProps: null, flags: 0, updateQueue: null,
    } as unknown as FiberNode;
    const root = { tag: T.HostRoot ?? 3, type: 'root', child: boundary, sibling: null, return: null, key: null } as unknown as FiberNode;
    (boundary as { return: FiberNode }).return = root;
    return { current: root };
  }

  beforeEach(() => {
    detector = createSuspenseWaterfallDetector();
    const registry = createRegistry({ emit: () => {}, log: () => {}, sanitize: (v) => v, performance: { now: () => 0 } });
    registry.register(detector);
    harness = {
      dispatch: (r) => registry.dispatch({ fiberRoot: r }),
      drain: () => {
        const e = registry.drainAll().find((x) => x.detectorId === 'suspense-waterfall');
        return (e?.issues as Issue[]) ?? [];
      },
    };
  });

  it('flags after 3 consecutive suspensions', () => {
    harness.dispatch(boundaryRoot(true));
    harness.dispatch(boundaryRoot(true));
    harness.dispatch(boundaryRoot(true)); // streak 3 → flag
    const issues = harness.drain();
    expect(issues).toHaveLength(1);
    expect(issues[0].type).toBe('SUSPENSE_WATERFALL');
    expect(issues[0].message).toMatch(/re-suspended 3/);
  });

  it('stays quiet at 2 consecutive suspensions', () => {
    harness.dispatch(boundaryRoot(true));
    harness.dispatch(boundaryRoot(true));
    expect(harness.drain()).toHaveLength(0);
  });

  it('resets the streak when the boundary is not suspended', () => {
    harness.dispatch(boundaryRoot(true));
    harness.dispatch(boundaryRoot(true));
    harness.dispatch(boundaryRoot(false)); // reset
    harness.dispatch(boundaryRoot(true));
    harness.dispatch(boundaryRoot(true)); // only 2 in a row → no flag
    expect(harness.drain()).toHaveLength(0);
  });
});
