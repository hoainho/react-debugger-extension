/**
 * Unified fiber traversal (M-D.1 / R2).
 *
 * One depth-first walk that drives multiple independent visitors, replacing the
 * three ad-hoc walkers in the monolith (snapshot capture, scan walker, Redux
 * store finder). Each visitor is isolated (a throwing visitor is dropped from
 * the rest of THIS walk, never aborting the others), can prune its own subtree
 * via `{ skipSubtree: true }` WITHOUT affecting other visitors, and the walk
 * honors a wall-clock deadline (returning `{ completed: false, visited }` so a
 * later call can resume by passing `startAt`).
 *
 * This module is pure w.r.t. the fiber shape (child/sibling/return) and is
 * added ADDITIVELY — the legacy walkers migrate onto it one at a time under
 * full detector-core regression before their bodies are deleted.
 */
import type { FiberNode } from '../react-adapters/types';

export interface VisitorResult {
  skipSubtree?: boolean;
}

export interface FiberVisitor {
  /** Called on the way down. Return `{skipSubtree:true}` to prune this subtree (for THIS visitor only). */
  enter(fiber: FiberNode): VisitorResult | void;
  /** Optional: called on the way back up, after the subtree is done. */
  exit?(fiber: FiberNode): void;
}

export interface WalkOptions {
  /** Wall-clock deadline (same units as `now()`); the walk yields once passed. */
  deadline?: number;
  now?: () => number;
  /** Resume: skip the first `startAt` entered nodes (from a prior yielded walk). */
  startAt?: number;
  /** Hard cap on nodes visited (guards pathological trees). */
  maxNodes?: number;
}

export interface WalkResult {
  completed: boolean;
  /** Total nodes entered this call (add to the prior `startAt` to resume). */
  visited: number;
}

interface VisitorState {
  visitor: FiberVisitor;
  /** Depth at which this visitor pruned; it is inactive until the walk pops back above it. */
  prunedAtDepth: number | null;
  alive: boolean;
}

/**
 * Depth-first walk `root`'s subtree, driving every visitor. Returns whether the
 * walk completed and how many nodes were entered.
 */
export function walkFiber(root: FiberNode | null, visitors: FiberVisitor[], opts: WalkOptions = {}): WalkResult {
  if (!root || visitors.length === 0) return { completed: true, visited: 0 };
  const now = opts.now ?? (() => 0);
  const deadline = opts.deadline;
  const startAt = opts.startAt ?? 0;
  const maxNodes = opts.maxNodes ?? Number.POSITIVE_INFINITY;

  const states: VisitorState[] = visitors.map((visitor) => ({ visitor, prunedAtDepth: null, alive: true }));
  let entered = 0; // total nodes entered (including skipped-for-resume)

  // Explicit stack to avoid recursion depth limits on deep trees.
  // Each frame: fiber + depth + phase ('enter'|'exit').
  const stack: Array<{ fiber: FiberNode; depth: number; phase: 'enter' | 'exit' }> = [
    { fiber: root, depth: 0, phase: 'enter' },
  ];

  while (stack.length > 0) {
    if (deadline !== undefined && now() > deadline) return { completed: false, visited: entered - startAt < 0 ? 0 : entered - startAt };
    if (entered - startAt >= maxNodes) return { completed: false, visited: entered - startAt };

    const frame = stack[stack.length - 1];
    const { fiber, depth, phase } = frame;

    if (phase === 'exit') {
      stack.pop();
      for (const st of states) {
        if (st.prunedAtDepth === depth) st.prunedAtDepth = null; // un-prune on the way up
        if (st.alive && st.prunedAtDepth === null && st.visitor.exit) {
          try {
            st.visitor.exit(fiber);
          } catch {
            st.alive = false;
          }
        }
      }
      continue;
    }

    // phase === 'enter'
    entered++;
    frame.phase = 'exit'; // process children next, then this frame flips to exit
    const skipResume = entered <= startAt;

    if (!skipResume) {
      for (const st of states) {
        if (!st.alive || st.prunedAtDepth !== null) continue;
        try {
          const res = st.visitor.enter(fiber);
          if (res && res.skipSubtree) st.prunedAtDepth = depth;
        } catch {
          st.alive = false;
        }
      }
    }

    // Push children (reverse order so first child is processed first).
    const children: FiberNode[] = [];
    let child: FiberNode | null = fiber.child;
    while (child) {
      children.push(child);
      child = child.sibling;
    }
    for (let i = children.length - 1; i >= 0; i--) {
      stack.push({ fiber: children[i], depth: depth + 1, phase: 'enter' });
    }
  }

  return { completed: true, visited: entered - startAt };
}
