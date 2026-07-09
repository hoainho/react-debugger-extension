/**
 * Profiling strategy selection (M-E.2).
 *
 * React 19.2+ exposes the Performance Tracks profiling API; earlier versions
 * use the legacy injectProfilingHooks path. This pure decision gates the swap
 * behind adapter version detection. The actual Performance Tracks API call on a
 * live 19.2 app is a humanGate; this module only decides WHICH strategy to use.
 */
export type ProfilingStrategy = 'performance-tracks' | 'legacy-hook';

/** Parse a React version string to [major, minor], or null if unparseable. */
export function parseReactVersion(version: string | null | undefined): [number, number] | null {
  if (typeof version !== 'string') return null;
  const m = /^(\d+)(?:\.(\d+))?/.exec(version.trim());
  if (!m) return null;
  return [Number(m[1]), m[2] ? Number(m[2]) : 0];
}

/** Performance Tracks for React >= 19.2, else the legacy profiling hook. */
export function selectProfilingStrategy(version: string | null | undefined): ProfilingStrategy {
  const parsed = parseReactVersion(version);
  if (!parsed) return 'legacy-hook';
  const [major, minor] = parsed;
  return major > 19 || (major === 19 && minor >= 2) ? 'performance-tracks' : 'legacy-hook';
}
