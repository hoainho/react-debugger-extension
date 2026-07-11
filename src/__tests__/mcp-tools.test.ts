/**
 * MCP tool-contract coverage (MCP v1, tasks 3.3/3.4, 4.1-4.8).
 */
import { describe, it, expect } from 'vitest';
import {
  TOOL_SCHEMAS,
  RESOURCE_TEMPLATES,
  ISSUE_TABS,
  MCP_ERROR,
  validateToolInput,
  invalidParams,
  rateLimited,
  busy,
  truncateFiberDepth,
  paginateChildren,
  redactSecrets,
  sanitizeForMcp,
  REDACTED,
  DEFAULT_MAX_DEPTH,
  type McpError,
  type FiberLike,
} from '../mcp/tools';

describe('tool + resource registry', () => {
  it('registers the 6 v1 tools and 2 resource templates', () => {
    expect(Object.keys(TOOL_SCHEMAS).sort()).toEqual(
      ['analyze_performance', 'explain_redux_action', 'get_fiber_node', 'get_issues', 'get_renders_for', 'list_inspected_tabs'],
    );
    expect(RESOURCE_TEMPLATES.fiberCurrent).toBe('react-debugger://fiber/{tabId}/current');
    expect(RESOURCE_TEMPLATES.issues).toBe('react-debugger://issues/{tabId}/{tab}');
  });

  it('get_fiber_node defaults maxDepth to 3', () => {
    expect(validateToolInput('get_fiber_node', { tabId: 1 }).maxDepth).toBe(DEFAULT_MAX_DEPTH);
  });
});

describe('error mapping', () => {
  it('invalid get_issues tab -> -32602', () => {
    try {
      validateToolInput('get_issues', { tabId: 1, tab: 'not-a-tab' });
      throw new Error('should have thrown');
    } catch (e) {
      const err = e as McpError;
      expect(err.code).toBe(MCP_ERROR.INVALID_PARAMS);
      expect(err.code).toBe(-32602);
    }
    // every declared tab is accepted
    for (const tab of ISSUE_TABS) {
      expect(validateToolInput('get_issues', { tabId: 1, tab }).tab).toBe(tab);
    }
  });

  it('quota exhaustion -> -32001 with retryAfterSeconds; concurrent AI -> -32002', () => {
    expect(rateLimited(1800)).toEqual({
      code: -32001,
      message: expect.any(String),
      data: { retryAfterSeconds: 1800 },
    });
    expect(busy().code).toBe(-32002);
    expect(invalidParams('x').code).toBe(-32602);
  });
});

describe('fiber depth + cursor pagination', () => {
  const tree: FiberLike = {
    name: 'App',
    children: [{ name: 'A', children: [{ name: 'A1', children: [{ name: 'A1x', children: [{ name: 'deep' }] }] }] }],
  };
  it('truncates children beyond maxDepth', () => {
    const t = truncateFiberDepth(tree, 2);
    // depth 0 App -> 1 A -> 2 A1 (children cut)
    const a1 = t.children![0].children![0];
    expect(a1.name).toBe('A1');
    expect(a1.children).toEqual([]);
    expect(a1.truncated).toBe(true);
  });
  it('paginates root children with a next cursor', () => {
    const kids = Array.from({ length: 5 }, (_, i) => i);
    const p1 = paginateChildren(kids, undefined, 2);
    expect(p1).toEqual({ page: [0, 1], nextCursor: '2' });
    const p3 = paginateChildren(kids, '4', 2);
    expect(p3).toEqual({ page: [4] }); // last page, no nextCursor
  });
});

describe('secret redaction (PII path)', () => {
  it('redacts sensitive keys and token-shaped strings, keeps benign data', () => {
    const out = sanitizeForMcp({
      title: 'UserCard',
      count: 3,
      props: {
        password: 'hunter2',
        apiKey: 'k',
        token: 'x',
        authHeader: 'Bearer abc',
        sessionId: 'abcdef0123456789abcdef0123456789', // 32-hex token-shaped
        label: 'safe-value',
      },
    }) as Record<string, Record<string, unknown>>;
    expect(out.title).toBe('UserCard');
    expect(out.count).toBe(3);
    expect(out.props.password).toBe(REDACTED);
    expect(out.props.apiKey).toBe(REDACTED);
    expect(out.props.token).toBe(REDACTED);
    expect(out.props.authHeader).toBe(REDACTED); // key matches /auth/
    expect(out.props.sessionId).toBe(REDACTED);
    expect(out.props.label).toBe('safe-value');
  });

  it('redacts a bare token-shaped value even under a benign key', () => {
    const jwt = 'eyJhbGciOi.eyJzdWIiOi.SflKxwRJSMeKKF2QT4';
    expect((redactSecrets({ note: jwt }) as Record<string, unknown>).note).toBe(REDACTED);
    const hex64 = 'a'.repeat(64);
    expect((redactSecrets({ ref: hex64 }) as Record<string, unknown>).ref).toBe(REDACTED);
  });
});
