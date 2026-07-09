/**
 * SW MCP client scheduling coverage (MCP v1, tasks 2.11, 2.12).
 * The socket/WebSocket wiring is a humanGate; here we lock the pure schedule.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  backoffDelay,
  startKeepalive,
  MCP_KEEPALIVE_MS,
  BACKOFF_CAP_MS,
} from '../background/mcp-client';

describe('backoffDelay', () => {
  it('is exponential from 1s and capped at 30s', () => {
    expect(backoffDelay(0)).toBe(1_000);
    expect(backoffDelay(1)).toBe(2_000);
    expect(backoffDelay(2)).toBe(4_000);
    expect(backoffDelay(3)).toBe(8_000);
    expect(backoffDelay(4)).toBe(16_000);
    expect(backoffDelay(5)).toBe(BACKOFF_CAP_MS); // 32s → capped 30s
    expect(backoffDelay(20)).toBe(BACKOFF_CAP_MS);
  });
});

describe('startKeepalive', () => {
  it('pings on the 20s interval while connected and stops on cancel', () => {
    expect(MCP_KEEPALIVE_MS).toBe(20_000);
    const send = vi.fn();
    let captured: (() => void) | null = null;
    const timers = {
      setInterval: (fn: () => void) => {
        captured = fn;
        return 1;
      },
      clearInterval: vi.fn(),
    };
    const stop = startKeepalive({ send }, timers);
    // simulate the interval firing twice
    captured!();
    captured!();
    expect(send).toHaveBeenCalledTimes(2);
    expect(JSON.parse(send.mock.calls[0][0]).type).toBe('ping');
    stop();
    expect(timers.clearInterval).toHaveBeenCalledWith(1);
  });
});
