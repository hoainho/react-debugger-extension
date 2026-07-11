/**
 * IssueCard renders EVERY IssueType generically (S4-4).
 * Guards the card system: any current or new detector issue type (incl.
 * HYDRATION_MISMATCH / CONTEXT_CASCADE / STALE_CLOSURE_ASYNC) renders by
 * severity without a per-type branch — so new detectors need zero UI work.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { IssueCard } from '../panel/components/IssueCard';
import type { Issue, IssueType } from '../types';

const ALL_TYPES: IssueType[] = [
  'MISSING_KEY',
  'INDEX_AS_KEY',
  'MISSING_CLEANUP',
  'MISSING_DEP',
  'INFINITE_LOOP_RISK',
  'EXCESSIVE_RERENDERS',
  'STALE_CLOSURE',
  'STALE_CLOSURE_RISK',
  'SLOW_RENDER',
  'MEMORY_GROWTH',
  'POTENTIAL_MEMORY_LEAK',
  'UNSTABLE_LIST_KEY',
  'HYDRATION_MISMATCH',
  'CONTEXT_CASCADE',
  'STALE_CLOSURE_ASYNC',
];

function issueOf(type: IssueType): Issue {
  return {
    id: `id-${type}`,
    type,
    severity: 'warning',
    component: 'Widget',
    message: `message for ${type}`,
    timestamp: 0,
  } as Issue;
}

describe('IssueCard — generic rendering for all IssueTypes', () => {
  it('renders a card for each type without crashing (generic, no per-type branch required)', () => {
    for (const type of ALL_TYPES) {
      const { container, unmount } = render(<IssueCard issue={issueOf(type)} />);
      expect(container.querySelector('.issue-card')).toBeTruthy();
      expect(screen.getByText('Widget')).toBeInTheDocument(); // component shown collapsed
      unmount();
    }
  });

  it('reflects severity in the card class for the new M-C/M-D issue types', () => {
    for (const type of ['HYDRATION_MISMATCH', 'CONTEXT_CASCADE', 'STALE_CLOSURE_ASYNC'] as IssueType[]) {
      const { container, unmount } = render(<IssueCard issue={{ ...issueOf(type), severity: 'error' }} />);
      expect(container.querySelector('.severity-error')).toBeTruthy();
      unmount();
    }
  });
});
