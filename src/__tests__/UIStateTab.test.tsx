import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { UIStateTab } from '../panel/tabs/UIStateTab';
import type { Issue } from '../types';

const mockUIIssues: Issue[] = [
  {
    id: 'issue-1',
    type: 'MISSING_KEY',
    severity: 'error',
    component: 'UserList',
    message: 'List items are missing key props',
    suggestion: 'Add unique key prop to each list item',
    timestamp: Date.now(),
    location: {
      componentName: 'UserList',
      componentPath: ['App', 'Dashboard', 'UserList'],
      elementType: 'li',
      listLength: 10,
      childElements: [
        { type: 'li', key: null, index: 0 },
        { type: 'li', key: null, index: 1 },
        { type: 'li', key: null, index: 2 },
      ],
    },
  },
  {
    id: 'issue-2',
    type: 'INDEX_AS_KEY',
    severity: 'warning',
    component: 'ProductGrid',
    message: 'Using index as key is not recommended',
    suggestion: 'Use a unique identifier from your data',
    timestamp: Date.now(),
    location: {
      componentName: 'ProductGrid',
      componentPath: ['App', 'Store', 'ProductGrid'],
      elementType: 'div',
      childElements: [
        { type: 'div', key: '0', index: 0 },
        { type: 'div', key: '1', index: 1 },
      ],
    },
  },
  {
    id: 'issue-3',
    type: 'MISSING_KEY',
    severity: 'error',
    component: 'Counter',
    message: 'Counter list items are missing key props',
    suggestion: 'Add unique key prop to each counter item',
    timestamp: Date.now(),
  },
];

describe('UIStateTab', () => {
  const mockOnClear = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders tab header correctly', () => {
      render(<UIStateTab issues={[]} onClear={mockOnClear} />);
      expect(screen.getByText('UI & State Issues')).toBeInTheDocument();
    });

    it('displays empty state when no issues', () => {
      const { container } = render(<UIStateTab issues={[]} onClear={mockOnClear} />);
      expect(screen.getByText('No UI or state issues detected')).toBeInTheDocument();
      expect(container.querySelector('.empty-state-icon--check')).toBeTruthy();
    });

    it('displays issue count correctly', () => {
      render(<UIStateTab issues={mockUIIssues} onClear={mockOnClear} />);
      expect(screen.getByText('3 issues')).toBeInTheDocument();
    });

    it('displays singular issue text for single issue', () => {
      render(<UIStateTab issues={[mockUIIssues[0]]} onClear={mockOnClear} />);
      expect(screen.getByText('1 issue')).toBeInTheDocument();
    });
  });

  describe('Issue Filtering', () => {
    it('only shows UI/State related issues', () => {
      const mixedIssues: Issue[] = [
        ...mockUIIssues,
        {
          id: 'perf-issue',
          type: 'EXCESSIVE_RERENDERS',
          severity: 'warning',
          component: 'App',
          message: 'Too many renders',
          suggestion: 'Use memo',
          timestamp: Date.now(),
        },
      ];

      render(<UIStateTab issues={mixedIssues} onClear={mockOnClear} />);
      expect(screen.getByText('3 issues')).toBeInTheDocument();
    });

    it('filters MISSING_KEY issues', () => {
      render(<UIStateTab issues={mockUIIssues} onClear={mockOnClear} />);
      expect(screen.getAllByText('Missing Key in List').length).toBeGreaterThan(0);
    });

    it('filters INDEX_AS_KEY issues', () => {
      render(<UIStateTab issues={mockUIIssues} onClear={mockOnClear} />);
      expect(screen.getByText('Index Used as Key')).toBeInTheDocument();
    });

    it('filters MISSING_KEY issues (from multiple fixtures)', () => {
      const singleIssue = [mockUIIssues[0]];
      render(<UIStateTab issues={singleIssue} onClear={mockOnClear} />);
      expect(screen.getByText('Missing Key in List')).toBeInTheDocument();
    });
  });

  describe('Issue Cards', () => {
    it('displays component name in issue card', () => {
      render(<UIStateTab issues={mockUIIssues} onClear={mockOnClear} />);
      expect(screen.getByText('UserList')).toBeInTheDocument();
    });

    it('expands issue card when clicked', () => {
      render(<UIStateTab issues={mockUIIssues} onClear={mockOnClear} />);
      
      const issueHeaders = screen.getAllByRole('button', { name: /▶/ });
      fireEvent.click(issueHeaders[0]);
      
      expect(screen.getByText(/List items are missing key props/)).toBeInTheDocument();
    });

    it('displays severity badge correctly', () => {
      render(<UIStateTab issues={mockUIIssues} onClear={mockOnClear} />);
      
      const errorBadges = screen.getAllByText('Error');
      const warningBadges = screen.getAllByText('Warning');
      
      expect(errorBadges.length).toBe(2);
      expect(warningBadges.length).toBe(1);
    });

    it('displays element type when available', () => {
      render(<UIStateTab issues={mockUIIssues} onClear={mockOnClear} />);
      expect(screen.getByText('li')).toBeInTheDocument();
    });
  });

  describe('Clear Button', () => {
    it('shows clear button when issues exist', () => {
      render(<UIStateTab issues={mockUIIssues} onClear={mockOnClear} />);
      expect(screen.getByText('Clear All')).toBeInTheDocument();
    });

    it('hides clear button when no issues', () => {
      render(<UIStateTab issues={[]} onClear={mockOnClear} />);
      expect(screen.queryByText('Clear All')).not.toBeInTheDocument();
    });

    it('calls onClear when clear button clicked', () => {
      render(<UIStateTab issues={mockUIIssues} onClear={mockOnClear} />);
      
      const clearButton = screen.getByText('Clear All');
      fireEvent.click(clearButton);
      
      expect(mockOnClear).toHaveBeenCalledTimes(1);
    });
  });
});
