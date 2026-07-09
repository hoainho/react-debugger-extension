/**
 * Fair-share budget allocator + yield/resume coverage (M-C.2).
 */
import { describe, it, expect } from 'vitest';
import {
  computeDeadline,
  isOverBudget,
  readCursor,
  writeCursor,
  clearCursor,
  processWithinBudget,
  type BudgetCtx,
} from '../inject/budget';

function fakeCtx(): BudgetCtx & { store: Map<string, unknown> } {
  const store = new Map<string, unknown>();
  return {
    store,
    read<T>(k: string) {
      return store.get(k) as T | undefined;
    },
    write<T>(k: string, v: T) {
      store.set(k, v);
    },
  };
}

/** Clock that advances 1ms per read. */
function tickingClock(start = 0) {
  let t = start;
  return () => t++;
}

describe('deadline math', () => {
  it('computeDeadline / isOverBudget', () => {
    expect(computeDeadline(100, 0.3)).toBeCloseTo(100.3);
    expect(computeDeadline(100, -5)).toBe(100); // negative budget clamped
    expect(isOverBudget(100.3, 100.3)).toBe(true);
    expect(isOverBudget(100.2, 100.3)).toBe(false);
  });
});

describe('cursor persistence', () => {
  it('reads 0 by default, round-trips, and clears', () => {
    const ctx = fakeCtx();
    expect(readCursor(ctx, 'd')).toBe(0);
    writeCursor(ctx, 'd', 42);
    expect(readCursor(ctx, 'd')).toBe(42);
    clearCursor(ctx, 'd');
    expect(readCursor(ctx, 'd')).toBe(0);
  });
});

describe('processWithinBudget — yield then resume', () => {
  const items = Array.from({ length: 10 }, (_, i) => i);

  it('yields a cursor when the budget runs out, then resumes to completion', () => {
    const seen: number[] = [];
    // deadline=3 with a clock that ticks 1/ms starting at 0 → over budget after ~3 items
    const r1 = processWithinBudget(items, 0, 3, tickingClock(0), (it) => seen.push(it));
    expect(r1.done).toBe(false);
    expect(r1.nextCursor).toBeGreaterThan(0);
    expect(r1.nextCursor).toBeLessThan(items.length);

    // resume from the cursor with a fresh (generous) budget
    const r2 = processWithinBudget(items, r1.nextCursor, Number.POSITIVE_INFINITY, () => 0, (it) => seen.push(it));
    expect(r2.done).toBe(true);
    expect(r2.nextCursor).toBe(items.length);
    expect(seen).toEqual(items); // every item processed exactly once across the two slices
  });

  it('a fresh generous budget completes in one slice', () => {
    const seen: number[] = [];
    const r = processWithinBudget(items, 0, Number.POSITIVE_INFINITY, () => 0, (it) => seen.push(it));
    expect(r).toEqual({ processed: 10, nextCursor: 10, done: true });
    expect(seen).toEqual(items);
  });

  it('always makes progress even with an already-exceeded budget', () => {
    const seen: number[] = [];
    // now() always past deadline → still processes exactly one item and yields
    const r = processWithinBudget(items, 0, 0, () => 999, (it) => seen.push(it));
    expect(r.processed).toBe(1);
    expect(r.nextCursor).toBe(1);
    expect(r.done).toBe(false);
    expect(seen).toEqual([0]);
  });
});
