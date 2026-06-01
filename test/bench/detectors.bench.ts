import { bench, describe } from 'vitest';

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
