/**
 * AI provider abstraction coverage (M-D.4 / R4). No live network — request
 * shaping + response parsing + provider selection + BYOK storage only.
 */
import { describe, it, expect } from 'vitest';
import {
  HostedProxyProvider,
  OpenAIDirect,
  AnthropicDirect,
  selectProvider,
  readByok,
  writeByok,
  clearByok,
  BYOK_STORAGE_KEY,
  type ChatMessage,
  type ByokStorageArea,
  type ByokRecord,
} from '../services/ai-provider';

const messages: ChatMessage[] = [
  { role: 'system', content: 'You are an analyst.' },
  { role: 'user', content: 'Analyze this.' },
];

describe('request shaping', () => {
  it('HostedProxy hits proxyUrl/v1/chat/completions with OpenAI body + subscription key', () => {
    const r = HostedProxyProvider.buildRequest(messages, { model: 'gpt', proxyUrl: 'https://proxy.example', subscriptionKey: 'SUB' });
    expect(r.url).toBe('https://proxy.example/v1/chat/completions');
    expect(r.headers['X-Subscription-Key']).toBe('SUB');
    expect(JSON.parse(r.body)).toEqual({ model: 'gpt', messages });
  });

  it('OpenAIDirect uses the OpenAI endpoint + Bearer auth', () => {
    const r = OpenAIDirect.buildRequest(messages, { model: 'gpt-4o', apiKey: 'sk-xxx' });
    expect(r.url).toBe('https://api.openai.com/v1/chat/completions');
    expect(r.headers.Authorization).toBe('Bearer sk-xxx');
    expect(JSON.parse(r.body).model).toBe('gpt-4o');
  });

  it('AnthropicDirect uses the Messages endpoint, x-api-key, and hoists system', () => {
    const r = AnthropicDirect.buildRequest(messages, { model: 'claude', apiKey: 'ant-xxx', maxTokens: 1000 });
    expect(r.url).toBe('https://api.anthropic.com/v1/messages');
    expect(r.headers['x-api-key']).toBe('ant-xxx');
    expect(r.headers['anthropic-version']).toBe('2023-06-01');
    const body = JSON.parse(r.body);
    expect(body.system).toBe('You are an analyst.');
    expect(body.max_tokens).toBe(1000);
    expect(body.messages).toEqual([{ role: 'user', content: 'Analyze this.' }]); // system hoisted out
  });
});

describe('response parsing', () => {
  it('extracts assistant text per provider shape', () => {
    expect(HostedProxyProvider.parseResponse({ choices: [{ message: { content: 'A' } }] })).toBe('A');
    expect(OpenAIDirect.parseResponse({ choices: [{ message: { content: 'B' } }] })).toBe('B');
    expect(AnthropicDirect.parseResponse({ content: [{ text: 'C' }] })).toBe('C');
    expect(HostedProxyProvider.parseResponse({})).toBe(''); // graceful
  });
});

describe('selectProvider', () => {
  it('maps ids and disables on none', () => {
    expect(selectProvider('hosted')).toBe(HostedProxyProvider);
    expect(selectProvider('openai')).toBe(OpenAIDirect);
    expect(selectProvider('anthropic')).toBe(AnthropicDirect);
    expect(selectProvider('none')).toBeNull(); // free tools keep working
  });
});

describe('BYOK storage', () => {
  function area(): ByokStorageArea & { store: Map<string, unknown> } {
    const store = new Map<string, unknown>();
    return {
      store,
      async get(k) { return { [k]: store.get(k) }; },
      async set(items) { for (const [k, v] of Object.entries(items)) store.set(k, v); },
      async remove(k) { store.delete(k); },
    };
  }
  it('round-trips + clears under react_debugger_byok_v1', async () => {
    const a = area();
    expect(await readByok(a)).toBeNull();
    const rec: ByokRecord = { provider: 'openai', apiKey: 'sk-1' };
    await writeByok(a, rec);
    expect(a.store.get(BYOK_STORAGE_KEY)).toEqual(rec);
    expect(await readByok(a)).toEqual(rec);
    await clearByok(a);
    expect(await readByok(a)).toBeNull();
  });
});
