import { describe, it, expect, beforeEach } from 'vitest';
import { createReconcilerKeysDetector } from '../inject/detectors/reconciler-keys';
import { createRegistry } from '../inject/registry';
import type { FiberNode, FiberRoot } from '../inject/react-adapters/types';
import type { Issue } from '../types';
import type { Detector } from '../types/registry';

const HOST_COMPONENT_TAG = 5;
const FUNCTION_COMPONENT_TAG = 0;

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

function makeListFiber(
  parentType: string,
  childKeys: Array<string | null>,
  childTag = HOST_COMPONENT_TAG,
  childType = 'li',
): FiberNode {
  const parent = makeFiber({ tag: HOST_COMPONENT_TAG, type: parentType, elementType: parentType });
  let prev: FiberNode | null = null;
  let first: FiberNode | null = null;
  for (const key of childKeys) {
    const child = makeFiber({
      tag: childTag,
      type: childType,
      elementType: childType,
      key,
      return: parent,
    });
    if (first === null) {
      first = child;
      parent.child = child;
    } else if (prev !== null) {
      prev.sibling = child;
    }
    prev = child;
  }
  return parent;
}

function makeRoot(parent: FiberNode): FiberRoot {
  // The detector calls `walkFiberImpl` from `root.current`, which visits the
  // root itself and then traverses .child/.sibling. We anchor at a host-root
  // whose only child is our list parent.
  const root = makeFiber({ tag: HOST_COMPONENT_TAG, type: 'root', elementType: 'root' });
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

describe('reconciler-keys detector', () => {
  let harness: ReturnType<typeof setupHarness>;
  beforeEach(() => {
    harness = setupHarness();
  });

  it('case 1: stable index keys with no reorder emits nothing', () => {
    const parent = makeListFiber('ul', ['0', '1', '2']);
    const root = makeRoot(parent);

    harness.dispatch(root);
    harness.dispatch(root);
    const issues = harness.drain();

    expect(issues).toHaveLength(0);
  });

  it('case 2: index keys + reorder emits UNSTABLE_LIST_KEY', () => {
    const root1 = makeRoot(makeListFiber('ul', ['0', '1', '2']));
    harness.dispatch(root1);

    const root2 = makeRoot(makeListFiber('ul', ['2', '0', '1']));
    harness.dispatch(root2);

    const issues = harness.drain();
    expect(issues).toHaveLength(1);
    expect(issues[0].type).toBe('UNSTABLE_LIST_KEY');
    expect(issues[0].severity).toBe('warning');
    expect(issues[0].message).toMatch(/Index keys with detected reorder/);
    expect(issues[0].component).toBe('ul');
  });

  it('case 3: Math.random()-style keys emit on first commit', () => {
    const parent = makeListFiber('ul', ['0.123456789', '0.987654321']);
    harness.dispatch(makeRoot(parent));

    const issues = harness.drain();
    expect(issues).toHaveLength(1);
    expect(issues[0].type).toBe('UNSTABLE_LIST_KEY');
    expect(issues[0].message).toMatch(/unstable keys/);
  });

  it('case 4: Date.now()-style keys emit on first commit', () => {
    const parent = makeListFiber('ul', ['1717180000000', '1717180000001']);
    harness.dispatch(makeRoot(parent));

    const issues = harness.drain();
    expect(issues).toHaveLength(1);
    expect(issues[0].type).toBe('UNSTABLE_LIST_KEY');
    expect(issues[0].message).toMatch(/unstable keys/);
  });

  it('case 5: stable string id keys emit nothing', () => {
    const parent = makeListFiber('ul', ['user-abc', 'user-def', 'user-ghi']);
    harness.dispatch(makeRoot(parent));
    harness.dispatch(makeRoot(makeListFiber('ul', ['user-ghi', 'user-abc', 'user-def'])));
    const issues = harness.drain();
    expect(issues).toHaveLength(0);
  });

  it('case 6: dedupe — repeated reorder on same parent emits only once', () => {
    harness.dispatch(makeRoot(makeListFiber('ul', ['0', '1', '2'])));
    harness.dispatch(makeRoot(makeListFiber('ul', ['2', '0', '1'])));
    harness.dispatch(makeRoot(makeListFiber('ul', ['1', '2', '0'])));
    harness.dispatch(makeRoot(makeListFiber('ul', ['0', '2', '1'])));

    const issues = harness.drain();
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toMatch(/reorder/);
  });

  it('detector metadata: confidence=high, category=ui-state, prodCapable=true, budgetMs=0.3', () => {
    expect(harness.detector.id).toBe('reconciler-keys');
    expect(harness.detector.category).toBe('ui-state');
    expect(harness.detector.confidence).toBe('high');
    expect(harness.detector.prodCapable).toBe(true);
    expect(harness.detector.budgetMs).toBe(0.3);
  });

  it('drained issues are cleared (drain is single-shot)', () => {
    harness.dispatch(makeRoot(makeListFiber('ul', ['0.111111', '0.222222'])));
    const first = harness.drain();
    expect(first).toHaveLength(1);
    const second = harness.drain();
    expect(second).toHaveLength(0);
  });

  it('emitted Issue carries the expected location shape', () => {
    const parent = makeListFiber('ol', ['0.111111', '0.222222']);
    harness.dispatch(makeRoot(parent));
    const [issue] = harness.drain();
    expect(issue.location).toBeDefined();
    expect(issue.location?.componentName).toBe('ol');
    expect(Array.isArray(issue.location?.componentPath)).toBe(true);
    expect(issue.suggestion).toMatch(/stable identifier/);
  });

  it('mixed unkeyed + keyed children are punted (no emission)', () => {
    const parent = makeFiber({ type: 'ul', elementType: 'ul' });
    const a = makeFiber({ key: '0', type: 'li', elementType: 'li', return: parent });
    const b = makeFiber({ key: null, type: 'li', elementType: 'li', return: parent });
    const c = makeFiber({ key: '2', type: 'li', elementType: 'li', return: parent });
    parent.child = a;
    a.sibling = b;
    b.sibling = c;

    harness.dispatch(makeRoot(parent));
    const issues = harness.drain();
    expect(issues).toHaveLength(0);
  });

  it('function-component list parent uses displayName for dedupe + component field', () => {
    function MyList(): null { return null; }
    const parent = makeFiber({
      tag: FUNCTION_COMPONENT_TAG,
      type: MyList,
      elementType: MyList,
    });
    const child1 = makeFiber({ tag: HOST_COMPONENT_TAG, type: 'li', elementType: 'li', key: '0.111111', return: parent });
    const child2 = makeFiber({ tag: HOST_COMPONENT_TAG, type: 'li', elementType: 'li', key: '0.222222', return: parent });
    parent.child = child1;
    child1.sibling = child2;

    harness.dispatch(makeRoot(parent));
    const issues = harness.drain();
    expect(issues).toHaveLength(1);
    expect(issues[0].component).toBe('MyList');
  });
});
