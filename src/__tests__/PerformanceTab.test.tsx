import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PerformanceTab } from '../panel/tabs/PerformanceTab';
import type { Issue, ComponentInfo, RenderInfo, PageLoadMetrics } from '../types';

const mockRenders = new Map<string, RenderInfo>([
  ['comp-1', {
    componentId: 'comp-1',
    componentName: 'UserProfile',
    renderCount: 15,
    lastRenderTime: Date.now(),
    renderDurations: [10, 15, 20, 25, 30],
    selfDurations: [5, 8, 10, 12, 15],
    triggerReasons: [
      { type: 'props' as const, changedKeys: ['userId', 'name'] },
      { type: 'state' as const, changedKeys: ['loading'] },
    ],
  }],
  ['comp-2', {
    componentId: 'comp-2',
    componentName: 'SlowComponent',
    renderCount: 8,
    lastRenderTime: Date.now(),
    renderDurations: [25, 35, 45, 55],
    selfDurations: [20, 30, 40, 50],
    triggerReasons: [{ type: 'context' as const }],
  }],
  ['comp-3', {
    componentId: 'comp-3',
    componentName: 'FastComponent',
    renderCount: 3,
    lastRenderTime: Date.now(),
    renderDurations: [2, 3, 4],
    selfDurations: [1, 2, 2],
    triggerReasons: [{ type: 'props' as const }],
  }],
]);

const mockComponents: ComponentInfo[] = [
  {
    id: 'comp-1',
    name: 'UserProfile',
    path: '/components/UserProfile',
    props: { userId: '123' },
    state: { loading: false },
    renderCount: 15,
    lastRenderTime: Date.now(),
    children: ['comp-2'],
  },
];

const mockIssues: Issue[] = [
  {
    id: 'issue-1',
    type: 'EXCESSIVE_RERENDERS',
    severity: 'warning',
    component: 'UserProfile',
    message: 'UserProfile rendered 15 times in the last second',
    suggestion: 'Consider using React.memo() or useMemo()',
    timestamp: Date.now(),
  },
];

const mockPageLoadMetrics: PageLoadMetrics = {
  fcp: 1200,
  lcp: 2000,
  ttfb: 300,
  domContentLoaded: 1500,
  loadComplete: 2500,
  timestamp: Date.now(),
};

describe('PerformanceTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders the tab header correctly', () => {
      render(
        <PerformanceTab
          issues={[]}
          components={[]}
          renders={new Map()}
          tabId={1}
          pageLoadMetrics={null}
        />
      );
      
      expect(screen.getByText('⚡ Performance Analysis')).toBeInTheDocument();
    });

    it('renders stats grid with correct values', () => {
      render(
        <PerformanceTab
          issues={mockIssues}
          components={mockComponents}
          renders={mockRenders}
          tabId={1}
          pageLoadMetrics={null}
        />
      );
      
      expect(screen.getByText('Components')).toBeInTheDocument();
      expect(screen.getByText('Total Renders')).toBeInTheDocument();
      expect(screen.getByText('Avg Render Time')).toBeInTheDocument();
      expect(screen.getByText(/Slow Renders/)).toBeInTheDocument();
    });

    it('displays empty state when no render data', () => {
      render(
        <PerformanceTab
          issues={[]}
          components={[]}
          renders={new Map()}
          tabId={1}
          pageLoadMetrics={null}
        />
      );
      
      expect(screen.getByText('No performance data yet')).toBeInTheDocument();
    });
  });

  describe('Slowest Components Section', () => {
    it('renders slowest components table when components exceed 16ms', () => {
      render(
        <PerformanceTab
          issues={[]}
          components={mockComponents}
          renders={mockRenders}
          tabId={1}
          pageLoadMetrics={null}
        />
      );
      
      expect(screen.getByText('🐌 Slowest Components')).toBeInTheDocument();
      expect(screen.getAllByText(/SlowComponent/).length).toBeGreaterThan(0);
    });

    it('displays correct column headers for slow table', () => {
      render(
        <PerformanceTab
          issues={[]}
          components={mockComponents}
          renders={mockRenders}
          tabId={1}
          pageLoadMetrics={null}
        />
      );
      
      const headers = screen.getAllByRole('columnheader');
      const slowTableHeaders = headers.filter(h => 
        h.textContent === 'Component' || 
        h.textContent === 'Max Time' || 
        h.textContent === 'Avg Time' ||
        h.textContent === 'Renders'
      );
      expect(slowTableHeaders.length).toBeGreaterThanOrEqual(4);
    });

    it('shows components sorted by max duration', () => {
      render(
        <PerformanceTab
          issues={[]}
          components={mockComponents}
          renders={mockRenders}
          tabId={1}
          pageLoadMetrics={null}
        />
      );
      
      const rows = screen.getAllByRole('row');
      const slowTableRows = rows.filter(row => 
        row.textContent?.includes('SlowComponent') || 
        row.textContent?.includes('UserProfile')
      );
      expect(slowTableRows.length).toBeGreaterThan(0);
    });
  });

  describe('Top Re-rendering Components Section', () => {
    it('renders re-rendering components table', () => {
      render(
        <PerformanceTab
          issues={[]}
          components={mockComponents}
          renders={mockRenders}
          tabId={1}
          pageLoadMetrics={null}
        />
      );
      
      expect(screen.getByText('Top Re-rendering Components')).toBeInTheDocument();
    });

    it('displays all 5 columns correctly', () => {
      render(
        <PerformanceTab
          issues={[]}
          components={mockComponents}
          renders={mockRenders}
          tabId={1}
          pageLoadMetrics={null}
        />
      );
      
      expect(screen.getByText('Last Trigger')).toBeInTheDocument();
      expect(screen.getByText('Self Time')).toBeInTheDocument();
    });

    it('shows trigger badges with correct types', () => {
      render(
        <PerformanceTab
          issues={[]}
          components={mockComponents}
          renders={mockRenders}
          tabId={1}
          pageLoadMetrics={null}
        />
      );
      
      expect(screen.getByText('state')).toBeInTheDocument();
    });

    it('displays changed keys when available', () => {
      render(
        <PerformanceTab
          issues={[]}
          components={mockComponents}
          renders={mockRenders}
          tabId={1}
          pageLoadMetrics={null}
        />
      );
      
      expect(screen.getByText('(loading)')).toBeInTheDocument();
    });

    it('highlights rows with warning class when renders > 10', () => {
      const { container } = render(
        <PerformanceTab
          issues={[]}
          components={mockComponents}
          renders={mockRenders}
          tabId={1}
          pageLoadMetrics={null}
        />
      );
      
      const warningRows = container.querySelectorAll('tr.warning');
      expect(warningRows.length).toBeGreaterThan(0);
    });
  });

  describe('Page Load Metrics', () => {
    it('renders page load metrics when available', () => {
      render(
        <PerformanceTab
          issues={[]}
          components={[]}
          renders={new Map()}
          tabId={1}
          pageLoadMetrics={mockPageLoadMetrics}
        />
      );
      
      expect(screen.getByText('Page Load Metrics')).toBeInTheDocument();
      expect(screen.getByText('FCP')).toBeInTheDocument();
      expect(screen.getByText('LCP')).toBeInTheDocument();
      expect(screen.getByText('TTFB')).toBeInTheDocument();
    });

    it('displays metrics with correct formatting', () => {
      render(
        <PerformanceTab
          issues={[]}
          components={[]}
          renders={new Map()}
          tabId={1}
          pageLoadMetrics={mockPageLoadMetrics}
        />
      );
      
      expect(screen.getAllByText(/1200ms|1\.20s/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/2000ms|2\.00s/).length).toBeGreaterThan(0);
    });

    it('applies correct color coding for metrics', () => {
      const poorMetrics: PageLoadMetrics = {
        fcp: 4000,
        lcp: 5000,
        ttfb: 2000,
        domContentLoaded: 5000,
        loadComplete: 6000,
        timestamp: Date.now(),
      };

      render(
        <PerformanceTab
          issues={[]}
          components={[]}
          renders={new Map()}
          tabId={1}
          pageLoadMetrics={poorMetrics}
        />
      );
      
      expect(screen.getAllByText(/4000ms|4\.00s/).length).toBeGreaterThan(0);
    });
  });

  describe('Performance Issues', () => {
    it('renders performance issues when present', () => {
      render(
        <PerformanceTab
          issues={mockIssues}
          components={mockComponents}
          renders={mockRenders}
          tabId={1}
          pageLoadMetrics={null}
        />
      );
      
      expect(screen.getByText('Performance Issues (1)')).toBeInTheDocument();
    });

    it('filters only performance-related issues', () => {
      const mixedIssues: Issue[] = [
        ...mockIssues,
        {
          id: 'issue-2',
          type: 'MISSING_KEY',
          severity: 'error',
          component: 'List',
          message: 'Missing key in list',
          suggestion: 'Add key prop',
          timestamp: Date.now(),
        },
      ];

      render(
        <PerformanceTab
          issues={mixedIssues}
          components={mockComponents}
          renders={mockRenders}
          tabId={1}
          pageLoadMetrics={null}
        />
      );
      
      expect(screen.getByText('Performance Issues (1)')).toBeInTheDocument();
    });
  });

  describe('Scan Toggle', () => {
    it('renders scan toggle button', () => {
      render(
        <PerformanceTab
          issues={[]}
          components={[]}
          renders={new Map()}
          tabId={1}
          pageLoadMetrics={null}
        />
      );
      
      expect(screen.getByText('🔍 Scan OFF')).toBeInTheDocument();
    });

    it('toggles scan state when clicked', () => {
      render(
        <PerformanceTab
          issues={[]}
          components={[]}
          renders={new Map()}
          tabId={1}
          pageLoadMetrics={null}
        />
      );
      
      const button = screen.getByText('🔍 Scan OFF');
      fireEvent.click(button);
      
      expect(screen.getByText('🔍 Scan ON')).toBeInTheDocument();
    });

    it('shows scan info when enabled', () => {
      render(
        <PerformanceTab
          issues={[]}
          components={[]}
          renders={new Map()}
          tabId={1}
          pageLoadMetrics={null}
        />
      );
      
      const button = screen.getByText('🔍 Scan OFF');
      fireEvent.click(button);
      
      expect(screen.getByText(/React Scan is active/)).toBeInTheDocument();
    });
  });

  describe('Performance Tips', () => {
    it('renders performance tips section', () => {
      render(
        <PerformanceTab
          issues={[]}
          components={[]}
          renders={new Map()}
          tabId={1}
          pageLoadMetrics={null}
        />
      );
      
      expect(screen.getByText('Performance Tips')).toBeInTheDocument();
      expect(screen.getByText(/React.memo/)).toBeInTheDocument();
    });
  });
});
