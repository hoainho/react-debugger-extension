/**
 * Cached useState name inference coverage (M-C.1).
 */
import { describe, it, expect } from 'vitest';
import { inferStateNames, getStateName } from '../inject/react-adapters/state-name';

/** A function whose toString is counted, to prove the cache. */
function spyComponent(src: string) {
  let calls = 0;
  const fn = function Component() {};
  fn.toString = () => {
    calls += 1;
    return src;
  };
  return { fn, toStringCalls: () => calls };
}

describe('inferStateNames', () => {
  it('extracts useState names in source order', () => {
    const { fn } = spyComponent(
      'function C(){ const [count,setCount]=useState(0); const [name,setName]=React.useState(""); }',
    );
    expect(inferStateNames(fn)).toEqual(['count', 'name']);
  });

  it('serves repeated lookups from cache (toString runs once)', () => {
    const { fn, toStringCalls } = spyComponent('const [a,setA]=useState(1)');
    inferStateNames(fn);
    inferStateNames(fn);
    getStateName(fn, 0);
    expect(toStringCalls()).toBe(1);
  });

  it('caches independently per function', () => {
    const a = spyComponent('const [x,setX]=useState(1)');
    const b = spyComponent('const [y,setY]=useState(2)');
    expect(inferStateNames(a.fn)).toEqual(['x']);
    expect(inferStateNames(b.fn)).toEqual(['y']);
    expect(a.toStringCalls()).toBe(1);
    expect(b.toStringCalls()).toBe(1);
  });

  it('caches empty results (no useState) so they never re-scan', () => {
    const { fn, toStringCalls } = spyComponent('function C(){ return null; }');
    expect(inferStateNames(fn)).toEqual([]);
    inferStateNames(fn);
    expect(toStringCalls()).toBe(1);
  });

  it('getStateName maps hookIndex; non-function → undefined/[]', () => {
    const { fn } = spyComponent('const [first,setFirst]=useState(); const [second,setSecond]=useState();');
    expect(getStateName(fn, 1)).toBe('second');
    expect(getStateName(fn, 9)).toBeUndefined();
    expect(inferStateNames(null)).toEqual([]);
    expect(inferStateNames('div')).toEqual([]);
  });
});
