import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createScanOverlayDetector,
  type ScanOverlayPendingItem,
} from '../inject/detectors/scan-overlay';
import { createRegistry } from '../inject/registry';
import { KNOWN_DETECTORS_DEFAULTS } from '../settings/migrate';

type RecorderFn = (fiber: unknown, name: string, count: number) => void;

interface BridgeMock {
  enable: () => void;
  disable: () => void;
  isEnabled: () => boolean;
  setRecorder: (fn: RecorderFn | null) => void;
  paint: (items: ScanOverlayPendingItem[]) => void;
  clear: () => void;
  recorder: RecorderFn | null;
  paintedBatches: ScanOverlayPendingItem[][];
  clearCalls: number;
  enabled: boolean;
}

function installMockBridge(): BridgeMock {
  const bridge: BridgeMock = {
    recorder: null,
    paintedBatches: [],
    clearCalls: 0,
    enabled: false,
    enable: () => {
      bridge.enabled = true;
    },
    disable: () => {
      bridge.enabled = false;
    },
    isEnabled: () => bridge.enabled,
    setRecorder: (fn) => {
      bridge.recorder = fn;
    },
    paint: (items) => {
      bridge.paintedBatches.push(items);
    },
    clear: () => {
      bridge.clearCalls++;
    },
  };
  (window as unknown as { __REACT_DEBUGGER_SCAN_BRIDGE__: BridgeMock }).__REACT_DEBUGGER_SCAN_BRIDGE__ = bridge;
  return bridge;
}

function uninstallMockBridge(): void {
  delete (window as unknown as { __REACT_DEBUGGER_SCAN_BRIDGE__?: unknown }).__REACT_DEBUGGER_SCAN_BRIDGE__;
}

function makeIdleDeadline(timeRemaining = 50, didTimeout = false): IdleDeadline {
  return {
    didTimeout,
    timeRemaining: () => timeRemaining,
  } as IdleDeadline;
}

function makeHarness() {
  const detector = createScanOverlayDetector();
  const registry = createRegistry({
    emit: () => {},
    log: () => {},
    sanitize: (v) => v,
    performance: { now: () => 0 },
  });
  registry.register(detector);
  return { detector, registry };
}

describe('scan-overlay detector', () => {
  let bridge: BridgeMock;

  beforeEach(() => {
    bridge = installMockBridge();
  });

  afterEach(() => {
    uninstallMockBridge();
  });

  it('declares the expected detector metadata (id, category, budgetMs, confidence, prodCapable)', () => {
    const d = createScanOverlayDetector();
    expect(d.id).toBe('scan-overlay');
    expect(d.category).toBe('performance');
    expect(d.budgetMs).toBe(0.5);
    expect(d.confidence).toBe('high');
    expect(d.prodCapable).toBe(true);
  });

  it('onCommit + recorder: buffers fibers WITHOUT touching the DOM (no getBoundingClientRect)', () => {
    const harness = makeHarness();
    expect(typeof bridge.recorder).toBe('function');

    const fakeFiber1 = { id: 'f1' };
    const fakeFiber2 = { id: 'f2' };

    const elem = document.createElement('div');
    const getRectSpy = vi.spyOn(elem, 'getBoundingClientRect');

    bridge.recorder!(fakeFiber1, 'Comp1', 3);
    bridge.recorder!(fakeFiber2, 'Comp2', 7);

    harness.detector.onCommit?.(null, 0);

    expect(getRectSpy).not.toHaveBeenCalled();
    expect(bridge.paintedBatches).toEqual([]);

    harness.detector.teardown();
  });

  it('onIdle drains the buffer and calls bridge.paint with the buffered items', () => {
    const harness = makeHarness();
    const fakeFiber = { id: 'f1' };

    bridge.recorder!(fakeFiber, 'CompA', 2);
    bridge.recorder!({ id: 'f2' }, 'CompB', 5);

    expect(bridge.paintedBatches).toEqual([]);

    harness.detector.onIdle!(makeIdleDeadline(50, false));

    expect(bridge.paintedBatches).toHaveLength(1);
    expect(bridge.paintedBatches[0]).toEqual([
      { fiber: { id: 'f1' }, componentName: 'CompA', renderCount: 2 },
      { fiber: { id: 'f2' }, componentName: 'CompB', renderCount: 5 },
    ]);

    bridge.paintedBatches = [];
    harness.detector.onIdle!(makeIdleDeadline(50, false));
    expect(bridge.paintedBatches).toEqual([]);

    harness.detector.teardown();
  });

  it('teardown clears the bridge (overlay removal) and detaches the recorder', () => {
    const harness = makeHarness();
    expect(bridge.recorder).not.toBeNull();
    expect(bridge.clearCalls).toBe(0);

    bridge.recorder!({ id: 'f' }, 'Comp', 1);
    harness.detector.teardown();

    expect(bridge.recorder).toBeNull();
    expect(bridge.clearCalls).toBe(1);
  });

  it('scan-overlay is configured as default-on in KNOWN_DETECTORS_DEFAULTS', () => {
    const entry = KNOWN_DETECTORS_DEFAULTS.find((d) => d.id === 'scan-overlay');
    expect(entry).toBeDefined();
    expect(entry?.confidence).toBe('high');
  });

  it('init is a safe no-op when the bridge is absent', () => {
    uninstallMockBridge();
    const detector = createScanOverlayDetector();
    const registry = createRegistry({
      emit: () => {},
      log: () => {},
      sanitize: (v) => v,
      performance: { now: () => 0 },
    });
    expect(() => registry.register(detector)).not.toThrow();
    expect(() => detector.onIdle!(makeIdleDeadline(50, false))).not.toThrow();
    expect(() => detector.teardown()).not.toThrow();
  });

  it('drain always returns an empty array (scan emits no issues — visual only)', () => {
    const harness = makeHarness();
    bridge.recorder!({ id: 'f' }, 'Comp', 1);
    expect(harness.detector.drain()).toEqual([]);
    harness.detector.teardown();
  });

  it('onIdle with zero timeRemaining and not didTimeout drops the batch (yields to user)', () => {
    const harness = makeHarness();
    bridge.recorder!({ id: 'f' }, 'Comp', 1);

    harness.detector.onIdle!(makeIdleDeadline(0, false));

    expect(bridge.paintedBatches).toEqual([]);
    harness.detector.teardown();
  });
});
