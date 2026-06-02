/**
 * reconciler-keys detector (M-B T7, hero #1)
 *
 * Dynamic, cross-commit list-key analysis built on the T1 Detector contract
 * and T3 React version adapter. Complementary to the legacy `checkListKeys`
 * in `src/inject/index.ts` (which only does single-shot shape detection of
 * MISSING_KEY / INDEX_AS_KEY).
 *
 * Two signals, both emitted as `UNSTABLE_LIST_KEY` issues:
 *
 *   1. Unstable key signature (Case A) — flagged on the FIRST commit.
 *      A child key matches either:
 *        - /^[0-9]{10,}/    → Date.now() / Date.now()+suffix style
 *        - /^0\.[0-9]{6,}/  → Math.random() style ("0.xxxxxx" decimals)
 *
 *   2. Index keys + verified reorder (Case B) — flagged on the SECOND+ commit.
 *      All children have purely numeric keys (`/^\d+$/`), AND the ordering
 *      of those keys changed from the previous commit recorded via
 *      `ctx.write('lastList:' + parentPath, [...])`.
 *
 * Per-parent dedupe via `ctx.dedupe(parentComponentPath)` so a single noisy
 * list does not flood the panel.
 *
 * Cross-commit state lives in `ctx.write` / `ctx.read` — the registry owns
 * the persistent store; this detector treats it purely as an opaque K/V.
 *
 * The walk uses `walkFiberImpl` from `react-adapters/utils.ts`. We do NOT
 * re-implement fiber traversal.
 */
import type { Detector, DetectorContext } from '../../types/registry';
import type { Issue } from '../../types';
import type { FiberNode, FiberRoot, ReactVersionAdapter } from '../react-adapters/types';
import { walkFiberImpl } from '../react-adapters/utils';
import { getAdapter } from '../react-adapters';

const DATE_NOW_KEY_RE = /^[0-9]{10,}/;          // 10+ digit prefix (ms since epoch)
const MATH_RANDOM_KEY_RE = /^0\.[0-9]{6,}/;      // 0.xxxxxx decimal
const NUMERIC_INDEX_KEY_RE = /^\d+$/;

const STORE_PREFIX = 'lastList:';

interface ListChild {
  key: string;
  index: number;
}

function isUnstableKey(key: string): boolean {
  return DATE_NOW_KEY_RE.test(key) || MATH_RANDOM_KEY_RE.test(key);
}

function buildComponentPath(fiber: FiberNode | null, adapter: ReactVersionAdapter): string[] {
  const path: string[] = [];
  let limit = 50; // guard against pathological return-chains
  let cur: FiberNode | null = fiber;
  while (cur !== null && limit-- > 0) {
    const name = adapter.getDisplayName(cur);
    if (name) path.unshift(name);
    cur = cur.return;
  }
  return path;
}

function generateIssueId(seq: number): string {
  // Avoid Math.random for determinism in tests; collision risk is acceptable
  // because the registry tracks dedupe separately.
  return `reconciler-keys-${Date.now()}-${seq}`;
}

export function createReconcilerKeysDetector(): Detector<Issue> {
  let ctx: DetectorContext | null = null;
  let adapter: ReactVersionAdapter | null = null;
  let buffer: Issue[] = [];
  let issueSeq = 0;

  function emitIssue(issue: Issue): void {
    buffer.push(issue);
  }

  function processListParent(
    parent: FiberNode,
    children: ListChild[],
    context: DetectorContext,
    ad: ReactVersionAdapter,
  ): void {
    const parentName = ad.getDisplayName(parent) ?? 'Anonymous';
    const componentPath = buildComponentPath(parent, ad);
    const dedupeKey = componentPath.length > 0 ? componentPath.join('/') : parentName;

    const keys = children.map((c) => c.key);

    // Case A: any child has an unstable key signature — emit immediately.
    const hasUnstable = keys.some(isUnstableKey);
    if (hasUnstable) {
      if (!context.dedupe(dedupeKey)) return;
      emitIssue({
        id: generateIssueId(++issueSeq),
        type: 'UNSTABLE_LIST_KEY',
        severity: 'warning',
        component: parentName,
        message:
          'List children use unstable keys (auto-fix: use a stable id field)',
        suggestion:
          'Replace key={index|Math.random()|Date.now()} with key={item.id} or another stable identifier',
        timestamp: Date.now(),
        fiberId: dedupeKey,
        location: { componentName: parentName, componentPath },
      });
      return;
    }

    // Case B: numeric-index keys + verified reorder across commits.
    const allNumericIndex = keys.every((k) => NUMERIC_INDEX_KEY_RE.test(k));
    if (!allNumericIndex) {
      // Nothing to track — record current state opportunistically so a later
      // mutation to index keys can still be diff'd, but no emission.
      return;
    }

    const storeKey = STORE_PREFIX + dedupeKey;
    const prev = context.read<string[]>(storeKey);
    // Always stage current keys for next commit (regardless of emission).
    context.write<string[]>(storeKey, keys.slice());

    if (prev === undefined) {
      // First sighting — cannot detect reorder yet.
      return;
    }
    if (prev.length !== keys.length) {
      // Length change is membership change, not a reorder signal.
      return;
    }
    if (JSON.stringify(prev) === JSON.stringify(keys)) {
      // Same order — quiet.
      return;
    }
    // Order changed AND keys remain purely numeric → emit.
    if (!context.dedupe(dedupeKey)) return;
    emitIssue({
      id: generateIssueId(++issueSeq),
      type: 'UNSTABLE_LIST_KEY',
      severity: 'warning',
      component: parentName,
      message:
        'Index keys with detected reorder (auto-fix: use a stable id field)',
      suggestion:
        'Replace key={index|Math.random()|Date.now()} with key={item.id} or another stable identifier',
      timestamp: Date.now(),
      fiberId: dedupeKey,
      location: { componentName: parentName, componentPath },
    });
  }

  return {
    id: 'reconciler-keys',
    category: 'ui-state',
    budgetMs: 0.3,
    confidence: 'high',
    prodCapable: true,

    init(injected: DetectorContext): void {
      ctx = injected;
      // Bind the adapter once. `getAdapter()` is safe in test environments
      // (it falls back to r17Adapter when no React is on the page).
      try {
        adapter = getAdapter();
      } catch {
        adapter = null;
      }
    },

    onCommit(fiberRoot: unknown, deadline: number): void {
      const context = ctx;
      const ad = adapter;
      if (context === null || ad === null) return;
      const root = fiberRoot as FiberRoot | null;
      if (!root || !root.current) return;

      walkFiberImpl(root.current, (fiber) => {
        // Cheap deadline check — performance.now() is also cheap, but bail
        // out without doing the per-list work when we're already over.
        if (context.performance.now() > deadline) return;

        // Collect KEYED children of this fiber. A "list parent" is any fiber
        // with >= 2 children that all carry explicit keys.
        let child: FiberNode | null = fiber.child;
        const keyed: ListChild[] = [];
        let index = 0;
        let hasUnkeyed = false;
        while (child !== null) {
          if (child.key !== null && child.key !== undefined) {
            keyed.push({ key: String(child.key), index });
          } else if (keyed.length > 0) {
            // Mixed keyed + unkeyed siblings — punt; this is the legacy
            // checkListKeys territory (MISSING_KEY).
            hasUnkeyed = true;
          }
          index++;
          child = child.sibling;
        }
        if (hasUnkeyed) return;
        if (keyed.length < 2) return;

        processListParent(fiber, keyed, context, ad);
      });
    },

    drain(): Issue[] {
      const out = buffer;
      buffer = [];
      return out;
    },

    teardown(): void {
      buffer = [];
      issueSeq = 0;
      ctx = null;
      adapter = null;
    },
  };
}

/** Singleton export for convenience — most callers use this directly. */
export const reconcilerKeysDetector = createReconcilerKeysDetector();
