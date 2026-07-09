import { bench, describe } from 'vitest';
import { createReconcilerKeysDetector } from '../../src/inject/detectors/reconciler-keys';
import { createRegistry } from '../../src/inject/registry';
import type { FiberNode, FiberRoot } from '../../src/inject/react-adapters/types';

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
