import type { TabState, AIAnalysisSnapshot, RenderInfo } from '@/types';

const MAX_ISSUES = 50;
const MAX_COMPONENTS = 30;
const MAX_CRASHES = 10;
const MAX_STACK_LINES = 10;

export function buildSnapshot(state: TabState): AIAnalysisSnapshot {
  const issues = state.issues.slice(0, MAX_ISSUES).map(issue => ({
    type: issue.type,
    severity: issue.severity,
    component: issue.component,
    message: issue.message,
    suggestion: issue.suggestion,
  }));

  const renderEntries = Array.from(state.renders.values());
  const components = renderEntries
    .sort((a: RenderInfo, b: RenderInfo) => b.renderCount - a.renderCount)
    .slice(0, MAX_COMPONENTS)
    .map((r: RenderInfo) => ({
      name: r.componentName,
      renderCount: r.renderCount,
      avgDuration: r.renderDurations.length > 0
        ? Math.round(r.renderDurations.reduce((a, b) => a + b, 0) / r.renderDurations.length * 100) / 100
        : 0,
    }));

  const crashes = (state.memoryReport?.crashes ?? [])
    .slice(-MAX_CRASHES)
    .map(crash => ({
      type: crash.type,
      message: crash.message,
      stack: crash.stack
        ? crash.stack.split('\n').slice(0, MAX_STACK_LINES).join('\n')
        : undefined,
      analysisHints: crash.analysisHints,
    }));

  const mem = state.memoryReport?.current;
  const memory = mem
    ? {
        usedMB: Math.round(mem.usedJSHeapSize / 1024 / 1024 * 10) / 10,
        totalMB: Math.round(mem.totalJSHeapSize / 1024 / 1024 * 10) / 10,
        limitMB: Math.round(mem.jsHeapSizeLimit / 1024 / 1024 * 10) / 10,
        growthRateKBs: Math.round((state.memoryReport?.growthRate ?? 0) / 1024 * 10) / 10,
        warnings: state.memoryReport?.warnings ?? [],
      }
    : null;

  const pm = state.pageLoadMetrics;
  const pageMetrics = pm
    ? { fcp: pm.fcp, lcp: pm.lcp, ttfb: pm.ttfb }
    : null;

  const totalRenders = renderEntries.reduce((sum: number, r: RenderInfo) => sum + r.renderCount, 0);

  return {
    issues,
    components,
    crashes,
    memory,
    pageMetrics,
    reactVersion: state.reactVersion,
    reactMode: state.reactMode,
    totalRenders,
    totalTimelineEvents: state.timelineEvents.length,
  };
}

export async function hashSnapshot(snapshot: AIAnalysisSnapshot): Promise<string> {
  const stable = JSON.stringify({
    issues: snapshot.issues.map((i: AIAnalysisSnapshot['issues'][number]) => `${i.type}:${i.component}:${i.severity}`).sort(),
    components: snapshot.components.map((c: AIAnalysisSnapshot['components'][number]) => `${c.name}:${c.renderCount}`).sort(),
    crashes: snapshot.crashes.map((c: AIAnalysisSnapshot['crashes'][number]) => `${c.type}:${c.message.slice(0, 100)}`),
    memory: snapshot.memory
      ? `${snapshot.memory.usedMB}:${snapshot.memory.warnings.length}`
      : 'null',
    totalRenders: snapshot.totalRenders,
  });

  const encoder = new TextEncoder();
  const data = encoder.encode(stable);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export function snapshotToPromptText(snapshot: AIAnalysisSnapshot): string {
  const sections: string[] = [];

  sections.push(`React ${snapshot.reactVersion ?? 'unknown'} (${snapshot.reactMode ?? 'unknown'} mode)`);
  sections.push(`Total renders: ${snapshot.totalRenders} | Timeline events: ${snapshot.totalTimelineEvents}`);

  if (snapshot.issues.length > 0) {
    sections.push('\n## Detected Issues');
    for (const issue of snapshot.issues) {
      sections.push(`- [${issue.severity.toUpperCase()}] ${issue.type} in <${issue.component}>: ${issue.message}`);
    }
  }

  if (snapshot.components.length > 0) {
    sections.push('\n## Top Components by Render Count');
    for (const comp of snapshot.components.slice(0, 15)) {
      sections.push(`- ${comp.name}: ${comp.renderCount} renders, avg ${comp.avgDuration}ms`);
    }
  }

  if (snapshot.crashes.length > 0) {
    sections.push('\n## Crashes/Errors');
    for (const crash of snapshot.crashes) {
      sections.push(`- [${crash.type}] ${crash.message}`);
      if (crash.stack) {
        sections.push(`  Stack: ${crash.stack.split('\n').slice(0, 5).join(' | ')}`);
      }
      if (crash.analysisHints.length > 0) {
        sections.push(`  Hints: ${crash.analysisHints.join(', ')}`);
      }
    }
  }

  if (snapshot.memory) {
    sections.push('\n## Memory');
    sections.push(`Used: ${snapshot.memory.usedMB}MB / ${snapshot.memory.limitMB}MB`);
    sections.push(`Growth: ${snapshot.memory.growthRateKBs}KB/s`);
    if (snapshot.memory.warnings.length > 0) {
      sections.push(`Warnings: ${snapshot.memory.warnings.join(', ')}`);
    }
  }

  if (snapshot.pageMetrics) {
    sections.push('\n## Page Load Metrics');
    const pm = snapshot.pageMetrics;
    sections.push(`FCP: ${pm.fcp ?? 'N/A'}ms | LCP: ${pm.lcp ?? 'N/A'}ms | TTFB: ${pm.ttfb ?? 'N/A'}ms`);
  }

  return sections.join('\n');
}
