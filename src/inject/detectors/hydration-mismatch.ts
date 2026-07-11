/**
 * hydration-mismatch detector (M-C.4, hero #2).
 *
 * React reports hydration problems via `console.error` (dev builds), not via a
 * fiber flag, so this detector intercepts `console.error` at init, recognizes
 * the hydration-failure message family, and emits an `HYDRATION_MISMATCH`
 * issue. The original `console.error` is always chained and restored on
 * teardown. Message parsing is factored into the pure `parseHydrationError`
 * for unit testing.
 *
 * Dev-only: React strips hydration warnings from production builds, so
 * `prodCapable: false`.
 */
import type { Detector, DetectorContext } from '../../types/registry';
import type { Issue } from '../../types';

export interface ParsedHydration {
  message: string;
  component?: string;
  server?: string;
  client?: string;
}

const HYDRATION_PATTERNS = [
  /hydrat/i,
  /did not match/i,
  /text content does not match/i,
  /expected server html/i,
];

const SERVER_CLIENT_RE = /server:\s*"([^"]*)"\s+client:\s*"([^"]*)"/i;
const COMPONENT_RE = /(?:in|at)\s+<?([A-Z][A-Za-z0-9_]*)\b/;

function stringifyArg(arg: unknown): string {
  return typeof arg === 'string' ? arg : String(arg ?? '');
}

/** Recognize a React hydration-failure console.error; null if unrelated. */
export function parseHydrationError(args: readonly unknown[]): ParsedHydration | null {
  const message = args.map(stringifyArg).join(' ').trim();
  if (!message) return null;
  if (!HYDRATION_PATTERNS.some((re) => re.test(message))) return null;

  const parsed: ParsedHydration = { message };
  const sc = SERVER_CLIENT_RE.exec(message);
  if (sc) {
    parsed.server = sc[1].trim();
    parsed.client = sc[2].trim();
  }
  const comp = COMPONENT_RE.exec(message);
  if (comp) parsed.component = comp[1];
  return parsed;
}

export function createHydrationMismatchDetector(): Detector<Issue> {
  let ctx: DetectorContext | null = null;
  let buffer: Issue[] = [];
  let seq = 0;
  let originalError: typeof console.error | null = null;

  function emitFrom(parsed: ParsedHydration): void {
    const component = parsed.component ?? 'Unknown';
    // Dedupe per component+server+client so a repeated warning doesn't flood.
    const dedupeKey = `${component}|${parsed.server ?? ''}|${parsed.client ?? ''}`;
    if (ctx && !ctx.dedupe(dedupeKey)) return;
    const diff =
      parsed.server !== undefined && parsed.client !== undefined
        ? ` (server: "${parsed.server}" vs client: "${parsed.client}")`
        : '';
    const issue: Issue = {
      id: `hydration-mismatch-${seq++}`,
      type: 'HYDRATION_MISMATCH',
      severity: 'error',
      component,
      message: `Hydration mismatch: server-rendered HTML did not match the client${diff}`,
      suggestion:
        'Ensure render output is deterministic across server/client (avoid Date.now(), Math.random(), window/localStorage, or locale-dependent formatting during render).',
      timestamp: Date.now(),
      fiberId: dedupeKey,
      location: { componentName: component, componentPath: parsed.component ? [parsed.component] : [] },
    };
    buffer.push(issue);
  }

  return {
    id: 'hydration-mismatch',
    category: 'ui-state',
    budgetMs: 0.2,
    confidence: 'high',
    prodCapable: false,

    init(injected: DetectorContext): void {
      ctx = injected;
      if (originalError) return; // already installed
      // Store the ORIGINAL reference (no .bind) so teardown restores identity.
      originalError = console.error;
      const original = originalError;
      console.error = (...args: unknown[]): void => {
        try {
          const parsed = parseHydrationError(args);
          if (parsed) emitFrom(parsed);
        } catch {
          /* never let detection break the app's logging */
        }
        original.apply(console, args as Parameters<typeof console.error>);
      };
    },

    drain(): Issue[] {
      const out = buffer;
      buffer = [];
      return out;
    },

    teardown(): void {
      if (originalError) {
        console.error = originalError;
        originalError = null;
      }
      buffer = [];
      seq = 0;
      ctx = null;
    },
  };
}

export const hydrationMismatchDetector = createHydrationMismatchDetector();
