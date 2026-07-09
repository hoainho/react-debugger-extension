/**
 * Production-mode capability matrix coverage (M-E.4).
 */
import { describe, it, expect } from 'vitest';
import { buildCapabilityMatrix, renderCapabilityMarkdown } from '../inject/capability-matrix';
import { ALL_DETECTORS } from '../inject/detectors';

describe('buildCapabilityMatrix', () => {
  const matrix = buildCapabilityMatrix(ALL_DETECTORS);
  const byId = Object.fromEntries(matrix.map((r) => [r.id, r]));

  it('has one row per registered detector', () => {
    expect(matrix).toHaveLength(ALL_DETECTORS.length);
    expect(matrix.map((r) => r.id).sort()).toEqual(
      [
        'closure-leak',
        'context-cascade',
        'hydration-mismatch',
        'reconciler-keys',
        'scan-overlay',
        'stale-closure-async',
        'suspense-waterfall',
      ].sort(),
    );
  });

  it('classifies prodCapable from each detector metadata', () => {
    // dev-only detectors (React strips their signal from prod / heuristic)
    expect(byId['hydration-mismatch'].prodCapable).toBe(false);
    expect(byId['stale-closure-async'].prodCapable).toBe(false);
    // production-capable
    expect(byId['reconciler-keys'].prodCapable).toBe(true);
    expect(byId['context-cascade'].prodCapable).toBe(true);
    expect(byId['suspense-waterfall'].prodCapable).toBe(true);
  });

  it('every row carries confidence + category', () => {
    for (const row of matrix) {
      expect(['high', 'medium', 'low']).toContain(row.confidence);
      expect(row.category.length).toBeGreaterThan(0);
    }
  });
});

describe('renderCapabilityMarkdown', () => {
  it('produces a markdown table with a header and a row per detector', () => {
    const md = renderCapabilityMarkdown(buildCapabilityMatrix(ALL_DETECTORS));
    expect(md).toMatch(/\| Detector \| Category \| Confidence \| Production \|/);
    expect(md).toMatch(/`reconciler-keys`/);
    expect(md).toMatch(/dev only/); // at least one dev-only detector
    expect(md).toMatch(/✅ prod/); // at least one prod-capable
  });
});
