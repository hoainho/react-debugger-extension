import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import type { AIAnalysisSnapshot } from '../types';

let analyzeSnapshot: typeof import('../services/ai-client')['analyzeSnapshot'];
let AIAnalysisError: typeof import('../services/ai-client')['AIAnalysisError'];

const VALID_AI_BODY = JSON.stringify({
  summary: 'App looks healthy.',
  security: [],
  crashRisks: [],
  performance: [
    {
      title: 'Re-renders',
      severity: 'warning',
      description: 'Too many renders',
      suggestion: 'Memoize',
    },
  ],
  rootCauses: [],
  suggestions: [],
});

function makeSnapshot(overrides: Partial<AIAnalysisSnapshot> = {}): AIAnalysisSnapshot {
  return {
    issues: [
      { type: 'MISSING_KEY', severity: 'warning', component: 'List', message: 'Missing key', suggestion: 'Add key' },
    ],
    components: [{ name: 'App', renderCount: 5, avgDuration: 10 }],
    crashes: [],
    memory: null,
    pageMetrics: null,
    reactVersion: '18.2.0',
    reactMode: 'development',
    totalRenders: 5,
    totalTimelineEvents: 0,
    ...overrides,
  };
}

function makeOpenAIResponse(content: string) {
  return {
    choices: [{ message: { content } }],
    usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
  };
}

beforeEach(async () => {
  vi.resetModules();
  const optimizerMod = await import('../services/token-optimizer');
  optimizerMod.tokenOptimizer.clearCache();

  const mod = await import('../services/ai-client');
  analyzeSnapshot = mod.analyzeSnapshot;
  AIAnalysisError = mod.AIAnalysisError;
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('analyzeSnapshot empty snapshot guard', () => {
  it('throws EMPTY_SNAPSHOT when no analyzable data is present', async () => {
    await expect(analyzeSnapshot(makeSnapshot({
      issues: [],
      components: [],
      crashes: [],
      memory: null,
      pageMetrics: null,
      totalRenders: 0,
    }))).rejects.toMatchObject({
      name: 'AIAnalysisError',
      code: 'EMPTY_SNAPSHOT',
    });
  });

  it('does not throw EMPTY_SNAPSHOT when only memory is populated', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => makeOpenAIResponse(VALID_AI_BODY),
    }));

    const result = await analyzeSnapshot(makeSnapshot({
      issues: [],
      components: [],
      crashes: [],
      memory: { usedMB: 50, totalMB: 100, limitMB: 2048, growthRateKBs: 0, warnings: [] },
      totalRenders: 0,
    }));

    expect(result.summary).toBe('App looks healthy.');
  });
});

describe('analyzeSnapshot happy path', () => {
  it('returns a structured AIAnalysisResult on a valid fetch response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => makeOpenAIResponse(VALID_AI_BODY),
    }));

    const result = await analyzeSnapshot(makeSnapshot());

    expect(result.summary).toBe('App looks healthy.');
    expect(result.performance).toHaveLength(1);
    expect(result.performance[0].title).toBe('Re-renders');
    expect(result.tokenUsage).toEqual({ prompt: 100, completion: 50, total: 150 });
    expect(result.model).toBe('gemini-2.5-flash-lite');
    expect(result.id).toMatch(/^ai-/);
    expect(result.snapshotHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('strips markdown JSON code fences before parsing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => makeOpenAIResponse(`\`\`\`json\n${VALID_AI_BODY}\n\`\`\``),
    }));

    await expect(analyzeSnapshot(makeSnapshot())).resolves.toMatchObject({ summary: 'App looks healthy.' });
  });

  it('returns a cached result on the second call with the same snapshot', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => makeOpenAIResponse(VALID_AI_BODY),
    });
    vi.stubGlobal('fetch', fetchMock);

    const snapshot = makeSnapshot();
    const first = await analyzeSnapshot(snapshot);
    const second = await analyzeSnapshot(snapshot);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(second.snapshotHash).toBe(first.snapshotHash);
    expect(second.id).not.toBe(first.id);
  });
});

describe('analyzeSnapshot error paths', () => {
  it('throws NETWORK_ERROR when fetch rejects', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Connection refused')));

    await expect(analyzeSnapshot(makeSnapshot())).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
  });

  it('throws AUTH_ERROR on 401', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401, statusText: 'Unauthorized' }));

    await expect(analyzeSnapshot(makeSnapshot())).rejects.toMatchObject({ code: 'AUTH_ERROR' });
  });

  it('throws RATE_LIMITED with retry metadata on 429', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 429, statusText: 'Too Many Requests' }));

    await expect(analyzeSnapshot(makeSnapshot())).rejects.toMatchObject({
      code: 'RATE_LIMITED',
      retryAfterMs: 60000,
    });
  });

  it('throws PROXY_ERROR on generic HTTP failures', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503, statusText: 'Service Unavailable' }));

    await expect(analyzeSnapshot(makeSnapshot())).rejects.toMatchObject({ code: 'PROXY_ERROR' });
  });

  it('throws ABORTED when the fetch rejects with AbortError', async () => {
    const controller = new AbortController();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new DOMException('The operation was aborted.', 'AbortError')));

    await expect(analyzeSnapshot(makeSnapshot(), { signal: controller.signal })).rejects.toMatchObject({ code: 'ABORTED' });
  });

  it('throws PARSE_ERROR when response JSON parsing fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => {
        throw new SyntaxError('Bad JSON');
      },
    }));

    await expect(analyzeSnapshot(makeSnapshot())).rejects.toMatchObject({ code: 'PARSE_ERROR' });
  });

  it('throws PARSE_ERROR when model content is missing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [], usage: {} }),
    }));

    await expect(analyzeSnapshot(makeSnapshot())).rejects.toMatchObject({ code: 'PARSE_ERROR' });
  });

  it('falls back to raw text as summary when model content is not JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => makeOpenAIResponse('This is just plain text, not JSON at all.'),
    }));

    const result = await analyzeSnapshot(makeSnapshot());

    expect(result.summary).toContain('This is just plain text');
    expect(result.suggestions).toEqual([
      expect.objectContaining({ title: 'Raw Analysis', severity: 'info' }),
    ]);
  });
});

describe('AIAnalysisError', () => {
  it('sets name, message, and code correctly', () => {
    const error = new AIAnalysisError('Something went wrong', 'NETWORK_ERROR');

    expect(error.name).toBe('AIAnalysisError');
    expect(error.message).toBe('Something went wrong');
    expect(error.code).toBe('NETWORK_ERROR');
    expect(error).toBeInstanceOf(Error);
  });

  it('stores optional retryAfterMs when provided', () => {
    const error = new AIAnalysisError('Rate limited', 'RATE_LIMITED', 30_000);

    expect(error.retryAfterMs).toBe(30_000);
  });
});
