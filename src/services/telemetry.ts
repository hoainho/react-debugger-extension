/**
 * Opt-in anonymous telemetry (M-F.2).
 *
 * DISABLED by default. When enabled, aggregates per-detector counters
 * (fires / dismisses / fp-link clicks) and batches them (hourly) to a
 * maintainer-owned append-only endpoint. The payload is assembled by an
 * explicit WHITELIST builder — it can only ever contain counters + the
 * extension/React versions, never host URLs, component names, or user data
 * (enforced by the payload-audit test). The network send + endpoint DEPLOY is
 * a maintainer humanGate; this module owns aggregation + opt-out + shaping.
 */
export type CounterKind = 'fire' | 'dismiss' | 'fpClick';

export interface DetectorCounters {
  detector: string;
  fires: number;
  dismisses: number;
  fpClicks: number;
}

/** The ONLY fields ever sent. No URLs, component names, or user data. */
export interface TelemetryPayload {
  detector: string;
  fires: number;
  dismisses: number;
  fpClicks: number;
  ext_version: string;
  react_version: string;
}

export interface TelemetryConfig {
  extVersion: string;
  reactVersion: string;
}

export const HOURLY_MS = 3_600_000;

/** Build a payload from a counter — explicit whitelist, drops any extra fields. */
export function buildTelemetryPayload(counter: DetectorCounters, cfg: TelemetryConfig): TelemetryPayload {
  return {
    detector: counter.detector,
    fires: counter.fires,
    dismisses: counter.dismisses,
    fpClicks: counter.fpClicks,
    ext_version: cfg.extVersion,
    react_version: cfg.reactVersion,
  };
}

export interface RecorderOptions {
  enabled: () => boolean; // opt-in flag (default OFF at the call site)
  now: () => number;
  send: (payloads: TelemetryPayload[]) => void;
  cfg: TelemetryConfig;
  intervalMs?: number;
}

export class TelemetryRecorder {
  private counters = new Map<string, DetectorCounters>();
  private lastFlush: number;
  private readonly intervalMs: number;

  constructor(private opts: RecorderOptions) {
    this.intervalMs = opts.intervalMs ?? HOURLY_MS;
    this.lastFlush = opts.now();
  }

  /** Record one event for a detector. No-op while telemetry is disabled. */
  record(detector: string, kind: CounterKind): void {
    if (!this.opts.enabled()) return;
    const c = this.counters.get(detector) ?? { detector, fires: 0, dismisses: 0, fpClicks: 0 };
    if (kind === 'fire') c.fires++;
    else if (kind === 'dismiss') c.dismisses++;
    else c.fpClicks++;
    this.counters.set(detector, c);
  }

  /** Flush buffered counters now. No-op (and buffer preserved) while disabled. */
  flush(): void {
    if (!this.opts.enabled()) return;
    if (this.counters.size === 0) {
      this.lastFlush = this.opts.now();
      return;
    }
    const payloads = [...this.counters.values()].map((c) => buildTelemetryPayload(c, this.opts.cfg));
    this.opts.send(payloads);
    this.counters.clear();
    this.lastFlush = this.opts.now();
  }

  /** Flush only if at least `intervalMs` has elapsed since the last flush. */
  maybeFlush(): void {
    if (!this.opts.enabled()) return;
    if (this.opts.now() - this.lastFlush >= this.intervalMs) this.flush();
  }
}
