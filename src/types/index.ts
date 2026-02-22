export type IssueSeverity = 'error' | 'warning' | 'info';

export type IssueType =
  | 'DIRECT_STATE_MUTATION'
  | 'MISSING_KEY'
  | 'INDEX_AS_KEY'
  | 'DUPLICATE_KEY'
  | 'MISSING_CLEANUP'
  | 'MISSING_DEP'
  | 'EXTRA_DEP'
  | 'INFINITE_LOOP_RISK'
  | 'EXCESSIVE_RERENDERS'
  | 'UNNECESSARY_RERENDER'
  | 'DEV_MODE_IN_PROD'
  | 'STALE_CLOSURE'
  | 'STALE_CLOSURE_RISK'
  | 'SLOW_RENDER'
  | 'MEMORY_GROWTH'
  | 'POTENTIAL_MEMORY_LEAK';

export interface IssueLocation {
  componentName: string;
  componentPath: string[];
  elementType?: string;
  elementIndex?: number;
  listLength?: number;
  childElements?: Array<{
    type: string;
    key: string | null;
    index: number;
  }>;
  closureInfo?: {
    functionName: string;
    createdAtRender: number;
    executedAtRender: number;
    capturedValues: Array<{
      name: string;
      capturedValue: unknown;
      currentValue: unknown;
    }>;
    asyncType?: 'setTimeout' | 'setInterval' | 'promise' | 'eventListener' | 'callback';
  };
}

export interface Issue {
  id: string;
  type: IssueType;
  severity: IssueSeverity;
  component: string;
  message: string;
  suggestion: string;
  code?: string;
  timestamp: number;
  fiberId?: string;
  location?: IssueLocation;
}

export interface ComponentInfo {
  id: string;
  name: string;
  path: string;
  props: Record<string, unknown>;
  state: unknown;
  renderCount: number;
  lastRenderTime: number;
  children: string[];
}

export interface RenderInfo {
  componentId: string;
  componentName: string;
  renderCount: number;
  lastRenderTime: number;
  renderDurations: number[];
  selfDurations: number[];
  triggerReasons: TriggerReason[];
}

export interface MemorySnapshot {
  timestamp: number;
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

export interface MemoryReport {
  current: MemorySnapshot | null;
  history: MemorySnapshot[];
  growthRate: number;
  peakUsage: number;
  warnings: string[];
  crashes: CrashEntry[];
}

// ============================================
// Page Load Metrics
// ============================================

export interface PageLoadMetrics {
  fcp: number | null;           // First Contentful Paint (ms)
  lcp: number | null;           // Largest Contentful Paint (ms)
  ttfb: number | null;          // Time to First Byte (ms)
  domContentLoaded: number | null;
  loadComplete: number | null;
  timestamp: number;
}

// ============================================
// Crash Detection
// ============================================

export type CrashType = 'js-error' | 'unhandled-rejection' | 'react-error';

export interface CrashEntry {
  id: string;
  timestamp: number;
  type: CrashType;
  message: string;
  stack?: string;
  componentStack?: string;
  source?: string;
  lineno?: number;
  colno?: number;
  memorySnapshot?: MemorySnapshot;
  analysisHints: string[];
}

// ============================================
// Timeline Events
// ============================================

export type TimelineEventType = 'render' | 'state-change' | 'effect' | 'error' | 'memory' | 'context-change';

export interface PropChange {
  key: string;
  oldValue: string;
  newValue: string;
}

export interface RenderEventPayload {
  componentName: string;
  componentId: string;
  trigger: 'props' | 'state' | 'context' | 'parent' | 'mount' | 'props+state';
  changedKeys?: string[];
  duration?: number;
  renderOrder?: number;
  parentComponent?: string;
  componentPath?: string[];
  batchId?: string;
  // Enhanced fields
  fiberDepth?: number;
  propsChanges?: PropChange[];
  stateChanges?: PropChange[];
  renderReasonSummary?: string;
}

export interface StateChangeEventPayload {
  source: 'redux' | 'local';
  actionType?: string;
  componentName?: string;
  hookIndex?: number;
  oldValue?: string;
  newValue?: string;
  valueType?: string;
  isExtractable?: boolean;
  // Enhanced field - inferred state variable name
  stateName?: string;
}

export interface ContextChangeEventPayload {
  componentName: string;
  contextType?: string;
  changedKeys?: string[];
}

export interface EffectEventPayload {
  componentName: string;
  effectType: 'run' | 'cleanup';
  effectIndex: number;
  depCount?: number;
  hasCleanup?: boolean;
  effectTag?: string;
  depsPreview?: string;
  createFnPreview?: string;
}

export interface ErrorEventPayload {
  errorType: CrashType;
  message: string;
  stack?: string;
  componentStack?: string;
  source?: string;
  lineno?: number;
}

export interface MemoryEventPayload {
  heapUsed: number;
  heapTotal: number;
  heapLimit: number;
  isSpike: boolean;
  growthRate?: number;
}

export type TimelineEventPayload = 
  | RenderEventPayload 
  | StateChangeEventPayload 
  | EffectEventPayload 
  | ErrorEventPayload 
  | MemoryEventPayload
  | ContextChangeEventPayload;

export interface TimelineEvent {
  id: string;
  timestamp: number;
  type: TimelineEventType;
  payload: TimelineEventPayload;
}

export interface CorrelationResult {
  correlatedIds: string[];
  explanation: string[];
}

export interface TriggerReason {
  type: 'props' | 'state' | 'context' | 'parent' | 'force';
  changedKeys?: string[];
}

export interface CLSEntry {
  id: string;
  timestamp: number;
  value: number;
  hadRecentInput: boolean;
  sources: CLSSource[];
  cumulativeScore: number;
}

export interface CLSSource {
  node: string;
  previousRect: DOMRectReadOnly | null;
  currentRect: DOMRectReadOnly | null;
}

export interface CLSReport {
  totalScore: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  entries: CLSEntry[];
  topContributors: Array<{
    element: string;
    totalShift: number;
    occurrences: number;
  }>;
}

export interface ReduxAction {
  id: string;
  type: string;
  payload: unknown;
  timestamp: number;
  stateBefore?: unknown;
  stateAfter?: unknown;
}

export interface TabState {
  reactDetected: boolean;
  reactVersion: string | null;
  reactMode: 'development' | 'production' | null;
  reduxDetected: boolean;
  issues: Issue[];
  components: ComponentInfo[];
  renders: Map<string, RenderInfo>;
  clsReport: CLSReport | null;
  reduxState: unknown;
  reduxActions: ReduxAction[];
  memoryReport: MemoryReport | null;
  pageLoadMetrics: PageLoadMetrics | null;
  timelineEvents: TimelineEvent[];
}

export type MessageType =
  | 'REACT_DETECTED'
  | 'REDUX_DETECTED'
  | 'FIBER_COMMIT'
  | 'ISSUE_DETECTED'
  | 'STALE_CLOSURE_DETECTED'
  | 'CLS_ENTRY'
  | 'REDUX_STATE_CHANGE'
  | 'REDUX_ACTION'
  | 'REDUX_OVERRIDES_CLEARED'
  | 'GET_STATE'
  | 'STATE_RESPONSE'
  | 'DISPATCH_REDUX_ACTION'
  | 'SET_REDUX_STATE'
  | 'DELETE_ARRAY_ITEM'
  | 'MOVE_ARRAY_ITEM'
  | 'REFRESH_REDUX_STATE'
  | 'CLEAR_REDUX_OVERRIDES'
  | 'TOGGLE_SCAN'
  | 'SCAN_STATUS'
  | 'PANEL_READY'
  | 'CLEAR_ISSUES'
  | 'MEMORY_SNAPSHOT'
  | 'START_MEMORY_MONITORING'
  | 'STOP_MEMORY_MONITORING'
  | 'PAGE_LOAD_METRICS'
  | 'CRASH_DETECTED'
  | 'TIMELINE_EVENTS'
  | 'GET_CORRELATION'
  | 'CORRELATION_RESULT'
  | 'ENABLE_DEBUGGER'
  | 'DISABLE_DEBUGGER'
  | 'GET_DEBUGGER_STATE'
  | 'DEBUGGER_STATE_CHANGED'
  | 'PAGE_NAVIGATING';

export interface Message<T = unknown> {
  type: MessageType;
  payload?: T;
  tabId?: number;
}

export interface ReactDetectedPayload {
  version: string;
  mode: 'development' | 'production';
}

export interface FiberCommitPayload {
  components: ComponentInfo[];
  issues: Issue[];
  renders: Array<{
    componentId: string;
    componentName: string;
    duration: number;
    selfDuration?: number;
    reason: TriggerReason;
  }>;
  timestamp: number;
}

// ============================================
// AI Analysis Types
// ============================================

export type AIAnalysisSeverity = 'critical' | 'warning' | 'info' | 'success';

export interface AIAnalysisItem {
  title: string;
  severity: AIAnalysisSeverity;
  description: string;
  suggestion?: string;
  affectedComponents?: string[];
}

export interface AIAnalysisResult {
  id: string;
  timestamp: number;
  snapshotHash: string;
  model: string;
  security: AIAnalysisItem[];
  crashRisks: AIAnalysisItem[];
  performance: AIAnalysisItem[];
  rootCauses: AIAnalysisItem[];
  suggestions: AIAnalysisItem[];
  summary: string;
  tokenUsage: {
    prompt: number;
    completion: number;
    total: number;
  };
  latencyMs: number;
}

export interface AIAnalysisSnapshot {
  issues: Array<{
    type: string;
    severity: string;
    component: string;
    message: string;
    suggestion: string;
  }>;
  components: Array<{
    name: string;
    renderCount: number;
    avgDuration: number;
  }>;
  crashes: Array<{
    type: string;
    message: string;
    stack?: string;
    analysisHints: string[];
  }>;
  memory: {
    usedMB: number;
    totalMB: number;
    limitMB: number;
    growthRateKBs: number;
    warnings: string[];
  } | null;
  pageMetrics: {
    fcp: number | null;
    lcp: number | null;
    ttfb: number | null;
  } | null;
  reactVersion: string | null;
  reactMode: string | null;
  totalRenders: number;
  totalTimelineEvents: number;
}

export interface AIConfig {
  proxyUrl: string;
  apiKey: string;
  model: string;
  maxTokens: number;
  subscriptionKey: string;
}
export const DEFAULT_AI_CONFIG: AIConfig = {
  proxyUrl: 'https://proxy.hoainho.info',
  apiKey: 'hoainho',
  model: 'gemini-2.5-flash-lite',
  maxTokens: 4096,
  subscriptionKey: '',
};