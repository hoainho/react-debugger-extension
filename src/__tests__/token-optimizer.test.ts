import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import type { AIAnalysisResult } from '../types';

let tokenOptimizer: typeof import('../services/token-optimizer')['tokenOptimizer'];

function makeResult(overrides: Partial<AIAnalysisResult> = {}): AIAnalysisResult {
  return {
    id: 'ai-1',
    timestamp: Date.now(),
    snapshotHash: 'abc123',
    model: 'gemini-flash',
    summary: 'All good',
    security: [],
    crashRisks: [],
    performance: [],
    rootCauses: [],
    suggestions: [],
    tokenUsage: { prompt: 100, completion: 50, total: 150 },
    latencyMs: 200,
    ...overrides,
  };
}

beforeEach(async () => {
  vi.resetModules();
  const mod = await import('../services/token-optimizer');
  tokenOptimizer = mod.tokenOptimizer;
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('checkRateLimit', () => {
  it('allows calls and shows 3 remaining before any calls are recorded', () => {
    expect(tokenOptimizer.checkRateLimit()).toEqual({
      allowed: true,
      remainingCalls: 3,
      resetInMs: 0,
      unlimited: false,
    });
  });

  it('decrements remaining calls after each recorded call', () => {
    tokenOptimizer.recordCall();
    expect(tokenOptimizer.checkRateLimit()).toMatchObject({ allowed: true, remainingCalls: 2 });

    tokenOptimizer.recordCall();
    expect(tokenOptimizer.checkRateLimit()).toMatchObject({ allowed: true, remainingCalls: 1 });
  });

  it('blocks the fourth call inside the free window', () => {
    tokenOptimizer.recordCall();
    tokenOptimizer.recordCall();
    tokenOptimizer.recordCall();

    expect(tokenOptimizer.checkRateLimit()).toMatchObject({
      allowed: false,
      remainingCalls: 0,
      unlimited: false,
    });
  });

  it('reports reset time while rate limited', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));

    tokenOptimizer.recordCall();
    tokenOptimizer.recordCall();
    tokenOptimizer.recordCall();
    vi.advanceTimersByTime(60_000);

    const result = tokenOptimizer.checkRateLimit();

    expect(result.allowed).toBe(false);
    expect(result.resetInMs).toBe(4 * 60 * 1000);
  });

  it('expires calls outside the 5-minute sliding window', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));

    tokenOptimizer.recordCall();
    tokenOptimizer.recordCall();
    tokenOptimizer.recordCall();
    vi.advanceTimersByTime(5 * 60 * 1000 + 1);

    expect(tokenOptimizer.checkRateLimit()).toMatchObject({ allowed: true, remainingCalls: 3 });
  });

});

describe('getCachedResult', () => {
  it('returns null for a key that was never set', () => {
    expect(tokenOptimizer.getCachedResult('missing')).toBeNull();
  });

  it('returns the result immediately after setting it', () => {
    const result = makeResult();
    tokenOptimizer.setCachedResult('hash-1', result);

    expect(tokenOptimizer.getCachedResult('hash-1')).toEqual(result);
  });

  it('returns null for an expired entry after the 10-minute TTL', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));

    tokenOptimizer.setCachedResult('hash-ttl', makeResult());
    vi.advanceTimersByTime(10 * 60 * 1000 + 1);

    expect(tokenOptimizer.getCachedResult('hash-ttl')).toBeNull();
  });

  it('keeps an entry within the 10-minute TTL', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const result = makeResult();

    tokenOptimizer.setCachedResult('hash-fresh', result);
    vi.advanceTimersByTime(9 * 60 * 1000);

    expect(tokenOptimizer.getCachedResult('hash-fresh')).toEqual(result);
  });
});

describe('setCachedResult', () => {
  it('evicts the oldest entry when the cache reaches 20 entries', () => {
    for (let index = 0; index < 20; index += 1) {
      tokenOptimizer.setCachedResult(`hash-${index}`, makeResult({ id: `ai-${index}` }));
    }

    tokenOptimizer.setCachedResult('hash-overflow', makeResult({ id: 'ai-overflow' }));

    expect(tokenOptimizer.getCacheSize()).toBe(20);
    expect(tokenOptimizer.getCachedResult('hash-0')).toBeNull();
    expect(tokenOptimizer.getCachedResult('hash-overflow')).not.toBeNull();
  });

});

describe('clearCache', () => {
  it('removes all cached entries', () => {
    tokenOptimizer.setCachedResult('a', makeResult());
    tokenOptimizer.setCachedResult('b', makeResult());

    tokenOptimizer.clearCache();

    expect(tokenOptimizer.getCacheSize()).toBe(0);
    expect(tokenOptimizer.getCachedResult('a')).toBeNull();
  });
});

describe('getCacheSize', () => {
  it('returns 0 on a fresh instance', () => {
    expect(tokenOptimizer.getCacheSize()).toBe(0);
  });

  it('increments after each new cached result', () => {
    tokenOptimizer.setCachedResult('x', makeResult());
    tokenOptimizer.setCachedResult('y', makeResult());

    expect(tokenOptimizer.getCacheSize()).toBe(2);
  });
});

describe('getTotalTokensUsed', () => {
  it('returns 0 when cache is empty', () => {
    expect(tokenOptimizer.getTotalTokensUsed()).toBe(0);
  });

  it('sums total tokens across cached entries', () => {
    tokenOptimizer.setCachedResult('h1', makeResult({ tokenUsage: { prompt: 100, completion: 50, total: 150 } }));
    tokenOptimizer.setCachedResult('h2', makeResult({ tokenUsage: { prompt: 200, completion: 100, total: 300 } }));

    expect(tokenOptimizer.getTotalTokensUsed()).toBe(450);
  });
});

describe('validateSubscriptionKey', () => {
  it('returns false and stays unsubscribed for an empty key', async () => {
    await expect(tokenOptimizer.validateSubscriptionKey('')).resolves.toBe(false);
    expect(tokenOptimizer.isSubscribed).toBe(false);
    expect(tokenOptimizer.subscriptionKey).toBe('');
  });

  it('returns false and stays unsubscribed for whitespace-only keys', async () => {
    await expect(tokenOptimizer.validateSubscriptionKey('   ')).resolves.toBe(false);
    expect(tokenOptimizer.isSubscribed).toBe(false);
  });

  it('returns false when the validation endpoint returns non-ok status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403, json: async () => ({ valid: false }) }));

    await expect(tokenOptimizer.validateSubscriptionKey('some-key')).resolves.toBe(false);
    expect(tokenOptimizer.isSubscribed).toBe(false);
  });

  it('returns false when the validation request throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network failure')));

    await expect(tokenOptimizer.validateSubscriptionKey('some-key')).resolves.toBe(false);
    expect(tokenOptimizer.isSubscribed).toBe(false);
  });

  it('returns true and stores trimmed key when endpoint returns valid', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ valid: true }) }));

    await expect(tokenOptimizer.validateSubscriptionKey('  good-key  ')).resolves.toBe(true);
    expect(tokenOptimizer.isSubscribed).toBe(true);
    expect(tokenOptimizer.subscriptionKey).toBe('good-key');
  });

  it('allows unlimited calls when subscribed', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ valid: true }) }));

    await tokenOptimizer.validateSubscriptionKey('good-key');
    tokenOptimizer.recordCall();
    tokenOptimizer.recordCall();
    tokenOptimizer.recordCall();

    expect(tokenOptimizer.checkRateLimit()).toMatchObject({ allowed: true, unlimited: true });
  });
});
