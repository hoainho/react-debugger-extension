import type { AIAnalysisResult } from '@/types';

const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;
const RATE_LIMIT_MAX_CALLS = 3;
const CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_CACHE_ENTRIES = 20;

const KEY_VALIDATION_URL = 'https://react-debugger-key-validator.remalw2019.workers.dev/validate-key';
const KEY_VALIDATION_TIMEOUT_MS = 5000;

interface CacheEntry {
  result: AIAnalysisResult;
  timestamp: number;
}

interface RateLimitEntry {
  timestamp: number;
}

class TokenOptimizer {
  private cache = new Map<string, CacheEntry>();
  private rateLimitLog: RateLimitEntry[] = [];
  private _subscriptionValid = false;
  private _subscriptionKey = '';

  get isSubscribed(): boolean {
    return this._subscriptionValid;
  }

  get subscriptionKey(): string {
    return this._subscriptionKey;
  }

  async validateSubscriptionKey(key: string): Promise<boolean> {
    if (!key || key.trim().length === 0) {
      this._subscriptionValid = false;
      this._subscriptionKey = '';
      return false;
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), KEY_VALIDATION_TIMEOUT_MS);

      const response = await fetch(KEY_VALIDATION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: key.trim() }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        this._subscriptionValid = false;
        return false;
      }

      const data = await response.json() as { valid: boolean };
      this._subscriptionValid = data.valid;
      this._subscriptionKey = key.trim();
      return data.valid;
    } catch {
      this._subscriptionValid = false;
      return false;
    }
  }

  getCachedResult(snapshotHash: string): AIAnalysisResult | null {
    const entry = this.cache.get(snapshotHash);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
      this.cache.delete(snapshotHash);
      return null;
    }

    return entry.result;
  }

  setCachedResult(snapshotHash: string, result: AIAnalysisResult): void {
    if (this.cache.size >= MAX_CACHE_ENTRIES) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }
    this.cache.set(snapshotHash, { result, timestamp: Date.now() });
  }

  checkRateLimit(): { allowed: boolean; remainingCalls: number; resetInMs: number; unlimited: boolean } {
    if (this._subscriptionValid) {
      return { allowed: true, remainingCalls: RATE_LIMIT_MAX_CALLS, resetInMs: 0, unlimited: true };
    }

    const now = Date.now();
    this.rateLimitLog = this.rateLimitLog.filter(
      entry => now - entry.timestamp < RATE_LIMIT_WINDOW_MS
    );

    const remaining = RATE_LIMIT_MAX_CALLS - this.rateLimitLog.length;
    const oldestEntry = this.rateLimitLog[0];
    const resetInMs = oldestEntry
      ? RATE_LIMIT_WINDOW_MS - (now - oldestEntry.timestamp)
      : 0;

    return {
      allowed: remaining > 0,
      remainingCalls: Math.max(0, remaining),
      resetInMs,
      unlimited: false,
    };
  }

  recordCall(): void {
    this.rateLimitLog.push({ timestamp: Date.now() });
  }

  clearCache(): void {
    this.cache.clear();
  }

  getCacheSize(): number {
    return this.cache.size;
  }

  getTotalTokensUsed(): number {
    let total = 0;
    for (const entry of this.cache.values()) {
      total += entry.result.tokenUsage.total;
    }
    return total;
  }
}

export const tokenOptimizer = new TokenOptimizer();
