import { describe, it, expect } from 'vitest';
import { buildSnapshot, hashSnapshot, snapshotToPromptText } from '../services/snapshot-builder';
import type { AIAnalysisSnapshot, CrashEntry, Issue, RenderInfo, TabState } from '../types';

function makeEmptyTabState(): TabState {
  return {
    reactDetected: false,
    reactVersion: null,
    reactMode: null,
    reduxDetected: false,
    issues: [],
    components: [],
    renders: new Map(),
    clsReport: null,
    reduxState: null,
    reduxActions: [],
    memoryReport: null,
    pageLoadMetrics: null,
    timelineEvents: [],
  };
}

function makeIssue(overrides: Partial<Issue> = {}): Issue {
  return {
    id: 'issue-1',
    type: 'MISSING_KEY',
    severity: 'warning',
    component: 'MyList',
    message: 'Missing key prop',
    suggestion: 'Add a unique key',
    timestamp: Date.now(),
    ...overrides,
  };
}

function makeRenderInfo(overrides: Partial<RenderInfo> = {}): RenderInfo {
  return {
    componentId: 'comp-1',
    componentName: 'MyComponent',
    renderCount: 5,
    lastRenderTime: Date.now(),
    renderDurations: [10, 20, 30],
    selfDurations: [5, 10, 15],
    triggerReasons: [],
    ...overrides,
  };
}

function makeCrash(overrides: Partial<CrashEntry> = {}): CrashEntry {
  return {
    id: 'crash-1',
    timestamp: Date.now(),
    type: 'js-error',
    message: 'Cannot read property',
    stack: 'line1\nline2',
    analysisHints: ['Check null refs'],
    ...overrides,
  };
}

function makeSnapshot(overrides: Partial<AIAnalysisSnapshot> = {}): AIAnalysisSnapshot {
  return {
    issues: [],
    components: [],
    crashes: [],
    memory: null,
    pageMetrics: null,
    reactVersion: '18.2.0',
    reactMode: 'development',
    totalRenders: 0,
    totalTimelineEvents: 0,
    ...overrides,
  };
}

describe('buildSnapshot', () => {
  it('returns empty arrays and null sections for an empty TabState', () => {
    const snapshot = buildSnapshot(makeEmptyTabState());

    expect(snapshot.issues).toEqual([]);
    expect(snapshot.components).toEqual([]);
    expect(snapshot.crashes).toEqual([]);
    expect(snapshot.memory).toBeNull();
    expect(snapshot.pageMetrics).toBeNull();
    expect(snapshot.totalRenders).toBe(0);
    expect(snapshot.totalTimelineEvents).toBe(0);
  });

  it('limits issues to the first 50 entries', () => {
    const state = makeEmptyTabState();
    state.issues = Array.from({ length: 51 }, (_, index) =>
      makeIssue({ id: `issue-${index}`, component: `Comp${index}` })
    );

    const snapshot = buildSnapshot(state);

    expect(snapshot.issues).toHaveLength(50);
    expect(snapshot.issues[0].component).toBe('Comp0');
    expect(snapshot.issues[49].component).toBe('Comp49');
  });

  it('maps issues to the prompt-safe shape', () => {
    const state = makeEmptyTabState();
    state.issues = [
      makeIssue({
        id: 'private-id',
        type: 'EXCESSIVE_RERENDERS',
        severity: 'error',
        component: 'Header',
        message: 'Too many renders',
        suggestion: 'Use memo',
        code: '<Header />',
        fiberId: 'fiber-1',
      }),
    ];

    const issue = buildSnapshot(state).issues[0];

    expect(issue).toEqual({
      type: 'EXCESSIVE_RERENDERS',
      severity: 'error',
      component: 'Header',
      message: 'Too many renders',
      suggestion: 'Use memo',
    });
    expect((issue as Record<string, unknown>).id).toBeUndefined();
    expect((issue as Record<string, unknown>).code).toBeUndefined();
    expect((issue as Record<string, unknown>).timestamp).toBeUndefined();
    expect((issue as Record<string, unknown>).fiberId).toBeUndefined();
  });

  it('sorts components by render count descending and limits to 30', () => {
    const state = makeEmptyTabState();
    for (let index = 1; index <= 31; index += 1) {
      state.renders.set(
        `comp-${index}`,
        makeRenderInfo({
          componentId: `comp-${index}`,
          componentName: `Comp${index}`,
          renderCount: index,
        }),
      );
    }

    const snapshot = buildSnapshot(state);

    expect(snapshot.components).toHaveLength(30);
    expect(snapshot.components[0]).toMatchObject({ name: 'Comp31', renderCount: 31 });
    expect(snapshot.components[29]).toMatchObject({ name: 'Comp2', renderCount: 2 });
  });

  it('rounds average render duration to two decimals', () => {
    const state = makeEmptyTabState();
    state.renders.set('comp-1', makeRenderInfo({ renderDurations: [1, 2, 2] }));

    expect(buildSnapshot(state).components[0].avgDuration).toBe(1.67);
  });

  it('uses 0 average duration when no render durations exist', () => {
    const state = makeEmptyTabState();
    state.renders.set('comp-1', makeRenderInfo({ renderDurations: [] }));

    expect(buildSnapshot(state).components[0].avgDuration).toBe(0);
  });

  it('sums total renders across all render entries', () => {
    const state = makeEmptyTabState();
    state.renders.set('a', makeRenderInfo({ componentId: 'a', renderCount: 10 }));
    state.renders.set('b', makeRenderInfo({ componentId: 'b', renderCount: 25 }));

    expect(buildSnapshot(state).totalRenders).toBe(35);
  });

  it('includes rounded memory values when current memory exists', () => {
    const state = makeEmptyTabState();
    state.memoryReport = {
      current: {
        timestamp: Date.now(),
        usedJSHeapSize: 50.25 * 1024 * 1024,
        totalJSHeapSize: 100 * 1024 * 1024,
        jsHeapSizeLimit: 2048 * 1024 * 1024,
      },
      history: [],
      growthRate: 512.25 * 1024,
      peakUsage: 0,
      warnings: ['High memory usage'],
      crashes: [],
    };

    expect(buildSnapshot(state).memory).toEqual({
      usedMB: 50.3,
      totalMB: 100,
      limitMB: 2048,
      growthRateKBs: 512.3,
      warnings: ['High memory usage'],
    });
  });

  it('includes page metrics subset when page load metrics exist', () => {
    const state = makeEmptyTabState();
    state.pageLoadMetrics = {
      fcp: 800,
      lcp: 1500,
      ttfb: 100,
      domContentLoaded: 900,
      loadComplete: 2000,
      timestamp: Date.now(),
    };

    expect(buildSnapshot(state).pageMetrics).toEqual({ fcp: 800, lcp: 1500, ttfb: 100 });
  });

  it('carries React metadata and timeline event count through', () => {
    const state = makeEmptyTabState();
    state.reactVersion = '18.3.0';
    state.reactMode = 'production';
    state.timelineEvents = [
      { id: 'event-1', timestamp: 1, type: 'render', payload: { componentName: 'A', componentId: 'a', trigger: 'mount' } },
      { id: 'event-2', timestamp: 2, type: 'error', payload: { errorType: 'js-error', message: 'boom' } },
    ];

    const snapshot = buildSnapshot(state);

    expect(snapshot.reactVersion).toBe('18.3.0');
    expect(snapshot.reactMode).toBe('production');
    expect(snapshot.totalTimelineEvents).toBe(2);
  });

  it('keeps the last 10 crashes from the memory report', () => {
    const state = makeEmptyTabState();
    state.memoryReport = {
      current: null,
      history: [],
      growthRate: 0,
      peakUsage: 0,
      warnings: [],
      crashes: Array.from({ length: 12 }, (_, index) =>
        makeCrash({ id: `crash-${index}`, message: `Crash ${index}` })
      ),
    };

    const snapshot = buildSnapshot(state);

    expect(snapshot.crashes).toHaveLength(10);
    expect(snapshot.crashes[0].message).toBe('Crash 2');
    expect(snapshot.crashes[9].message).toBe('Crash 11');
  });

  it('truncates crash stacks to 10 lines', () => {
    const state = makeEmptyTabState();
    state.memoryReport = {
      current: null,
      history: [],
      growthRate: 0,
      peakUsage: 0,
      warnings: [],
      crashes: [makeCrash({ stack: Array.from({ length: 12 }, (_, index) => `line${index + 1}`).join('\n') })],
    };

    const stack = buildSnapshot(state).crashes[0].stack;

    expect(stack?.split('\n')).toHaveLength(10);
    expect(stack).not.toContain('line11');
  });
});

describe('hashSnapshot', () => {
  it('returns a 64-character lowercase hex string', async () => {
    const hash = await hashSnapshot(makeSnapshot());

    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is deterministic for the same input', async () => {
    const snapshot = makeSnapshot({
      issues: [{ type: 'MISSING_KEY', severity: 'warning', component: 'List', message: 'Missing key', suggestion: 'Add key' }],
      totalRenders: 42,
    });

    await expect(hashSnapshot(snapshot)).resolves.toBe(await hashSnapshot(snapshot));
  });

  it('changes when render totals change', async () => {
    await expect(hashSnapshot(makeSnapshot({ totalRenders: 10 }))).resolves.not.toBe(
      await hashSnapshot(makeSnapshot({ totalRenders: 99 })),
    );
  });

  it('changes when memory summary changes', async () => {
    const withMemory = makeSnapshot({
      memory: { usedMB: 50, totalMB: 100, limitMB: 2048, growthRateKBs: 0, warnings: [] },
    });

    await expect(hashSnapshot(withMemory)).resolves.not.toBe(await hashSnapshot(makeSnapshot({ memory: null })));
  });
});

describe('snapshotToPromptText', () => {
  it('includes React version, mode, renders, and timeline totals', () => {
    const text = snapshotToPromptText(makeSnapshot({ totalRenders: 12, totalTimelineEvents: 3 }));

    expect(text).toContain('React 18.2.0 (development mode)');
    expect(text).toContain('Total renders: 12 | Timeline events: 3');
  });

  it('falls back to unknown React metadata', () => {
    const text = snapshotToPromptText(makeSnapshot({ reactVersion: null, reactMode: null }));

    expect(text).toContain('React unknown (unknown mode)');
  });

  it('includes detected issues when present', () => {
    const text = snapshotToPromptText(makeSnapshot({
      issues: [{ type: 'MISSING_KEY', severity: 'warning', component: 'List', message: 'Missing key', suggestion: 'Add key' }],
    }));

    expect(text).toContain('## Detected Issues');
    expect(text).toContain('[WARNING] MISSING_KEY in <List>: Missing key');
  });

  it('omits detected issues section when no issues exist', () => {
    expect(snapshotToPromptText(makeSnapshot({ issues: [] }))).not.toContain('## Detected Issues');
  });

  it('includes only the top 15 components in prompt text', () => {
    const text = snapshotToPromptText(makeSnapshot({
      components: Array.from({ length: 16 }, (_, index) => ({
        name: `Comp${index + 1}`,
        renderCount: index + 1,
        avgDuration: 5,
      })),
    }));

    expect(text).toContain('## Top Components by Render Count');
    expect(text).toContain('Comp15');
    expect(text).not.toContain('Comp16');
  });

  it('includes crash stacks and analysis hints', () => {
    const text = snapshotToPromptText(makeSnapshot({
      crashes: [{ type: 'js-error', message: 'Cannot read property', stack: 'at App.js:10\nat index.js:5', analysisHints: ['Check null ref'] }],
    }));

    expect(text).toContain('## Crashes/Errors');
    expect(text).toContain('[js-error] Cannot read property');
    expect(text).toContain('Stack: at App.js:10 | at index.js:5');
    expect(text).toContain('Hints: Check null ref');
  });

  it('includes memory usage and warnings', () => {
    const text = snapshotToPromptText(makeSnapshot({
      memory: { usedMB: 75, totalMB: 150, limitMB: 2048, growthRateKBs: 10, warnings: ['leak detected'] },
    }));

    expect(text).toContain('## Memory');
    expect(text).toContain('Used: 75MB / 2048MB');
    expect(text).toContain('Growth: 10KB/s');
    expect(text).toContain('Warnings: leak detected');
  });

  it('includes page load metrics and N/A fallbacks', () => {
    const text = snapshotToPromptText(makeSnapshot({
      pageMetrics: { fcp: null, lcp: 1500, ttfb: null },
    }));

    expect(text).toContain('## Page Load Metrics');
    expect(text).toContain('FCP: N/Ams | LCP: 1500ms | TTFB: N/Ams');
  });
});
