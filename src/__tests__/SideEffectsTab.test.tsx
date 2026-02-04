import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SideEffectsTab } from '../panel/tabs/SideEffectsTab';
import type { Issue } from '../types';

const mockCleanupIssue: Issue = {
  id: 'issue-1',
  type: 'MISSING_CLEANUP',
  severity: 'warning',
  component: 'DataSubscriber',
  message: 'useEffect with subscription has no cleanup function',
  suggestion: 'Return a cleanup function that unsubscribes',
  code: 'useEffect(() => {\n  subscribe();\n  return () => unsubscribe(); // Add this\n}, []);',
  timestamp: Date.now(),
};

const mockDepIssue: Issue = {
  id: 'issue-2',
  type: 'MISSING_DEP',
  severity: 'warning',
  component: 'UserFetcher',
  message: 'Missing dependency: userId',
  suggestion: 'Add userId to the dependency array',
  timestamp: Date.now(),
};

const mockLoopIssue: Issue = {
  id: 'issue-3',
  type: 'INFINITE_LOOP_RISK',
  severity: 'error',
  component: 'Counter',
  message: 'This effect may cause infinite re-renders',
  suggestion: 'Add proper guards or use useRef for mutable values',
  timestamp: Date.now(),
};

const mockStaleClosureIssue: Issue = {
  id: 'issue-4',
  type: 'STALE_CLOSURE',
  severity: 'error',
  component: 'Timer',
  message: 'Callback using stale value of count',
  suggestion: 'Use a ref or update callback dependencies',
  timestamp: Date.now(),
  location: {
    componentName: 'Timer',
    componentPath: ['App', 'Timer'],
    closureInfo: {
      functionName: 'handleClick',
      createdAtRender: 1,
      executedAtRender: 5,
      capturedValues: [{ name: 'count', capturedValue: 0, currentValue: 4 }],
      asyncType: 'setTimeout',
    },
  },
};

const mockSideEffectIssues: Issue[] = [
  mockCleanupIssue,
  mockDepIssue,
  mockLoopIssue,
  mockStaleClosureIssue,
];

describe('SideEffectsTab', () => {
  describe('Rendering', () => {
    it('renders tab header correctly', () => {
      render(<SideEffectsTab issues={[]} />);
      expect(screen.getByText('🔄 Side Effects Analysis')).toBeInTheDocument();
    });

    it('displays empty state when no issues', () => {
      render(<SideEffectsTab issues={[]} />);
      expect(screen.getByText('No side effect issues detected')).toBeInTheDocument();
      expect(screen.getByText('Your useEffect hooks look good!')).toBeInTheDocument();
    });

    it('displays issue count correctly', () => {
      render(<SideEffectsTab issues={mockSideEffectIssues} />);
      expect(screen.getByText('4 issues')).toBeInTheDocument();
    });
  });

  describe('Issue Sections', () => {
    it('shows missing cleanup section', () => {
      render(<SideEffectsTab issues={mockSideEffectIssues} />);
      expect(screen.getByText('⚠️ Missing Cleanup (1)')).toBeInTheDocument();
    });

    it('shows dependency issues section', () => {
      render(<SideEffectsTab issues={mockSideEffectIssues} />);
      expect(screen.getByText('📋 Dependency Issues (1)')).toBeInTheDocument();
    });

    it('shows infinite loop risk section', () => {
      render(<SideEffectsTab issues={mockSideEffectIssues} />);
      expect(screen.getByText('🔴 Infinite Loop Risk (1)')).toBeInTheDocument();
    });

    it('shows stale closures section', () => {
      render(<SideEffectsTab issues={mockSideEffectIssues} />);
      expect(screen.getByText('🔒 Stale Closures (1)')).toBeInTheDocument();
    });
  });

  describe('Issue Cards', () => {
    it('displays component name in issue card', () => {
      render(<SideEffectsTab issues={mockSideEffectIssues} />);
      expect(screen.getByText('DataSubscriber')).toBeInTheDocument();
      expect(screen.getByText('UserFetcher')).toBeInTheDocument();
    });

    it('expands issue card when clicked', () => {
      render(<SideEffectsTab issues={[mockCleanupIssue]} />);
      
      const issueHeader = screen.getByRole('button', { name: /▶/ });
      fireEvent.click(issueHeader);
      
      expect(screen.getByText(/useEffect with subscription/)).toBeInTheDocument();
    });

    it('displays code example when available', () => {
      render(<SideEffectsTab issues={[mockCleanupIssue]} />);
      
      const issueHeader = screen.getByRole('button', { name: /▶/ });
      fireEvent.click(issueHeader);
      
      expect(screen.getByText(/subscribe\(\)/)).toBeInTheDocument();
    });
  });

  describe('Stale Closure Details', () => {
    it('displays closure timeline', () => {
      render(<SideEffectsTab issues={[mockStaleClosureIssue]} />);
      
      const issueHeader = screen.getByRole('button', { name: /▶/ });
      fireEvent.click(issueHeader);
      
      expect(screen.getByText('🔍 Closure Timeline:')).toBeInTheDocument();
    });

    it('shows render numbers', () => {
      render(<SideEffectsTab issues={[mockStaleClosureIssue]} />);
      
      const issueHeader = screen.getByRole('button', { name: /▶/ });
      fireEvent.click(issueHeader);
      
      expect(screen.getByText('Render #1')).toBeInTheDocument();
      expect(screen.getByText('Render #5')).toBeInTheDocument();
    });

    it('shows captured values', () => {
      render(<SideEffectsTab issues={[mockStaleClosureIssue]} />);
      
      const issueHeader = screen.getByRole('button', { name: /▶/ });
      fireEvent.click(issueHeader);
      
      expect(screen.getByText('count')).toBeInTheDocument();
    });
  });

  describe('Issue Filtering', () => {
    it('only shows side effect related issues', () => {
      const mixedIssues: Issue[] = [
        ...mockSideEffectIssues,
        {
          id: 'ui-issue',
          type: 'MISSING_KEY',
          severity: 'error',
          component: 'List',
          message: 'Missing key',
          suggestion: 'Add key prop',
          timestamp: Date.now(),
        },
      ];

      render(<SideEffectsTab issues={mixedIssues} />);
      expect(screen.getByText('4 issues')).toBeInTheDocument();
    });
  });

  describe('Best Practices Section', () => {
    it('displays best practices', () => {
      render(<SideEffectsTab issues={[]} />);
      expect(screen.getByText('💡 Best Practices')).toBeInTheDocument();
    });

    it('shows specific tips', () => {
      render(<SideEffectsTab issues={[]} />);
      expect(screen.getByText(/Always return a cleanup function/)).toBeInTheDocument();
      expect(screen.getByText(/Include all variables used inside the effect/)).toBeInTheDocument();
    });
  });
});
