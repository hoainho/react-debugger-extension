/**
 * Opt-in telemetry coverage (M-F.2) — aggregation, opt-out, hourly batch, and
 * the PAYLOAD AUDIT (no URLs / component names / user data ever leave).
 */
import { describe, it, expect, vi } from 'vitest';
import {
  TelemetryRecorder,
  buildTelemetryPayload,
  HOURLY_MS,
  type TelemetryConfig,
} from '../services/telemetry';

const cfg: TelemetryConfig = { extVersion: '3.0.0', reactVersion: '19.2.0' };

describe('payload audit (no PII ever)', () => {
  it('emits ONLY the whitelisted fields — extra data is dropped', () => {
    // A counter object contaminated with URL / component / user data:
    const dirty = {
      detector: 'reconciler-keys',
      fires: 4,
      dismisses: 1,
      fpClicks: 0,
      url: 'https://app.example.com/secret?token=abc',
      componentName: 'UserProfile',
      userEmail: 'a@b.com',
    } as unknown as Parameters<typeof buildTelemetryPayload>[0];

    const payload = buildTelemetryPayload(dirty, cfg);
    expect(Object.keys(payload).sort()).toEqual(
      ['detector', 'ext_version', 'fires', 'dismisses', 'fpClicks', 'react_version'].sort(),
    );
    const serialized = JSON.stringify(payload);
    expect(serialized).not.toMatch(/http/);
    expect(serialized).not.toMatch(/UserProfile/);
    expect(serialized).not.toMatch(/a@b\.com/);
    expect(serialized).not.toMatch(/token/);
  });
});

describe('opt-out (default OFF)', () => {
  it('records nothing and sends nothing while disabled', () => {
    const send = vi.fn();
    const rec = new TelemetryRecorder({ enabled: () => false, now: () => 0, send, cfg });
    rec.record('reconciler-keys', 'fire');
    rec.record('reconciler-keys', 'dismiss');
    rec.flush();
    expect(send).not.toHaveBeenCalled();
  });
});

describe('aggregation + flush', () => {
  it('aggregates per-detector counters and flushes a batch', () => {
    const send = vi.fn();
    const rec = new TelemetryRecorder({ enabled: () => true, now: () => 0, send, cfg });
    rec.record('reconciler-keys', 'fire');
    rec.record('reconciler-keys', 'fire');
    rec.record('reconciler-keys', 'fpClick');
    rec.record('hydration-mismatch', 'dismiss');
    rec.flush();
    expect(send).toHaveBeenCalledOnce();
    const batch = send.mock.calls[0][0] as ReturnType<typeof buildTelemetryPayload>[];
    const rk = batch.find((p) => p.detector === 'reconciler-keys')!;
    expect(rk).toMatchObject({ fires: 2, fpClicks: 1, dismisses: 0, ext_version: '3.0.0', react_version: '19.2.0' });
    expect(batch.find((p) => p.detector === 'hydration-mismatch')!.dismisses).toBe(1);
  });

  it('clears the buffer after flush (no double-send)', () => {
    const send = vi.fn();
    const rec = new TelemetryRecorder({ enabled: () => true, now: () => 0, send, cfg });
    rec.record('x', 'fire');
    rec.flush();
    rec.flush(); // nothing new
    expect(send).toHaveBeenCalledOnce();
  });
});

describe('hourly batch (maybeFlush)', () => {
  it('flushes only after the interval elapses', () => {
    const send = vi.fn();
    let clock = 0;
    const rec = new TelemetryRecorder({ enabled: () => true, now: () => clock, send, cfg });
    rec.record('x', 'fire');
    clock = HOURLY_MS - 1;
    rec.maybeFlush();
    expect(send).not.toHaveBeenCalled(); // not yet an hour
    clock = HOURLY_MS;
    rec.maybeFlush();
    expect(send).toHaveBeenCalledOnce();
  });
});
