(function() {
  'use strict';

  const PAGE_SOURCE = 'REACT_DEBUGGER_PAGE';
  const CONTENT_SOURCE = 'REACT_DEBUGGER_CONTENT';
  const DEBUG = false;
  
  // Global debugger enable/disable flag (default: OFF for performance)
  let debuggerEnabled = false;
  
  let extensionAlive = true;
  let messageQueue: Array<{type: string; payload?: unknown}> = [];
  let flushTimeout: number | null = null;
  
  let messageCount = 0;
  let lastCountReset = Date.now();
  let currentThrottle = 100;
  const MAX_BATCH_SIZE = 100;
  
  function getAdaptiveThrottle(): number {
    const now = Date.now();
    if (now - lastCountReset > 1000) {
      const rate = messageCount;
      messageCount = 0;
      lastCountReset = now;
      
      if (rate < 5) currentThrottle = 200;
      else if (rate < 20) currentThrottle = 100;
      else currentThrottle = 50;
      
      if (DEBUG) log('Adaptive throttle:', currentThrottle, 'ms (rate:', rate, '/s)');
    }
    messageCount++;
    return currentThrottle;
  }

  function log(...args: unknown[]): void {
    if (DEBUG) console.log('[React Debugger]', ...args);
  }

  function flushMessages(): void {
    if (!extensionAlive || messageQueue.length === 0) {
      messageQueue = [];
      return;
    }
    
    let messages = messageQueue;
    messageQueue = [];
    flushTimeout = null;
    
    if (messages.length > MAX_BATCH_SIZE) {
      if (DEBUG) log('Batch size exceeded:', messages.length, '- truncating to', MAX_BATCH_SIZE);
      messages = messages.slice(-MAX_BATCH_SIZE);
    }
    
    for (const msg of messages) {
      try {
        window.postMessage({ source: PAGE_SOURCE, type: msg.type, payload: msg.payload }, '*');
      } catch {
        extensionAlive = false;
        break;
      }
    }
  }

  function sendFromPage(type: string, payload?: unknown): void {
    if (!extensionAlive) return;
    
    const alwaysAllowedMessages = [
      'DEBUGGER_STATE_CHANGED', 
      'REACT_DETECTED',
      'REDUX_DETECTED',
      'REDUX_STATE_CHANGE',
      'REDUX_OVERRIDES_CLEARED'
    ];
    if (!debuggerEnabled && !alwaysAllowedMessages.includes(type)) {
      return;
    }
    
    const criticalMessages = [
      'REACT_DETECTED', 
      'REDUX_DETECTED', 
      'REDUX_STATE_CHANGE', 
      'DEBUGGER_STATE_CHANGED',
      'REDUX_OVERRIDES_CLEARED'
    ];
    if (criticalMessages.includes(type)) {
      try {
        window.postMessage({ source: PAGE_SOURCE, type, payload }, '*');
      } catch {
        extensionAlive = false;
      }
      return;
    }
    
    messageQueue.push({ type, payload });
    
    if (!flushTimeout) {
      flushTimeout = window.setTimeout(flushMessages, getAdaptiveThrottle());
    }
    
    if (DEBUG && (type === 'REDUX_DETECTED' || type === 'REACT_DETECTED')) {
      log('Sent message:', type, payload);
    }
  }

  function listenFromContent(callback: (message: { type: string; payload?: unknown }) => void): void {
    window.addEventListener('message', (event) => {
      if (event.source !== window) return;
      if (!event.data || event.data.source !== CONTENT_SOURCE) return;
      callback({ type: event.data.type, payload: event.data.payload });
    });
  }

  function generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  let lastTimestamp = 0;
  let timestampCounter = 0;
  
  function getUniqueTimestamp(): number {
    const now = Date.now();
    if (now === lastTimestamp) {
      timestampCounter++;
    } else {
      timestampCounter = 0;
      lastTimestamp = now;
    }
    return now + (timestampCounter * 0.001);
  }

  function scheduleIdleWork(callback: () => void, timeoutMs = 500): void {
    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(callback, { timeout: timeoutMs });
    } else {
      setTimeout(callback, 0);
    }
  }

  function sanitizeValue(value: unknown, depth = 0): unknown {
    if (depth > 5) return '[Object depth exceeded]';
    if (value === null) return null;
    if (value === undefined) return undefined;
    
    const type = typeof value;
    if (type === 'string') return (value as string).slice(0, 500);
    if (type === 'number' || type === 'boolean') return value;
    if (type === 'function') return `[Function: ${(value as Function).name || 'anonymous'}]`;
    if (type === 'symbol') return `[Symbol]`;
    
    if (Array.isArray(value)) {
      if (value.length > 50) return `[Array(${value.length})]`;
      return value.slice(0, 50).map(v => sanitizeValue(v, depth + 1));
    }
    
    if (type === 'object') {
      const obj = value as Record<string, unknown>;
      if ((obj as any).$$typeof) return '[React Element]';
      if (obj instanceof HTMLElement) return `[${obj.tagName}]`;
      if (obj instanceof Event) return '[Event]';
      if (obj instanceof Error) return `[Error: ${obj.message}]`;
      if (obj instanceof Date) return obj.toISOString();
      if (obj instanceof RegExp) return obj.toString();
      if (obj instanceof Map) return `[Map(${obj.size})]`;
      if (obj instanceof Set) return `[Set(${obj.size})]`;
      if (obj instanceof Promise) return '[Promise]';
      
      const result: Record<string, unknown> = {};
      const keys = Object.keys(obj).slice(0, 30);
      for (const key of keys) {
        try {
          result[key] = sanitizeValue(obj[key], depth + 1);
        } catch {
          result[key] = '[Error]';
        }
      }
      return result;
    }
    
    return String(value);
  }

  interface ContextDependency {
    context: {
      _currentValue?: any;
      _currentValue2?: any;
      displayName?: string;
      Provider?: { _context?: any };
    };
    next: ContextDependency | null;
  }

  interface FiberNode {
    tag: number;
    type: any;
    key: string | null;
    memoizedState: any;
    memoizedProps: any;
    child: FiberNode | null;
    sibling: FiberNode | null;
    return: FiberNode | null;
    stateNode: any;
    alternate: FiberNode | null;
    dependencies?: {
      firstContext: ContextDependency | null;
      lanes?: number;
    } | null;
    actualDuration?: number;
    actualStartTime?: number;
    selfBaseDuration?: number;
    treeBaseDuration?: number;
  }

  interface FiberRoot {
    current: FiberNode;
  }

  const FIBER_TAGS = {
    FunctionComponent: 0,
    ClassComponent: 1,
    HostRoot: 3,
    HostComponent: 5,
    HostText: 6,
    Fragment: 7,
    ForwardRef: 11,
    MemoComponent: 14,
    SimpleMemoComponent: 15,
  };

  const FIBER_FLAGS = {
    NoFlags: 0,
    PerformedWork: 1,
    Placement: 2,
    Update: 4,
    PlacementAndUpdate: 6,
    Deletion: 8,
    ChildDeletion: 16,
    ContentReset: 32,
    Callback: 64,
    Ref: 128,
    Passive: 512,
    PassiveUnmountPendingDev: 8192,
    PassiveStatic: 2097152,
  };
  
  const lastEffectStates = new Map<string, Map<number, { hasEffect: boolean; hasDestroy: boolean }>>();

  function didFiberRender(fiber: FiberNode): boolean {
    const alternate = fiber.alternate;
    
    if (!alternate) return true;
    
    const flags = (fiber as any).flags ?? (fiber as any).effectTag ?? 0;
    if (flags & (FIBER_FLAGS.PerformedWork | FIBER_FLAGS.Update | FIBER_FLAGS.Placement | FIBER_FLAGS.Passive)) {
      return true;
    }
    
    if ((fiber as any).actualDuration > 0) {
      return true;
    }
    
    const lanes = (fiber as any).lanes ?? 0;
    if (lanes !== 0) {
      return true;
    }
    
    if (fiber.memoizedProps !== alternate.memoizedProps) return true;
    if (fiber.memoizedState !== alternate.memoizedState) return true;
    
    const currentContext = (fiber as any).dependencies?.firstContext;
    const alternateContext = (alternate as any).dependencies?.firstContext;
    if (currentContext !== alternateContext) return true;
    
    if (fiber.type !== alternate.type) return true;
    
    return false;
  }

  const renderCounts = new Map<string, number>();
  const lastRenderTimes = new Map<string, number>();
  const recentRenderTimestamps = new Map<string, number[]>();
  const reportedEffectIssues = new Set<string>();
  const reportedExcessiveRerenders = new Set<string>();
  const reportedSlowRenders = new Set<string>();
  
  const EXCESSIVE_RENDER_THRESHOLD = 10;
  const EXCESSIVE_RENDER_WINDOW_MS = 1000;
  
  interface ClosureTracker {
    componentName: string;
    componentPath: string[];
    renderId: number;
    createdAt: number;
    functionName: string;
    capturedState: Map<string, unknown>;
    asyncType: 'setTimeout' | 'setInterval' | 'promise' | 'eventListener' | 'callback';
  }
  
  const componentRenderIds = new Map<string, number>();
  const trackedClosures = new Map<number, ClosureTracker>();
  const staleClosureIssues = new Map<string, any>();
  let closureIdCounter = 0;
  
  const originalSetTimeout = window.setTimeout;
  const originalSetInterval = window.setInterval;
  const originalAddEventListener = EventTarget.prototype.addEventListener;
  
  function getCurrentComponentContext(): { name: string; path: string[]; renderId: number } | null {
    const hook = (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__;
    if (!hook || !hook.renderers) return null;
    
    try {
      for (const [, renderer] of hook.renderers) {
        if (renderer.getCurrentFiber) {
          const fiber = renderer.getCurrentFiber();
          if (fiber) {
            const name = getComponentName(fiber);
            const path = getComponentPath(fiber);
            const fiberId = `${name}_${path.join('/')}`;
            const renderId = componentRenderIds.get(fiberId) || 0;
            return { name, path, renderId };
          }
        }
      }
    } catch {
      return null;
    }
    return null;
  }
  
  function extractFunctionName(fn: Function): string {
    if (fn.name) return fn.name;
    const fnStr = fn.toString();
    const match = fnStr.match(/function\s+([^\s(]+)/);
    return match ? match[1] : 'anonymous';
  }
  
  function trackClosure(
    fn: Function,
    asyncType: ClosureTracker['asyncType'],
    context: { name: string; path: string[]; renderId: number }
  ): number {
    const closureId = ++closureIdCounter;
    
    const capturedState = new Map<string, unknown>();
    const fnStr = fn.toString();
    
    const statePatterns = [
      /\b(count|value|data|user|items|state|props|isLoading|isOpen|error|result)\b/gi
    ];
    
    for (const pattern of statePatterns) {
      const matches = fnStr.match(pattern);
      if (matches) {
        matches.forEach(match => {
          capturedState.set(match.toLowerCase(), `[captured at render #${context.renderId}]`);
        });
      }
    }
    
    trackedClosures.set(closureId, {
      componentName: context.name,
      componentPath: context.path,
      renderId: context.renderId,
      createdAt: Date.now(),
      functionName: extractFunctionName(fn),
      capturedState,
      asyncType,
    });
    
    return closureId;
  }
  
  function checkStaleClosureOnExecution(closureId: number): void {
    const tracker = trackedClosures.get(closureId);
    if (!tracker) return;
    
    const fiberId = `${tracker.componentName}_${tracker.componentPath.join('/')}`;
    const currentRenderId = componentRenderIds.get(fiberId) || 0;
    
    if (currentRenderId > tracker.renderId + 1) {
      const issueKey = `${fiberId}_${tracker.functionName}_${tracker.asyncType}`;
      
      if (!staleClosureIssues.has(issueKey)) {
        const issue = {
          id: generateId(),
          type: 'STALE_CLOSURE',
          severity: 'warning' as const,
          component: tracker.componentName,
          message: `${tracker.asyncType} callback "${tracker.functionName}" may be using stale values from render #${tracker.renderId} (current: #${currentRenderId})`,
          suggestion: 'Use useCallback with proper dependencies, or useRef for mutable values that should persist across renders',
          timestamp: Date.now(),
          location: {
            componentName: tracker.componentName,
            componentPath: tracker.componentPath,
            closureInfo: {
              functionName: tracker.functionName,
              createdAtRender: tracker.renderId,
              executedAtRender: currentRenderId,
              capturedValues: Array.from(tracker.capturedState.entries()).map(([name, value]) => ({
                name,
                capturedValue: value,
                currentValue: '[current value]',
              })),
              asyncType: tracker.asyncType,
            },
          },
        };
        
        staleClosureIssues.set(issueKey, issue);
        sendFromPage('STALE_CLOSURE_DETECTED', issue);
      }
    }
    
    if (Date.now() - tracker.createdAt > 60000) {
      trackedClosures.delete(closureId);
    }
  }
  
  function _installClosureTracking(): void {
    (window as any).setTimeout = function(callback: Function, delay?: number, ...args: any[]) {
      if (typeof callback !== 'function') {
        return originalSetTimeout.call(window, callback, delay, ...args);
      }
      
      const context = getCurrentComponentContext();
      if (!context) {
        return originalSetTimeout.call(window, callback, delay, ...args);
      }
      
      const closureId = trackClosure(callback, 'setTimeout', context);
      
      const wrappedCallback = function(this: any) {
        checkStaleClosureOnExecution(closureId);
        return callback.apply(this, args);
      };
      
      return originalSetTimeout.call(window, wrappedCallback, delay);
    } as typeof setTimeout;
    
    (window as any).setInterval = function(callback: Function, delay?: number, ...args: any[]) {
      if (typeof callback !== 'function') {
        return originalSetInterval.call(window, callback, delay, ...args);
      }
      
      const context = getCurrentComponentContext();
      if (!context) {
        return originalSetInterval.call(window, callback, delay, ...args);
      }
      
      const closureId = trackClosure(callback, 'setInterval', context);
      
      const wrappedCallback = function(this: any) {
        checkStaleClosureOnExecution(closureId);
        return callback.apply(this, args);
      };
      
      return originalSetInterval.call(window, wrappedCallback, delay);
    } as typeof setInterval;
    
    EventTarget.prototype.addEventListener = function(
      type: string,
      listener: EventListenerOrEventListenerObject | null,
      options?: boolean | AddEventListenerOptions
    ) {
      if (!listener || typeof listener !== 'function') {
        return originalAddEventListener.call(this, type, listener, options);
      }
      
      const context = getCurrentComponentContext();
      if (!context) {
        return originalAddEventListener.call(this, type, listener, options);
      }
      
      const closureId = trackClosure(listener, 'eventListener', context);
      
      const wrappedListener = function(this: any, event: Event) {
        checkStaleClosureOnExecution(closureId);
        return (listener as EventListener).call(this, event);
      };
      
      (wrappedListener as any).__reactDebuggerOriginal = listener;
      (wrappedListener as any).__reactDebuggerClosureId = closureId;
      
      return originalAddEventListener.call(this, type, wrappedListener, options);
    };
  }

  function getComponentName(fiber: FiberNode | null): string {
    if (!fiber) return 'Unknown';
    const { type, tag } = fiber;
    
    if (tag === FIBER_TAGS.HostComponent) return typeof type === 'string' ? type : 'HostComponent';
    if (tag === FIBER_TAGS.HostText) return '#text';
    if (tag === FIBER_TAGS.HostRoot) return 'Root';
    if (tag === FIBER_TAGS.Fragment) return 'Fragment';
    
    if (typeof type === 'function') {
      return type.displayName || type.name || 'Anonymous';
    }
    
    if (typeof type === 'object' && type !== null) {
      if (type.$$typeof === Symbol.for('react.forward_ref')) {
        return type.render?.displayName || type.render?.name || 'ForwardRef';
      }
      if (type.$$typeof === Symbol.for('react.memo')) {
        return type.type?.displayName || type.type?.name || 'Memo';
      }
    }
    
    return 'Unknown';
  }

  function isUserComponent(fiber: FiberNode): boolean {
    const { tag } = fiber;
    return tag === FIBER_TAGS.FunctionComponent || 
           tag === FIBER_TAGS.ClassComponent ||
           tag === FIBER_TAGS.ForwardRef ||
           tag === FIBER_TAGS.MemoComponent ||
           tag === FIBER_TAGS.SimpleMemoComponent;
  }

  const pathCache = new Map<FiberNode, string[]>();
  const PATH_CACHE_LIMIT = 500;
  
  function clearPathCache(): void {
    pathCache.clear();
  }
  
  function getComponentPath(fiber: FiberNode | null): string[] {
    if (!fiber) return [];
    
    if (pathCache.has(fiber)) {
      return pathCache.get(fiber)!;
    }
    
    const path: string[] = [];
    let current: FiberNode | null = fiber;
    let depth = 0;
    
    while (current && depth < 10) {
      if (isUserComponent(current)) {
        path.unshift(getComponentName(current));
      }
      current = current.return;
      depth++;
    }
    
    if (pathCache.size >= PATH_CACHE_LIMIT) {
      const firstKey = pathCache.keys().next().value;
      if (firstKey) pathCache.delete(firstKey);
    }
    pathCache.set(fiber, path);
    
    return path;
  }

  function getElementType(fiber: FiberNode): string {
    if (fiber.tag === FIBER_TAGS.HostComponent) {
      return typeof fiber.type === 'string' ? `<${fiber.type}>` : '<element>';
    }
    if (fiber.tag === FIBER_TAGS.Fragment) {
      return '<Fragment>';
    }
    return getComponentName(fiber);
  }

  interface EffectHook {
    tag: number;
    create: Function | null;
    destroy: Function | null | undefined;
    deps: any[] | null;
    next: EffectHook | null;
  }

  interface HookNode {
    memoizedState: any;
    baseState: any;
    baseQueue: any;
    queue: any;
    next: HookNode | null;
  }

  const EFFECT_HAS_EFFECT = 0b001;
  const EFFECT_PASSIVE = 0b100;

  function getEffectsFromFiber(fiber: FiberNode): EffectHook[] {
    const effects: EffectHook[] = [];
    
    if (!fiber.memoizedState) return effects;
    
    let hook: HookNode | null = fiber.memoizedState;
    let hookIndex = 0;
    const maxHooks = 50;
    
    while (hook && hookIndex < maxHooks) {
      const memoizedState = hook.memoizedState;
      
      if (memoizedState && typeof memoizedState === 'object') {
        if ('create' in memoizedState || 'destroy' in memoizedState || 'tag' in memoizedState) {
          effects.push({
            tag: memoizedState.tag || 0,
            create: memoizedState.create || null,
            destroy: memoizedState.destroy,
            deps: memoizedState.deps || null,
            next: memoizedState.next || null,
          });
        }
      }
      
      hook = hook.next;
      hookIndex++;
    }
    
    return effects;
  }

  function analyzeEffectForIssues(
    effect: EffectHook,
    componentName: string,
    componentPath: string[],
    effectIndex: number,
    issues: any[]
  ): void {
    const isPassiveEffect = (effect.tag & EFFECT_PASSIVE) !== 0;
    const hasEffect = (effect.tag & EFFECT_HAS_EFFECT) !== 0;
    
    if (!isPassiveEffect && !hasEffect) return;
    
    const createFn = effect.create;
    const destroyFn = effect.destroy;
    const deps = effect.deps;
    
    if (createFn) {
      const fnStr = createFn.toString();
      
      const hasTimerPattern = /\b(setInterval|setTimeout)\s*\(/.test(fnStr);
      const hasEventListenerPattern = /\b(addEventListener)\s*\(/.test(fnStr);
      const hasSubscriptionPattern = /\b(subscribe|on\(|addListener)\s*\(/.test(fnStr);
      const hasWebSocketPattern = /\b(WebSocket|EventSource)\b/.test(fnStr);
      const needsCleanup = hasTimerPattern || hasEventListenerPattern || 
                          hasSubscriptionPattern || hasWebSocketPattern;
      
      if (needsCleanup && destroyFn === undefined) {
        const issueKey = `${componentName}_MISSING_CLEANUP_${effectIndex}`;
        if (!reportedEffectIssues.has(issueKey)) {
          reportedEffectIssues.add(issueKey);
          let resourceType = 'resource';
          if (hasTimerPattern) resourceType = 'timer (setInterval/setTimeout)';
          else if (hasEventListenerPattern) resourceType = 'event listener';
          else if (hasSubscriptionPattern) resourceType = 'subscription';
          else if (hasWebSocketPattern) resourceType = 'WebSocket/EventSource';
          
          issues.push({
            id: generateId(),
            type: 'MISSING_CLEANUP',
            severity: 'warning',
            component: componentName,
            message: `useEffect with ${resourceType} has no cleanup function`,
            suggestion: `Return a cleanup function to remove the ${resourceType} when component unmounts`,
            timestamp: Date.now(),
            location: {
              componentName,
              componentPath,
              effectIndex,
            },
          });
        }
      }
      
      const hasStateSetterPattern = /\b(set[A-Z]\w*)\s*\(/.test(fnStr);
      const hasDispatchPattern = /\bdispatch\s*\(/.test(fnStr);
      
      if ((hasStateSetterPattern || hasDispatchPattern) && deps !== null && deps.length === 0) {
        if (!hasTimerPattern && !hasEventListenerPattern) {
          const issueKey = `${componentName}_INFINITE_LOOP_RISK_${effectIndex}`;
          if (!reportedEffectIssues.has(issueKey)) {
            reportedEffectIssues.add(issueKey);
            issues.push({
              id: generateId(),
              type: 'INFINITE_LOOP_RISK',
              severity: 'error',
              component: componentName,
              message: `useEffect updates state but has empty dependency array`,
              suggestion: 'Add conditions to prevent updates on every render, or include proper dependencies',
              timestamp: Date.now(),
              location: {
                componentName,
                componentPath,
                effectIndex,
              },
            });
          }
        }
      }
      
      if (deps === null) {
        const usesPropsOrState = /\b(props\.|state\.|use[A-Z])/i.test(fnStr);
        if (usesPropsOrState) {
          const issueKey = `${componentName}_MISSING_DEP_${effectIndex}`;
          if (!reportedEffectIssues.has(issueKey)) {
            reportedEffectIssues.add(issueKey);
            issues.push({
              id: generateId(),
              type: 'MISSING_DEP',
              severity: 'info',
              component: componentName,
              message: `useEffect without dependency array runs on every render`,
              suggestion: 'Consider adding a dependency array to control when the effect runs',
              timestamp: Date.now(),
              location: {
                componentName,
                componentPath,
                effectIndex,
              },
            });
          }
        }
      }
    }
  }

  function checkEffectHooks(fiber: FiberNode, issues: any[]): void {
    if (!isUserComponent(fiber)) return;
    
    const componentName = getComponentName(fiber);
    const componentPath = getComponentPath(fiber);
    const effects = getEffectsFromFiber(fiber);
    
    effects.forEach((effect, index) => {
      analyzeEffectForIssues(effect, componentName, componentPath, index, issues);
    });
  }

  interface EffectChangeInfo {
    type: 'run' | 'cleanup';
    effectIndex: number;
    depCount?: number;
    hasCleanup: boolean;
    effectTag: string;
    depsPreview?: string;
    createFnPreview?: string;
  }

  function getEffectTagName(tag: number): string {
    const tags: string[] = [];
    if (tag & EFFECT_HAS_EFFECT) tags.push('HasEffect');
    if (tag & EFFECT_PASSIVE) tags.push('Passive');
    if (tags.length === 0) return 'None';
    return tags.join('+');
  }

  function extractEffectPreview(effect: EffectHook): { depsPreview?: string; createFnPreview?: string } {
    const result: { depsPreview?: string; createFnPreview?: string } = {};
    
    if (effect.deps) {
      const depNames = effect.deps.map((dep, i) => {
        if (dep === null) return 'null';
        if (dep === undefined) return 'undefined';
        if (typeof dep === 'function') return `fn${i}`;
        if (typeof dep === 'object') return `obj${i}`;
        if (typeof dep === 'string') return `"${dep.slice(0, 10)}${dep.length > 10 ? '...' : ''}"`;
        return String(dep);
      });
      result.depsPreview = `[${depNames.join(', ')}]`;
    } else if (effect.deps === null) {
      result.depsPreview = '[]';
    }
    
    if (effect.create) {
      const fnStr = effect.create.toString();
      
      const hints: string[] = [];
      if (/fetch\s*\(/i.test(fnStr)) hints.push('fetch');
      if (/setInterval\s*\(/i.test(fnStr)) hints.push('setInterval');
      if (/setTimeout\s*\(/i.test(fnStr)) hints.push('setTimeout');
      if (/addEventListener\s*\(/i.test(fnStr)) hints.push('addEventListener');
      if (/subscribe\s*\(/i.test(fnStr)) hints.push('subscribe');
      if (/\.on\s*\(/i.test(fnStr)) hints.push('event listener');
      
      if (hints.length > 0) {
        result.createFnPreview = hints.join(', ');
      } else {
        const firstLine = fnStr.split('\n')[0].slice(0, 50);
        result.createFnPreview = firstLine.length < fnStr.length ? firstLine + '...' : firstLine;
      }
    }
    
    return result;
  }

  function detectEffectChanges(fiber: FiberNode): EffectChangeInfo[] {
    if (!isUserComponent(fiber)) return [];
    
    const componentName = getComponentName(fiber);
    const fiberId = `${componentName}_${getComponentPath(fiber).join('/')}`;
    const effects = getEffectsFromFiber(fiber);
    const changes: EffectChangeInfo[] = [];
    
    if (!lastEffectStates.has(fiberId)) {
      lastEffectStates.set(fiberId, new Map());
    }
    const prevStates = lastEffectStates.get(fiberId)!;
    
    effects.forEach((effect, index) => {
      const hasEffect = (effect.tag & EFFECT_HAS_EFFECT) !== 0;
      const hasDestroy = effect.destroy !== undefined && effect.destroy !== null;
      const depCount = effect.deps?.length;
      const effectTag = getEffectTagName(effect.tag);
      const prevState = prevStates.get(index);
      const { depsPreview, createFnPreview } = extractEffectPreview(effect);
      
      if (!prevState) {
        if (hasEffect) {
          changes.push({ 
            type: 'run', 
            effectIndex: index, 
            depCount, 
            hasCleanup: hasDestroy,
            effectTag,
            depsPreview,
            createFnPreview,
          });
        }
      } else {
        if (hasEffect && !prevState.hasEffect) {
          changes.push({ 
            type: 'run', 
            effectIndex: index, 
            depCount, 
            hasCleanup: hasDestroy,
            effectTag,
            depsPreview,
            createFnPreview,
          });
        }
        if (hasDestroy && !prevState.hasDestroy && prevState.hasEffect) {
          changes.push({ 
            type: 'cleanup', 
            effectIndex: index, 
            depCount, 
            hasCleanup: true,
            effectTag,
            depsPreview,
            createFnPreview,
          });
        }
      }
      
      prevStates.set(index, { hasEffect, hasDestroy });
    });
    
    return changes;
  }

  interface LocalStateChangeInfo {
    componentName: string;
    hookIndex: number;
    oldValue?: string;
    newValue?: string;
    valueType: string;
    isExtractable: boolean;
    stateName?: string;
  }

  function tryInferStateName(fiber: FiberNode, hookIndex: number): string | undefined {
    try {
      const componentType = fiber.type;
      if (!componentType) return undefined;
      
      let sourceCode: string | undefined;
      if (typeof componentType === 'function') {
        sourceCode = componentType.toString();
      }
      
      if (!sourceCode) return undefined;
      
      const useStatePattern = /(?:const|let|var)\s*\[\s*(\w+)\s*,\s*set\w*\s*\]\s*=\s*(?:React\.)?useState/g;
      const matches: string[] = [];
      let match;
      
      while ((match = useStatePattern.exec(sourceCode)) !== null) {
        matches.push(match[1]);
      }
      
      if (matches[hookIndex]) {
        return matches[hookIndex];
      }
      
      return undefined;
    } catch {
      return undefined;
    }
  }

  function serializeValueForDisplay(value: unknown, maxLength = 200): string {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    
    const type = typeof value;
    if (type === 'string') {
      const str = value as string;
      if (str.length > maxLength) return `"${str.slice(0, maxLength)}..."`;
      return `"${str}"`;
    }
    if (type === 'number' || type === 'boolean') {
      return String(value);
    }
    if (type === 'function') {
      return `[Function: ${(value as Function).name || 'anonymous'}]`;
    }
    
    if (Array.isArray(value)) {
      if (value.length === 0) return '[]';
      try {
        const preview = JSON.stringify(value);
        if (preview.length <= maxLength) return preview;
        const items = value.slice(0, 5).map(item => serializeValueForDisplay(item, 30));
        const suffix = value.length > 5 ? `, ... (${value.length} items)` : '';
        return `[${items.join(', ')}${suffix}]`;
      } catch {
        return `Array(${value.length})`;
      }
    }
    
    if (type === 'object') {
      const obj = value as Record<string, unknown>;
      if ((obj as any).$$typeof) return '[React Element]';
      if (obj instanceof HTMLElement) return `[HTMLElement: ${obj.tagName}]`;
      if (obj instanceof Date) return obj.toISOString();
      if (obj instanceof RegExp) return obj.toString();
      if (obj instanceof Map) return `Map(${obj.size})`;
      if (obj instanceof Set) return `Set(${obj.size})`;
      if (obj instanceof Error) return `Error: ${obj.message}`;
      
      try {
        const preview = JSON.stringify(obj);
        if (preview.length <= maxLength) return preview;
        const keys = Object.keys(obj).slice(0, 5);
        const items = keys.map(k => {
          const v = serializeValueForDisplay(obj[k], 30);
          return `${k}: ${v}`;
        });
        const suffix = Object.keys(obj).length > 5 ? ', ...' : '';
        return `{${items.join(', ')}${suffix}}`;
      } catch {
        return '[Object]';
      }
    }
    
    return String(value);
  }

  function extractScalarValue(value: unknown): { str: string; isExtractable: boolean } {
    if (value === null) return { str: 'null', isExtractable: true };
    if (value === undefined) return { str: 'undefined', isExtractable: true };
    
    const type = typeof value;
    if (type === 'string' || type === 'number' || type === 'boolean') {
      return { str: serializeValueForDisplay(value), isExtractable: true };
    }
    if (type === 'function') {
      return { str: serializeValueForDisplay(value), isExtractable: false };
    }
    
    return { str: serializeValueForDisplay(value), isExtractable: true };
  }

  function detectLocalStateChanges(fiber: FiberNode): LocalStateChangeInfo[] {
    if (!isUserComponent(fiber)) return [];
    
    const alternate = fiber.alternate;
    if (!alternate) return [];
    
    const componentName = getComponentName(fiber);
    const changes: LocalStateChangeInfo[] = [];
    
    let currentHook: HookNode | null = fiber.memoizedState;
    let alternateHook: HookNode | null = alternate.memoizedState;
    
    let hookIndex = 0;
    let useStateIndex = 0;
    const maxHooks = 50;
    
    while (currentHook && alternateHook && hookIndex < maxHooks) {
      const isEffectHook = currentHook.memoizedState && 
        typeof currentHook.memoizedState === 'object' &&
        ('create' in currentHook.memoizedState || 'destroy' in currentHook.memoizedState);
      
      if (!isEffectHook) {
        const prevValue = alternateHook.memoizedState;
        const currValue = currentHook.memoizedState;
        
        if (prevValue !== currValue) {
          const oldExtracted = extractScalarValue(prevValue);
          const newExtracted = extractScalarValue(currValue);
          const inferredName = tryInferStateName(fiber, useStateIndex);
          
          changes.push({
            componentName,
            hookIndex,
            oldValue: oldExtracted.str,
            newValue: newExtracted.str,
            valueType: typeof currValue,
            isExtractable: oldExtracted.isExtractable && newExtracted.isExtractable,
            stateName: inferredName,
          });
        }
        useStateIndex++;
      }
      
      currentHook = currentHook.next;
      alternateHook = alternateHook.next;
      hookIndex++;
    }
    
    return changes;
  }

  interface ContextChangeInfo {
    componentName: string;
    contextType?: string;
    changedKeys?: string[];
  }

  const previousContextValues = new WeakMap<object, any>();

  function getContextDisplayName(context: any): string | undefined {
    if (!context) return undefined;
    if (context.displayName) return context.displayName;
    if (context.Provider?._context?.displayName) return context.Provider._context.displayName;
    if (context._currentValue !== undefined && typeof context._currentValue === 'object' && context._currentValue !== null) {
      const keys = Object.keys(context._currentValue);
      if (keys.length > 0 && keys.length <= 3) {
        return `Context(${keys.join(', ')})`;
      }
    }
    return 'Context';
  }

  function detectContextChanges(fiber: FiberNode): ContextChangeInfo[] {
    if (!isUserComponent(fiber)) return [];
    
    const alternate = fiber.alternate;
    if (!alternate) return [];
    
    const componentName = getComponentName(fiber);
    const changes: ContextChangeInfo[] = [];
    
    const deps = fiber.dependencies;
    const altDeps = alternate.dependencies;
    
    if (!deps?.firstContext && !altDeps?.firstContext) return [];
    
    let contextDep = deps?.firstContext;
    let altContextDep = altDeps?.firstContext;
    
    while (contextDep || altContextDep) {
      const context = contextDep?.context || altContextDep?.context;
      if (context) {
        const currentValue = context._currentValue ?? context._currentValue2;
        const prevValue = previousContextValues.get(context);
        
        if (prevValue !== undefined && currentValue !== prevValue) {
          const contextType = getContextDisplayName(context);
          const changedKeys: string[] = [];
          
          if (typeof prevValue === 'object' && prevValue !== null &&
              typeof currentValue === 'object' && currentValue !== null) {
            const allKeys = new Set([...Object.keys(prevValue), ...Object.keys(currentValue)]);
            for (const key of allKeys) {
              if (prevValue[key] !== currentValue[key]) {
                changedKeys.push(key);
              }
            }
          }
          
          changes.push({
            componentName,
            contextType,
            changedKeys: changedKeys.length > 0 ? changedKeys : undefined,
          });
        }
        
        previousContextValues.set(context, currentValue);
      }
      
      contextDep = contextDep?.next || null;
      altContextDep = altContextDep?.next || null;
    }
    
    return changes;
  }

  function checkListKeys(fiber: FiberNode, issues: any[]): void {
    if (fiber.tag !== FIBER_TAGS.Fragment && fiber.tag !== FIBER_TAGS.HostComponent) return;
    
    const children: FiberNode[] = [];
    let child = fiber.child;
    while (child) {
      if (isUserComponent(child) || child.tag === FIBER_TAGS.HostComponent) {
        children.push(child);
      }
      child = child.sibling;
    }
    
    if (children.length < 2) return;
    
    const parentComponent = fiber.return;
    const parentName = getComponentName(parentComponent);
    const containerType = getElementType(fiber);
    const componentPath = getComponentPath(parentComponent);
    
    const childElements = children.map((c, index) => ({
      type: getElementType(c),
      key: c.key,
      index,
    }));
    
    const keys = children.map(c => c.key);
    const hasNullKeys = keys.some(k => k === null);
    const nullKeyCount = keys.filter(k => k === null).length;
    const allIndexKeys = keys.every((k, i) => k === String(i));
    
    const location = {
      componentName: parentName,
      componentPath,
      elementType: containerType,
      listLength: children.length,
      childElements,
    };
    
    if (hasNullKeys) {
      const childTypes = [...new Set(childElements.map(c => c.type))];
      const childTypesStr = childTypes.slice(0, 3).join(', ') + (childTypes.length > 3 ? '...' : '');
      
      issues.push({
        id: generateId(),
        type: 'MISSING_KEY',
        severity: 'error',
        component: parentName,
        message: `${nullKeyCount} of ${children.length} items missing keys in ${containerType} containing [${childTypesStr}]`,
        suggestion: 'Add unique "key" prop to each child element',
        timestamp: Date.now(),
        location,
      });
    } else if (allIndexKeys) {
      issues.push({
        id: generateId(),
        type: 'INDEX_AS_KEY',
        severity: 'warning',
        component: parentName,
        message: `List of ${children.length} items uses array index as key in ${containerType}`,
        suggestion: 'Use stable unique identifier instead of array index as key',
        timestamp: Date.now(),
        location,
      });
    }
  }

  function traverseFiber(fiber: FiberNode | null, callback: (fiber: FiberNode, path: string) => void, path = ''): void {
    if (!fiber) return;
    callback(fiber, path);
    if (fiber.child) traverseFiber(fiber.child, callback, `${path}/0`);
    if (fiber.sibling) {
      const parts = path.split('/');
      const index = parseInt(parts.pop() || '0', 10) + 1;
      traverseFiber(fiber.sibling, callback, `${parts.join('/')}/${index}`);
    }
  }

  interface PropChangeInfo {
    key: string;
    oldValue: string;
    newValue: string;
  }

  interface EnhancedRenderChange {
    type: string;
    changedKeys?: string[];
    propsChanges?: PropChangeInfo[];
    stateChanges?: PropChangeInfo[];
    renderReasonSummary: string;
  }

  function detectRenderChanges(node: FiberNode): EnhancedRenderChange {
    const alternate = node.alternate;
    if (!alternate) {
      return { type: 'mount', renderReasonSummary: 'Initial mount' };
    }

    const prevProps = alternate.memoizedProps;
    const nextProps = node.memoizedProps;
    const prevState = alternate.memoizedState;
    const nextState = node.memoizedState;

    const changedProps: string[] = [];
    const propsChanges: PropChangeInfo[] = [];
    const changedState: string[] = [];
    const stateChanges: PropChangeInfo[] = [];

    if (prevProps && nextProps) {
      const allKeys = new Set([...Object.keys(prevProps || {}), ...Object.keys(nextProps || {})]);
      for (const key of allKeys) {
        if (key === 'children') continue;
        if (prevProps[key] !== nextProps[key]) {
          changedProps.push(key);
          if (propsChanges.length < 5) {
            const oldExtracted = extractScalarValue(prevProps[key]);
            const newExtracted = extractScalarValue(nextProps[key]);
            propsChanges.push({
              key,
              oldValue: oldExtracted.str,
              newValue: newExtracted.str,
            });
          }
        }
      }
    }

    if (prevState !== nextState) {
      if (typeof prevState === 'object' && typeof nextState === 'object' && prevState !== null && nextState !== null) {
        const allStateKeys = new Set([...Object.keys(prevState || {}), ...Object.keys(nextState || {})]);
        for (const key of allStateKeys) {
          if (prevState?.[key] !== nextState?.[key]) {
            changedState.push(key);
            if (stateChanges.length < 5) {
              const oldExtracted = extractScalarValue(prevState?.[key]);
              const newExtracted = extractScalarValue(nextState?.[key]);
              stateChanges.push({
                key,
                oldValue: oldExtracted.str,
                newValue: newExtracted.str,
              });
            }
          }
        }
      } else {
        changedState.push('state');
        if (stateChanges.length < 5) {
          const oldExtracted = extractScalarValue(prevState);
          const newExtracted = extractScalarValue(nextState);
          stateChanges.push({
            key: 'state',
            oldValue: oldExtracted.str,
            newValue: newExtracted.str,
          });
        }
      }
    }

    const buildSummary = (): string => {
      const parts: string[] = [];
      if (changedProps.length > 0) {
        const propsList = changedProps.slice(0, 3).join(', ');
        const suffix = changedProps.length > 3 ? ` (+${changedProps.length - 3} more)` : '';
        parts.push(`Props: ${propsList}${suffix}`);
      }
      if (changedState.length > 0) {
        const stateList = changedState.slice(0, 3).join(', ');
        const suffix = changedState.length > 3 ? ` (+${changedState.length - 3} more)` : '';
        parts.push(`State: ${stateList}${suffix}`);
      }
      if (parts.length === 0) {
        return 'Parent re-rendered';
      }
      return parts.join(' | ');
    };

    if (changedProps.length > 0 && changedState.length > 0) {
      return { 
        type: 'props+state', 
        changedKeys: [...changedProps, ...changedState],
        propsChanges,
        stateChanges,
        renderReasonSummary: buildSummary(),
      };
    }
    if (changedProps.length > 0) {
      return { 
        type: 'props', 
        changedKeys: changedProps,
        propsChanges,
        renderReasonSummary: buildSummary(),
      };
    }
    if (changedState.length > 0) {
      return { 
        type: 'state', 
        changedKeys: changedState,
        stateChanges,
        renderReasonSummary: buildSummary(),
      };
    }

    return { type: 'parent', renderReasonSummary: 'Parent re-rendered' };
  }

  function getFiberDepth(fiber: FiberNode | null): number {
    let depth = 0;
    let current = fiber?.return;
    while (current) {
      if (isUserComponent(current)) {
        depth++;
      }
      current = current.return;
    }
    return depth;
  }

  let batchCounter = 0;
  
  function getParentComponentName(fiber: FiberNode | null): string | undefined {
    let parent = fiber?.return;
    while (parent) {
      if (isUserComponent(parent)) {
        return getComponentName(parent);
      }
      parent = parent.return;
    }
    return undefined;
  }
  
  function analyzeFiberTree(root: FiberRoot): void {
    const fiber = root.current;
    const components: any[] = [];
    const renders: any[] = [];
    const effectEvents: Array<{ componentName: string } & EffectChangeInfo> = [];
    const localStateChanges: LocalStateChangeInfo[] = [];
    const contextChanges: ContextChangeInfo[] = [];
    const renderData: Array<{ fiberId: string; componentName: string; node: FiberNode; rendersInLastSecond: number; actualDuration: number }> = [];
    
    const batchId = `batch_${++batchCounter}_${Date.now()}`;
    let renderOrder = 0;

    traverseFiber(fiber, (node, path) => {
      const componentName = getComponentName(node);
      const fiberId = `${componentName}_${path}`;

      if (isUserComponent(node)) {
        const componentPath = getComponentPath(node);
        const componentPathKey = `${componentName}_${componentPath.join('/')}`;
        const currentRenderId = (componentRenderIds.get(componentPathKey) || 0) + 1;
        componentRenderIds.set(componentPathKey, currentRenderId);

        const effectChanges = detectEffectChanges(node);
        for (const change of effectChanges) {
          effectEvents.push({ componentName, ...change });
        }
        
        const stateChanges = detectLocalStateChanges(node);
        localStateChanges.push(...stateChanges);
        
        const ctxChanges = detectContextChanges(node);
        contextChanges.push(...ctxChanges);

        const actuallyRendered = didFiberRender(node);
        
        if (actuallyRendered) {
          const now = Date.now();
          renderOrder++;
          
          const count = (renderCounts.get(fiberId) || 0) + 1;
          renderCounts.set(fiberId, count);
          lastRenderTimes.set(fiberId, now);
          
          let timestamps = recentRenderTimestamps.get(fiberId) || [];
          timestamps.push(now);
          timestamps = timestamps.filter(t => now - t < EXCESSIVE_RENDER_WINDOW_MS);
          recentRenderTimestamps.set(fiberId, timestamps);

          const renderChange = detectRenderChanges(node);
          const actualDuration = (node as any).actualDuration ?? 0;
          const selfBaseDuration = (node as any).selfBaseDuration ?? 0;
          const parentComponent = getParentComponentName(node);

          components.push({
            id: fiberId,
            name: componentName,
            path,
            props: sanitizeValue(node.memoizedProps),
            state: sanitizeValue(node.memoizedState),
            renderCount: count,
            lastRenderTime: now,
            children: [],
          });

          renders.push({
            componentId: fiberId,
            componentName,
            duration: actualDuration,
            selfDuration: selfBaseDuration,
            reason: renderChange,
            renderOrder,
            parentComponent,
            componentPath,
            batchId,
            fiberDepth: getFiberDepth(node),
          });

          renderData.push({
            fiberId,
            componentName,
            node,
            rendersInLastSecond: timestamps.length,
            actualDuration,
          });
        }
      }
    });

    const renderTimelineEvents = renders.map(r => ({
      id: generateId(),
      timestamp: getUniqueTimestamp(),
      type: 'render' as const,
      payload: {
        componentName: r.componentName,
        componentId: r.componentId,
        trigger: r.reason.type,
        changedKeys: r.reason.changedKeys,
        duration: r.duration,
        renderOrder: r.renderOrder,
        parentComponent: r.parentComponent,
        componentPath: r.componentPath,
        batchId: r.batchId,
        fiberDepth: r.fiberDepth,
        propsChanges: r.reason.propsChanges,
        stateChanges: r.reason.stateChanges,
        renderReasonSummary: r.reason.renderReasonSummary,
      },
    }));
    
    const effectTimelineEvents = effectEvents.map(e => ({
      id: generateId(),
      timestamp: getUniqueTimestamp(),
      type: 'effect' as const,
      payload: {
        componentName: e.componentName,
        effectType: e.type,
        effectIndex: e.effectIndex,
        depCount: e.depCount,
        hasCleanup: e.hasCleanup,
        effectTag: e.effectTag,
        depsPreview: e.depsPreview,
        createFnPreview: e.createFnPreview,
      },
    }));
    
    const localStateTimelineEvents = localStateChanges.map(s => ({
      id: generateId(),
      timestamp: getUniqueTimestamp(),
      type: 'state-change' as const,
      payload: {
        source: 'local' as const,
        componentName: s.componentName,
        hookIndex: s.hookIndex,
        oldValue: s.oldValue,
        newValue: s.newValue,
        valueType: s.valueType,
        isExtractable: s.isExtractable,
        stateName: s.stateName,
      },
    }));
    
    const contextTimelineEvents = contextChanges.map(c => ({
      id: generateId(),
      timestamp: getUniqueTimestamp(),
      type: 'context-change' as const,
      payload: {
        componentName: c.componentName,
        contextType: c.contextType,
        changedKeys: c.changedKeys,
      },
    }));
    
    const timelineEvents = [...renderTimelineEvents, ...effectTimelineEvents, ...localStateTimelineEvents, ...contextTimelineEvents];
    
    if (timelineEvents.length > 0) {
      sendFromPage('TIMELINE_EVENTS', timelineEvents);
    }

    scheduleIdleWork(() => {
      if (!debuggerEnabled) return;
      analyzeIssuesDeferred(fiber, renderData, components, renders);
    }, 500);
  }

  function analyzeIssuesDeferred(
    fiber: FiberNode,
    renderData: Array<{ fiberId: string; componentName: string; node: FiberNode; rendersInLastSecond: number; actualDuration: number }>,
    components: any[],
    renders: any[]
  ): void {
    const issues: any[] = [];

    for (const data of renderData) {
      const { fiberId, componentName, node, rendersInLastSecond, actualDuration } = data;
      const now = Date.now();

      if (rendersInLastSecond >= EXCESSIVE_RENDER_THRESHOLD) {
        const issueKey = `excessive_${fiberId}`;
        if (!reportedExcessiveRerenders.has(issueKey)) {
          reportedExcessiveRerenders.add(issueKey);
        }
        issues.push({
          id: issueKey,
          type: 'EXCESSIVE_RERENDERS',
          severity: 'warning',
          component: componentName,
          message: `Rendered ${rendersInLastSecond} times in less than 1 second`,
          suggestion: 'Consider using React.memo() to prevent unnecessary re-renders when props haven\'t changed',
          timestamp: now,
          renderCount: rendersInLastSecond,
        });
      }
      
      if (actualDuration > 16) {
        if (!reportedSlowRenders.has(fiberId)) {
          reportedSlowRenders.add(fiberId);
          issues.push({
            id: generateId(),
            type: 'SLOW_RENDER',
            severity: actualDuration > 50 ? 'error' : 'warning',
            component: componentName,
            message: `Render took ${actualDuration.toFixed(2)}ms (budget: 16ms for 60fps)`,
            suggestion: 'Consider memoization, code splitting, or optimizing expensive computations',
            timestamp: now,
            location: {
              componentName,
              componentPath: getComponentPath(node),
            },
          });
        }
      }
    }

    traverseFiber(fiber, (node) => {
      checkListKeys(node, issues);
      checkEffectHooks(node, issues);
    });

    if (issues.length > 0 || components.length > 0) {
      sendFromPage('FIBER_COMMIT', { components, issues, renders, timestamp: getUniqueTimestamp() });
    }
  }

  function detectReactVersion(): string {
    return (window as any).React?.version || 'unknown';
  }

  function detectReactMode(): 'development' | 'production' {
    const React = (window as any).React;
    if (React?.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED?.ReactDebugCurrentFrame) {
      return 'development';
    }
    return 'production';
  }

  function installReactHook(): void {
    let hook = (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__;
    
    if (!hook) {
      const renderers = new Map();
      let nextID = 1;
      
      hook = {
        renderers,
        supportsFiber: true,
        inject: (renderer: unknown) => {
          const id = nextID++;
          renderers.set(id, renderer);
          
          sendFromPage('REACT_DETECTED', {
            version: detectReactVersion(),
            mode: detectReactMode(),
          });
          
          return id;
        },
        onCommitFiberRoot: () => {},
        onCommitFiberUnmount: () => {},
      };
      
      (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__ = hook;
    }
    
    const originalOnCommitFiberRoot = hook.onCommitFiberRoot;
    const originalInject = hook.inject;
    
    hook.inject = function(renderer: unknown) {
      const id = originalInject ? originalInject.call(this, renderer) : hook.renderers.size + 1;
      
      sendFromPage('REACT_DETECTED', {
        version: detectReactVersion(),
        mode: detectReactMode(),
      });
      
      return id;
    };
    
    let lastAnalyzeTime = 0;
    let pendingRoot: FiberRoot | null = null;
    let analyzeTimeout: number | null = null;
    const ANALYZE_THROTTLE_MS = 100;
    
    const scheduleAnalyze = (root: FiberRoot) => {
      pendingRoot = root;
      const now = Date.now();
      
      if (now - lastAnalyzeTime >= ANALYZE_THROTTLE_MS) {
        lastAnalyzeTime = now;
        try {
          analyzeFiberTree(root);
        } catch (e) {
          if (DEBUG) console.error('[React Debugger] Analyze error:', e);
        }
        pendingRoot = null;
      } else if (!analyzeTimeout) {
        analyzeTimeout = window.setTimeout(() => {
          analyzeTimeout = null;
          if (pendingRoot) {
            lastAnalyzeTime = Date.now();
            try {
              analyzeFiberTree(pendingRoot);
            } catch (e) {
              if (DEBUG) console.error('[React Debugger] Analyze error:', e);
            }
            pendingRoot = null;
          }
        }, ANALYZE_THROTTLE_MS - (now - lastAnalyzeTime));
      }
    };
    
    hook.onCommitFiberRoot = function(rendererID: number, root: FiberRoot, priorityLevel?: unknown, didError?: boolean) {
      if (typeof originalOnCommitFiberRoot === 'function') {
        originalOnCommitFiberRoot.call(this, rendererID, root, priorityLevel, didError);
      }
      
      if (!debuggerEnabled) return;
      
      scheduleAnalyze(root);
      
      if (scanEnabled) {
        try {
          traverseFiber(root.current, (node, path) => {
            if (isUserComponent(node) && didFiberRender(node)) {
              const componentName = getComponentName(node);
              const fiberId = `${componentName}_${path}`;
              const count = renderCounts.get(fiberId) || 1;
              flashRenderOverlay(node, componentName, count);
            }
          });
        } catch (e) {
          if (DEBUG) console.error('[React Debugger] Scan error:', e);
        }
      }
    };
    
    if (hook.renderers && hook.renderers.size > 0) {
      sendFromPage('REACT_DETECTED', {
        version: detectReactVersion(),
        mode: detectReactMode(),
      });
    }
  }

  function findReactRoots(): FiberRoot[] {
    const roots: FiberRoot[] = [];
    
    const allElements = document.querySelectorAll('*');
    for (const element of allElements) {
      try {
        const keys = Object.keys(element);
        const fiberKey = keys.find(key => 
          key.startsWith('__reactContainer$') || 
          key.startsWith('__reactFiber$')
        );
        
        if (fiberKey) {
          let fiber = (element as any)[fiberKey];
          let maxDepth = 100;
          
          while (fiber && maxDepth > 0) {
            if (fiber.stateNode && fiber.stateNode.current) {
              const root = fiber.stateNode as FiberRoot;
              if (!roots.includes(root)) {
                roots.push(root);
              }
              break;
            }
            if (fiber.tag === FIBER_TAGS.HostRoot && fiber.stateNode) {
              const root = fiber.stateNode as FiberRoot;
              if (!roots.includes(root)) {
                roots.push(root);
              }
              break;
            }
            fiber = fiber.return;
            maxDepth--;
          }
          
          if (roots.length > 0) break;
        }
      } catch (e) {
        continue;
      }
    }
    
    return roots;
  }
  
  function forceReanalyze(): void {
    if (!debuggerEnabled) return;
    
    const doAnalyze = () => {
      if (!debuggerEnabled) return;
      
      const roots = findReactRoots();
      let analyzed = false;
      
      if (roots.length > 0) {
        for (const root of roots) {
          try {
            if (root?.current) {
              analyzeFiberTree(root);
              analyzed = true;
            }
          } catch (e) {
            log('Force reanalyze error:', e);
          }
        }
      }
      
      if (!analyzed) {
        const hook = (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__;
        if (hook?.renderers) {
          hook.renderers.forEach((renderer: any) => {
            try {
              if (renderer?.getFiberRoots) {
                const fiberRoots = renderer.getFiberRoots(renderer);
                fiberRoots?.forEach((root: FiberRoot) => {
                  if (root?.current) {
                    analyzeFiberTree(root);
                    analyzed = true;
                  }
                });
              }
            } catch (e) {
              log('Renderer fallback error:', e);
            }
          });
        }
      }
      
      if (reduxStore) {
        try {
          sendFromPage('REDUX_STATE_CHANGE', deepSanitizeState(reduxStore.getState()));
        } catch (e) {
          log('Redux state snapshot error:', e);
        }
      }
    };
    
    scheduleIdleWork(doAnalyze, 100);
    setTimeout(doAnalyze, 200);
  }

  function isReduxStore(obj: any): boolean {
    if (!obj) return false;
    const hasGetState = typeof obj.getState === 'function';
    const hasDispatch = typeof obj.dispatch === 'function';
    const hasSubscribe = typeof obj.subscribe === 'function';
    
    if (hasGetState && hasDispatch && hasSubscribe) {
      try {
        const state = obj.getState();
        if (state !== undefined) {
          log('Found valid Redux store with state:', typeof state);
          return true;
        }
      } catch (e) {
        log('Store candidate failed getState():', e);
      }
    }
    return false;
  }

  function extractStoreFromFiber(fiber: any): any {
    if (!fiber) return null;
    
    const memoizedState = fiber.memoizedState;
    if (memoizedState?.store && isReduxStore(memoizedState.store)) {
      return memoizedState.store;
    }
    
    if (memoizedState?.memoizedState?.store && isReduxStore(memoizedState.memoizedState.store)) {
      return memoizedState.memoizedState.store;
    }
    
    const memoizedProps = fiber.memoizedProps;
    if (memoizedProps?.store && isReduxStore(memoizedProps.store)) {
      return memoizedProps.store;
    }
    
    if (memoizedProps?.value?.store && isReduxStore(memoizedProps.value.store)) {
      return memoizedProps.value.store;
    }
    
    if (memoizedProps?.value && isReduxStore(memoizedProps.value)) {
      return memoizedProps.value;
    }
    
    if (fiber.type?.displayName === 'Provider' || fiber.type?.name === 'Provider') {
      if (memoizedProps?.store && isReduxStore(memoizedProps.store)) {
        return memoizedProps.store;
      }
    }
    
    if (memoizedProps?.children?.props?.store && isReduxStore(memoizedProps.children.props.store)) {
      return memoizedProps.children.props.store;
    }

    const pendingProps = fiber.pendingProps;
    if (pendingProps?.store && isReduxStore(pendingProps.store)) {
      return pendingProps.store;
    }
    
    return null;
  }

  function traverseFiberForStore(fiber: any, visited: Set<any>, maxDepth: number): any {
    if (!fiber || maxDepth <= 0 || visited.has(fiber)) return null;
    visited.add(fiber);
    
    const store = extractStoreFromFiber(fiber);
    if (store) return store;
    
    if (fiber.child) {
      const childStore = traverseFiberForStore(fiber.child, visited, maxDepth - 1);
      if (childStore) return childStore;
    }
    
    if (fiber.sibling) {
      const siblingStore = traverseFiberForStore(fiber.sibling, visited, maxDepth - 1);
      if (siblingStore) return siblingStore;
    }
    
    return null;
  }

  function findStoreInReactFiber(): any {
    try {
      const rootSelectors = ['#root', '#app', '#__next', '[data-reactroot]', '#react-root', '.react-root', '#___gatsby', 'main', 'body'];
      let fiber: any = null;
      
      for (const selector of rootSelectors) {
        const el = document.querySelector(selector);
        if (!el) continue;
        
        const keys = Object.keys(el);
        const fiberKey = keys.find(key => 
          key.startsWith('__reactContainer$') ||
          key.startsWith('__reactFiber$') || 
          key.startsWith('__reactInternalInstance$')
        );
        
        if (fiberKey) {
          fiber = (el as any)[fiberKey];
          if (fiber?.stateNode?.current) {
            fiber = fiber.stateNode.current;
          } else if (fiber?.current) {
            fiber = fiber.current;
          }
          break;
        }
      }
      
      if (!fiber) {
        const allElements = document.querySelectorAll('*');
        for (const el of allElements) {
          const keys = Object.keys(el);
          const fiberKey = keys.find(key => 
            key.startsWith('__reactContainer$') ||
            key.startsWith('__reactFiber$')
          );
          if (fiberKey) {
            fiber = (el as any)[fiberKey];
            break;
          }
        }
      }
      
      if (!fiber) return null;
      
      let rootFiber = fiber;
      let maxUp = 100;
      while (rootFiber.return && maxUp > 0) {
        rootFiber = rootFiber.return;
        maxUp--;
      }
      
      const visited = new Set();
      const store = traverseFiberForStore(rootFiber, visited, 200);
      if (store) {
        log('Found Redux store in React Fiber tree');
        return store;
      }
      
      let currentFiber = fiber;
      let depth = 100;
      while (currentFiber && depth > 0) {
        if (visited.has(currentFiber)) break;
        
        const store = extractStoreFromFiber(currentFiber);
        if (store) return store;
        
        currentFiber = currentFiber.return;
        depth--;
      }
      
    } catch (e) {
      console.debug('[React Debugger] Error finding store in fiber:', e);
      return null;
    }
    return null;
  }

  function findStoreInWindowProperties(win: any): any {
    const storePatterns = ['store', 'redux', 'state', 'Store', 'Redux'];
    
    for (const key of Object.keys(win)) {
      const lowerKey = key.toLowerCase();
      if (storePatterns.some(p => lowerKey.includes(p.toLowerCase()))) {
        try {
          const candidate = win[key];
          if (isReduxStore(candidate)) {
            return candidate;
          }
          // Check if it's a module with a store property
          if (candidate && typeof candidate === 'object') {
            if (isReduxStore(candidate.store)) {
              return candidate.store;
            }
            if (isReduxStore(candidate.default)) {
              return candidate.default;
            }
          }
        } catch {
          continue;
        }
      }
    }
    return null;
  }

  let reduxDevToolsState: any = null;
  let reduxDevToolsMessageListenerInstalled = false;

  function setupReduxDevToolsMessageListener(): void {
    if (reduxDevToolsMessageListenerInstalled) return;
    reduxDevToolsMessageListenerInstalled = true;

    window.addEventListener('message', (event) => {
      if (!event.data || typeof event.data !== 'object') return;
      
      const validSources = ['@devtools-page', '@devtools-extension', '@redux-devtools-extension'];
      if (!validSources.includes(event.data.source)) return;
      
      const { type, state, payload } = event.data;
      
      const stateUpdateTypes = ['STATE', 'ACTION', 'INIT_INSTANCE', 'DISPATCH', 'START', 'INIT'];
      
      if (stateUpdateTypes.includes(type)) {
        const stateData = state || payload?.state || payload;
        
        if (stateData && !reduxStore) {
          try {
            const parsedState = typeof stateData === 'string' ? JSON.parse(stateData) : stateData;
            
            if (parsedState && typeof parsedState === 'object') {
              reduxDevToolsState = parsedState;
              log('Received Redux state from DevTools message:', type);
              
              const proxyStore = createReduxDevToolsProxyStore(parsedState);
              if (proxyStore) {
                setupReduxStore(proxyStore);
              }
            }
          } catch (e) {
            log('Failed to parse Redux DevTools state:', e);
          }
        }
      }
    });
  }

  function createReduxDevToolsProxyStore(initialState: any): any {
    const win = window as any;
    
    if (!win.__REDUX_DEVTOOLS_EXTENSION__?.connect) {
      return null;
    }

    try {
      const connection = win.__REDUX_DEVTOOLS_EXTENSION__.connect({
        name: 'React Debugger Proxy',
        features: { jump: false, skip: false, dispatch: true },
      });

      let currentState = initialState;
      const subscribers: Function[] = [];

      connection.subscribe((message: any) => {
        if (message.type === 'DISPATCH' && message.state) {
          try {
            currentState = typeof message.state === 'string' 
              ? JSON.parse(message.state) 
              : message.state;
            subscribers.forEach(fn => fn());
          } catch (e) {
            log('Failed to update state from DevTools:', e);
          }
        }
      });

      connection.init(initialState);

      const proxyStore = {
        getState: () => currentState,
        dispatch: (action: any) => {
          if (connection.send) {
            connection.send(action, currentState);
          }
          return action;
        },
        subscribe: (listener: Function) => {
          subscribers.push(listener);
          return () => {
            const index = subscribers.indexOf(listener);
            if (index > -1) subscribers.splice(index, 1);
          };
        },
        replaceReducer: () => {},
        ['@@observable']: () => ({
          subscribe: (observer: any) => {
            const unsubscribe = proxyStore.subscribe(() => {
              if (observer.next) observer.next(currentState);
            });
            return { unsubscribe };
          },
        }),
        __isProxyStore: true,
        __devToolsConnection: connection,
      };

      log('Created Redux DevTools proxy store');
      return proxyStore;
    } catch (e) {
      log('Failed to create Redux DevTools proxy store:', e);
      return null;
    }
  }

  function findStoreInReduxDevTools(): any {
    const win = window as any;
    
    if (win.__REDUX_DEVTOOLS_EXTENSION__) {
      const ext = win.__REDUX_DEVTOOLS_EXTENSION__;
      
      if (ext._stores && ext._stores.length > 0) {
        for (const store of ext._stores) {
          if (isReduxStore(store)) return store;
        }
      }
      
      if (ext._connections) {
        for (const conn of Object.values(ext._connections)) {
          if ((conn as any)?.store && isReduxStore((conn as any).store)) {
            return (conn as any).store;
          }
          if ((conn as any)?.init && (conn as any)?.subscribe) {
            const connAny = conn as any;
            if (connAny._store && isReduxStore(connAny._store)) {
              return connAny._store;
            }
          }
        }
      }
      
      if (ext.stores) {
        for (const store of Object.values(ext.stores)) {
          if (isReduxStore(store)) return store;
        }
      }

      if (ext.instances) {
        for (const instance of Object.values(ext.instances)) {
          const inst = instance as any;
          if (inst?.store && isReduxStore(inst.store)) {
            return inst.store;
          }
        }
      }

      if (reduxDevToolsState && !reduxStore) {
        const proxyStore = createReduxDevToolsProxyStore(reduxDevToolsState);
        if (proxyStore) return proxyStore;
      }
    }
    
    if (win.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__) {
      const compose = win.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__;
      if (compose._store && isReduxStore(compose._store)) {
        return compose._store;
      }
      if (compose.store && isReduxStore(compose.store)) {
        return compose.store;
      }
    }
    
    if (win.__REDUX_DEVTOOLS_STORE__) {
      if (isReduxStore(win.__REDUX_DEVTOOLS_STORE__)) {
        return win.__REDUX_DEVTOOLS_STORE__;
      }
    }
    
    return null;
  }

  function findReduxStore(): any {
    const win = window as any;
    log('Searching for Redux store...');
    
    const directCandidates = [
      { name: 'store', value: win.store },
      { name: '__REDUX_STORE__', value: win.__REDUX_STORE__ },
      { name: '__store__', value: win.__store__ },
      { name: 'reduxStore', value: win.reduxStore },
      { name: '__STORE__', value: win.__STORE__ },
      { name: 'appStore', value: win.appStore },
      { name: 'rootStore', value: win.rootStore },
      { name: '__store', value: win.__store },
      { name: '_store', value: win._store },
      { name: 'Store', value: win.Store },
      { name: 'myStore', value: win.myStore },
      { name: 'globalStore', value: win.globalStore },
    ];
    
    for (const { name, value } of directCandidates) {
      if (value) {
        log(`Checking window.${name}...`);
        if (isReduxStore(value)) {
          log(`Found Redux store via window.${name}`);
          return value;
        }
      }
    }
    
    log('Checking Redux DevTools...');
    const devToolsStore = findStoreInReduxDevTools();
    if (devToolsStore) {
      log('Found Redux store via DevTools');
      return devToolsStore;
    }
    
    log('Checking React Fiber tree...');
    const storeFromFiber = findStoreInReactFiber();
    if (storeFromFiber) {
      log('Found Redux store via React Fiber');
      return storeFromFiber;
    }
    
    log('Scanning window properties...');
    const storeFromWindow = findStoreInWindowProperties(win);
    if (storeFromWindow) {
      log('Found Redux store via window scan');
      return storeFromWindow;
    }
    
    log('Checking for zustand/jotai/other state managers...');
    const altStore = findAlternativeStateManagers(win);
    if (altStore) {
      log('Found alternative state manager');
      return altStore;
    }
    
    log('Redux store not found in this check');
    return null;
  }

  function findAlternativeStateManagers(win: any): any {
    if (win.__ZUSTAND_DEVTOOLS_EXTENSION__) {
      const stores = Object.values(win.__ZUSTAND_DEVTOOLS_EXTENSION__);
      for (const store of stores) {
        if (isReduxStore(store)) return store;
      }
    }
    
    const reactContext = win.__REACT_CONTEXT_DEVTOOL_GLOBAL_HOOK__;
    if (reactContext?.stores) {
      for (const store of Object.values(reactContext.stores)) {
        if (isReduxStore(store)) return store;
      }
    }
    
    return null;
  }

  function deepSanitizeState(value: unknown, depth = 0, maxDepth = 5): unknown {
    if (depth > maxDepth) return '[Object depth exceeded]';
    if (value === null) return null;
    if (value === undefined) return undefined;
    
    const type = typeof value;
    if (type === 'string') return value;
    if (type === 'number' || type === 'boolean') return value;
    if (type === 'function') return `[Function: ${(value as Function).name || 'anonymous'}]`;
    if (type === 'symbol') return `[Symbol: ${(value as symbol).toString()}]`;
    
    if (Array.isArray(value)) {
      return value.map(v => deepSanitizeState(v, depth + 1, maxDepth));
    }
    
    if (type === 'object') {
      const obj = value as Record<string, unknown>;
      
      // Handle special objects
      if ((obj as any).$$typeof) return '[React Element]';
      if (obj instanceof HTMLElement) return `[HTMLElement: ${obj.tagName}]`;
      if (obj instanceof Event) return '[Event]';
      if (obj instanceof Error) return { __type: 'Error', message: obj.message, stack: obj.stack };
      if (obj instanceof Date) return { __type: 'Date', value: obj.toISOString() };
      if (obj instanceof RegExp) return { __type: 'RegExp', value: obj.toString() };
      if (obj instanceof Map) {
        const mapObj: Record<string, unknown> = { __type: 'Map', size: obj.size, entries: {} };
        obj.forEach((v, k) => {
          (mapObj.entries as Record<string, unknown>)[String(k)] = deepSanitizeState(v, depth + 1, maxDepth);
        });
        return mapObj;
      }
      if (obj instanceof Set) {
        return { __type: 'Set', size: obj.size, values: Array.from(obj).map(v => deepSanitizeState(v, depth + 1, maxDepth)) };
      }
      if (obj instanceof Promise) return '[Promise]';
      
      const result: Record<string, unknown> = {};
      for (const key of Object.keys(obj)) {
        try {
          result[key] = deepSanitizeState(obj[key], depth + 1, maxDepth);
        } catch {
          result[key] = '[Error reading property]';
        }
      }
      return result;
    }
    
    return String(value);
  }

  // Set nested value by path
  function setNestedValue(obj: any, path: string[], value: any): any {
    if (path.length === 0) return value;
    
    const result = Array.isArray(obj) ? [...obj] : { ...obj };
    const [first, ...rest] = path;
    
    if (rest.length === 0) {
      result[first] = value;
    } else {
      result[first] = setNestedValue(result[first], rest, value);
    }
    
    return result;
  }

  let reduxStore: any = null;
  let originalDispatch: Function | null = null;
  let stateOverrides: Map<string, any> = new Map();

  let reduxSearchStopped = false;
  let reduxSearchAttempts = 0;
  
  let stateChangeTimeout: number | null = null;
  const STATE_CHANGE_DEBOUNCE = 100;

  let reduxHookInstalled = false;
  let reduxCheckInterval: number | null = null;
  
  function restartReduxSearch(): void {
    reduxSearchStopped = false;
    reduxSearchAttempts = 0;
    
    if (reduxStore) return;
    
    const store = findReduxStore();
    if (store) {
      setupReduxStore(store);
      return;
    }
    
    startReduxPolling();
  }
  
  function setupReduxStore(store: any): void {
    if (!store || reduxStore === store) return;
    
    reduxStore = store;
    reduxSearchStopped = true;
    
    if (reduxCheckInterval) {
      clearInterval(reduxCheckInterval);
      reduxCheckInterval = null;
    }
    
    try {
      const initialState = deepSanitizeState(store.getState());
      console.log('[React Debugger] Redux store connected');
      sendFromPage('REDUX_DETECTED', initialState);
      
      originalDispatch = store.dispatch;
      
      store.dispatch = function(action: any) {
        if (action.type?.startsWith('@@REACT_DEBUGGER/')) {
          return originalDispatch!.call(store, action);
        }
        
        const result = originalDispatch!.call(store, action);
        
        if (debuggerEnabled) {
          sendFromPage('REDUX_ACTION', {
            id: generateId(),
            type: action.type || 'UNKNOWN',
            payload: sanitizeValue(action, 0),
            timestamp: getUniqueTimestamp(),
          });
          
          sendFromPage('TIMELINE_EVENTS', [{
            id: generateId(),
            timestamp: getUniqueTimestamp(),
            type: 'state-change',
            payload: {
              source: 'redux',
              actionType: action.type || 'UNKNOWN',
            },
          }]);
        }
        
        return result;
      };
      
      store.subscribe(() => {
        if (stateChangeTimeout) {
          clearTimeout(stateChangeTimeout);
        }
        stateChangeTimeout = window.setTimeout(() => {
          try {
            sendFromPage('REDUX_STATE_CHANGE', deepSanitizeState(store.getState()));
          } catch (e) {
            console.debug('[React Debugger] Error sending state change:', e);
          }
          stateChangeTimeout = null;
        }, STATE_CHANGE_DEBOUNCE);
      });
      
      (window as any).__REACT_DEBUGGER_DISPATCH__ = (action: any) => {
        return originalDispatch!.call(store, action);
      };
      (window as any).__REACT_DEBUGGER_STORE__ = store;
      (window as any).__REACT_DEBUGGER_GET_STATE__ = () => store.getState();
      
      let injectedState: any = null;
      
      if (typeof store.replaceReducer === 'function') {
        try {
          const createInjectorReducer = (baseReducer: Function | null) => {
            return (state: any, action: any) => {
              if (injectedState !== null) {
                const newState = injectedState;
                injectedState = null;
                return newState;
              }
              
              if (baseReducer) {
                return baseReducer(state, action);
              }
              return state;
            };
          };
          
          const originalReplaceReducer = store.replaceReducer.bind(store);
          
          store.replaceReducer = (nextReducer: Function) => {
            return originalReplaceReducer(createInjectorReducer(nextReducer));
          };
          
          originalReplaceReducer(createInjectorReducer(null));
          
          log('Redux state injection ready');
        } catch (e) {
          log('replaceReducer setup failed:', e);
        }
      }
      
      (window as any).__REACT_DEBUGGER_SET_STATE__ = (path: string[], value: any) => {
        try {
          const currentState = store.getState();
          const newState = setNestedValue(currentState, path, value);
          
          stateOverrides.set(path.join('.'), { path, value });
          
          injectedState = newState;
          originalDispatch!.call(store, { type: '@@REACT_DEBUGGER/SET_STATE' });
          
          sendFromPage('REDUX_STATE_CHANGE', deepSanitizeState(store.getState()));
        } catch (e) {
          console.error('[React Debugger] Set state error:', e);
        }
      };
      
      (window as any).__REACT_DEBUGGER_CLEAR_OVERRIDES__ = () => {
        try {
          if (stateOverrides.size === 0) return;
          stateOverrides.clear();
          sendFromPage('REDUX_STATE_CHANGE', deepSanitizeState(store.getState()));
          sendFromPage('REDUX_OVERRIDES_CLEARED', null);
        } catch (e) {
          console.error('[React Debugger] Clear overrides error:', e);
        }
      };
      
      (window as any).__REACT_DEBUGGER_RESET_STATE__ = () => {
        try {
          stateOverrides.clear();
          sendFromPage('REDUX_STATE_CHANGE', deepSanitizeState(store.getState()));
          sendFromPage('REDUX_OVERRIDES_CLEARED', null);
        } catch (e) {
          console.error('[React Debugger] Reset state error:', e);
        }
      };
    } catch (e) {
      console.error('[React Debugger] Error setting up Redux hook:', e);
      reduxStore = null;
    }
  }
  
  function startReduxPolling(): void {
    if (reduxCheckInterval) return;
    
    let attempts = 0;
    const maxAttempts = 20;
    const checkInterval = 1000;
    
    reduxCheckInterval = window.setInterval(() => {
      attempts++;
      reduxSearchAttempts++;
      
      if (reduxSearchStopped || reduxStore) {
        if (reduxCheckInterval) {
          clearInterval(reduxCheckInterval);
          reduxCheckInterval = null;
        }
        return;
      }
      
      const store = findReduxStore();
      if (store) {
        if (reduxCheckInterval) {
          clearInterval(reduxCheckInterval);
          reduxCheckInterval = null;
        }
        setupReduxStore(store);
        return;
      }
      
      if (attempts >= maxAttempts) {
        if (reduxCheckInterval) {
          clearInterval(reduxCheckInterval);
          reduxCheckInterval = null;
        }
        log('Redux store detection paused after', maxAttempts, 'attempts (will retry on enable)');
      }
    }, checkInterval);
  }
  
  function installReduxHook(): void {
    if (reduxHookInstalled) return;
    reduxHookInstalled = true;
    
    setupReduxDevToolsMessageListener();
    
    const win = window as any;
    
    if (typeof win.__REDUX_DEVTOOLS_EXTENSION__ !== 'undefined') {
      const originalConnect = win.__REDUX_DEVTOOLS_EXTENSION__.connect;
      if (originalConnect) {
        win.__REDUX_DEVTOOLS_EXTENSION__.connect = function(...args: any[]) {
          const devTools = originalConnect.apply(this, args);
          
          setTimeout(() => {
            if (!reduxStore && !reduxSearchStopped) {
              const store = findReduxStore();
              if (store) setupReduxStore(store);
            }
          }, 500);
          
          return devTools;
        };
      }
    }
    
    if (typeof win.Redux !== 'undefined' && win.Redux.createStore) {
      const originalCreateStore = win.Redux.createStore;
      win.Redux.createStore = function(...args: any[]) {
        const store = originalCreateStore.apply(this, args);
        setTimeout(() => setupReduxStore(store), 100);
        return store;
      };
    }

    const onReady = () => {
      if (reduxStore || reduxSearchStopped) return;
      setTimeout(() => {
        if (!reduxStore && !reduxSearchStopped) {
          const store = findReduxStore();
          if (store) {
            setupReduxStore(store);
          } else {
            startReduxPolling();
          }
        }
      }, 1000);
    };

    if (document.readyState === 'complete') {
      onReady();
    } else {
      window.addEventListener('load', onReady, { once: true });
    }
  }

  let scanEnabled = false;
  const overlayElements = new Map<string, HTMLElement>();
  const renderFlashTimers = new Map<string, number>();
  
  function createOverlayContainer(): HTMLElement {
    let container = document.getElementById('react-debugger-overlay-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'react-debugger-overlay-container';
      container.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 999999;
      `;
      document.body.appendChild(container);
    }
    return container;
  }

  function getBorderColorForRenderCount(count: number): string {
    if (count <= 1) return '#40c463';
    if (count <= 3) return '#ffc107';
    if (count <= 5) return '#ff9800';
    if (count <= 10) return '#ff5722';
    return '#f44336';
  }

  function flashRenderOverlay(fiber: FiberNode, componentName: string, renderCount: number): void {
    if (!scanEnabled) return;
    
    const stateNode = fiber.stateNode;
    let domNode: HTMLElement | null = null;
    
    if (stateNode instanceof HTMLElement) {
      domNode = stateNode;
    } else if (fiber.child) {
      let childFiber: FiberNode | null = fiber.child;
      while (childFiber) {
        if (childFiber.stateNode instanceof HTMLElement) {
          domNode = childFiber.stateNode;
          break;
        }
        childFiber = childFiber.child;
      }
    }
    
    if (!domNode) return;
    
    const rect = domNode.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    if (rect.bottom < 0 || rect.right < 0 || rect.top > window.innerHeight || rect.left > window.innerWidth) return;
    
    const container = createOverlayContainer();
    const fiberId = `${componentName}_${fiber.key || 'nokey'}_${Math.round(rect.top)}_${Math.round(rect.left)}`;
    
    const renderChange = detectRenderChanges(fiber);
    
    let overlay = overlayElements.get(fiberId);
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'react-debugger-overlay';
      container.appendChild(overlay);
      overlayElements.set(fiberId, overlay);
    }
    
    const borderColor = getBorderColorForRenderCount(renderCount);
    
    overlay.style.cssText = `
      position: fixed;
      top: ${rect.top}px;
      left: ${rect.left}px;
      width: ${rect.width}px;
      height: ${rect.height}px;
      background: transparent;
      border: 2px solid ${borderColor};
      border-radius: 4px;
      pointer-events: none;
      z-index: 999999;
      transition: opacity 0.3s ease-out, transform 0.1s ease-out;
      box-sizing: border-box;
      transform: scale(1.02);
    `;
    
    setTimeout(() => {
      if (overlay) overlay.style.transform = 'scale(1)';
    }, 50);
    
    const label = overlay.querySelector('.scan-label') as HTMLElement || document.createElement('div');
    label.className = 'scan-label';
    
    const reasonText = renderChange.changedKeys 
      ? ` [${renderChange.type}: ${renderChange.changedKeys.slice(0, 3).join(', ')}${renderChange.changedKeys.length > 3 ? '...' : ''}]`
      : renderChange.type !== 'parent' ? ` [${renderChange.type}]` : '';
    
    label.style.cssText = `
      position: absolute;
      top: -22px;
      left: 0;
      background: ${borderColor};
      color: white;
      font-size: 10px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', monospace;
      padding: 2px 8px;
      border-radius: 4px;
      white-space: nowrap;
      pointer-events: none;
      font-weight: 500;
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    `;
    label.textContent = `${componentName} ×${renderCount}${reasonText}`;
    
    if (!label.parentElement) {
      overlay.appendChild(label);
    }
    
    overlay.style.opacity = '1';
    
    const existingTimer = renderFlashTimers.get(fiberId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }
    
    const timer = window.setTimeout(() => {
      if (overlay) {
        overlay.style.opacity = '0';
      }
      renderFlashTimers.delete(fiberId);
    }, 800);
    
    renderFlashTimers.set(fiberId, timer);
  }

  function clearAllOverlays(): void {
    overlayElements.forEach(overlay => {
      overlay.remove();
    });
    overlayElements.clear();
    renderFlashTimers.forEach(timer => clearTimeout(timer));
    renderFlashTimers.clear();
  }

  function toggleScan(enabled: boolean): void {
    scanEnabled = enabled;
    if (!enabled) {
      clearAllOverlays();
    }
    sendFromPage('SCAN_STATUS', { enabled: scanEnabled });
  }

  (window as any).__REACT_DEBUGGER_SCAN__ = {
    enable: () => toggleScan(true),
    disable: () => toggleScan(false),
    toggle: () => toggleScan(!scanEnabled),
    isEnabled: () => scanEnabled,
  };

  let memoryMonitoringEnabled = false;
  let memoryMonitorInterval: number | null = null;
  const MEMORY_SAMPLE_INTERVAL = 2000;

  interface ChromePerformance extends Performance {
    memory?: {
      usedJSHeapSize: number;
      totalJSHeapSize: number;
      jsHeapSizeLimit: number;
    };
  }

  function getMemorySnapshot(): { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number } | null {
    const perf = performance as ChromePerformance;
    if (!perf.memory) return null;
    
    return {
      usedJSHeapSize: perf.memory.usedJSHeapSize,
      totalJSHeapSize: perf.memory.totalJSHeapSize,
      jsHeapSizeLimit: perf.memory.jsHeapSizeLimit,
    };
  }

  let lastMemoryUsage = 0;
  const MEMORY_SPIKE_THRESHOLD = 0.15;
  
  function startMemoryMonitoring(): void {
    if (!debuggerEnabled || memoryMonitoringEnabled) return;
    
    const snapshot = getMemorySnapshot();
    if (!snapshot) {
      log('Memory API not available');
      return;
    }
    
    memoryMonitoringEnabled = true;
    lastMemoryUsage = snapshot.usedJSHeapSize;
    
    sendFromPage('MEMORY_SNAPSHOT', {
      ...snapshot,
      timestamp: Date.now(),
    });
    
    memoryMonitorInterval = window.setInterval(() => {
      const snap = getMemorySnapshot();
      if (snap) {
        const timestamp = getUniqueTimestamp();
        const growthRate = lastMemoryUsage > 0 
          ? (snap.usedJSHeapSize - lastMemoryUsage) / lastMemoryUsage 
          : 0;
        const isSpike = growthRate > MEMORY_SPIKE_THRESHOLD;
        
        sendFromPage('MEMORY_SNAPSHOT', {
          ...snap,
          timestamp,
        });
        
        if (isSpike || snap.usedJSHeapSize / snap.jsHeapSizeLimit > 0.8) {
          sendFromPage('TIMELINE_EVENTS', [{
            id: generateId(),
            timestamp,
            type: 'memory',
            payload: {
              heapUsed: snap.usedJSHeapSize,
              heapTotal: snap.totalJSHeapSize,
              heapLimit: snap.jsHeapSizeLimit,
              isSpike,
              growthRate,
            },
          }]);
        }
        
        lastMemoryUsage = snap.usedJSHeapSize;
      }
    }, MEMORY_SAMPLE_INTERVAL);
    
    log('Memory monitoring started');
  }

  function stopMemoryMonitoring(): void {
    if (!memoryMonitoringEnabled) return;
    
    memoryMonitoringEnabled = false;
    if (memoryMonitorInterval) {
      clearInterval(memoryMonitorInterval);
      memoryMonitorInterval = null;
    }
    
    log('Memory monitoring stopped');
  }

  function stopAllMonitoring(): void {
    stopMemoryMonitoring();
    toggleScan(false);
    reduxSearchStopped = true;
    messageQueue = [];
    if (flushTimeout) {
      clearTimeout(flushTimeout);
      flushTimeout = null;
    }
    clearPathCache();
    log('All monitoring stopped');
  }

  (window as any).__REACT_DEBUGGER_MEMORY__ = {
    start: startMemoryMonitoring,
    stop: stopMemoryMonitoring,
    getSnapshot: getMemorySnapshot,
    isMonitoring: () => memoryMonitoringEnabled,
  };

  function installErrorHandlers(): void {
    const originalOnError = window.onerror;
    
    window.onerror = function(message, source, lineno, colno, error) {
      if (source?.includes('react-debugger') || source?.includes('chrome-extension')) {
        return originalOnError?.apply(window, arguments as any);
      }
      
      const memorySnapshot = getMemorySnapshot();
      const analysisHints: string[] = [];
      
      if (memorySnapshot) {
        const usagePercent = memorySnapshot.usedJSHeapSize / memorySnapshot.jsHeapSizeLimit;
        if (usagePercent > 0.8) {
          analysisHints.push('High memory usage detected at crash time');
        }
      }
      
      const crashId = generateId();
      const crashTimestamp = getUniqueTimestamp();
      
      sendFromPage('CRASH_DETECTED', {
        id: crashId,
        timestamp: crashTimestamp,
        type: 'js-error',
        message: String(message),
        stack: error?.stack?.slice(0, 5000),
        source,
        lineno,
        colno,
        memorySnapshot: memorySnapshot ? {
          timestamp: crashTimestamp,
          usedJSHeapSize: memorySnapshot.usedJSHeapSize,
          totalJSHeapSize: memorySnapshot.totalJSHeapSize,
          jsHeapSizeLimit: memorySnapshot.jsHeapSizeLimit,
        } : undefined,
        analysisHints,
      });
      
      sendFromPage('TIMELINE_EVENTS', [{
        id: crashId,
        timestamp: crashTimestamp,
        type: 'error',
        payload: {
          errorType: 'js-error',
          message: String(message),
          stack: error?.stack?.slice(0, 2000),
          source,
          lineno,
        },
      }]);
      
      return originalOnError?.apply(window, arguments as any);
    };
    
    window.addEventListener('unhandledrejection', (event) => {
      const reason = event.reason;
      const memorySnapshot = getMemorySnapshot();
      const analysisHints: string[] = [];
      
      if (memorySnapshot) {
        const usagePercent = memorySnapshot.usedJSHeapSize / memorySnapshot.jsHeapSizeLimit;
        if (usagePercent > 0.8) {
          analysisHints.push('High memory usage detected at crash time');
        }
      }
      
      const rejectId = generateId();
      const rejectTimestamp = getUniqueTimestamp();
      
      sendFromPage('CRASH_DETECTED', {
        id: rejectId,
        timestamp: rejectTimestamp,
        type: 'unhandled-rejection',
        message: reason?.message || String(reason),
        stack: reason?.stack?.slice(0, 5000),
        memorySnapshot: memorySnapshot ? {
          timestamp: rejectTimestamp,
          usedJSHeapSize: memorySnapshot.usedJSHeapSize,
          totalJSHeapSize: memorySnapshot.totalJSHeapSize,
          jsHeapSizeLimit: memorySnapshot.jsHeapSizeLimit,
        } : undefined,
        analysisHints,
      });
      
      sendFromPage('TIMELINE_EVENTS', [{
        id: rejectId,
        timestamp: rejectTimestamp,
        type: 'error',
        payload: {
          errorType: 'unhandled-rejection',
          message: reason?.message || String(reason),
          stack: reason?.stack?.slice(0, 2000),
        },
      }]);
    });
    
    log('Error handlers installed');
  }

  listenFromContent((message) => {
    if (message.type === 'DISPATCH_REDUX_ACTION') {
      const dispatch = (window as any).__REACT_DEBUGGER_DISPATCH__;
      if (dispatch && message.payload) {
        try {
          dispatch(message.payload);
        } catch (e) {
          console.error('[React Debugger] Dispatch error:', e);
        }
      }
    }
    
    if (message.type === 'SET_REDUX_STATE') {
      const payload = message.payload as { path: string[]; value: unknown } | undefined;
      if (payload && reduxStore) {
        try {
          const setStateFn = (window as any).__REACT_DEBUGGER_SET_STATE__;
          if (setStateFn) {
            setStateFn(payload.path, payload.value);
          }
        } catch (e) {
          console.error('[React Debugger] Set state error:', e);
        }
      }
    }
    
    if (message.type === 'CLEAR_REDUX_OVERRIDES') {
      if (reduxStore && originalDispatch) {
        try {
          const clearFn = (window as any).__REACT_DEBUGGER_CLEAR_OVERRIDES__;
          if (clearFn) clearFn();
        } catch (e) {
          console.error('[React Debugger] Clear overrides error:', e);
        }
      }
    }
    
    if (message.type === 'DELETE_ARRAY_ITEM') {
      const payload = message.payload as { path: string[]; index: number } | undefined;
      if (payload && reduxStore) {
        try {
          const currentState = reduxStore.getState();
          let target = currentState;
          for (const key of payload.path) {
            target = target[key];
          }
          if (Array.isArray(target)) {
            const newArray = [...target];
            newArray.splice(payload.index, 1);
            const setStateFn = (window as any).__REACT_DEBUGGER_SET_STATE__;
            if (setStateFn) {
              setStateFn(payload.path, newArray);
            }
          }
        } catch (e) {
          console.error('[React Debugger] Delete array item error:', e);
        }
      }
    }
    
    if (message.type === 'MOVE_ARRAY_ITEM') {
      const payload = message.payload as { path: string[]; fromIndex: number; toIndex: number } | undefined;
      if (payload && reduxStore) {
        try {
          const currentState = reduxStore.getState();
          let target = currentState;
          for (const key of payload.path) {
            target = target[key];
          }
          if (Array.isArray(target) && payload.toIndex >= 0 && payload.toIndex < target.length) {
            const newArray = [...target];
            const [item] = newArray.splice(payload.fromIndex, 1);
            newArray.splice(payload.toIndex, 0, item);
            const setStateFn = (window as any).__REACT_DEBUGGER_SET_STATE__;
            if (setStateFn) {
              setStateFn(payload.path, newArray);
            }
          }
        } catch (e) {
          console.error('[React Debugger] Move array item error:', e);
        }
      }
    }
    
    if (message.type === 'REFRESH_REDUX_STATE') {
      if (reduxStore) {
        try {
          sendFromPage('REDUX_STATE_CHANGE', deepSanitizeState(reduxStore.getState()));
        } catch (e) {
          console.error('[React Debugger] Refresh state error:', e);
        }
      }
    }
    
    if (message.type === 'TOGGLE_SCAN') {
      const payload = message.payload as { enabled?: boolean } | undefined;
      if (payload && typeof payload.enabled === 'boolean') {
        toggleScan(payload.enabled);
      } else {
        toggleScan(!scanEnabled);
      }
    }
    
    if (message.type === 'START_MEMORY_MONITORING') {
      startMemoryMonitoring();
    }
    
    if (message.type === 'STOP_MEMORY_MONITORING') {
      stopMemoryMonitoring();
    }
    
    if (message.type === 'ENABLE_DEBUGGER') {
      debuggerEnabled = true;
      installReduxHook();
      restartReduxSearch();
      forceReanalyze();
      sendFromPage('DEBUGGER_STATE_CHANGED', { enabled: true });
      log('Debugger enabled');
    }
    
    if (message.type === 'DISABLE_DEBUGGER') {
      debuggerEnabled = false;
      stopAllMonitoring();
      sendFromPage('DEBUGGER_STATE_CHANGED', { enabled: false });
      log('Debugger disabled');
    }
    
    if (message.type === 'GET_DEBUGGER_STATE') {
      sendFromPage('DEBUGGER_STATE_CHANGED', { enabled: debuggerEnabled });
    }
  });

  installReactHook();
  installReduxHook();
  installErrorHandlers();
  
  (window as any).__REACT_DEBUGGER_ENABLE_CLOSURE_TRACKING__ = _installClosureTracking;

  setTimeout(() => {
    const hook = (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__;
    if (hook?.renderers?.size > 0) {
      sendFromPage('REACT_DETECTED', {
        version: detectReactVersion(),
        mode: detectReactMode(),
      });
    }
  }, 500);

  console.log('[React Debugger] Inject script loaded');
})();
