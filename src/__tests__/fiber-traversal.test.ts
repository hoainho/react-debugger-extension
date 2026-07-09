/**
 * Unified fiber traversal coverage (M-D.1 / R2).
 */
import { describe, it, expect } from 'vitest';
import { walkFiber, type FiberVisitor } from '../inject/core/fiber-traversal';
import type { FiberNode } from '../inject/react-adapters/types';

/** Build a fiber tree from a nested [name, children[]] spec. */
function node(name: string, children: FiberNode[] = []): FiberNode {
  const f = { type: name, child: null, sibling: null, return: null } as unknown as FiberNode;
  for (let i = 0; i < children.length; i++) {
    (children[i] as { return: FiberNode }).return = f;
    if (i === 0) (f as { child: FiberNode }).child = children[i];
    else (children[i - 1] as { sibling: FiberNode }).sibling = children[i];
  }
  return f;
}

const nameOf = (f: FiberNode) => String((f as { type: unknown }).type);

// App → [A → [A1, A2], B]
function tree(): FiberNode {
  return node('App', [node('A', [node('A1'), node('A2')]), node('B')]);
}

function collector(into: string[]): FiberVisitor {
  return { enter: (f) => void into.push(nameOf(f)) };
}

describe('walkFiber', () => {
  it('visits every node depth-first (pre-order)', () => {
    const seen: string[] = [];
    const r = walkFiber(tree(), [collector(seen)]);
    expect(r).toEqual({ completed: true, visited: 5 });
    expect(seen).toEqual(['App', 'A', 'A1', 'A2', 'B']);
  });

  it('per-visitor skipSubtree prunes only the pruning visitor', () => {
    const all: string[] = [];
    const pruned: string[] = [];
    const prune: FiberVisitor = {
      enter: (f) => {
        pruned.push(nameOf(f));
        return nameOf(f) === 'A' ? { skipSubtree: true } : undefined;
      },
    };
    walkFiber(tree(), [collector(all), prune]);
    expect(all).toEqual(['App', 'A', 'A1', 'A2', 'B']); // unaffected visitor sees all
    expect(pruned).toEqual(['App', 'A', 'B']); // pruning visitor skips A's subtree (A1,A2) but still sees sibling B
  });

  it('isolates a throwing visitor: it is dropped, others complete', () => {
    const good: string[] = [];
    const boom: FiberVisitor = {
      enter: (f) => {
        if (nameOf(f) === 'A') throw new Error('boom');
      },
    };
    const r = walkFiber(tree(), [boom, collector(good)]);
    expect(r.completed).toBe(true);
    expect(good).toEqual(['App', 'A', 'A1', 'A2', 'B']); // good visitor unaffected
  });

  it('calls exit on the way back up (post-order)', () => {
    const order: string[] = [];
    walkFiber(tree(), [{ enter: () => {}, exit: (f) => void order.push(nameOf(f)) }]);
    expect(order).toEqual(['A1', 'A2', 'A', 'B', 'App']); // post-order
  });

  it('yields at the deadline and resumes from startAt to completion', () => {
    const t = tree();
    let clock = 0;
    const seen: string[] = [];
    // deadline 2 with a clock ticking each loop iteration → stops early
    const r1 = walkFiber(t, [collector(seen)], { deadline: 2, now: () => clock++ });
    expect(r1.completed).toBe(false);
    const firstBatch = seen.length;
    expect(firstBatch).toBeGreaterThan(0);
    expect(firstBatch).toBeLessThan(5);

    // resume: skip the already-entered nodes, generous budget
    const r2 = walkFiber(t, [collector(seen)], { startAt: firstBatch });
    expect(r2.completed).toBe(true);
    expect(seen).toEqual(['App', 'A', 'A1', 'A2', 'B']); // all 5 across the two calls, once each
  });
});
