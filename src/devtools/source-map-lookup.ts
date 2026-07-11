/**
 * Source-map position lookup (M-C.3, time-boxed).
 *
 * Resolves a runtime `(scriptId, line, column)` to an authored source position.
 * The actual resolution goes through `chrome.debugger` /
 * `Debugger.getScriptSource` + a source-map parse — that RESOLUTION is a human
 * gate (needs the `debugger` permission and a real inspected page), so the
 * resolver is INJECTED. This module owns only the in-session cache and the
 * public shape.
 *
 * BOUNDARY (enforced by a static test): this module must never be imported from
 * `src/inject/detectors/*` — source-map lookups are a panel/service concern,
 * not something a hot-path detector may do per commit.
 */

export interface ScriptLocation {
  scriptId: string;
  line: number;
  column: number;
}

export interface SourcePosition {
  source: string;
  line: number;
  column: number;
  name?: string;
}

export type SourceResolver = (loc: ScriptLocation) => Promise<SourcePosition | null>;

const sessionCache = new Map<string, SourcePosition | null>();

function keyOf(loc: ScriptLocation): string {
  return `${loc.scriptId}:${loc.line}:${loc.column}`;
}

/** Default resolver — real chrome.debugger path; returns null when unavailable. */
const defaultResolver: SourceResolver = async () => {
  // Populated by the maintainer gate (chrome.debugger.attach + getScriptSource).
  // Absent outside a paired DevTools session → no attribution.
  return null;
};

/**
 * Resolve a source position, memoized per `(scriptId,line,column)` for the
 * session. A repeated lookup for the same key returns the cached value WITHOUT
 * re-invoking the resolver.
 */
export async function lookupSourcePosition(
  loc: ScriptLocation,
  resolver: SourceResolver = defaultResolver,
): Promise<SourcePosition | null> {
  const key = keyOf(loc);
  if (sessionCache.has(key)) return sessionCache.get(key) ?? null;
  const position = await resolver(loc);
  sessionCache.set(key, position);
  return position;
}

/** Clear the in-session cache (e.g. on navigation / detach). */
export function clearSourceMapCache(): void {
  sessionCache.clear();
}
