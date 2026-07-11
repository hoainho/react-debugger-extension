/**
 * Profiling strategy version-gate coverage (M-E.2).
 */
import { describe, it, expect } from 'vitest';
import { selectProfilingStrategy, parseReactVersion } from '../inject/profiling-strategy';

describe('parseReactVersion', () => {
  it('parses major.minor and degrades gracefully', () => {
    expect(parseReactVersion('19.2.0')).toEqual([19, 2]);
    expect(parseReactVersion('18')).toEqual([18, 0]);
    expect(parseReactVersion('unknown')).toBeNull();
    expect(parseReactVersion(null)).toBeNull();
  });
});

describe('selectProfilingStrategy', () => {
  it('uses Performance Tracks for React >= 19.2, legacy otherwise', () => {
    expect(selectProfilingStrategy('19.2.0')).toBe('performance-tracks');
    expect(selectProfilingStrategy('19.3.1')).toBe('performance-tracks');
    expect(selectProfilingStrategy('20.0.0')).toBe('performance-tracks');
    expect(selectProfilingStrategy('19.1.0')).toBe('legacy-hook');
    expect(selectProfilingStrategy('19')).toBe('legacy-hook'); // 19.0
    expect(selectProfilingStrategy('18.3.1')).toBe('legacy-hook');
    expect(selectProfilingStrategy('17.0.2')).toBe('legacy-hook');
    expect(selectProfilingStrategy(undefined)).toBe('legacy-hook'); // unknown → safe default
  });
});
