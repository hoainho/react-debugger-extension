/**
 * Fair-share per-detector deadline budget + yield/resume (M-C.2).
 *
 * The registry already hands each detector a per-commit deadline
 * (`perf.now() + detector.budgetMs`). This module adds the cooperative
 * yield-and-resume protocol on top: a detector that can't finish within its
 * slice records a cursor via `ctx.write` and returns; on the next commit it
 * reads the cursor back and resumes from there, so a large tree is amortized
 * across commits instead of blowing a single frame's budget.
 *
 * All helpers are pure / DI'd (clock + a minimal {read,write} ctx) so they are
 * unit-testable without the registry or a live page.
 */

export interface BudgetCtx {
  read<T>(key: string): T | undefined;
  write<T>(key: string, value: T): void;
}

const CURSOR_PREFIX = 'budget:cursor:';

/** Deadline (ms, in the clock's units) by which a detector should yield. */
export function computeDeadline(now: number, budgetMs: number): number {
  return now + Math.max(0, budgetMs);
}

/** True once the clock has passed the deadline. */
export function isOverBudget(now: number, deadline: number): boolean {
  return now >= deadline;
}

export function readCursor(ctx: BudgetCtx, detectorId: string): number {
  return ctx.read<number>(CURSOR_PREFIX + detectorId) ?? 0;
}
export function writeCursor(ctx: BudgetCtx, detectorId: string, cursor: number): void {
  ctx.write<number>(CURSOR_PREFIX + detectorId, cursor);
}
export function clearCursor(ctx: BudgetCtx, detectorId: string): void {
  ctx.write<number>(CURSOR_PREFIX + detectorId, 0);
}

export interface BudgetRun {
  /** Count processed this slice. */
  processed: number;
  /** Index to resume from next commit (equals items.length when finished). */
  nextCursor: number;
  /** True when the whole list was consumed this slice. */
  done: boolean;
}

/**
 * Process `items` starting at `startCursor`, stopping when the clock reaches
 * `deadline`. Always makes forward progress (at least one item per call) so a
 * pathologically tight budget can't livelock.
 */
export function processWithinBudget<T>(
  items: readonly T[],
  startCursor: number,
  deadline: number,
  now: () => number,
  visit: (item: T, index: number) => void,
): BudgetRun {
  let i = Math.max(0, startCursor);
  let processed = 0;
  for (; i < items.length; i++) {
    visit(items[i], i);
    processed++;
    // Check AFTER at least one item so we never stall without progress.
    if (isOverBudget(now(), deadline) && i + 1 < items.length) {
      return { processed, nextCursor: i + 1, done: false };
    }
  }
  return { processed, nextCursor: items.length, done: true };
}
