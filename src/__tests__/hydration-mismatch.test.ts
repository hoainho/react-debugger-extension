/**
 * hydration-mismatch detector coverage (M-C.4, hero #2).
 * Pure parser + fixture-driven emit/zero via the registry harness. The detector
 * intercepts console.error, so each test restores it via teardown.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createHydrationMismatchDetector,
  parseHydrationError,
} from '../inject/detectors/hydration-mismatch';
import { createRegistry } from '../inject/registry';
import type { Issue } from '../types';
import type { Detector } from '../types/registry';
import {
  positiveHydrationErrors,
  negativeErrors,
} from '../../test/fixtures/hydration-mismatch/messages';

describe('parseHydrationError', () => {
  it('recognizes every positive fixture and extracts server/client + component when present', () => {
    for (const args of positiveHydrationErrors) {
      expect(parseHydrationError(args)).not.toBeNull();
    }
    const withDiff = parseHydrationError([
      'Warning: Text content did not match. Server: "Good morning" Client: "Good evening"',
      '\n    in Greeting',
    ]);
    expect(withDiff?.server).toBe('Good morning');
    expect(withDiff?.client).toBe('Good evening');
    expect(withDiff?.component).toBe('Greeting');
  });

  it('ignores every negative fixture', () => {
    for (const args of negativeErrors) {
      expect(parseHydrationError(args)).toBeNull();
    }
  });
});

describe('detector emit/zero via console.error interception', () => {
  let detector: Detector<Issue>;
  let originalError: typeof console.error;
  let harness: { drain: () => Issue[] };

  beforeEach(() => {
    originalError = console.error;
    detector = createHydrationMismatchDetector();
    const registry = createRegistry({ emit: () => {}, log: () => {}, sanitize: (v) => v, performance: { now: () => 0 } });
    registry.register(detector);
    harness = {
      drain: () => {
        const all = registry.drainAll();
        const e = all.find((x) => x.detectorId === 'hydration-mismatch');
        return (e?.issues as Issue[]) ?? [];
      },
    };
  });

  afterEach(() => {
    detector.teardown?.();
    console.error = originalError; // safety net
  });

  it('emits one HYDRATION_MISMATCH per distinct positive hydration error', () => {
    console.error(...positiveHydrationErrors[0]);
    const issues = harness.drain();
    expect(issues).toHaveLength(1);
    expect(issues[0].type).toBe('HYDRATION_MISMATCH');
    expect(issues[0].severity).toBe('error');
    expect(issues[0].component).toBe('Greeting');
    expect(issues[0].message).toMatch(/server: "Good morning" vs client: "Good evening"/);
  });

  it('emits nothing for unrelated console.error output', () => {
    for (const args of negativeErrors) console.error(...args);
    expect(harness.drain()).toHaveLength(0);
  });

  it('dedupes a repeated identical mismatch', () => {
    console.error(...positiveHydrationErrors[0]);
    console.error(...positiveHydrationErrors[0]);
    expect(harness.drain()).toHaveLength(1);
  });

  it('restores console.error on teardown', () => {
    const wrapped = console.error;
    detector.teardown?.();
    expect(console.error).toBe(originalError);
    expect(wrapped).not.toBe(originalError);
  });
});
