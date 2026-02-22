import type { AIConfig, AIAnalysisResult, AIAnalysisSnapshot, AIAnalysisItem } from '@/types';
import { DEFAULT_AI_CONFIG } from '@/types';
import { snapshotToPromptText, hashSnapshot } from './snapshot-builder';
import { tokenOptimizer } from './token-optimizer';

const SYSTEM_PROMPT = `You are an expert React performance analyst and security auditor. Analyze the following React application debug snapshot and provide a structured analysis.

RESPOND IN VALID JSON with this exact structure:
{
  "summary": "1-2 sentence overview of the application's health",
  "security": [{"title": "...", "severity": "critical|warning|info|success", "description": "...", "suggestion": "...", "affectedComponents": ["..."]}],
  "crashRisks": [{"title": "...", "severity": "critical|warning|info|success", "description": "...", "suggestion": "...", "affectedComponents": ["..."]}],
  "performance": [{"title": "...", "severity": "critical|warning|info|success", "description": "...", "suggestion": "...", "affectedComponents": ["..."]}],
  "rootCauses": [{"title": "...", "severity": "critical|warning|info|success", "description": "...", "suggestion": "..."}],
  "suggestions": [{"title": "...", "severity": "info", "description": "...", "suggestion": "..."}]
}

Rules:
- Each category can have 0-5 items
- severity: "critical" = immediate fix needed, "warning" = should fix, "info" = good to know, "success" = doing well
- Be specific with component names and code patterns
- If no issues in a category, return empty array
- Focus on actionable insights, not generic advice
- For security: check for XSS risks, unsafe patterns, dev mode in production
- For crashes: analyze error patterns, memory pressure, infinite loops
- For performance: excessive re-renders, slow components, missing memoization
- For root causes: WHY issues happen, not just WHAT
- For suggestions: prioritized, specific code-level recommendations`;

export interface AnalysisOptions {
  config?: Partial<AIConfig>;
  signal?: AbortSignal;
}

export class AIAnalysisError extends Error {
  constructor(
    message: string,
    public readonly code: 'RATE_LIMITED' | 'NETWORK_ERROR' | 'AUTH_ERROR' | 'PARSE_ERROR' | 'EMPTY_SNAPSHOT' | 'PROXY_ERROR' | 'ABORTED',
    public readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = 'AIAnalysisError';
  }
}

function parseAIResponse(raw: string): Omit<AIAnalysisResult, 'id' | 'timestamp' | 'snapshotHash' | 'model' | 'tokenUsage' | 'latencyMs'> {
  let text = raw.trim();

  // Strip markdown code fences if present
  if (text.startsWith('```')) {
    const firstNewline = text.indexOf('\n');
    text = text.slice(firstNewline + 1);
    const lastFence = text.lastIndexOf('```');
    if (lastFence > 0) {
      text = text.slice(0, lastFence);
    }
  }

  try {
    const parsed = JSON.parse(text.trim());
    const ensureArray = (val: unknown): AIAnalysisItem[] => {
      if (!Array.isArray(val)) return [];
      return val.filter(
        (item: unknown) =>
          typeof item === 'object' &&
          item !== null &&
          typeof (item as AIAnalysisItem).title === 'string' &&
          typeof (item as AIAnalysisItem).description === 'string',
      ) as AIAnalysisItem[];
    };

    return {
      summary: typeof parsed.summary === 'string' ? parsed.summary : 'Analysis complete.',
      security: ensureArray(parsed.security),
      crashRisks: ensureArray(parsed.crashRisks),
      performance: ensureArray(parsed.performance),
      rootCauses: ensureArray(parsed.rootCauses),
      suggestions: ensureArray(parsed.suggestions),
    };
  } catch {
    // Fallback: treat entire response as summary
    return {
      summary: text.slice(0, 500),
      security: [],
      crashRisks: [],
      performance: [],
      rootCauses: [],
      suggestions: [{
        title: 'Raw Analysis',
        severity: 'info',
        description: text.slice(0, 2000),
      }],
    };
  }
}

export async function analyzeSnapshot(
  snapshot: AIAnalysisSnapshot,
  options: AnalysisOptions = {},
): Promise<AIAnalysisResult> {
  // 1. Check for empty snapshot
  if (
    snapshot.issues.length === 0 &&
    snapshot.components.length === 0 &&
    snapshot.crashes.length === 0 &&
    !snapshot.memory
  ) {
    throw new AIAnalysisError(
      'No data to analyze. Enable debugging and interact with the page first.',
      'EMPTY_SNAPSHOT',
    );
  }

  // 2. Hash & check cache
  const snapshotHash = await hashSnapshot(snapshot);
  const cached = tokenOptimizer.getCachedResult(snapshotHash);
  if (cached) {
    return { ...cached, id: generateId() };
  }

  // 3. Rate limit check
  const rateCheck = tokenOptimizer.checkRateLimit();
  if (!rateCheck.allowed) {
    throw new AIAnalysisError(
      `Rate limit reached. ${rateCheck.remainingCalls} calls remaining. Try again in ${Math.ceil(rateCheck.resetInMs / 1000)}s.`,
      'RATE_LIMITED',
      rateCheck.resetInMs,
    );
  }

  // 4. Build config
  const config: AIConfig = { ...DEFAULT_AI_CONFIG, ...options.config };

  // 5. Build prompt
  const userPrompt = snapshotToPromptText(snapshot);

  // 6. Make API call
  const startTime = performance.now();

  let response: Response;
  try {
    response = await fetch(`${config.proxyUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: config.maxTokens,
        temperature: 0.3,
      }),
      signal: options.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new AIAnalysisError('Analysis cancelled.', 'ABORTED');
    }
    throw new AIAnalysisError(
      `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'NETWORK_ERROR',
    );
  }

  const latencyMs = Math.round(performance.now() - startTime);

  if (!response.ok) {
    if (response.status === 401) {
      throw new AIAnalysisError('Invalid API key. Check your settings.', 'AUTH_ERROR');
    }
    if (response.status === 429) {
      throw new AIAnalysisError('Proxy rate limit reached. Try again later.', 'RATE_LIMITED', 60000);
    }
    throw new AIAnalysisError(
      `Proxy error: ${response.status} ${response.statusText}`,
      'PROXY_ERROR',
    );
  }

  let responseData: {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  };

  try {
    responseData = await response.json();
  } catch {
    throw new AIAnalysisError('Failed to parse proxy response.', 'PARSE_ERROR');
  }

  const content = responseData.choices?.[0]?.message?.content;
  if (!content) {
    throw new AIAnalysisError('Empty response from AI model.', 'PARSE_ERROR');
  }

  // 7. Parse response
  const parsed = parseAIResponse(content);
  const tokenUsage = {
    prompt: responseData.usage?.prompt_tokens ?? 0,
    completion: responseData.usage?.completion_tokens ?? 0,
    total: responseData.usage?.total_tokens ?? 0,
  };

  // 8. Build result
  const result: AIAnalysisResult = {
    id: generateId(),
    timestamp: Date.now(),
    snapshotHash,
    model: config.model,
    ...parsed,
    tokenUsage,
    latencyMs,
  };

  // 9. Cache & record
  tokenOptimizer.recordCall();
  tokenOptimizer.setCachedResult(snapshotHash, result);

  return result;
}

function generateId(): string {
  return `ai-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export async function loadAIConfig(): Promise<AIConfig> {
  try {
    const result = await chrome.storage.local.get('ai_config');
    if (result.ai_config) {
      return { ...DEFAULT_AI_CONFIG, ...result.ai_config };
    }
  } catch {
    // Storage access may fail in some contexts
  }
  return { ...DEFAULT_AI_CONFIG };
}

export async function saveAIConfig(config: Partial<AIConfig>): Promise<void> {
  const current = await loadAIConfig();
  const merged = { ...current, ...config };
  await chrome.storage.local.set({ ai_config: merged });
}
