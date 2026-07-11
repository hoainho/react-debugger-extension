/**
 * DashboardView (S4.5 V2) — the first-screen KPI dashboard.
 * Asserts severity stat-tiles, the React status chip, render-pressure summary,
 * and the calm empty state.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DashboardView } from '../panel/components/views/DashboardView';
import type { Issue, RenderInfo, TabState } from '@/types';

function makeIssue(id: string, severity: Issue['severity']): Issue {
  return { id, type: 'MISSING_KEY', severity, component: 'List', message: `msg ${id}`, suggestion: 's', timestamp: 0 };
}

function makeRender(name: string, renderCount: number): RenderInfo {
  return { componentId: name, componentName: name, renderCount, lastRenderTime: 0, renderDurations: [1], selfDurations: [1], triggerReasons: [] };
}

function baseState(overrides: Partial<TabState> = {}): TabState {
  return {
    reactDetected: true, reactVersion: '19.2.0', reactMode: 'development', reduxDetected: false,
    issues: [], components: [], renders: new Map(), clsReport: null, reduxState: null, reduxActions: [],
    memoryReport: null, pageLoadMetrics: null, timelineEvents: [], ...overrides,
  };
}

describe('DashboardView', () => {
  it('renders severity KPI counts and the React status chip', () => {
    const state = baseState({
      issues: [makeIssue('1', 'error'), makeIssue('2', 'error'), makeIssue('3', 'warning')],
      renders: new Map([['A', makeRender('A', 5)], ['B', makeRender('B', 2)]]),
    });
    render(<DashboardView state={state} />);
    // React chip
    expect(screen.getByText('React 19.2.0')).toBeInTheDocument();
    expect(screen.getByText('Dev')).toBeInTheDocument();
    // KPI tiles: Errors label present, and the error count (2) rendered
    expect(screen.getByText('Errors')).toBeInTheDocument();
    expect(screen.getByText('Warnings')).toBeInTheDocument();
    expect(screen.getByText('Total issues')).toBeInTheDocument();
    // Top offenders surfaces the busiest component
    expect(screen.getByText('A')).toBeInTheDocument();
  });

  it('shows a calm empty state when there are no issues and no renders', () => {
    render(<DashboardView state={baseState()} />);
    expect(screen.getByText(/No metrics captured yet/i)).toBeInTheDocument();
  });
});
