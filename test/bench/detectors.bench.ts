import { bench, describe } from 'vitest';
import { createReconcilerKeysDetector } from '../../src/inject/detectors/reconciler-keys';
import { createRegistry } from '../../src/inject/registry';
import type { FiberNode, FiberRoot } from '../../src/inject/react-adapters/types';
import { processWithinBudget, computeDeadline } from '../../src/inject/budget';

type TreeNode = { id: number; children: TreeNode[] };

function buildTree(depth: number, branching: number): TreeNode {
  if (depth === 0) return { id: depth, children: [] };
  return {
    id: depth,
    children: Array.from({ length: branching }, () => buildTree(depth - 1, branching)),
  };
}

function walkTree(node: TreeNode): number {
  return node.children.reduce((acc, child) => acc + walkTree(child), 1);
}

describe('detector harness — synthetic baseline', () => {
  const tree = buildTree(4, 4);

  bench('walk 1365-node tree', () => {
    walkTree(tree);
  });
});

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

/** A `<ul>` whose `count` `<li>` children carry the supplied keys. */
function makeListRoot(keys: string[]): FiberRoot {
  const parent = makeFiber({ type: 'ul', elementType: 'ul' });
  let prev: FiberNode | null = null;
  for (const key of keys) {
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

describe('reconciler-keys detector — commit cost', () => {
  // 1000 numeric-index children: worst-case Case-B path (every child inspected,
  // full key array compared against the previous commit).
  const keys = Array.from({ length: 1000 }, (_, i) => String(i));
  const rootA = makeListRoot(keys);
  const rootB = makeListRoot([...keys.slice(1), keys[0]]); // one rotation → reorder

  const detector = createReconcilerKeysDetector();
  const registry = createRegistry({
    emit: () => {},
    log: () => {},
    sanitize: (v) => v,
    performance: { now: () => 0 },
  });
  registry.register(detector);
  // Prime the previous-commit store so the benched dispatch exercises the
  // reorder-diff branch rather than the first-sighting early return.
  registry.dispatch({ fiberRoot: rootA });
  registry.drainAll();

  bench('onCommit over 1000-child keyed list (reorder diff)', () => {
    registry.dispatch({ fiberRoot: rootB });
    registry.drainAll();
  });
});

describe('M-C.2 budget allocator overhead', () => {
  const items = Array.from({ length: 1000 }, (_, i) => i);
  let now = 0;
  const clock = () => now++;

  // Full pass over a 1000-item commit with a generous deadline: measures the
  // allocator's per-commit overhead (target < 0.1ms/commit).
  bench('processWithinBudget over 1000 items (generous budget)', () => {
    now = 0;
    const deadline = computeDeadline(clock(), 1e9);
    processWithinBudget(items, 0, deadline, clock, () => {});
  });
});

import { parseHydrationError } from '../../src/inject/detectors/hydration-mismatch';
describe('M-C.4 hydration parse', () => {
  const msg = ['Warning: Text content did not match. Server: "Good morning" Client: "Good evening"', '\n    in Greeting'];
  bench('parseHydrationError on a hydration error', () => {
    parseHydrationError(msg);
  });
});

import { createContextCascadeDetector } from '../../src/inject/detectors/context-cascade';
describe('M-D.3 context-cascade commit cost', () => {
  const CTX = { displayName: 'Theme' };
  function tree(v: unknown) {
    const provider: any = { tag: 10, type: { _context: CTX }, memoizedProps: { value: v }, child: null, sibling: null, return: null, key: null };
    let prev: any = null;
    for (let i = 0; i < 20; i++) {
      const c: any = { tag: 0, dependencies: { firstContext: { context: CTX, next: null } }, return: provider, child: null, sibling: null, key: null };
      if (!prev) provider.child = c; else prev.sibling = c; prev = c;
    }
    const root: any = { tag: 3, type: 'root', child: provider, sibling: null, return: null, key: null };
    provider.return = root;
    return { current: root };
  }
  const d = createContextCascadeDetector();
  const reg = createRegistry({ emit: () => {}, log: () => {}, sanitize: (x) => x, performance: { now: () => 0 } });
  reg.register(d);
  reg.dispatch({ fiberRoot: tree({ a: 1 }) as any });
  reg.drainAll();
  bench('onCommit over provider + 20 consumers (ref changed)', () => {
    reg.dispatch({ fiberRoot: tree({ a: 2 }) as any });
    reg.drainAll();
  });
});
