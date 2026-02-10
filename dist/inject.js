(function() {
  "use strict";
  (function() {
    const PAGE_SOURCE = "REACT_DEBUGGER_PAGE";
    const CONTENT_SOURCE = "REACT_DEBUGGER_CONTENT";
    let debuggerEnabled = false;
    let extensionAlive = true;
    let messageQueue = [];
    let flushTimeout = null;
    let messageCount = 0;
    let lastCountReset = Date.now();
    let currentThrottle = 100;
    const MAX_BATCH_SIZE = 100;
    function getAdaptiveThrottle() {
      const now = Date.now();
      if (now - lastCountReset > 1e3) {
        const rate = messageCount;
        messageCount = 0;
        lastCountReset = now;
        if (rate < 5) currentThrottle = 200;
        else if (rate < 20) currentThrottle = 100;
        else currentThrottle = 50;
      }
      messageCount++;
      return currentThrottle;
    }
    function log(...args) {
    }
    function flushMessages() {
      if (!extensionAlive || messageQueue.length === 0) {
        messageQueue = [];
        return;
      }
      let messages = messageQueue;
      messageQueue = [];
      flushTimeout = null;
      if (messages.length > MAX_BATCH_SIZE) {
        messages = messages.slice(-MAX_BATCH_SIZE);
      }
      for (const msg of messages) {
        try {
          window.postMessage({ source: PAGE_SOURCE, type: msg.type, payload: msg.payload }, "*");
        } catch {
          extensionAlive = false;
          break;
        }
      }
    }
    function sendFromPage(type, payload) {
      if (!extensionAlive) return;
      const alwaysAllowedMessages = [
        "DEBUGGER_STATE_CHANGED",
        "REACT_DETECTED",
        "REDUX_DETECTED",
        "REDUX_STATE_CHANGE",
        "REDUX_OVERRIDES_CLEARED"
      ];
      if (!debuggerEnabled && !alwaysAllowedMessages.includes(type)) {
        return;
      }
      const criticalMessages = [
        "REACT_DETECTED",
        "REDUX_DETECTED",
        "REDUX_STATE_CHANGE",
        "DEBUGGER_STATE_CHANGED",
        "REDUX_OVERRIDES_CLEARED"
      ];
      if (criticalMessages.includes(type)) {
        try {
          window.postMessage({ source: PAGE_SOURCE, type, payload }, "*");
        } catch {
          extensionAlive = false;
        }
        return;
      }
      messageQueue.push({ type, payload });
      if (!flushTimeout) {
        flushTimeout = window.setTimeout(flushMessages, getAdaptiveThrottle());
      }
    }
    function listenFromContent(callback) {
      window.addEventListener("message", (event) => {
        if (event.source !== window) return;
        if (!event.data || event.data.source !== CONTENT_SOURCE) return;
        callback({ type: event.data.type, payload: event.data.payload });
      });
    }
    function generateId() {
      return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    let lastTimestamp = 0;
    let timestampCounter = 0;
    function getUniqueTimestamp() {
      const now = Date.now();
      if (now === lastTimestamp) {
        timestampCounter++;
      } else {
        timestampCounter = 0;
        lastTimestamp = now;
      }
      return now + timestampCounter * 1e-3;
    }
    function scheduleIdleWork(callback, timeoutMs = 500) {
      if ("requestIdleCallback" in window) {
        window.requestIdleCallback(callback, { timeout: timeoutMs });
      } else {
        setTimeout(callback, 0);
      }
    }
    function sanitizeValue(value, depth = 0) {
      if (depth > 5) return "[Object depth exceeded]";
      if (value === null) return null;
      if (value === void 0) return void 0;
      const type = typeof value;
      if (type === "string") return value.slice(0, 500);
      if (type === "number" || type === "boolean") return value;
      if (type === "function") return `[Function: ${value.name || "anonymous"}]`;
      if (type === "symbol") return `[Symbol]`;
      if (Array.isArray(value)) {
        if (value.length > 50) return `[Array(${value.length})]`;
        return value.slice(0, 50).map((v) => sanitizeValue(v, depth + 1));
      }
      if (type === "object") {
        const obj = value;
        if (obj.$$typeof) return "[React Element]";
        if (obj instanceof HTMLElement) return `[${obj.tagName}]`;
        if (obj instanceof Event) return "[Event]";
        if (obj instanceof Error) return `[Error: ${obj.message}]`;
        if (obj instanceof Date) return obj.toISOString();
        if (obj instanceof RegExp) return obj.toString();
        if (obj instanceof Map) return `[Map(${obj.size})]`;
        if (obj instanceof Set) return `[Set(${obj.size})]`;
        if (obj instanceof Promise) return "[Promise]";
        const result = {};
        const keys = Object.keys(obj).slice(0, 30);
        for (const key of keys) {
          try {
            result[key] = sanitizeValue(obj[key], depth + 1);
          } catch {
            result[key] = "[Error]";
          }
        }
        return result;
      }
      return String(value);
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
      SimpleMemoComponent: 15
    };
    const FIBER_FLAGS = {
      PerformedWork: 1,
      Placement: 2,
      Update: 4,
      Passive: 512
    };
    const lastEffectStates = /* @__PURE__ */ new Map();
    function didFiberRender(fiber) {
      var _a, _b;
      const alternate = fiber.alternate;
      if (!alternate) return true;
      const flags = fiber.flags ?? fiber.effectTag ?? 0;
      if (flags & (FIBER_FLAGS.PerformedWork | FIBER_FLAGS.Update | FIBER_FLAGS.Placement | FIBER_FLAGS.Passive)) {
        return true;
      }
      if (fiber.actualDuration > 0) {
        return true;
      }
      const lanes = fiber.lanes ?? 0;
      if (lanes !== 0) {
        return true;
      }
      if (fiber.memoizedProps !== alternate.memoizedProps) return true;
      if (fiber.memoizedState !== alternate.memoizedState) return true;
      const currentContext = (_a = fiber.dependencies) == null ? void 0 : _a.firstContext;
      const alternateContext = (_b = alternate.dependencies) == null ? void 0 : _b.firstContext;
      if (currentContext !== alternateContext) return true;
      if (fiber.type !== alternate.type) return true;
      return false;
    }
    const renderCounts = /* @__PURE__ */ new Map();
    const lastRenderTimes = /* @__PURE__ */ new Map();
    const recentRenderTimestamps = /* @__PURE__ */ new Map();
    const reportedEffectIssues = /* @__PURE__ */ new Set();
    const reportedExcessiveRerenders = /* @__PURE__ */ new Set();
    const reportedSlowRenders = /* @__PURE__ */ new Set();
    const EXCESSIVE_RENDER_THRESHOLD = 10;
    const EXCESSIVE_RENDER_WINDOW_MS = 1e3;
    const componentRenderIds = /* @__PURE__ */ new Map();
    const trackedClosures = /* @__PURE__ */ new Map();
    const staleClosureIssues = /* @__PURE__ */ new Map();
    let closureIdCounter = 0;
    const originalSetTimeout = window.setTimeout;
    const originalSetInterval = window.setInterval;
    const originalAddEventListener = EventTarget.prototype.addEventListener;
    function getCurrentComponentContext() {
      const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
      if (!hook || !hook.renderers) return null;
      try {
        for (const [, renderer] of hook.renderers) {
          if (renderer.getCurrentFiber) {
            const fiber = renderer.getCurrentFiber();
            if (fiber) {
              const name = getComponentName(fiber);
              const path = getComponentPath(fiber);
              const fiberId = `${name}_${path.join("/")}`;
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
    function extractFunctionName(fn) {
      if (fn.name) return fn.name;
      const fnStr = fn.toString();
      const match = fnStr.match(/function\s+([^\s(]+)/);
      return match ? match[1] : "anonymous";
    }
    function trackClosure(fn, asyncType, context) {
      const closureId = ++closureIdCounter;
      const capturedState = /* @__PURE__ */ new Map();
      const fnStr = fn.toString();
      const statePatterns = [
        /\b(count|value|data|user|items|state|props|isLoading|isOpen|error|result)\b/gi
      ];
      for (const pattern of statePatterns) {
        const matches = fnStr.match(pattern);
        if (matches) {
          matches.forEach((match) => {
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
        asyncType
      });
      return closureId;
    }
    function checkStaleClosureOnExecution(closureId) {
      const tracker = trackedClosures.get(closureId);
      if (!tracker) return;
      const fiberId = `${tracker.componentName}_${tracker.componentPath.join("/")}`;
      const currentRenderId = componentRenderIds.get(fiberId) || 0;
      if (currentRenderId > tracker.renderId + 1) {
        const issueKey = `${fiberId}_${tracker.functionName}_${tracker.asyncType}`;
        if (!staleClosureIssues.has(issueKey)) {
          const issue = {
            id: generateId(),
            type: "STALE_CLOSURE",
            severity: "warning",
            component: tracker.componentName,
            message: `${tracker.asyncType} callback "${tracker.functionName}" may be using stale values from render #${tracker.renderId} (current: #${currentRenderId})`,
            suggestion: "Use useCallback with proper dependencies, or useRef for mutable values that should persist across renders",
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
                  currentValue: "[current value]"
                })),
                asyncType: tracker.asyncType
              }
            }
          };
          staleClosureIssues.set(issueKey, issue);
          sendFromPage("STALE_CLOSURE_DETECTED", issue);
        }
      }
      if (Date.now() - tracker.createdAt > 6e4) {
        trackedClosures.delete(closureId);
      }
    }
    function _installClosureTracking() {
      window.setTimeout = function(callback, delay, ...args) {
        if (typeof callback !== "function") {
          return originalSetTimeout.call(window, callback, delay, ...args);
        }
        const context = getCurrentComponentContext();
        if (!context) {
          return originalSetTimeout.call(window, callback, delay, ...args);
        }
        const closureId = trackClosure(callback, "setTimeout", context);
        const wrappedCallback = function() {
          checkStaleClosureOnExecution(closureId);
          return callback.apply(this, args);
        };
        return originalSetTimeout.call(window, wrappedCallback, delay);
      };
      window.setInterval = function(callback, delay, ...args) {
        if (typeof callback !== "function") {
          return originalSetInterval.call(window, callback, delay, ...args);
        }
        const context = getCurrentComponentContext();
        if (!context) {
          return originalSetInterval.call(window, callback, delay, ...args);
        }
        const closureId = trackClosure(callback, "setInterval", context);
        const wrappedCallback = function() {
          checkStaleClosureOnExecution(closureId);
          return callback.apply(this, args);
        };
        return originalSetInterval.call(window, wrappedCallback, delay);
      };
      EventTarget.prototype.addEventListener = function(type, listener, options) {
        if (!listener || typeof listener !== "function") {
          return originalAddEventListener.call(this, type, listener, options);
        }
        const context = getCurrentComponentContext();
        if (!context) {
          return originalAddEventListener.call(this, type, listener, options);
        }
        const closureId = trackClosure(listener, "eventListener", context);
        const wrappedListener = function(event) {
          checkStaleClosureOnExecution(closureId);
          return listener.call(this, event);
        };
        wrappedListener.__reactDebuggerOriginal = listener;
        wrappedListener.__reactDebuggerClosureId = closureId;
        return originalAddEventListener.call(this, type, wrappedListener, options);
      };
    }
    function getComponentName(fiber) {
      var _a, _b, _c, _d;
      if (!fiber) return "Unknown";
      const { type, tag } = fiber;
      if (tag === FIBER_TAGS.HostComponent) return typeof type === "string" ? type : "HostComponent";
      if (tag === FIBER_TAGS.HostText) return "#text";
      if (tag === FIBER_TAGS.HostRoot) return "Root";
      if (tag === FIBER_TAGS.Fragment) return "Fragment";
      if (typeof type === "function") {
        return type.displayName || type.name || "Anonymous";
      }
      if (typeof type === "object" && type !== null) {
        if (type.$$typeof === Symbol.for("react.forward_ref")) {
          return ((_a = type.render) == null ? void 0 : _a.displayName) || ((_b = type.render) == null ? void 0 : _b.name) || "ForwardRef";
        }
        if (type.$$typeof === Symbol.for("react.memo")) {
          return ((_c = type.type) == null ? void 0 : _c.displayName) || ((_d = type.type) == null ? void 0 : _d.name) || "Memo";
        }
      }
      return "Unknown";
    }
    function isUserComponent(fiber) {
      const { tag } = fiber;
      return tag === FIBER_TAGS.FunctionComponent || tag === FIBER_TAGS.ClassComponent || tag === FIBER_TAGS.ForwardRef || tag === FIBER_TAGS.MemoComponent || tag === FIBER_TAGS.SimpleMemoComponent;
    }
    const pathCache = /* @__PURE__ */ new Map();
    const PATH_CACHE_LIMIT = 500;
    function clearPathCache() {
      pathCache.clear();
    }
    function getComponentPath(fiber) {
      if (!fiber) return [];
      if (pathCache.has(fiber)) {
        return pathCache.get(fiber);
      }
      const path = [];
      let current = fiber;
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
    function getElementType(fiber) {
      if (fiber.tag === FIBER_TAGS.HostComponent) {
        return typeof fiber.type === "string" ? `<${fiber.type}>` : "<element>";
      }
      if (fiber.tag === FIBER_TAGS.Fragment) {
        return "<Fragment>";
      }
      return getComponentName(fiber);
    }
    const EFFECT_HAS_EFFECT = 1;
    const EFFECT_PASSIVE = 4;
    function getEffectsFromFiber(fiber) {
      const effects = [];
      if (!fiber.memoizedState) return effects;
      let hook = fiber.memoizedState;
      let hookIndex = 0;
      const maxHooks = 50;
      while (hook && hookIndex < maxHooks) {
        const memoizedState = hook.memoizedState;
        if (memoizedState && typeof memoizedState === "object") {
          if ("create" in memoizedState || "destroy" in memoizedState || "tag" in memoizedState) {
            effects.push({
              tag: memoizedState.tag || 0,
              create: memoizedState.create || null,
              destroy: memoizedState.destroy,
              deps: memoizedState.deps || null,
              next: memoizedState.next || null
            });
          }
        }
        hook = hook.next;
        hookIndex++;
      }
      return effects;
    }
    function analyzeEffectForIssues(effect, componentName, componentPath, effectIndex, issues) {
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
        const needsCleanup = hasTimerPattern || hasEventListenerPattern || hasSubscriptionPattern || hasWebSocketPattern;
        if (needsCleanup && destroyFn === void 0) {
          const issueKey = `${componentName}_MISSING_CLEANUP_${effectIndex}`;
          if (!reportedEffectIssues.has(issueKey)) {
            reportedEffectIssues.add(issueKey);
            let resourceType = "resource";
            if (hasTimerPattern) resourceType = "timer (setInterval/setTimeout)";
            else if (hasEventListenerPattern) resourceType = "event listener";
            else if (hasSubscriptionPattern) resourceType = "subscription";
            else if (hasWebSocketPattern) resourceType = "WebSocket/EventSource";
            issues.push({
              id: generateId(),
              type: "MISSING_CLEANUP",
              severity: "warning",
              component: componentName,
              message: `useEffect with ${resourceType} has no cleanup function`,
              suggestion: `Return a cleanup function to remove the ${resourceType} when component unmounts`,
              timestamp: Date.now(),
              location: {
                componentName,
                componentPath,
                effectIndex
              }
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
                type: "INFINITE_LOOP_RISK",
                severity: "error",
                component: componentName,
                message: `useEffect updates state but has empty dependency array`,
                suggestion: "Add conditions to prevent updates on every render, or include proper dependencies",
                timestamp: Date.now(),
                location: {
                  componentName,
                  componentPath,
                  effectIndex
                }
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
                type: "MISSING_DEP",
                severity: "info",
                component: componentName,
                message: `useEffect without dependency array runs on every render`,
                suggestion: "Consider adding a dependency array to control when the effect runs",
                timestamp: Date.now(),
                location: {
                  componentName,
                  componentPath,
                  effectIndex
                }
              });
            }
          }
        }
      }
    }
    function checkEffectHooks(fiber, issues) {
      if (!isUserComponent(fiber)) return;
      const componentName = getComponentName(fiber);
      const componentPath = getComponentPath(fiber);
      const effects = getEffectsFromFiber(fiber);
      effects.forEach((effect, index) => {
        analyzeEffectForIssues(effect, componentName, componentPath, index, issues);
      });
    }
    function getEffectTagName(tag) {
      const tags = [];
      if (tag & EFFECT_HAS_EFFECT) tags.push("HasEffect");
      if (tag & EFFECT_PASSIVE) tags.push("Passive");
      if (tags.length === 0) return "None";
      return tags.join("+");
    }
    function extractEffectPreview(effect) {
      const result = {};
      if (effect.deps) {
        const depNames = effect.deps.map((dep, i) => {
          if (dep === null) return "null";
          if (dep === void 0) return "undefined";
          if (typeof dep === "function") return `fn${i}`;
          if (typeof dep === "object") return `obj${i}`;
          if (typeof dep === "string") return `"${dep.slice(0, 10)}${dep.length > 10 ? "..." : ""}"`;
          return String(dep);
        });
        result.depsPreview = `[${depNames.join(", ")}]`;
      } else if (effect.deps === null) {
        result.depsPreview = "[]";
      }
      if (effect.create) {
        const fnStr = effect.create.toString();
        const hints = [];
        if (/fetch\s*\(/i.test(fnStr)) hints.push("fetch");
        if (/setInterval\s*\(/i.test(fnStr)) hints.push("setInterval");
        if (/setTimeout\s*\(/i.test(fnStr)) hints.push("setTimeout");
        if (/addEventListener\s*\(/i.test(fnStr)) hints.push("addEventListener");
        if (/subscribe\s*\(/i.test(fnStr)) hints.push("subscribe");
        if (/\.on\s*\(/i.test(fnStr)) hints.push("event listener");
        if (hints.length > 0) {
          result.createFnPreview = hints.join(", ");
        } else {
          const firstLine = fnStr.split("\n")[0].slice(0, 50);
          result.createFnPreview = firstLine.length < fnStr.length ? firstLine + "..." : firstLine;
        }
      }
      return result;
    }
    function detectEffectChanges(fiber) {
      if (!isUserComponent(fiber)) return [];
      const componentName = getComponentName(fiber);
      const fiberId = `${componentName}_${getComponentPath(fiber).join("/")}`;
      const effects = getEffectsFromFiber(fiber);
      const changes = [];
      if (!lastEffectStates.has(fiberId)) {
        lastEffectStates.set(fiberId, /* @__PURE__ */ new Map());
      }
      const prevStates = lastEffectStates.get(fiberId);
      effects.forEach((effect, index) => {
        var _a;
        const hasEffect = (effect.tag & EFFECT_HAS_EFFECT) !== 0;
        const hasDestroy = effect.destroy !== void 0 && effect.destroy !== null;
        const depCount = (_a = effect.deps) == null ? void 0 : _a.length;
        const effectTag = getEffectTagName(effect.tag);
        const prevState = prevStates.get(index);
        const { depsPreview, createFnPreview } = extractEffectPreview(effect);
        if (!prevState) {
          if (hasEffect) {
            changes.push({
              type: "run",
              effectIndex: index,
              depCount,
              hasCleanup: hasDestroy,
              effectTag,
              depsPreview,
              createFnPreview
            });
          }
        } else {
          if (hasEffect && !prevState.hasEffect) {
            changes.push({
              type: "run",
              effectIndex: index,
              depCount,
              hasCleanup: hasDestroy,
              effectTag,
              depsPreview,
              createFnPreview
            });
          }
          if (hasDestroy && !prevState.hasDestroy && prevState.hasEffect) {
            changes.push({
              type: "cleanup",
              effectIndex: index,
              depCount,
              hasCleanup: true,
              effectTag,
              depsPreview,
              createFnPreview
            });
          }
        }
        prevStates.set(index, { hasEffect, hasDestroy });
      });
      return changes;
    }
    function tryInferStateName(fiber, hookIndex) {
      try {
        const componentType = fiber.type;
        if (!componentType) return void 0;
        let sourceCode;
        if (typeof componentType === "function") {
          sourceCode = componentType.toString();
        }
        if (!sourceCode) return void 0;
        const useStatePattern = /(?:const|let|var)\s*\[\s*(\w+)\s*,\s*set\w*\s*\]\s*=\s*(?:React\.)?useState/g;
        const matches = [];
        let match;
        while ((match = useStatePattern.exec(sourceCode)) !== null) {
          matches.push(match[1]);
        }
        if (matches[hookIndex]) {
          return matches[hookIndex];
        }
        return void 0;
      } catch {
        return void 0;
      }
    }
    function serializeValueForDisplay(value, maxLength = 200) {
      if (value === null) return "null";
      if (value === void 0) return "undefined";
      const type = typeof value;
      if (type === "string") {
        const str = value;
        if (str.length > maxLength) return `"${str.slice(0, maxLength)}..."`;
        return `"${str}"`;
      }
      if (type === "number" || type === "boolean") {
        return String(value);
      }
      if (type === "function") {
        return `[Function: ${value.name || "anonymous"}]`;
      }
      if (Array.isArray(value)) {
        if (value.length === 0) return "[]";
        try {
          const preview = JSON.stringify(value);
          if (preview.length <= maxLength) return preview;
          const items = value.slice(0, 5).map((item) => serializeValueForDisplay(item, 30));
          const suffix = value.length > 5 ? `, ... (${value.length} items)` : "";
          return `[${items.join(", ")}${suffix}]`;
        } catch {
          return `Array(${value.length})`;
        }
      }
      if (type === "object") {
        const obj = value;
        if (obj.$$typeof) return "[React Element]";
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
          const items = keys.map((k) => {
            const v = serializeValueForDisplay(obj[k], 30);
            return `${k}: ${v}`;
          });
          const suffix = Object.keys(obj).length > 5 ? ", ..." : "";
          return `{${items.join(", ")}${suffix}}`;
        } catch {
          return "[Object]";
        }
      }
      return String(value);
    }
    function extractScalarValue(value) {
      if (value === null) return { str: "null", isExtractable: true };
      if (value === void 0) return { str: "undefined", isExtractable: true };
      const type = typeof value;
      if (type === "string" || type === "number" || type === "boolean") {
        return { str: serializeValueForDisplay(value), isExtractable: true };
      }
      if (type === "function") {
        return { str: serializeValueForDisplay(value), isExtractable: false };
      }
      return { str: serializeValueForDisplay(value), isExtractable: true };
    }
    function detectLocalStateChanges(fiber) {
      if (!isUserComponent(fiber)) return [];
      const alternate = fiber.alternate;
      if (!alternate) return [];
      const componentName = getComponentName(fiber);
      const changes = [];
      let currentHook = fiber.memoizedState;
      let alternateHook = alternate.memoizedState;
      let hookIndex = 0;
      let useStateIndex = 0;
      const maxHooks = 50;
      while (currentHook && alternateHook && hookIndex < maxHooks) {
        const isEffectHook = currentHook.memoizedState && typeof currentHook.memoizedState === "object" && ("create" in currentHook.memoizedState || "destroy" in currentHook.memoizedState);
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
              stateName: inferredName
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
    const previousContextValues = /* @__PURE__ */ new WeakMap();
    function getContextDisplayName(context) {
      var _a, _b;
      if (!context) return void 0;
      if (context.displayName) return context.displayName;
      if ((_b = (_a = context.Provider) == null ? void 0 : _a._context) == null ? void 0 : _b.displayName) return context.Provider._context.displayName;
      if (context._currentValue !== void 0 && typeof context._currentValue === "object" && context._currentValue !== null) {
        const keys = Object.keys(context._currentValue);
        if (keys.length > 0 && keys.length <= 3) {
          return `Context(${keys.join(", ")})`;
        }
      }
      return "Context";
    }
    function detectContextChanges(fiber) {
      if (!isUserComponent(fiber)) return [];
      const alternate = fiber.alternate;
      if (!alternate) return [];
      const componentName = getComponentName(fiber);
      const changes = [];
      const deps = fiber.dependencies;
      const altDeps = alternate.dependencies;
      if (!(deps == null ? void 0 : deps.firstContext) && !(altDeps == null ? void 0 : altDeps.firstContext)) return [];
      let contextDep = deps == null ? void 0 : deps.firstContext;
      let altContextDep = altDeps == null ? void 0 : altDeps.firstContext;
      while (contextDep || altContextDep) {
        const context = (contextDep == null ? void 0 : contextDep.context) || (altContextDep == null ? void 0 : altContextDep.context);
        if (context) {
          const currentValue = context._currentValue ?? context._currentValue2;
          const prevValue = previousContextValues.get(context);
          if (prevValue !== void 0 && currentValue !== prevValue) {
            const contextType = getContextDisplayName(context);
            const changedKeys = [];
            if (typeof prevValue === "object" && prevValue !== null && typeof currentValue === "object" && currentValue !== null) {
              const allKeys = /* @__PURE__ */ new Set([...Object.keys(prevValue), ...Object.keys(currentValue)]);
              for (const key of allKeys) {
                if (prevValue[key] !== currentValue[key]) {
                  changedKeys.push(key);
                }
              }
            }
            changes.push({
              componentName,
              contextType,
              changedKeys: changedKeys.length > 0 ? changedKeys : void 0
            });
          }
          previousContextValues.set(context, currentValue);
        }
        contextDep = (contextDep == null ? void 0 : contextDep.next) || null;
        altContextDep = (altContextDep == null ? void 0 : altContextDep.next) || null;
      }
      return changes;
    }
    function checkListKeys(fiber, issues) {
      if (fiber.tag !== FIBER_TAGS.Fragment && fiber.tag !== FIBER_TAGS.HostComponent) return;
      const children = [];
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
        index
      }));
      const keys = children.map((c) => c.key);
      const hasNullKeys = keys.some((k) => k === null);
      const nullKeyCount = keys.filter((k) => k === null).length;
      const allIndexKeys = keys.every((k, i) => k === String(i));
      const location = {
        componentName: parentName,
        componentPath,
        elementType: containerType,
        listLength: children.length,
        childElements
      };
      if (hasNullKeys) {
        const childTypes = [...new Set(childElements.map((c) => c.type))];
        const childTypesStr = childTypes.slice(0, 3).join(", ") + (childTypes.length > 3 ? "..." : "");
        issues.push({
          id: generateId(),
          type: "MISSING_KEY",
          severity: "error",
          component: parentName,
          message: `${nullKeyCount} of ${children.length} items missing keys in ${containerType} containing [${childTypesStr}]`,
          suggestion: 'Add unique "key" prop to each child element',
          timestamp: Date.now(),
          location
        });
      } else if (allIndexKeys) {
        issues.push({
          id: generateId(),
          type: "INDEX_AS_KEY",
          severity: "warning",
          component: parentName,
          message: `List of ${children.length} items uses array index as key in ${containerType}`,
          suggestion: "Use stable unique identifier instead of array index as key",
          timestamp: Date.now(),
          location
        });
      }
    }
    function traverseFiber(fiber, callback, path = "", maxNodes = 500) {
      if (!fiber) return;
      const stack = [{ fiber, path }];
      let nodeCount = 0;
      while (stack.length > 0 && nodeCount < maxNodes) {
        const item = stack.pop();
        nodeCount++;
        callback(item.fiber, item.path);
        if (item.fiber.sibling) {
          const parts = item.path.split("/");
          const index = parseInt(parts.pop() || "0", 10) + 1;
          stack.push({ fiber: item.fiber.sibling, path: `${parts.join("/")}/${index}` });
        }
        if (item.fiber.child) {
          stack.push({ fiber: item.fiber.child, path: `${item.path}/0` });
        }
      }
    }
    function detectRenderChanges(node) {
      const alternate = node.alternate;
      if (!alternate) {
        return { type: "mount", renderReasonSummary: "Initial mount" };
      }
      const prevProps = alternate.memoizedProps;
      const nextProps = node.memoizedProps;
      const prevState = alternate.memoizedState;
      const nextState = node.memoizedState;
      const changedProps = [];
      const propsChanges = [];
      const changedState = [];
      const stateChanges = [];
      if (prevProps && nextProps) {
        const allKeys = /* @__PURE__ */ new Set([...Object.keys(prevProps || {}), ...Object.keys(nextProps || {})]);
        for (const key of allKeys) {
          if (key === "children") continue;
          if (prevProps[key] !== nextProps[key]) {
            changedProps.push(key);
            if (propsChanges.length < 5) {
              const oldExtracted = extractScalarValue(prevProps[key]);
              const newExtracted = extractScalarValue(nextProps[key]);
              propsChanges.push({
                key,
                oldValue: oldExtracted.str,
                newValue: newExtracted.str
              });
            }
          }
        }
      }
      if (prevState !== nextState) {
        if (typeof prevState === "object" && typeof nextState === "object" && prevState !== null && nextState !== null) {
          const allStateKeys = /* @__PURE__ */ new Set([...Object.keys(prevState || {}), ...Object.keys(nextState || {})]);
          for (const key of allStateKeys) {
            if ((prevState == null ? void 0 : prevState[key]) !== (nextState == null ? void 0 : nextState[key])) {
              changedState.push(key);
              if (stateChanges.length < 5) {
                const oldExtracted = extractScalarValue(prevState == null ? void 0 : prevState[key]);
                const newExtracted = extractScalarValue(nextState == null ? void 0 : nextState[key]);
                stateChanges.push({
                  key,
                  oldValue: oldExtracted.str,
                  newValue: newExtracted.str
                });
              }
            }
          }
        } else {
          changedState.push("state");
          if (stateChanges.length < 5) {
            const oldExtracted = extractScalarValue(prevState);
            const newExtracted = extractScalarValue(nextState);
            stateChanges.push({
              key: "state",
              oldValue: oldExtracted.str,
              newValue: newExtracted.str
            });
          }
        }
      }
      const buildSummary = () => {
        const parts = [];
        if (changedProps.length > 0) {
          const propsList = changedProps.slice(0, 3).join(", ");
          const suffix = changedProps.length > 3 ? ` (+${changedProps.length - 3} more)` : "";
          parts.push(`Props: ${propsList}${suffix}`);
        }
        if (changedState.length > 0) {
          const stateList = changedState.slice(0, 3).join(", ");
          const suffix = changedState.length > 3 ? ` (+${changedState.length - 3} more)` : "";
          parts.push(`State: ${stateList}${suffix}`);
        }
        if (parts.length === 0) {
          return "Parent re-rendered";
        }
        return parts.join(" | ");
      };
      if (changedProps.length > 0 && changedState.length > 0) {
        return {
          type: "props+state",
          changedKeys: [...changedProps, ...changedState],
          propsChanges,
          stateChanges,
          renderReasonSummary: buildSummary()
        };
      }
      if (changedProps.length > 0) {
        return {
          type: "props",
          changedKeys: changedProps,
          propsChanges,
          renderReasonSummary: buildSummary()
        };
      }
      if (changedState.length > 0) {
        return {
          type: "state",
          changedKeys: changedState,
          stateChanges,
          renderReasonSummary: buildSummary()
        };
      }
      return { type: "parent", renderReasonSummary: "Parent re-rendered" };
    }
    function getFiberDepth(fiber) {
      let depth = 0;
      let current = fiber == null ? void 0 : fiber.return;
      while (current) {
        if (isUserComponent(current)) {
          depth++;
        }
        current = current.return;
      }
      return depth;
    }
    let batchCounter = 0;
    function getParentComponentName(fiber) {
      let parent = fiber == null ? void 0 : fiber.return;
      while (parent) {
        if (isUserComponent(parent)) {
          return getComponentName(parent);
        }
        parent = parent.return;
      }
      return void 0;
    }
    function analyzeFiberTree(root) {
      const fiber = root.current;
      const components = [];
      const renders = [];
      const effectEvents = [];
      const localStateChanges = [];
      const contextChanges = [];
      const renderData = [];
      const batchId = `batch_${++batchCounter}_${Date.now()}`;
      let renderOrder = 0;
      traverseFiber(fiber, (node, path) => {
        const componentName = getComponentName(node);
        const fiberId = `${componentName}_${path}`;
        if (isUserComponent(node)) {
          const componentPath = getComponentPath(node);
          const componentPathKey = `${componentName}_${componentPath.join("/")}`;
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
            timestamps = timestamps.filter((t) => now - t < EXCESSIVE_RENDER_WINDOW_MS);
            recentRenderTimestamps.set(fiberId, timestamps);
            const renderChange = detectRenderChanges(node);
            const actualDuration = node.actualDuration ?? 0;
            const selfBaseDuration = node.selfBaseDuration ?? 0;
            const parentComponent = getParentComponentName(node);
            components.push({
              id: fiberId,
              name: componentName,
              path,
              props: sanitizeValue(node.memoizedProps),
              state: sanitizeValue(node.memoizedState),
              renderCount: count,
              lastRenderTime: now,
              children: []
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
              fiberDepth: getFiberDepth(node)
            });
            renderData.push({
              fiberId,
              componentName,
              node,
              rendersInLastSecond: timestamps.length,
              actualDuration
            });
          }
        }
      });
      const renderTimelineEvents = renders.map((r) => ({
        id: generateId(),
        timestamp: getUniqueTimestamp(),
        type: "render",
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
          renderReasonSummary: r.reason.renderReasonSummary
        }
      }));
      const effectTimelineEvents = effectEvents.map((e) => ({
        id: generateId(),
        timestamp: getUniqueTimestamp(),
        type: "effect",
        payload: {
          componentName: e.componentName,
          effectType: e.type,
          effectIndex: e.effectIndex,
          depCount: e.depCount,
          hasCleanup: e.hasCleanup,
          effectTag: e.effectTag,
          depsPreview: e.depsPreview,
          createFnPreview: e.createFnPreview
        }
      }));
      const localStateTimelineEvents = localStateChanges.map((s) => ({
        id: generateId(),
        timestamp: getUniqueTimestamp(),
        type: "state-change",
        payload: {
          source: "local",
          componentName: s.componentName,
          hookIndex: s.hookIndex,
          oldValue: s.oldValue,
          newValue: s.newValue,
          valueType: s.valueType,
          isExtractable: s.isExtractable,
          stateName: s.stateName
        }
      }));
      const contextTimelineEvents = contextChanges.map((c) => ({
        id: generateId(),
        timestamp: getUniqueTimestamp(),
        type: "context-change",
        payload: {
          componentName: c.componentName,
          contextType: c.contextType,
          changedKeys: c.changedKeys
        }
      }));
      const timelineEvents = [...renderTimelineEvents, ...effectTimelineEvents, ...localStateTimelineEvents, ...contextTimelineEvents];
      if (timelineEvents.length > 0) {
        sendFromPage("TIMELINE_EVENTS", timelineEvents);
      }
      scheduleIdleWork(() => {
        if (!debuggerEnabled) return;
        analyzeIssuesDeferred(fiber, renderData, components, renders);
      }, 500);
    }
    function analyzeIssuesDeferred(fiber, renderData, components, renders) {
      const issues = [];
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
            type: "EXCESSIVE_RERENDERS",
            severity: "warning",
            component: componentName,
            message: `Rendered ${rendersInLastSecond} times in less than 1 second`,
            suggestion: "Consider using React.memo() to prevent unnecessary re-renders when props haven't changed",
            timestamp: now,
            renderCount: rendersInLastSecond
          });
        }
        if (actualDuration > 16) {
          if (!reportedSlowRenders.has(fiberId)) {
            reportedSlowRenders.add(fiberId);
            issues.push({
              id: generateId(),
              type: "SLOW_RENDER",
              severity: actualDuration > 50 ? "error" : "warning",
              component: componentName,
              message: `Render took ${actualDuration.toFixed(2)}ms (budget: 16ms for 60fps)`,
              suggestion: "Consider memoization, code splitting, or optimizing expensive computations",
              timestamp: now,
              location: {
                componentName,
                componentPath: getComponentPath(node)
              }
            });
          }
        }
      }
      traverseFiber(fiber, (node) => {
        checkListKeys(node, issues);
        checkEffectHooks(node, issues);
      });
      if (issues.length > 0 || components.length > 0) {
        sendFromPage("FIBER_COMMIT", { components, issues, renders, timestamp: getUniqueTimestamp() });
      }
    }
    function detectReactVersion() {
      var _a;
      return ((_a = window.React) == null ? void 0 : _a.version) || "unknown";
    }
    function detectReactMode() {
      var _a;
      const React = window.React;
      if ((_a = React == null ? void 0 : React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED) == null ? void 0 : _a.ReactDebugCurrentFrame) {
        return "development";
      }
      return "production";
    }
    function installReactHook() {
      let hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
      if (!hook) {
        const renderers = /* @__PURE__ */ new Map();
        let nextID = 1;
        hook = {
          renderers,
          supportsFiber: true,
          inject: (renderer) => {
            const id = nextID++;
            renderers.set(id, renderer);
            sendFromPage("REACT_DETECTED", {
              version: detectReactVersion(),
              mode: detectReactMode()
            });
            return id;
          },
          onCommitFiberRoot: () => {
          },
          onCommitFiberUnmount: () => {
          }
        };
        window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = hook;
      }
      const originalOnCommitFiberRoot = hook.onCommitFiberRoot;
      const originalInject = hook.inject;
      hook.inject = function(renderer) {
        const id = originalInject ? originalInject.call(this, renderer) : hook.renderers.size + 1;
        sendFromPage("REACT_DETECTED", {
          version: detectReactVersion(),
          mode: detectReactMode()
        });
        return id;
      };
      let lastAnalyzeTime = 0;
      let pendingRoot = null;
      let analyzeTimeout = null;
      const ANALYZE_THROTTLE_MS = 250;
      const scheduleAnalyze = (root) => {
        pendingRoot = root;
        const now = Date.now();
        if (now - lastAnalyzeTime >= ANALYZE_THROTTLE_MS) {
          lastAnalyzeTime = now;
          try {
            analyzeFiberTree(root);
          } catch (e) {
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
              }
              pendingRoot = null;
            }
          }, ANALYZE_THROTTLE_MS - (now - lastAnalyzeTime));
        }
      };
      hook.onCommitFiberRoot = function(rendererID, root, priorityLevel, didError) {
        if (typeof originalOnCommitFiberRoot === "function") {
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
            }, "", 200);
          } catch (e) {
          }
        }
      };
      if (hook.renderers && hook.renderers.size > 0) {
        sendFromPage("REACT_DETECTED", {
          version: detectReactVersion(),
          mode: detectReactMode()
        });
      }
    }
    function findReactRoots() {
      const roots = [];
      const extractRoot = (element) => {
        try {
          const keys = Object.keys(element);
          const fiberKey = keys.find(
            (key) => key.startsWith("__reactContainer$") || key.startsWith("__reactFiber$")
          );
          if (fiberKey) {
            let fiber = element[fiberKey];
            let maxDepth = 100;
            while (fiber && maxDepth > 0) {
              if (fiber.stateNode && fiber.stateNode.current) {
                return fiber.stateNode;
              }
              if (fiber.tag === FIBER_TAGS.HostRoot && fiber.stateNode) {
                return fiber.stateNode;
              }
              fiber = fiber.return;
              maxDepth--;
            }
          }
        } catch (e) {
        }
        return null;
      };
      const knownSelectors = "#root, #app, #__next, [data-reactroot], #___gatsby";
      const knownElements = document.querySelectorAll(knownSelectors);
      for (const element of knownElements) {
        const root = extractRoot(element);
        if (root && !roots.includes(root)) {
          roots.push(root);
        }
      }
      if (roots.length > 0) return roots;
      const allElements = document.querySelectorAll("*");
      const limit = Math.min(allElements.length, 200);
      for (let i = 0; i < limit; i++) {
        const root = extractRoot(allElements[i]);
        if (root && !roots.includes(root)) {
          roots.push(root);
          break;
        }
      }
      return roots;
    }
    function forceReanalyze() {
      if (!debuggerEnabled) return;
      const doAnalyze = () => {
        if (!debuggerEnabled) return;
        const roots = findReactRoots();
        let analyzed = false;
        if (roots.length > 0) {
          for (const root of roots) {
            try {
              if (root == null ? void 0 : root.current) {
                analyzeFiberTree(root);
                analyzed = true;
              }
            } catch (e) {
            }
          }
        }
        if (!analyzed) {
          const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
          if (hook == null ? void 0 : hook.renderers) {
            hook.renderers.forEach((renderer) => {
              try {
                if (renderer == null ? void 0 : renderer.getFiberRoots) {
                  const fiberRoots = renderer.getFiberRoots(renderer);
                  fiberRoots == null ? void 0 : fiberRoots.forEach((root) => {
                    if (root == null ? void 0 : root.current) {
                      analyzeFiberTree(root);
                      analyzed = true;
                    }
                  });
                }
              } catch (e) {
              }
            });
          }
        }
        if (reduxStore) {
          try {
            sendFromPage("REDUX_STATE_CHANGE", deepSanitizeState(reduxStore.getState()));
          } catch (e) {
          }
        }
      };
      scheduleIdleWork(doAnalyze, 100);
      setTimeout(doAnalyze, 200);
    }
    function isReduxStore(obj) {
      if (!obj) return false;
      const hasGetState = typeof obj.getState === "function";
      const hasDispatch = typeof obj.dispatch === "function";
      const hasSubscribe = typeof obj.subscribe === "function";
      if (hasGetState && hasDispatch && hasSubscribe) {
        try {
          const state = obj.getState();
          if (state !== void 0) {
            log("Found valid Redux store with state:", typeof state);
            return true;
          }
        } catch (e) {
        }
      }
      return false;
    }
    function extractStoreFromFiber(fiber) {
      var _a, _b, _c, _d, _e, _f;
      if (!fiber) return null;
      const memoizedState = fiber.memoizedState;
      if ((memoizedState == null ? void 0 : memoizedState.store) && isReduxStore(memoizedState.store)) {
        return memoizedState.store;
      }
      if (((_a = memoizedState == null ? void 0 : memoizedState.memoizedState) == null ? void 0 : _a.store) && isReduxStore(memoizedState.memoizedState.store)) {
        return memoizedState.memoizedState.store;
      }
      const memoizedProps = fiber.memoizedProps;
      if ((memoizedProps == null ? void 0 : memoizedProps.store) && isReduxStore(memoizedProps.store)) {
        return memoizedProps.store;
      }
      if (((_b = memoizedProps == null ? void 0 : memoizedProps.value) == null ? void 0 : _b.store) && isReduxStore(memoizedProps.value.store)) {
        return memoizedProps.value.store;
      }
      if ((memoizedProps == null ? void 0 : memoizedProps.value) && isReduxStore(memoizedProps.value)) {
        return memoizedProps.value;
      }
      if (((_c = fiber.type) == null ? void 0 : _c.displayName) === "Provider" || ((_d = fiber.type) == null ? void 0 : _d.name) === "Provider") {
        if ((memoizedProps == null ? void 0 : memoizedProps.store) && isReduxStore(memoizedProps.store)) {
          return memoizedProps.store;
        }
      }
      if (((_f = (_e = memoizedProps == null ? void 0 : memoizedProps.children) == null ? void 0 : _e.props) == null ? void 0 : _f.store) && isReduxStore(memoizedProps.children.props.store)) {
        return memoizedProps.children.props.store;
      }
      const pendingProps = fiber.pendingProps;
      if ((pendingProps == null ? void 0 : pendingProps.store) && isReduxStore(pendingProps.store)) {
        return pendingProps.store;
      }
      return null;
    }
    function traverseFiberForStore(fiber, visited, maxDepth) {
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
    function findStoreInReactFiber() {
      var _a;
      try {
        const rootSelectors = ["#root", "#app", "#__next", "[data-reactroot]", "#react-root", ".react-root", "#___gatsby", "main", "body"];
        let fiber = null;
        for (const selector of rootSelectors) {
          const el = document.querySelector(selector);
          if (!el) continue;
          const keys = Object.keys(el);
          const fiberKey = keys.find(
            (key) => key.startsWith("__reactContainer$") || key.startsWith("__reactFiber$") || key.startsWith("__reactInternalInstance$")
          );
          if (fiberKey) {
            fiber = el[fiberKey];
            if ((_a = fiber == null ? void 0 : fiber.stateNode) == null ? void 0 : _a.current) {
              fiber = fiber.stateNode.current;
            } else if (fiber == null ? void 0 : fiber.current) {
              fiber = fiber.current;
            }
            break;
          }
        }
        if (!fiber) {
          const allElements = document.querySelectorAll("*");
          for (const el of allElements) {
            const keys = Object.keys(el);
            const fiberKey = keys.find(
              (key) => key.startsWith("__reactContainer$") || key.startsWith("__reactFiber$")
            );
            if (fiberKey) {
              fiber = el[fiberKey];
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
        const visited = /* @__PURE__ */ new Set();
        const store = traverseFiberForStore(rootFiber, visited, 200);
        if (store) {
          log("Found Redux store in React Fiber tree");
          return store;
        }
        let currentFiber = fiber;
        let depth = 100;
        while (currentFiber && depth > 0) {
          if (visited.has(currentFiber)) break;
          const store2 = extractStoreFromFiber(currentFiber);
          if (store2) return store2;
          currentFiber = currentFiber.return;
          depth--;
        }
      } catch (e) {
        console.debug("[React Debugger] Error finding store in fiber:", e);
        return null;
      }
      return null;
    }
    function findStoreInWindowProperties(win) {
      const storePatterns = ["store", "redux", "state", "Store", "Redux"];
      for (const key of Object.keys(win)) {
        const lowerKey = key.toLowerCase();
        if (storePatterns.some((p) => lowerKey.includes(p.toLowerCase()))) {
          try {
            const candidate = win[key];
            if (isReduxStore(candidate)) {
              return candidate;
            }
            if (candidate && typeof candidate === "object") {
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
    let reduxDevToolsState = null;
    let reduxDevToolsMessageListenerInstalled = false;
    function setupReduxDevToolsMessageListener() {
      if (reduxDevToolsMessageListenerInstalled) return;
      reduxDevToolsMessageListenerInstalled = true;
      window.addEventListener("message", (event) => {
        if (!event.data || typeof event.data !== "object") return;
        const validSources = ["@devtools-page", "@devtools-extension", "@redux-devtools-extension"];
        if (!validSources.includes(event.data.source)) return;
        const { type, state, payload } = event.data;
        const stateUpdateTypes = ["STATE", "ACTION", "INIT_INSTANCE", "DISPATCH", "START", "INIT"];
        if (stateUpdateTypes.includes(type)) {
          const stateData = state || (payload == null ? void 0 : payload.state) || payload;
          if (stateData && !reduxStore) {
            try {
              const parsedState = typeof stateData === "string" ? JSON.parse(stateData) : stateData;
              if (parsedState && typeof parsedState === "object") {
                reduxDevToolsState = parsedState;
                log("Received Redux state from DevTools message:", type);
                const proxyStore = createReduxDevToolsProxyStore(parsedState);
                if (proxyStore) {
                  setupReduxStore(proxyStore);
                }
              }
            } catch (e) {
            }
          }
        }
      });
    }
    function createReduxDevToolsProxyStore(initialState) {
      var _a;
      const win = window;
      if (!((_a = win.__REDUX_DEVTOOLS_EXTENSION__) == null ? void 0 : _a.connect)) {
        return null;
      }
      try {
        const connection = win.__REDUX_DEVTOOLS_EXTENSION__.connect({
          name: "React Debugger Proxy",
          features: { jump: false, skip: false, dispatch: true }
        });
        let currentState = initialState;
        const subscribers = [];
        connection.subscribe((message) => {
          if (message.type === "DISPATCH" && message.state) {
            try {
              currentState = typeof message.state === "string" ? JSON.parse(message.state) : message.state;
              subscribers.forEach((fn) => fn());
            } catch (e) {
              log("Failed to update state from DevTools:", e);
            }
          }
        });
        connection.init(initialState);
        const proxyStore = {
          getState: () => currentState,
          dispatch: (action) => {
            if (connection.send) {
              connection.send(action, currentState);
            }
            return action;
          },
          subscribe: (listener) => {
            subscribers.push(listener);
            return () => {
              const index = subscribers.indexOf(listener);
              if (index > -1) subscribers.splice(index, 1);
            };
          },
          replaceReducer: () => {
          },
          ["@@observable"]: () => ({
            subscribe: (observer) => {
              const unsubscribe = proxyStore.subscribe(() => {
                if (observer.next) observer.next(currentState);
              });
              return { unsubscribe };
            }
          }),
          __isProxyStore: true,
          __devToolsConnection: connection
        };
        log("Created Redux DevTools proxy store");
        return proxyStore;
      } catch (e) {
        return null;
      }
    }
    function findStoreInReduxDevTools() {
      const win = window;
      if (win.__REDUX_DEVTOOLS_EXTENSION__) {
        const ext = win.__REDUX_DEVTOOLS_EXTENSION__;
        if (ext._stores && ext._stores.length > 0) {
          for (const store of ext._stores) {
            if (isReduxStore(store)) return store;
          }
        }
        if (ext._connections) {
          for (const conn of Object.values(ext._connections)) {
            if ((conn == null ? void 0 : conn.store) && isReduxStore(conn.store)) {
              return conn.store;
            }
            if ((conn == null ? void 0 : conn.init) && (conn == null ? void 0 : conn.subscribe)) {
              const connAny = conn;
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
            const inst = instance;
            if ((inst == null ? void 0 : inst.store) && isReduxStore(inst.store)) {
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
    function findReduxStore() {
      const win = window;
      const directCandidates = [
        { name: "store", value: win.store },
        { name: "__REDUX_STORE__", value: win.__REDUX_STORE__ },
        { name: "__store__", value: win.__store__ },
        { name: "reduxStore", value: win.reduxStore },
        { name: "__STORE__", value: win.__STORE__ },
        { name: "appStore", value: win.appStore },
        { name: "rootStore", value: win.rootStore },
        { name: "__store", value: win.__store },
        { name: "_store", value: win._store },
        { name: "Store", value: win.Store },
        { name: "myStore", value: win.myStore },
        { name: "globalStore", value: win.globalStore }
      ];
      for (const { name, value } of directCandidates) {
        if (value) {
          if (isReduxStore(value)) {
            return value;
          }
        }
      }
      const devToolsStore = findStoreInReduxDevTools();
      if (devToolsStore) {
        return devToolsStore;
      }
      const storeFromFiber = findStoreInReactFiber();
      if (storeFromFiber) {
        return storeFromFiber;
      }
      const storeFromWindow = findStoreInWindowProperties(win);
      if (storeFromWindow) {
        return storeFromWindow;
      }
      const altStore = findAlternativeStateManagers(win);
      if (altStore) {
        return altStore;
      }
      return null;
    }
    function findAlternativeStateManagers(win) {
      if (win.__ZUSTAND_DEVTOOLS_EXTENSION__) {
        const stores = Object.values(win.__ZUSTAND_DEVTOOLS_EXTENSION__);
        for (const store of stores) {
          if (isReduxStore(store)) return store;
        }
      }
      const reactContext = win.__REACT_CONTEXT_DEVTOOL_GLOBAL_HOOK__;
      if (reactContext == null ? void 0 : reactContext.stores) {
        for (const store of Object.values(reactContext.stores)) {
          if (isReduxStore(store)) return store;
        }
      }
      return null;
    }
    function deepSanitizeState(value, depth = 0, maxDepth = 5) {
      if (depth > maxDepth) return "[Object depth exceeded]";
      if (value === null) return null;
      if (value === void 0) return void 0;
      const type = typeof value;
      if (type === "string") return value;
      if (type === "number" || type === "boolean") return value;
      if (type === "function") return `[Function: ${value.name || "anonymous"}]`;
      if (type === "symbol") return `[Symbol: ${value.toString()}]`;
      if (Array.isArray(value)) {
        return value.map((v) => deepSanitizeState(v, depth + 1, maxDepth));
      }
      if (type === "object") {
        const obj = value;
        if (obj.$$typeof) return "[React Element]";
        if (obj instanceof HTMLElement) return `[HTMLElement: ${obj.tagName}]`;
        if (obj instanceof Event) return "[Event]";
        if (obj instanceof Error) return { __type: "Error", message: obj.message, stack: obj.stack };
        if (obj instanceof Date) return { __type: "Date", value: obj.toISOString() };
        if (obj instanceof RegExp) return { __type: "RegExp", value: obj.toString() };
        if (obj instanceof Map) {
          const mapObj = { __type: "Map", size: obj.size, entries: {} };
          obj.forEach((v, k) => {
            mapObj.entries[String(k)] = deepSanitizeState(v, depth + 1, maxDepth);
          });
          return mapObj;
        }
        if (obj instanceof Set) {
          return { __type: "Set", size: obj.size, values: Array.from(obj).map((v) => deepSanitizeState(v, depth + 1, maxDepth)) };
        }
        if (obj instanceof Promise) return "[Promise]";
        const result = {};
        for (const key of Object.keys(obj)) {
          try {
            result[key] = deepSanitizeState(obj[key], depth + 1, maxDepth);
          } catch {
            result[key] = "[Error reading property]";
          }
        }
        return result;
      }
      return String(value);
    }
    function setNestedValue(obj, path, value) {
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
    let reduxStore = null;
    let originalDispatch = null;
    let stateOverrides = /* @__PURE__ */ new Map();
    let reduxSearchStopped = false;
    let stateChangeTimeout = null;
    const STATE_CHANGE_DEBOUNCE = 100;
    let reduxHookInstalled = false;
    function restartReduxSearch() {
      reduxSearchStopped = false;
      if (reduxStore) return;
      const store = findReduxStore();
      if (store) {
        setupReduxStore(store);
        return;
      }
      startReduxPolling();
    }
    function setupReduxStore(store) {
      if (!store || reduxStore === store) return;
      reduxStore = store;
      reduxSearchStopped = true;
      try {
        const initialState = deepSanitizeState(store.getState());
        console.log("[React Debugger] Redux store connected");
        sendFromPage("REDUX_DETECTED", initialState);
        originalDispatch = store.dispatch;
        store.dispatch = function(action) {
          var _a;
          if ((_a = action.type) == null ? void 0 : _a.startsWith("@@REACT_DEBUGGER/")) {
            return originalDispatch.call(store, action);
          }
          const result = originalDispatch.call(store, action);
          if (debuggerEnabled) {
            sendFromPage("REDUX_ACTION", {
              id: generateId(),
              type: action.type || "UNKNOWN",
              payload: sanitizeValue(action, 0),
              timestamp: getUniqueTimestamp()
            });
            sendFromPage("TIMELINE_EVENTS", [{
              id: generateId(),
              timestamp: getUniqueTimestamp(),
              type: "state-change",
              payload: {
                source: "redux",
                actionType: action.type || "UNKNOWN"
              }
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
              sendFromPage("REDUX_STATE_CHANGE", deepSanitizeState(store.getState()));
            } catch (e) {
              console.debug("[React Debugger] Error sending state change:", e);
            }
            stateChangeTimeout = null;
          }, STATE_CHANGE_DEBOUNCE);
        });
        window.__REACT_DEBUGGER_DISPATCH__ = (action) => {
          return originalDispatch.call(store, action);
        };
        window.__REACT_DEBUGGER_STORE__ = store;
        window.__REACT_DEBUGGER_GET_STATE__ = () => store.getState();
        let injectedState = null;
        if (typeof store.replaceReducer === "function") {
          try {
            const createInjectorReducer = (baseReducer) => {
              return (state, action) => {
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
            store.replaceReducer = (nextReducer) => {
              return originalReplaceReducer(createInjectorReducer(nextReducer));
            };
            originalReplaceReducer(createInjectorReducer(null));
            log("Redux state injection ready");
          } catch (e) {
            log("replaceReducer setup failed:", e);
          }
        }
        window.__REACT_DEBUGGER_SET_STATE__ = (path, value) => {
          try {
            const currentState = store.getState();
            const newState = setNestedValue(currentState, path, value);
            stateOverrides.set(path.join("."), { path, value });
            injectedState = newState;
            originalDispatch.call(store, { type: "@@REACT_DEBUGGER/SET_STATE" });
            sendFromPage("REDUX_STATE_CHANGE", deepSanitizeState(store.getState()));
          } catch (e) {
            console.error("[React Debugger] Set state error:", e);
          }
        };
        window.__REACT_DEBUGGER_CLEAR_OVERRIDES__ = () => {
          try {
            if (stateOverrides.size === 0) return;
            stateOverrides.clear();
            sendFromPage("REDUX_STATE_CHANGE", deepSanitizeState(store.getState()));
            sendFromPage("REDUX_OVERRIDES_CLEARED", null);
          } catch (e) {
            console.error("[React Debugger] Clear overrides error:", e);
          }
        };
        window.__REACT_DEBUGGER_RESET_STATE__ = () => {
          try {
            stateOverrides.clear();
            sendFromPage("REDUX_STATE_CHANGE", deepSanitizeState(store.getState()));
            sendFromPage("REDUX_OVERRIDES_CLEARED", null);
          } catch (e) {
            console.error("[React Debugger] Reset state error:", e);
          }
        };
      } catch (e) {
        console.error("[React Debugger] Error setting up Redux hook:", e);
        reduxStore = null;
      }
    }
    function startReduxPolling() {
      if (reduxStore || reduxSearchStopped) return;
      const store = findReduxStore();
      if (store) {
        setupReduxStore(store);
        return;
      }
      setTimeout(() => {
        if (reduxStore || reduxSearchStopped) return;
        const store2 = findReduxStore();
        if (store2) {
          setupReduxStore(store2);
        }
      }, 2e3);
    }
    function installReduxHook() {
      if (reduxHookInstalled) return;
      reduxHookInstalled = true;
      setupReduxDevToolsMessageListener();
      const win = window;
      if (typeof win.__REDUX_DEVTOOLS_EXTENSION__ !== "undefined") {
        const originalConnect = win.__REDUX_DEVTOOLS_EXTENSION__.connect;
        if (originalConnect) {
          win.__REDUX_DEVTOOLS_EXTENSION__.connect = function(...args) {
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
      if (typeof win.Redux !== "undefined" && win.Redux.createStore) {
        const originalCreateStore = win.Redux.createStore;
        win.Redux.createStore = function(...args) {
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
        }, 1e3);
      };
      if (document.readyState === "complete") {
        onReady();
      } else {
        window.addEventListener("load", onReady, { once: true });
      }
    }
    let scanEnabled = false;
    const overlayElements = /* @__PURE__ */ new Map();
    const renderFlashTimers = /* @__PURE__ */ new Map();
    function createOverlayContainer() {
      let container = document.getElementById("react-debugger-overlay-container");
      if (!container) {
        container = document.createElement("div");
        container.id = "react-debugger-overlay-container";
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
    function getBorderColorForRenderCount(count) {
      if (count <= 1) return "#40c463";
      if (count <= 3) return "#ffc107";
      if (count <= 5) return "#ff9800";
      if (count <= 10) return "#ff5722";
      return "#f44336";
    }
    function flashRenderOverlay(fiber, componentName, renderCount) {
      if (!scanEnabled) return;
      const stateNode = fiber.stateNode;
      let domNode = null;
      if (stateNode instanceof HTMLElement) {
        domNode = stateNode;
      } else if (fiber.child) {
        let childFiber = fiber.child;
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
      const fiberId = `${componentName}_${fiber.key || "nokey"}_${Math.round(rect.top)}_${Math.round(rect.left)}`;
      const renderChange = detectRenderChanges(fiber);
      let overlay = overlayElements.get(fiberId);
      if (!overlay) {
        overlay = document.createElement("div");
        overlay.className = "react-debugger-overlay";
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
        if (overlay) overlay.style.transform = "scale(1)";
      }, 50);
      const label = overlay.querySelector(".scan-label") || document.createElement("div");
      label.className = "scan-label";
      const reasonText = renderChange.changedKeys ? ` [${renderChange.type}: ${renderChange.changedKeys.slice(0, 3).join(", ")}${renderChange.changedKeys.length > 3 ? "..." : ""}]` : renderChange.type !== "parent" ? ` [${renderChange.type}]` : "";
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
      overlay.style.opacity = "1";
      const existingTimer = renderFlashTimers.get(fiberId);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }
      const timer = window.setTimeout(() => {
        if (overlay) {
          overlay.style.opacity = "0";
        }
        renderFlashTimers.delete(fiberId);
      }, 800);
      renderFlashTimers.set(fiberId, timer);
    }
    function clearAllOverlays() {
      overlayElements.forEach((overlay) => {
        overlay.remove();
      });
      overlayElements.clear();
      renderFlashTimers.forEach((timer) => clearTimeout(timer));
      renderFlashTimers.clear();
    }
    function toggleScan(enabled) {
      scanEnabled = enabled;
      if (!enabled) {
        clearAllOverlays();
      }
      sendFromPage("SCAN_STATUS", { enabled: scanEnabled });
    }
    window.__REACT_DEBUGGER_SCAN__ = {
      enable: () => toggleScan(true),
      disable: () => toggleScan(false),
      toggle: () => toggleScan(!scanEnabled),
      isEnabled: () => scanEnabled
    };
    let memoryMonitoringEnabled = false;
    let memoryMonitorInterval = null;
    const MEMORY_SAMPLE_INTERVAL = 2e3;
    function getMemorySnapshot() {
      const perf = performance;
      if (!perf.memory) return null;
      return {
        usedJSHeapSize: perf.memory.usedJSHeapSize,
        totalJSHeapSize: perf.memory.totalJSHeapSize,
        jsHeapSizeLimit: perf.memory.jsHeapSizeLimit
      };
    }
    let lastMemoryUsage = 0;
    const MEMORY_SPIKE_THRESHOLD = 0.15;
    function startMemoryMonitoring() {
      if (!debuggerEnabled || memoryMonitoringEnabled) return;
      const snapshot = getMemorySnapshot();
      if (!snapshot) {
        return;
      }
      memoryMonitoringEnabled = true;
      lastMemoryUsage = snapshot.usedJSHeapSize;
      sendFromPage("MEMORY_SNAPSHOT", {
        ...snapshot,
        timestamp: Date.now()
      });
      memoryMonitorInterval = window.setInterval(() => {
        const snap = getMemorySnapshot();
        if (snap) {
          const timestamp = getUniqueTimestamp();
          const growthRate = lastMemoryUsage > 0 ? (snap.usedJSHeapSize - lastMemoryUsage) / lastMemoryUsage : 0;
          const isSpike = growthRate > MEMORY_SPIKE_THRESHOLD;
          sendFromPage("MEMORY_SNAPSHOT", {
            ...snap,
            timestamp
          });
          if (isSpike || snap.usedJSHeapSize / snap.jsHeapSizeLimit > 0.8) {
            sendFromPage("TIMELINE_EVENTS", [{
              id: generateId(),
              timestamp,
              type: "memory",
              payload: {
                heapUsed: snap.usedJSHeapSize,
                heapTotal: snap.totalJSHeapSize,
                heapLimit: snap.jsHeapSizeLimit,
                isSpike,
                growthRate
              }
            }]);
          }
          lastMemoryUsage = snap.usedJSHeapSize;
        }
      }, MEMORY_SAMPLE_INTERVAL);
    }
    function stopMemoryMonitoring() {
      if (!memoryMonitoringEnabled) return;
      memoryMonitoringEnabled = false;
      if (memoryMonitorInterval) {
        clearInterval(memoryMonitorInterval);
        memoryMonitorInterval = null;
      }
    }
    function stopAllMonitoring() {
      stopMemoryMonitoring();
      toggleScan(false);
      reduxSearchStopped = true;
      messageQueue = [];
      if (flushTimeout) {
        clearTimeout(flushTimeout);
        flushTimeout = null;
      }
      clearPathCache();
      renderCounts.clear();
      lastRenderTimes.clear();
      recentRenderTimestamps.clear();
      reportedEffectIssues.clear();
      reportedExcessiveRerenders.clear();
      reportedSlowRenders.clear();
      componentRenderIds.clear();
      lastEffectStates.clear();
      trackedClosures.clear();
      staleClosureIssues.clear();
      stateOverrides.clear();
      overlayElements.clear();
      renderFlashTimers.forEach((timer) => clearTimeout(timer));
      renderFlashTimers.clear();
    }
    window.__REACT_DEBUGGER_MEMORY__ = {
      start: startMemoryMonitoring,
      stop: stopMemoryMonitoring,
      getSnapshot: getMemorySnapshot,
      isMonitoring: () => memoryMonitoringEnabled
    };
    function installErrorHandlers() {
      const originalOnError = window.onerror;
      window.onerror = function(message, source, lineno, colno, error) {
        var _a, _b;
        if ((source == null ? void 0 : source.includes("react-debugger")) || (source == null ? void 0 : source.includes("chrome-extension"))) {
          return originalOnError == null ? void 0 : originalOnError.apply(window, arguments);
        }
        const memorySnapshot = getMemorySnapshot();
        const analysisHints = [];
        if (memorySnapshot) {
          const usagePercent = memorySnapshot.usedJSHeapSize / memorySnapshot.jsHeapSizeLimit;
          if (usagePercent > 0.8) {
            analysisHints.push("High memory usage detected at crash time");
          }
        }
        const crashId = generateId();
        const crashTimestamp = getUniqueTimestamp();
        sendFromPage("CRASH_DETECTED", {
          id: crashId,
          timestamp: crashTimestamp,
          type: "js-error",
          message: String(message),
          stack: (_a = error == null ? void 0 : error.stack) == null ? void 0 : _a.slice(0, 5e3),
          source,
          lineno,
          colno,
          memorySnapshot: memorySnapshot ? {
            timestamp: crashTimestamp,
            usedJSHeapSize: memorySnapshot.usedJSHeapSize,
            totalJSHeapSize: memorySnapshot.totalJSHeapSize,
            jsHeapSizeLimit: memorySnapshot.jsHeapSizeLimit
          } : void 0,
          analysisHints
        });
        sendFromPage("TIMELINE_EVENTS", [{
          id: crashId,
          timestamp: crashTimestamp,
          type: "error",
          payload: {
            errorType: "js-error",
            message: String(message),
            stack: (_b = error == null ? void 0 : error.stack) == null ? void 0 : _b.slice(0, 2e3),
            source,
            lineno
          }
        }]);
        return originalOnError == null ? void 0 : originalOnError.apply(window, arguments);
      };
      window.addEventListener("unhandledrejection", (event) => {
        var _a, _b;
        const reason = event.reason;
        const memorySnapshot = getMemorySnapshot();
        const analysisHints = [];
        if (memorySnapshot) {
          const usagePercent = memorySnapshot.usedJSHeapSize / memorySnapshot.jsHeapSizeLimit;
          if (usagePercent > 0.8) {
            analysisHints.push("High memory usage detected at crash time");
          }
        }
        const rejectId = generateId();
        const rejectTimestamp = getUniqueTimestamp();
        sendFromPage("CRASH_DETECTED", {
          id: rejectId,
          timestamp: rejectTimestamp,
          type: "unhandled-rejection",
          message: (reason == null ? void 0 : reason.message) || String(reason),
          stack: (_a = reason == null ? void 0 : reason.stack) == null ? void 0 : _a.slice(0, 5e3),
          memorySnapshot: memorySnapshot ? {
            timestamp: rejectTimestamp,
            usedJSHeapSize: memorySnapshot.usedJSHeapSize,
            totalJSHeapSize: memorySnapshot.totalJSHeapSize,
            jsHeapSizeLimit: memorySnapshot.jsHeapSizeLimit
          } : void 0,
          analysisHints
        });
        sendFromPage("TIMELINE_EVENTS", [{
          id: rejectId,
          timestamp: rejectTimestamp,
          type: "error",
          payload: {
            errorType: "unhandled-rejection",
            message: (reason == null ? void 0 : reason.message) || String(reason),
            stack: (_b = reason == null ? void 0 : reason.stack) == null ? void 0 : _b.slice(0, 2e3)
          }
        }]);
      });
    }
    listenFromContent((message) => {
      if (message.type === "DISPATCH_REDUX_ACTION") {
        const dispatch = window.__REACT_DEBUGGER_DISPATCH__;
        if (dispatch && message.payload) {
          try {
            dispatch(message.payload);
          } catch (e) {
            console.error("[React Debugger] Dispatch error:", e);
          }
        }
      }
      if (message.type === "SET_REDUX_STATE") {
        const payload = message.payload;
        if (payload && reduxStore) {
          try {
            const setStateFn = window.__REACT_DEBUGGER_SET_STATE__;
            if (setStateFn) {
              setStateFn(payload.path, payload.value);
            }
          } catch (e) {
            console.error("[React Debugger] Set state error:", e);
          }
        }
      }
      if (message.type === "CLEAR_REDUX_OVERRIDES") {
        if (reduxStore && originalDispatch) {
          try {
            const clearFn = window.__REACT_DEBUGGER_CLEAR_OVERRIDES__;
            if (clearFn) clearFn();
          } catch (e) {
            console.error("[React Debugger] Clear overrides error:", e);
          }
        }
      }
      if (message.type === "DELETE_ARRAY_ITEM") {
        const payload = message.payload;
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
              const setStateFn = window.__REACT_DEBUGGER_SET_STATE__;
              if (setStateFn) {
                setStateFn(payload.path, newArray);
              }
            }
          } catch (e) {
            console.error("[React Debugger] Delete array item error:", e);
          }
        }
      }
      if (message.type === "MOVE_ARRAY_ITEM") {
        const payload = message.payload;
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
              const setStateFn = window.__REACT_DEBUGGER_SET_STATE__;
              if (setStateFn) {
                setStateFn(payload.path, newArray);
              }
            }
          } catch (e) {
            console.error("[React Debugger] Move array item error:", e);
          }
        }
      }
      if (message.type === "REFRESH_REDUX_STATE") {
        if (reduxStore) {
          try {
            sendFromPage("REDUX_STATE_CHANGE", deepSanitizeState(reduxStore.getState()));
          } catch (e) {
            console.error("[React Debugger] Refresh state error:", e);
          }
        }
      }
      if (message.type === "TOGGLE_SCAN") {
        const payload = message.payload;
        if (payload && typeof payload.enabled === "boolean") {
          toggleScan(payload.enabled);
        } else {
          toggleScan(!scanEnabled);
        }
      }
      if (message.type === "START_MEMORY_MONITORING") {
        startMemoryMonitoring();
      }
      if (message.type === "STOP_MEMORY_MONITORING") {
        stopMemoryMonitoring();
      }
      if (message.type === "ENABLE_DEBUGGER") {
        debuggerEnabled = true;
        installReduxHook();
        restartReduxSearch();
        forceReanalyze();
        sendFromPage("DEBUGGER_STATE_CHANGED", { enabled: true });
      }
      if (message.type === "DISABLE_DEBUGGER") {
        debuggerEnabled = false;
        stopAllMonitoring();
        sendFromPage("DEBUGGER_STATE_CHANGED", { enabled: false });
      }
      if (message.type === "GET_DEBUGGER_STATE") {
        sendFromPage("DEBUGGER_STATE_CHANGED", { enabled: debuggerEnabled });
      }
    });
    installReactHook();
    installReduxHook();
    installErrorHandlers();
    window.__REACT_DEBUGGER_ENABLE_CLOSURE_TRACKING__ = _installClosureTracking;
    setTimeout(() => {
      var _a;
      const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
      if (((_a = hook == null ? void 0 : hook.renderers) == null ? void 0 : _a.size) > 0) {
        sendFromPage("REACT_DETECTED", {
          version: detectReactVersion(),
          mode: detectReactMode()
        });
      }
    }, 500);
    console.log("[React Debugger] Inject script loaded");
  })();
})();
