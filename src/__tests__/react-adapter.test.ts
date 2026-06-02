import { describe, it, expect, afterEach } from 'vitest';
import {
  getAdapterForVersion,
  detectReactVersion,
  detectProfilingConflict,
} from '../inject/react-adapters';

type AnyWindow = Window & typeof globalThis & Record<string, unknown>;
function win(): AnyWindow {
  return window as AnyWindow;
}

describe('getAdapterForVersion', () => {
  it('r17: OffscreenComponent === 23 for 17.0.2', () => {
    const adapter = getAdapterForVersion('17.0.2');
    expect(adapter).toBeDefined();
    expect(adapter.FIBER_TAGS.OffscreenComponent).toBe(23);
  });

  it('r18: OffscreenComponent === 22 and CacheComponent === 24 for 18.3.1', () => {
    const adapter = getAdapterForVersion('18.3.1');
    expect(adapter).toBeDefined();
    expect(adapter.FIBER_TAGS.OffscreenComponent).toBe(22);
    expect(adapter.FIBER_TAGS.CacheComponent).toBe(24);
  });

  it('r19: HostHoistable === 26 for 19.0.0', () => {
    const adapter = getAdapterForVersion('19.0.0');
    expect(adapter).toBeDefined();
    expect(adapter.FIBER_TAGS.HostHoistable).toBe(26);
  });

  it('r19.2: ViewTransitionComponent === 30 and supportsPerformanceTracks === true for 19.2.0', () => {
    const adapter = getAdapterForVersion('19.2.0');
    expect(adapter).toBeDefined();
    expect(adapter.FIBER_TAGS.ViewTransitionComponent).toBe(30);
    expect(adapter.supportsPerformanceTracks).toBe(true);
  });

  it('unknown version (99.0.0): does not throw and returns a real adapter', () => {
    let adapter: ReturnType<typeof getAdapterForVersion> | undefined;
    expect(() => { adapter = getAdapterForVersion('99.0.0'); }).not.toThrow();
    expect(adapter).toBeDefined();
    expect(adapter).not.toBeNull();
    expect(adapter!.FIBER_TAGS.ViewTransitionComponent).toBe(30);
  });
});

describe('detectReactVersion', () => {
  afterEach(() => {
    delete (win() as any).__REACT_DEVTOOLS_GLOBAL_HOOK__;
    delete (win() as any).React;
  });

  it('returns version from hook.renderers Map (priority 1)', () => {
    const renderers = new Map<number, unknown>();
    renderers.set(1, { version: '18.3.1' });
    (win() as any).__REACT_DEVTOOLS_GLOBAL_HOOK__ = { renderers };
    expect(detectReactVersion()).toBe('18.3.1');
  });

  it('falls back to window.React.version when no hook is present', () => {
    delete (win() as any).__REACT_DEVTOOLS_GLOBAL_HOOK__;
    (win() as any).React = { version: '17.0.2' };
    expect(detectReactVersion()).toBe('17.0.2');
  });

  it('returns null when neither hook nor window.React is present', () => {
    delete (win() as any).__REACT_DEVTOOLS_GLOBAL_HOOK__;
    delete (win() as any).React;
    expect(detectReactVersion()).toBeNull();
  });
});

describe('detectProfilingConflict', () => {
  afterEach(() => {
    delete (win() as any).__REACT_SCAN__;
    delete (win() as any).__REACT_DEVTOOLS_GLOBAL_HOOK__;
  });

  it('returns reactScan: true when __REACT_SCAN__.ReactScanInternals is present', () => {
    (win() as any).__REACT_SCAN__ = { ReactScanInternals: {} };
    const conflict = detectProfilingConflict();
    expect(conflict.reactScan).toBe(true);
  });

  it('returns reactDevTools: true when hook has getFiberRoots method', () => {
    (win() as any).__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
      renderers: new Map(),
      getFiberRoots: () => new Set(),
    };
    const conflict = detectProfilingConflict();
    expect(conflict.reactDevTools).toBe(true);
  });

  it('returns all false when no profiling tool stubs are present', () => {
    delete (win() as any).__REACT_SCAN__;
    delete (win() as any).__REACT_DEVTOOLS_GLOBAL_HOOK__;
    const conflict = detectProfilingConflict();
    expect(conflict.reactScan).toBe(false);
    expect(conflict.reactDevTools).toBe(false);
  });
});
