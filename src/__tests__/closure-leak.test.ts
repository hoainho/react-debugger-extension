import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createClosureLeakDetector } from '../inject/detectors/closure-leak';
import { createRegistry } from '../inject/registry';
import type { Issue } from '../types';

interface BridgeMock {
  install: () => void;
  restoreOriginals: () => void;
  clear: () => void;
  setSink: (fn: ((issue: Issue) => void) | null) => void;
  installCalls: number;
  restoreCalls: number;
  clearCalls: number;
  sink: ((issue: Issue) => void) | null;
}

function installMockBridge(): BridgeMock {
  const bridge: BridgeMock = {
    installCalls: 0,
    restoreCalls: 0,
    clearCalls: 0,
    sink: null,
    install: () => {
      bridge.installCalls++;
    },
    restoreOriginals: () => {
      bridge.restoreCalls++;
    },
    clear: () => {
      bridge.clearCalls++;
    },
    setSink: (fn) => {
      bridge.sink = fn;
    },
  };
  (window as unknown as { __REACT_DEBUGGER_CLOSURE_BRIDGE__: BridgeMock }).__REACT_DEBUGGER_CLOSURE_BRIDGE__ = bridge;
  return bridge;
}

function uninstallMockBridge(): void {
  delete (window as unknown as { __REACT_DEBUGGER_CLOSURE_BRIDGE__?: unknown }).__REACT_DEBUGGER_CLOSURE_BRIDGE__;
}

function makeRegistryHarness() {
  const detector = createClosureLeakDetector();
  const registry = createRegistry({
    emit: () => {},
    log: () => {},
    sanitize: (v) => v,
    performance: { now: () => 0 },
  });
  registry.register(detector);
  return {
    detector,
    registry,
    drain: (): Issue[] => {
      const all = registry.drainAll();
      const us = all.find((e) => e.detectorId === 'closure-leak');
      return (us?.issues as Issue[]) ?? [];
    },
  };
}

function makeFakeIssue(id: string): Issue {
  return {
    id,
    type: 'STALE_CLOSURE',
    severity: 'warning',
    component: 'Comp',
    message: 'fake stale closure',
    suggestion: 'fake suggestion',
    timestamp: 0,
  };
}

describe('closure-leak detector', () => {
  let bridge: BridgeMock;
  beforeEach(() => {
    bridge = installMockBridge();
  });
  afterEach(() => {
    uninstallMockBridge();
  });

  it('declares the expected detector metadata (id, category, budgetMs, confidence, prodCapable)', () => {
    const d = createClosureLeakDetector();
    expect(d.id).toBe('closure-leak');
    expect(d.category).toBe('side-effects');
    expect(d.budgetMs).toBe(0.2);
    expect(d.confidence).toBe('medium');
    expect(d.prodCapable).toBe(true);
  });

  it('init() invokes the bridge install hook and attaches a sink', () => {
    const harness = makeRegistryHarness();
    expect(bridge.installCalls).toBe(1);
    expect(typeof bridge.sink).toBe('function');
    harness.detector.teardown();
  });

  it('teardown() restores originals via the bridge and detaches the sink', () => {
    const harness = makeRegistryHarness();
    expect(bridge.installCalls).toBe(1);
    expect(bridge.sink).not.toBeNull();
    harness.detector.teardown();
    expect(bridge.restoreCalls).toBe(1);
    expect(bridge.clearCalls).toBe(1);
    expect(bridge.sink).toBeNull();
  });

  it('drain() returns buffered issues fed via the sink and then clears the buffer', () => {
    const harness = makeRegistryHarness();
    const sink = bridge.sink;
    expect(sink).not.toBeNull();
    sink!(makeFakeIssue('a'));
    sink!(makeFakeIssue('b'));
    const drained = harness.drain();
    expect(drained.map((i) => i.id)).toEqual(['a', 'b']);
    expect(harness.drain()).toEqual([]);
    harness.detector.teardown();
  });

  it('teardown() is idempotent — calling it twice does not throw', () => {
    const harness = makeRegistryHarness();
    expect(() => {
      harness.detector.teardown();
      harness.detector.teardown();
    }).not.toThrow();
    expect(bridge.restoreCalls).toBe(1);
  });

  it('sink emissions after teardown are dropped (buffer not appended)', () => {
    const harness = makeRegistryHarness();
    const sink = bridge.sink;
    harness.detector.teardown();
    sink!(makeFakeIssue('late'));
    expect(harness.drain()).toEqual([]);
  });

  it('init() is a safe no-op when the bridge is absent', () => {
    uninstallMockBridge();
    const harness = makeRegistryHarness();
    expect(harness.drain()).toEqual([]);
    expect(() => harness.detector.teardown()).not.toThrow();
  });
});
