/**
 * MCP tool + resource contracts (MCP v1, tasks 3.3/3.4, 4.1-4.8).
 *
 * Pure, extension-side source of truth for: the 6 tool input schemas, the 2
 * resource URI templates, the JSON-RPC error codes, fiber depth/cursor
 * pagination, and secret redaction. The SW validates + redacts with these
 * before replying to the bridge, so contracts stay in one testable place.
 */
import { z } from 'zod';
import { sanitizeValue } from '../utils/sanitize';

/** Panel-tab data sources exposed by get_issues (mirrors MCPTabCategory). */
export const ISSUE_TABS = ['performance', 'memory', 'cls', 'side-effects', 'redux', 'ui-state'] as const;
export type IssueTab = (typeof ISSUE_TABS)[number];

export const DEFAULT_MAX_DEPTH = 3;

// ── Tool input schemas ──────────────────────────────────────────────────────
export const getFiberNodeInput = z.object({
  tabId: z.number().int().optional(),
  maxDepth: z.number().int().min(1).max(10).default(DEFAULT_MAX_DEPTH),
  cursor: z.string().optional(),
});
export const listInspectedTabsInput = z.object({});
export const getIssuesInput = z.object({
  tabId: z.number().int(),
  tab: z.enum(ISSUE_TABS),
});
export const getRendersForInput = z.object({
  tabId: z.number().int(),
  componentName: z.string().min(1),
  since: z.number().int().optional(),
});
export const analyzePerformanceInput = z.object({
  tabId: z.number().int(),
  component: z.string().optional(),
});
export const explainReduxActionInput = z.object({
  tabId: z.number().int(),
  actionId: z.string().min(1),
});

export const TOOL_SCHEMAS = {
  get_fiber_node: getFiberNodeInput,
  list_inspected_tabs: listInspectedTabsInput,
  get_issues: getIssuesInput,
  get_renders_for: getRendersForInput,
  analyze_performance: analyzePerformanceInput,
  explain_redux_action: explainReduxActionInput,
} as const;

export type ToolName = keyof typeof TOOL_SCHEMAS;

// ── Resource templates ──────────────────────────────────────────────────────
export const RESOURCE_TEMPLATES = {
  fiberCurrent: 'react-debugger://fiber/{tabId}/current',
  issues: 'react-debugger://issues/{tabId}/{tab}',
} as const;

// ── JSON-RPC error mapping ──────────────────────────────────────────────────
export const MCP_ERROR = {
  INVALID_PARAMS: -32602,
  RATE_LIMITED: -32001,
  BUSY: -32002,
} as const;

export interface McpError {
  code: number;
  message: string;
  data?: Record<string, unknown>;
}

export function invalidParams(message: string, data?: Record<string, unknown>): McpError {
  return { code: MCP_ERROR.INVALID_PARAMS, message, data };
}
export function rateLimited(retryAfterSeconds: number): McpError {
  return {
    code: MCP_ERROR.RATE_LIMITED,
    message: 'AI Analysis quota exhausted',
    data: { retryAfterSeconds },
  };
}
export function busy(): McpError {
  return { code: MCP_ERROR.BUSY, message: 'Another AI Analysis is in progress for this tab' };
}

/** Validate a tool's input; throws {@link McpError} (-32602) on failure. */
export function validateToolInput<T extends ToolName>(
  tool: T,
  args: unknown,
): z.infer<(typeof TOOL_SCHEMAS)[T]> {
  const schema = TOOL_SCHEMAS[tool];
  const result = schema.safeParse(args ?? {});
  if (!result.success) {
    throw invalidParams(`Invalid params for ${tool}`, { issues: result.error.issues });
  }
  return result.data as z.infer<(typeof TOOL_SCHEMAS)[T]>;
}

// ── Fiber depth / cursor pagination ─────────────────────────────────────────
export interface FiberLike {
  name?: string;
  children?: FiberLike[];
  [k: string]: unknown;
}

/** Trim the tree so no node deeper than `maxDepth` retains children. */
export function truncateFiberDepth(node: FiberLike, maxDepth: number = DEFAULT_MAX_DEPTH): FiberLike {
  const walk = (n: FiberLike, depth: number): FiberLike => {
    if (!n || typeof n !== 'object') return n;
    if (depth >= maxDepth || !Array.isArray(n.children)) {
      return { ...n, children: n.children && n.children.length ? [] : n.children, truncated: depth >= maxDepth && !!n.children?.length };
    }
    return { ...n, children: n.children.map((c) => walk(c, depth + 1)) };
  };
  return walk(node, 0);
}

/** Cursor pagination over a flat list of root children. Returns a page + next cursor. */
export function paginateChildren<T>(
  children: T[],
  cursor: string | undefined,
  pageSize: number,
): { page: T[]; nextCursor?: string } {
  const start = cursor ? Number.parseInt(cursor, 10) || 0 : 0;
  const page = children.slice(start, start + pageSize);
  const end = start + page.length;
  return end < children.length ? { page, nextCursor: String(end) } : { page };
}

// ── Secret redaction (composed with the existing structural sanitizer) ───────
const SENSITIVE_KEY_RE = /(token|password|passwd|secret|api[_-]?key|authorization|auth|bearer|session|cookie|credential)/i;
/** hex >= 32 chars, base64url >= 40 chars, or JWT-like a.b.c */
const TOKEN_SHAPED_RE = /(^[0-9a-f]{32,}$)|(^[A-Za-z0-9_-]{40,}$)|(^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$)/;
export const REDACTED = '[REDACTED]';

/** Mask secret-looking keys and token-shaped strings. */
export function redactSecrets(value: unknown, keyHint?: string): unknown {
  if (typeof value === 'string') {
    if ((keyHint && SENSITIVE_KEY_RE.test(keyHint)) || TOKEN_SHAPED_RE.test(value)) return REDACTED;
    return value;
  }
  if (Array.isArray(value)) return value.map((v) => redactSecrets(v));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SENSITIVE_KEY_RE.test(k) ? REDACTED : redactSecrets(v, k);
    }
    return out;
  }
  return value;
}

/** The response path: structural sanitize THEN secret redaction. */
export function sanitizeForMcp(value: unknown): unknown {
  return redactSecrets(sanitizeValue(value));
}
