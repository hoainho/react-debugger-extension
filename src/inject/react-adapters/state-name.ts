/**
 * Cached useState name inference (M-C.1).
 *
 * Extracting a component's `useState` variable names requires `fn.toString()`
 * + a regex scan — expensive to run on every commit. This memoizes the result
 * per component function in a `WeakMap`, so the toString+regex runs at most
 * once per function (the map entry is GC'd with the function). Empty results
 * are cached too, so components without useState never re-scan.
 */
const cache = new WeakMap<Function, string[]>();

const USE_STATE_SOURCE = String.raw`(?:const|let|var)\s*\[\s*(\w+)\s*,\s*set\w*\s*\]\s*=\s*(?:React\.)?useState`;

/** All `useState` variable names declared in the component, in source order. */
export function inferStateNames(componentType: unknown): string[] {
  if (typeof componentType !== 'function') return [];
  const hit = cache.get(componentType);
  if (hit) return hit;

  const names: string[] = [];
  try {
    const src = componentType.toString();
    const re = new RegExp(USE_STATE_SOURCE, 'g');
    let m: RegExpExecArray | null;
    while ((m = re.exec(src)) !== null) names.push(m[1]);
  } catch {
    /* toString can throw on exotic callables — treat as no names */
  }
  cache.set(componentType, names);
  return names;
}

/** The name bound to the hook at `hookIndex`, or undefined. */
export function getStateName(componentType: unknown, hookIndex: number): string | undefined {
  return inferStateNames(componentType)[hookIndex];
}
