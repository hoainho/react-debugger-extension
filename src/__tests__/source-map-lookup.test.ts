/**
 * Source-map lookup coverage (M-C.3). Uses node:fs for the boundary check, so
 * this file is excluded from the browser tsconfig (tsc) and verified by vitest.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  lookupSourcePosition,
  clearSourceMapCache,
  type SourcePosition,
} from '../devtools/source-map-lookup';

beforeEach(() => clearSourceMapCache());

describe('lookupSourcePosition (in-session cache)', () => {
  it('does not re-invoke the resolver for a repeated key', async () => {
    const resolver = vi.fn(async (): Promise<SourcePosition> => ({ source: 'App.tsx', line: 10, column: 4 }));
    const loc = { scriptId: 's1', line: 100, column: 2 };

    const a = await lookupSourcePosition(loc, resolver);
    const b = await lookupSourcePosition(loc, resolver);
    expect(a).toEqual({ source: 'App.tsx', line: 10, column: 4 });
    expect(b).toEqual(a);
    expect(resolver).toHaveBeenCalledTimes(1); // cached
  });

  it('caches distinct keys separately and caches null results too', async () => {
    const resolver = vi.fn(async (l: { scriptId: string }) => (l.scriptId === 'has' ? { source: 'x', line: 1, column: 1 } : null));
    await lookupSourcePosition({ scriptId: 'has', line: 1, column: 1 }, resolver);
    await lookupSourcePosition({ scriptId: 'none', line: 1, column: 1 }, resolver);
    await lookupSourcePosition({ scriptId: 'none', line: 1, column: 1 }, resolver); // cached null
    expect(resolver).toHaveBeenCalledTimes(2);
  });
});

describe('boundary: detectors must not import source-map-lookup', () => {
  it('no file under src/inject/detectors imports source-map-lookup', () => {
    const detectorsDir = resolve(dirname(fileURLToPath(import.meta.url)), '../inject/detectors');
    const offenders = readdirSync(detectorsDir)
      .filter((f) => f.endsWith('.ts'))
      .filter((f) => /source-map-lookup/.test(readFileSync(resolve(detectorsDir, f), 'utf8')));
    expect(offenders).toEqual([]);
  });
});
