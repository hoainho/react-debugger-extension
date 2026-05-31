/**
 * Shared utilities for all React version adapters.
 * These operations are STABLE across r17–r19.2 — no version branching needed here.
 */

import type { FiberNode, FiberHook } from './types';

/**
 * Walk a fiber tree depth-first, calling visitor on each node.
 * Uses fiber.child (descend) and fiber.sibling (breadth iteration).
 *
 * fiber.child / fiber.sibling / fiber.return have been stable since React 16.
 * Source: https://github.com/facebook/react/blob/05ca66ad9c/packages/react-reconciler/src/ReactFiber.js
 *
 * Limits: max 5000 nodes to prevent infinite loops on pathological trees.
 * Never throws — silently skips unreachable fibers.
 */
export function walkFiberImpl(
  root: FiberNode,
  visitor: (fiber: FiberNode) => void,
  maxNodes = 5000,
): void {
  let count = 0;
  // Iterative DFS using an explicit stack to avoid call-stack overflow on deep trees
  const stack: FiberNode[] = [root];

  while (stack.length > 0 && count < maxNodes) {
    const fiber = stack.pop()!;
    count++;

    try {
      visitor(fiber);
    } catch {
      // visitor errors must not abort the walk
    }

    // Push sibling first so child is processed before sibling (DFS pre-order)
    if (fiber.sibling !== null) stack.push(fiber.sibling);
    if (fiber.child !== null) stack.push(fiber.child);
  }
}

/**
 * Walk the memoizedState linked list of a function component fiber
 * and return all Hook structs as an array.
 *
 * The Hook struct shape is STABLE across r17–r19.2:
 *   { memoizedState, baseState, baseQueue, queue, next }
 * Source: https://github.com/facebook/react/blob/v17.0.2/packages/react-reconciler/src/ReactFiberHooks.old.js
 *         https://github.com/facebook/react/blob/05ca66ad9c/packages/react-reconciler/src/ReactFiberHooks.js#L194
 *
 * NOTE: memoizedState SEMANTICS vary by hook type — this returns raw structs only.
 *   useState/useReducer: hook.memoizedState = current value
 *   useRef:             hook.memoizedState = { current: ... }
 *   useMemo/useCallback: hook.memoizedState = [value, deps]
 *   useEffect:          hook.memoizedState = Effect object { tag, create, destroy, deps, next }
 *   useContext:         hook.memoizedState = context value (no queue)
 *
 * Returns [] for class components, host components, and anything without a
 * hook linked list.
 *
 * Never throws.
 */
export function walkHookLinkedList(firstHook: any): FiberHook[] {
  const hooks: FiberHook[] = [];
  if (firstHook === null || firstHook === undefined) return hooks;

  // Sanity check: a Hook must have a `next` property (may be null)
  // This distinguishes a Hook from arbitrary memoizedState objects (e.g. class component state)
  if (typeof firstHook !== 'object' || !('next' in firstHook)) return hooks;

  let current: FiberHook | null = firstHook as FiberHook;
  let limit = 1000; // guard against circular lists

  while (current !== null && limit-- > 0) {
    hooks.push(current);
    current = current.next;
  }

  return hooks;
}
