import { describe, it, expect, vi } from 'vitest';
import { createRegistry } from '../inject/registry';
import type { Detector, DetectorContext } from '../types/registry';

function makeOptions(overrides: Partial<Parameters<typeof createRegistry>[0]> = {}) {
  return {
    emit: vi.fn(),
    log: vi.fn(),
    sanitize: (v: unknown) => v,
    performance: { now: () => 0 },
    ...overrides,
  };
}

function makeDetector(partial: Partial<Detector> & { id: string }): Detector {
  return {
    category: 'performance',
    budgetMs: 1,
    confidence: 'high',
    prodCapable: true,
    init: vi.fn(),
    drain: vi.fn(() => []),
    teardown: vi.fn(),
    ...partial,
  } as Detector;
}

describe('createRegistry', () => {
  describe('register / init', () => {
    it('calls detector.init synchronously with a DetectorContext', () => {
      const registry = createRegistry(makeOptions());
      const init = vi.fn();
      const detector = makeDetector({ id: 'd1', init });

      registry.register(detector);

      expect(init).toHaveBeenCalledTimes(1);
      const ctx = init.mock.calls[0][0] as DetectorContext;
      expect(typeof ctx.emit).toBe('function');
      expect(typeof ctx.log).toBe('function');
      expect(typeof ctx.sanitize).toBe('function');
      expect(typeof ctx.dedupe).toBe('function');
      expect(typeof ctx.write).toBe('function');
      expect(typeof ctx.read).toBe('function');
      expect(typeof ctx.performance.now).toBe('function');
    });

    it('throws when registering a duplicate id', () => {
      const registry = createRegistry(makeOptions());
      registry.register(makeDetector({ id: 'dup' }));
      expect(() => registry.register(makeDetector({ id: 'dup' }))).toThrow(
        /already registered/,
      );
    });

    it('allows re-registering after unregister', () => {
      const registry = createRegistry(makeOptions());
      const init1 = vi.fn();
      const init2 = vi.fn();
      registry.register(makeDetector({ id: 're', init: init1 }));
      registry.unregister('re');
      registry.register(makeDetector({ id: 're', init: init2 }));
      expect(init2).toHaveBeenCalledTimes(1);
    });
  });

  describe('unregister / teardown', () => {
    it('calls detector.teardown on unregister', () => {
      const registry = createRegistry(makeOptions());
      const teardown = vi.fn();
      registry.register(makeDetector({ id: 't1', teardown }));
      registry.unregister('t1');
      expect(teardown).toHaveBeenCalledTimes(1);
    });

    it('silently no-ops when unregistering an unknown id', () => {
      const registry = createRegistry(makeOptions());
      expect(() => registry.unregister('nope')).not.toThrow();
    });
  });

  describe('dispatch / throw isolation', () => {
    it('isolates a throwing detector from its peers in the same commit', () => {
      const registry = createRegistry(makeOptions());

      const drainB = vi.fn(() => [{ msg: 'B emitted' }]);
      let bRan = false;

      const a = makeDetector({
        id: 'a',
        onCommit: () => {
          throw new Error('boom from a');
        },
      });
      const b = makeDetector({
        id: 'b',
        onCommit: () => {
          bRan = true;
        },
        drain: drainB,
      });

      registry.register(a);
      registry.register(b);
      registry.dispatch({ fiberRoot: null });

      expect(bRan).toBe(true);
      const drained = registry.drainAll();
      const bEntry = drained.find((e) => e.detectorId === 'b');
      expect(bEntry?.issues).toEqual([{ msg: 'B emitted' }]);

      const listed = registry.list();
      const aEntry = listed.find((e) => e.id === 'a');
      expect(aEntry?.enabled).toBe(false);
      expect(aEntry?.disabledReason).toContain('boom from a');
    });

    it('emits DETECTOR_DISABLED when a detector throws', () => {
      const emit = vi.fn();
      const registry = createRegistry(makeOptions({ emit }));
      registry.register(
        makeDetector({
          id: 'thrower',
          onCommit: () => {
            throw new Error('nope');
          },
        }),
      );
      registry.dispatch({ fiberRoot: null });

      const event = emit.mock.calls
        .map((c) => c[0])
        .find(
          (p): p is { type: string; detectorId: string; phase: string; error: string } =>
            typeof p === 'object' &&
            p !== null &&
            (p as { type?: unknown }).type === 'DETECTOR_DISABLED',
        );
      expect(event).toBeDefined();
      expect(event?.detectorId).toBe('thrower');
      expect(event?.phase).toBe('onCommit');
      expect(event?.error).toBe('nope');
    });
  });

  describe('recover', () => {
    it('invokes recover before disabling on throw', () => {
      const registry = createRegistry(makeOptions());
      const calls: string[] = [];
      const recover = vi.fn(() => calls.push('recover'));
      registry.register(
        makeDetector({
          id: 'rec',
          onCommit: () => {
            calls.push('onCommit');
            throw new Error('die');
          },
          recover,
        }),
      );

      registry.dispatch({ fiberRoot: null });

      expect(recover).toHaveBeenCalledTimes(1);
      expect(calls).toEqual(['onCommit', 'recover']);
      const listed = registry.list();
      expect(listed[0].enabled).toBe(false);
    });
  });

  describe('staged write transactionality', () => {
    it('discards writes on throw and commits writes on success', () => {
      const registry = createRegistry(makeOptions());

      let phase: 'throw' | 'ok' = 'throw';
      let readBack: unknown;
      let ctxRef: DetectorContext | null = null;

      const detector = makeDetector({
        id: 'tx',
        init: (ctx) => {
          ctxRef = ctx;
        },
        onCommit: () => {
          if (phase === 'throw') {
            ctxRef!.write('k', 'v1');
            throw new Error('rollback');
          }
          readBack = ctxRef!.read('k');
          ctxRef!.write('k', 'v2');
        },
      });

      registry.register(detector);

      registry.dispatch({ fiberRoot: null });
      expect(registry.list()[0].enabled).toBe(false);

      registry.enable('tx');
      phase = 'ok';
      registry.dispatch({ fiberRoot: null });
      expect(readBack).toBeUndefined();

      phase = 'ok';
      registry.dispatch({ fiberRoot: null });
      expect(readBack).toBe('v2');
    });

    it('does not expose intra-call writes to intra-call reads', () => {
      const registry = createRegistry(makeOptions());
      let observed: unknown = 'sentinel';
      let ctxRef: DetectorContext | null = null;

      registry.register(
        makeDetector({
          id: 'sameCall',
          init: (ctx) => {
            ctxRef = ctx;
          },
          onCommit: () => {
            ctxRef!.write('k', 'fresh');
            observed = ctxRef!.read('k');
          },
        }),
      );

      registry.dispatch({ fiberRoot: null });
      expect(observed).toBeUndefined();
    });
  });

  describe('dedupe LRU', () => {
    it('returns true on first sighting and false thereafter', () => {
      const registry = createRegistry(makeOptions());
      let ctxRef: DetectorContext | null = null;
      registry.register(
        makeDetector({
          id: 'dd',
          init: (ctx) => {
            ctxRef = ctx;
          },
        }),
      );
      expect(ctxRef!.dedupe('a')).toBe(true);
      expect(ctxRef!.dedupe('a')).toBe(false);
      expect(ctxRef!.dedupe('b')).toBe(true);
    });

    it('evicts the least-recently-used key when capacity is exceeded', () => {
      const registry = createRegistry(makeOptions({ dedupeCapDefault: 3 }));
      let ctxRef: DetectorContext | null = null;
      registry.register(
        makeDetector({
          id: 'cap',
          init: (ctx) => {
            ctxRef = ctx;
          },
        }),
      );

      expect(ctxRef!.dedupe('k1')).toBe(true);
      expect(ctxRef!.dedupe('k2')).toBe(true);
      expect(ctxRef!.dedupe('k3')).toBe(true);

      // k4 is unseen → returns true; capacity exceeded → evicts k1 (LRU).
      expect(ctxRef!.dedupe('k4')).toBe(true);

      // k1 was evicted → first-sighting again, returns true; this in turn
      // evicts the next-oldest, k2.
      expect(ctxRef!.dedupe('k1')).toBe(true);
      // k2 was evicted in the previous step → first-sighting again.
      expect(ctxRef!.dedupe('k2')).toBe(true);
      // k3 and k4 are still hot from the prior loop, plus k1 just refreshed.
      expect(ctxRef!.dedupe('k4')).toBe(false);
      expect(ctxRef!.dedupe('k1')).toBe(false);
    });
  });

  describe('list / enable / disable', () => {
    it('lists detectors with metadata', () => {
      const registry = createRegistry(makeOptions());
      registry.register(
        makeDetector({
          id: 'one',
          category: 'redux',
          confidence: 'medium',
        }),
      );
      const out = registry.list();
      expect(out).toEqual([
        { id: 'one', category: 'redux', confidence: 'medium', enabled: true },
      ]);
    });

    it('disable then enable toggles the enabled flag', () => {
      const registry = createRegistry(makeOptions());
      registry.register(makeDetector({ id: 'toggle' }));
      registry.disable('toggle');
      expect(registry.list()[0].enabled).toBe(false);
      registry.enable('toggle');
      expect(registry.list()[0].enabled).toBe(true);
      expect(registry.list()[0].disabledReason).toBeUndefined();
    });
  });

  describe('dispatch budget deadline', () => {
    it('passes performance.now() + budgetMs as the deadline', () => {
      const now = vi.fn(() => 100);
      const onCommit = vi.fn();
      const registry = createRegistry(
        makeOptions({ performance: { now } }),
      );
      registry.register(
        makeDetector({
          id: 'deadline',
          budgetMs: 2.5,
          onCommit,
        }),
      );
      registry.dispatch({ fiberRoot: { tag: 'root' } });
      expect(onCommit).toHaveBeenCalledWith({ tag: 'root' }, 102.5);
    });
  });

  describe('dispatchIdle', () => {
    function makeDeadline(timeRemaining = 50, didTimeout = false): IdleDeadline {
      return {
        didTimeout,
        timeRemaining: () => timeRemaining,
      } as IdleDeadline;
    }

    it('invokes onIdle for every active detector that defines it', () => {
      const registry = createRegistry(makeOptions());
      const onIdleA = vi.fn();
      const onIdleB = vi.fn();

      registry.register(makeDetector({ id: 'a', onIdle: onIdleA }));
      registry.register(makeDetector({ id: 'b', onIdle: onIdleB }));

      const deadline = makeDeadline(42, false);
      registry.dispatchIdle(deadline);

      expect(onIdleA).toHaveBeenCalledTimes(1);
      expect(onIdleA).toHaveBeenCalledWith(deadline);
      expect(onIdleB).toHaveBeenCalledTimes(1);
      expect(onIdleB).toHaveBeenCalledWith(deadline);
    });

    it('skips detectors that do not define onIdle (does not crash)', () => {
      const registry = createRegistry(makeOptions());
      const onIdleA = vi.fn();

      registry.register(makeDetector({ id: 'withIdle', onIdle: onIdleA }));
      registry.register(makeDetector({ id: 'noIdle' }));

      expect(() => registry.dispatchIdle(makeDeadline())).not.toThrow();
      expect(onIdleA).toHaveBeenCalledTimes(1);
    });

    it('skips disabled detectors', () => {
      const registry = createRegistry(makeOptions());
      const onIdleA = vi.fn();
      registry.register(makeDetector({ id: 'd', onIdle: onIdleA }));
      registry.disable('d');

      registry.dispatchIdle(makeDeadline());

      expect(onIdleA).not.toHaveBeenCalled();
    });

    it('isolates a throwing onIdle: peer detectors still run, thrower is disabled', () => {
      const registry = createRegistry(makeOptions());
      const onIdleB = vi.fn();

      registry.register(
        makeDetector({
          id: 'thrower',
          onIdle: () => {
            throw new Error('idle boom');
          },
        }),
      );
      registry.register(makeDetector({ id: 'b', onIdle: onIdleB }));

      registry.dispatchIdle(makeDeadline());

      expect(onIdleB).toHaveBeenCalledTimes(1);
      const listed = registry.list();
      expect(listed.find((e) => e.id === 'thrower')?.enabled).toBe(false);
      expect(listed.find((e) => e.id === 'thrower')?.disabledReason).toContain('idle boom');
    });
  });

  describe('drainAll', () => {
    it('returns {detectorId, issues[]} for all enabled detectors with non-empty drain results, and skips disabled detectors', () => {
      const registry = createRegistry(makeOptions());

      const enabledIssues = [{ type: 'UNSTABLE_LIST_KEY', component: 'List' }];
      const enabledDetector = makeDetector({
        id: 'enabled-with-issues',
        drain: vi.fn(() => enabledIssues),
      });
      const emptyDetector = makeDetector({
        id: 'enabled-no-issues',
        drain: vi.fn(() => []),
      });
      const disabledDetector = makeDetector({
        id: 'disabled-detector',
        drain: vi.fn(() => [{ type: 'SHOULD_NOT_APPEAR' }]),
      });

      registry.register(enabledDetector);
      registry.register(emptyDetector);
      registry.register(disabledDetector);
      registry.disable('disabled-detector');

      const result = registry.drainAll();

      const enabledEntry = result.find((e) => e.detectorId === 'enabled-with-issues');
      expect(enabledEntry).toBeDefined();
      expect(enabledEntry?.issues).toEqual(enabledIssues);

      const emptyEntry = result.find((e) => e.detectorId === 'enabled-no-issues');
      expect(emptyEntry).toBeDefined();
      expect(emptyEntry?.issues).toEqual([]);

      const disabledEntry = result.find((e) => e.detectorId === 'disabled-detector');
      expect(disabledEntry?.issues).toEqual([]);
      expect((disabledDetector.drain as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
    });
  });
});
