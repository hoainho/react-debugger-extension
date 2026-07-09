/**
 * AI provider abstraction (M-D.4 / R4).
 *
 * Pluggable request-shaping + response-parsing strategies so AI Analysis can go
 * through the hosted proxy (default, preserves current behavior), OR directly
 * to OpenAI / Anthropic with a user's own key (BYOK). Kept as request
 * DESCRIPTORS ({url, headers, body}) rather than performing fetch, so the
 * shaping is unit-testable without a live network call (the caller does the
 * fetch). `provider: 'none'` disables AI; the free panel tools keep working.
 *
 * HostedProxyProvider reproduces the exact request analyzeSnapshot already
 * makes (`${proxyUrl}/v1/chat/completions`, OpenAI chat format), so routing
 * through it is behavior-preserving by construction.
 */

export type ProviderId = 'hosted' | 'openai' | 'anthropic' | 'none';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  url: string;
  headers: Record<string, string>;
  body: string; // JSON-serialized request body
}

export interface ProviderConfig {
  model: string;
  maxTokens?: number;
  proxyUrl?: string; // hosted
  apiKey?: string; // openai / anthropic (BYOK)
  subscriptionKey?: string; // hosted
}

export interface AIProvider {
  readonly id: ProviderId;
  buildRequest(messages: ChatMessage[], config: ProviderConfig): ChatRequest;
  /** Extract the assistant text from the provider's JSON response. */
  parseResponse(json: unknown): string;
}

const DEFAULT_MAX_TOKENS = 2048;

export const HostedProxyProvider: AIProvider = {
  id: 'hosted',
  buildRequest(messages, config) {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (config.subscriptionKey) headers['X-Subscription-Key'] = config.subscriptionKey;
    return {
      url: `${config.proxyUrl ?? ''}/v1/chat/completions`,
      headers,
      body: JSON.stringify({ model: config.model, messages }),
    };
  },
  parseResponse(json) {
    return (json as { choices?: Array<{ message?: { content?: string } }> })?.choices?.[0]?.message?.content ?? '';
  },
};

export const OpenAIDirect: AIProvider = {
  id: 'openai',
  buildRequest(messages, config) {
    return {
      url: 'https://api.openai.com/v1/chat/completions',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey ?? ''}`,
      },
      body: JSON.stringify({ model: config.model, messages }),
    };
  },
  parseResponse(json) {
    return (json as { choices?: Array<{ message?: { content?: string } }> })?.choices?.[0]?.message?.content ?? '';
  },
};

export const AnthropicDirect: AIProvider = {
  id: 'anthropic',
  buildRequest(messages, config) {
    const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n');
    const rest = messages.filter((m) => m.role !== 'system');
    return {
      url: 'https://api.anthropic.com/v1/messages',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey ?? '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: config.maxTokens ?? DEFAULT_MAX_TOKENS,
        ...(system ? { system } : {}),
        messages: rest,
      }),
    };
  },
  parseResponse(json) {
    return (json as { content?: Array<{ text?: string }> })?.content?.[0]?.text ?? '';
  },
};

const PROVIDERS: Record<Exclude<ProviderId, 'none'>, AIProvider> = {
  hosted: HostedProxyProvider,
  openai: OpenAIDirect,
  anthropic: AnthropicDirect,
};

/** Resolve the provider strategy, or null when AI is disabled ('none'). */
export function selectProvider(id: ProviderId): AIProvider | null {
  if (id === 'none') return null;
  return PROVIDERS[id] ?? HostedProxyProvider;
}

// ── BYOK key storage ─────────────────────────────────────────────────────────
export const BYOK_STORAGE_KEY = 'react_debugger_byok_v1';

export interface ByokRecord {
  provider: ProviderId;
  apiKey: string;
}

export interface ByokStorageArea {
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(key: string): Promise<void>;
}

export async function readByok(area: ByokStorageArea): Promise<ByokRecord | null> {
  const rec = await area.get(BYOK_STORAGE_KEY);
  return (rec?.[BYOK_STORAGE_KEY] as ByokRecord | undefined) ?? null;
}
export async function writeByok(area: ByokStorageArea, record: ByokRecord): Promise<void> {
  await area.set({ [BYOK_STORAGE_KEY]: record });
}
export async function clearByok(area: ByokStorageArea): Promise<void> {
  await area.remove(BYOK_STORAGE_KEY);
}
