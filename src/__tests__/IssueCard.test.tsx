import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { IssueCard } from '../panel/components/IssueCard';
import type { Issue } from '../types';

const mockErrorIssue: Issue = {
  id: 'issue-1',
  type: 'MISSING_KEY',
  severity: 'error',
  component: 'UserList',
  message: 'List items are missing key props which can cause incorrect rendering',
  suggestion: 'Add a unique key prop to each list item',
  code: 'items.map(item => <Item key={item.id} {...item} />)',
  timestamp: Date.now(),
  location: {
    componentName: 'UserList',
    componentPath: ['App', 'Dashboard', 'UserList'],
    elementType: 'li',
    childElements: [
      { type: 'li', key: null, index: 0 },
      { type: 'li', key: null, index: 1 },
      { type: 'li', key: null, index: 2 },
    ],
  },
};

const mockWarningIssue: Issue = {
  id: 'issue-2',
  type: 'EXCESSIVE_RERENDERS',
  severity: 'warning',
  component: 'Counter',
  message: 'Rendered 25 times in the last second',
  suggestion: 'Use React.memo() or useMemo() to optimize',
  timestamp: Date.now(),
};

const mockInfoIssue: Issue = {
  id: 'issue-3',
  type: 'DEV_MODE_IN_PROD',
  severity: 'info',
  component: 'App',
  message: 'React is running in development mode',
  suggestion: 'Use production build for better performance',
  timestamp: Date.now(),
};

const mockStaleClosureIssue: Issue = {
  id: 'issue-4',
  type: 'STALE_CLOSURE',
  severity: 'error',
  component: 'Timer',
  message: 'Callback is using stale closure values',
  suggestion: 'Use useRef or add dependencies to useCallback',
  timestamp: Date.now(),
  location: {
    componentName: 'Timer',
    componentPath: ['App', 'Timer'],
    closureInfo: {
      functionName: 'handleTick',
      createdAtRender: 1,
      executedAtRender: 10,
      capturedValues: [
        { name: 'count', capturedValue: 0, currentValue: 9 },
        { name: 'isRunning', capturedValue: true, currentValue: false },
      ],
      asyncType: 'setInterval',
    },
  },
};

describe('IssueCard', () => {
  describe('Header Display', () => {
    it('displays issue title', () => {
      render(<IssueCard issue={mockErrorIssue} />);
      expect(screen.getByText('Missing Key in List')).toBeInTheDocument();
    });

    it('displays component name', () => {
      render(<IssueCard issue={mockErrorIssue} />);
      expect(screen.getByText('UserList')).toBeInTheDocument();
    });

    it('displays element type when available', () => {
      render(<IssueCard issue={mockErrorIssue} />);
      expect(screen.getByText('li')).toBeInTheDocument();
    });

    it('shows render count badge for excessive rerenders', () => {
      render(<IssueCard issue={mockWarningIssue} />);
      expect(screen.getByText('25×')).toBeInTheDocument();
    });
  });

  describe('Severity Badge', () => {
    it('displays error severity badge', () => {
      render(<IssueCard issue={mockErrorIssue} />);
      expect(screen.getByText('Error')).toBeInTheDocument();
    });

    it('displays warning severity badge', () => {
      render(<IssueCard issue={mockWarningIssue} />);
      expect(screen.getByText('Warning')).toBeInTheDocument();
    });

    it('displays info severity badge', () => {
      render(<IssueCard issue={mockInfoIssue} />);
      expect(screen.getByText('Info')).toBeInTheDocument();
    });
  });

  describe('Expansion', () => {
    it('shows expand button', () => {
      render(<IssueCard issue={mockErrorIssue} />);
      expect(screen.getByRole('button', { name: '▶' })).toBeInTheDocument();
    });

    it('expands when header is clicked', () => {
      render(<IssueCard issue={mockErrorIssue} />);
      
      const expandButton = screen.getByRole('button', { name: '▶' });
      fireEvent.click(expandButton);
      
      expect(screen.getByText('▼')).toBeInTheDocument();
    });

    it('shows message when expanded', () => {
      render(<IssueCard issue={mockErrorIssue} />);
      
      const header = screen.getByText('Missing Key in List').closest('.issue-header');
      if (header) fireEvent.click(header);
      
      expect(screen.getByText(/List items are missing key props/)).toBeInTheDocument();
    });

    it('shows suggestion when expanded', () => {
      render(<IssueCard issue={mockErrorIssue} />);
      
      const header = screen.getByText('Missing Key in List').closest('.issue-header');
      if (header) fireEvent.click(header);
      
      expect(screen.getByText('💡 Suggestion:')).toBeInTheDocument();
      expect(screen.getByText(/Add a unique key prop/)).toBeInTheDocument();
    });
  });

  describe('Why This Matters Section', () => {
    it('displays why section when expanded', () => {
      render(<IssueCard issue={mockErrorIssue} />);
      
      const header = screen.getByText('Missing Key in List').closest('.issue-header');
      if (header) fireEvent.click(header);
      
      expect(screen.getByText('Why this matters:')).toBeInTheDocument();
    });
  });

  describe('Code Example', () => {
    it('displays code example when available', () => {
      render(<IssueCard issue={mockErrorIssue} />);
      
      const header = screen.getByText('Missing Key in List').closest('.issue-header');
      if (header) fireEvent.click(header);
      
      expect(screen.getByText('Example:')).toBeInTheDocument();
      expect(screen.getByText(/key={item.id}/)).toBeInTheDocument();
    });
  });

  describe('Affected Elements', () => {
    it('displays affected elements when available', () => {
      render(<IssueCard issue={mockErrorIssue} />);
      
      const header = screen.getByText('Missing Key in List').closest('.issue-header');
      if (header) fireEvent.click(header);
      
      expect(screen.getByText('Affected Elements:')).toBeInTheDocument();
    });

    it('shows element details', () => {
      render(<IssueCard issue={mockErrorIssue} />);
      
      const header = screen.getByText('Missing Key in List').closest('.issue-header');
      if (header) fireEvent.click(header);
      
      expect(screen.getByText('[0]')).toBeInTheDocument();
      expect(screen.getAllByText(/key=null|key="null"/).length).toBeGreaterThan(0);
    });
  });

  describe('Stale Closure Info', () => {
    it('displays closure timeline', () => {
      render(<IssueCard issue={mockStaleClosureIssue} />);
      
      const header = screen.getByText('Stale Closure Detected').closest('.issue-header');
      if (header) fireEvent.click(header);
      
      expect(screen.getByText('🔍 Closure Timeline:')).toBeInTheDocument();
    });

    it('shows created and executed render numbers', () => {
      render(<IssueCard issue={mockStaleClosureIssue} />);
      
      const header = screen.getByText('Stale Closure Detected').closest('.issue-header');
      if (header) fireEvent.click(header);
      
      expect(screen.getByText('Render #1')).toBeInTheDocument();
      expect(screen.getByText('Render #10')).toBeInTheDocument();
    });

    it('shows function name', () => {
      render(<IssueCard issue={mockStaleClosureIssue} />);
      
      const header = screen.getByText('Stale Closure Detected').closest('.issue-header');
      if (header) fireEvent.click(header);
      
      expect(screen.getByText('handleTick()')).toBeInTheDocument();
    });

    it('shows async type', () => {
      render(<IssueCard issue={mockStaleClosureIssue} />);
      
      const header = screen.getByText('Stale Closure Detected').closest('.issue-header');
      if (header) fireEvent.click(header);
      
      expect(screen.getByText('setInterval')).toBeInTheDocument();
    });

    it('shows renders behind count', () => {
      render(<IssueCard issue={mockStaleClosureIssue} />);
      
      const header = screen.getByText('Stale Closure Detected').closest('.issue-header');
      if (header) fireEvent.click(header);
      
      expect(screen.getByText('9 render(s)')).toBeInTheDocument();
    });

    it('shows captured values', () => {
      render(<IssueCard issue={mockStaleClosureIssue} />);
      
      const header = screen.getByText('Stale Closure Detected').closest('.issue-header');
      if (header) fireEvent.click(header);
      
      expect(screen.getByText('Potentially stale variables:')).toBeInTheDocument();
      expect(screen.getByText('count')).toBeInTheDocument();
      expect(screen.getByText('isRunning')).toBeInTheDocument();
    });
  });

  describe('Learn More Link', () => {
    it('displays learn more link when available', () => {
      render(<IssueCard issue={mockErrorIssue} />);
      
      const header = screen.getByText('Missing Key in List').closest('.issue-header');
      if (header) fireEvent.click(header);
      
      expect(screen.getByText('📚 Learn more')).toBeInTheDocument();
    });

    it('link opens in new tab', () => {
      render(<IssueCard issue={mockErrorIssue} />);
      
      const header = screen.getByText('Missing Key in List').closest('.issue-header');
      if (header) fireEvent.click(header);
      
      const link = screen.getByText('📚 Learn more');
      expect(link.getAttribute('target')).toBe('_blank');
      expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    });
  });
});
