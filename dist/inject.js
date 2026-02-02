(function() {
  "use strict";
  (function() {
    const PAGE_SOURCE = "REACT_DEBUGGER_PAGE";
    const CONTENT_SOURCE = "REACT_DEBUGGER_CONTENT";
    let extensionAlive = true;
    let messageQueue = [];
    let flushTimeout = null;
    const MESSAGE_THROTTLE_MS = 50;
    function log(...args) {
    }
    function flushMessages() {
      if (!extensionAlive || messageQueue.length === 0) {
        messageQueue = [];
        return;
      }
      const messages = messageQueue;
      messageQueue = [];
      flushTimeout = null;
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
      const criticalMessages = ["REACT_DETECTED", "REDUX_DETECTED", "REDUX_STATE_CHANGE"];
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
        flushTimeout = window.setTimeout(flushMessages, MESSAGE_THROTTLE_MS);
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
    function sanitizeValue(value, depth = 0) {
      if (depth > 5) return "[Max depth]";
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
    const renderCounts = /* @__PURE__ */ new Map();
    const lastRenderTimes = /* @__PURE__ */ new Map();
    const reportedEffectIssues = /* @__PURE__ */ new Set();
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
    function getComponentPath(fiber) {
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
    function traverseFiber(fiber, callback, path = "") {
      if (!fiber) return;
      callback(fiber, path);
      if (fiber.child) traverseFiber(fiber.child, callback, `${path}/0`);
      if (fiber.sibling) {
        const parts = path.split("/");
        const index = parseInt(parts.pop() || "0", 10) + 1;
        traverseFiber(fiber.sibling, callback, `${parts.join("/")}/${index}`);
      }
    }
    function detectRenderChanges(node) {
      const alternate = node.alternate;
      if (!alternate) return { type: "mount" };
      const prevProps = alternate.memoizedProps;
      const nextProps = node.memoizedProps;
      const prevState = alternate.memoizedState;
      const nextState = node.memoizedState;
      const changedProps = [];
      const changedState = [];
      if (prevProps && nextProps) {
        const allKeys = /* @__PURE__ */ new Set([...Object.keys(prevProps || {}), ...Object.keys(nextProps || {})]);
        for (const key of allKeys) {
          if (key === "children") continue;
          if (prevProps[key] !== nextProps[key]) {
            changedProps.push(key);
          }
        }
      }
      if (prevState !== nextState) {
        if (typeof prevState === "object" && typeof nextState === "object") {
          const allStateKeys = /* @__PURE__ */ new Set([...Object.keys(prevState || {}), ...Object.keys(nextState || {})]);
          for (const key of allStateKeys) {
            if ((prevState == null ? void 0 : prevState[key]) !== (nextState == null ? void 0 : nextState[key])) {
              changedState.push(key);
            }
          }
        } else {
          changedState.push("state");
        }
      }
      if (changedProps.length > 0 && changedState.length > 0) {
        return { type: "props+state", changedKeys: [...changedProps, ...changedState] };
      }
      if (changedProps.length > 0) {
        return { type: "props", changedKeys: changedProps };
      }
      if (changedState.length > 0) {
        return { type: "state", changedKeys: changedState };
      }
      return { type: "parent" };
    }
    function analyzeFiberTree(root) {
      const fiber = root.current;
      const issues = [];
      const components = [];
      const renders = [];
      traverseFiber(fiber, (node, path) => {
        const componentName = getComponentName(node);
        const fiberId = `${componentName}_${path}`;
        if (isUserComponent(node)) {
          const count = (renderCounts.get(fiberId) || 0) + 1;
          renderCounts.set(fiberId, count);
          lastRenderTimes.set(fiberId, Date.now());
          const componentPathKey = `${componentName}_${getComponentPath(node).join("/")}`;
          const currentRenderId = (componentRenderIds.get(componentPathKey) || 0) + 1;
          componentRenderIds.set(componentPathKey, currentRenderId);
          const renderChange = detectRenderChanges(node);
          components.push({
            id: fiberId,
            name: componentName,
            path,
            props: sanitizeValue(node.memoizedProps),
            state: sanitizeValue(node.memoizedState),
            renderCount: count,
            lastRenderTime: Date.now(),
            children: []
          });
          const actualDuration = node.actualDuration ?? 0;
          const selfBaseDuration = node.selfBaseDuration ?? 0;
          renders.push({
            componentId: fiberId,
            componentName,
            duration: actualDuration,
            selfDuration: selfBaseDuration,
            reason: renderChange
          });
          const now = Date.now();
          const lastTime = lastRenderTimes.get(fiberId) || 0;
          if (now - lastTime < 1e3 && count > 5) {
            const exists = issues.find((i) => i.type === "EXCESSIVE_RERENDERS" && i.component === componentName);
            if (!exists) {
              issues.push({
                id: generateId(),
                type: "EXCESSIVE_RERENDERS",
                severity: "warning",
                component: componentName,
                message: `Rendered ${count} times in less than 1 second`,
                suggestion: "Consider using React.memo()",
                timestamp: now
              });
            }
          }
          if (actualDuration > 16) {
            const exists = issues.find((i) => i.type === "SLOW_RENDER" && i.component === componentName);
            if (!exists) {
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
        checkListKeys(node, issues);
        checkEffectHooks(node, issues);
      });
      sendFromPage("FIBER_COMMIT", { components, issues, renders, timestamp: Date.now() });
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
      const ANALYZE_THROTTLE_MS = 100;
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
        scheduleAnalyze(root);
        if (scanEnabled) {
          try {
            traverseFiber(root.current, (node) => {
              if (isUserComponent(node)) {
                const componentName = getComponentName(node);
                const fiberId = `${componentName}_scan`;
                const count = renderCounts.get(fiberId) || 1;
                flashRenderOverlay(node, componentName, count);
              }
            });
          } catch (e) {
          }
        }
        if (typeof originalOnCommitFiberRoot === "function") {
          originalOnCommitFiberRoot.call(this, rendererID, root, priorityLevel, didError);
        }
      };
      if (hook.renderers && hook.renderers.size > 0) {
        sendFromPage("REACT_DETECTED", {
          version: detectReactVersion(),
          mode: detectReactMode()
        });
      }
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
    function findStoreInReactFiber() {
      var _a, _b, _c, _d;
      try {
        const rootSelectors = ["#root", "#app", "#__next", "[data-reactroot]", "#react-root", ".react-root"];
        let rootEl = null;
        for (const selector of rootSelectors) {
          rootEl = document.querySelector(selector);
          if (rootEl) break;
        }
        if (!rootEl) {
          const allElements = document.querySelectorAll("*");
          for (const el of allElements) {
            const keys = Object.keys(el);
            if (keys.some((k) => k.startsWith("__reactFiber$") || k.startsWith("__reactInternalInstance$"))) {
              rootEl = el;
              break;
            }
          }
        }
        if (!rootEl) return null;
        const fiberKey = Object.keys(rootEl).find(
          (key) => key.startsWith("__reactFiber$") || key.startsWith("__reactInternalInstance$")
        );
        if (!fiberKey) return null;
        let fiber = rootEl[fiberKey];
        let maxDepth = 100;
        const visited = /* @__PURE__ */ new Set();
        while (fiber && maxDepth > 0) {
          if (visited.has(fiber)) break;
          visited.add(fiber);
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
          if (((_d = (_c = memoizedProps == null ? void 0 : memoizedProps.children) == null ? void 0 : _c.props) == null ? void 0 : _d.store) && isReduxStore(memoizedProps.children.props.store)) {
            return memoizedProps.children.props.store;
          }
          fiber = fiber.return;
          maxDepth--;
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
    function findStoreInReduxDevTools() {
      const win = window;
      if (win.__REDUX_DEVTOOLS_EXTENSION__) {
        const ext = win.__REDUX_DEVTOOLS_EXTENSION__;
        if (ext._stores && ext._stores.length > 0) {
          return ext._stores[0];
        }
        if (ext._connections) {
          for (const conn of Object.values(ext._connections)) {
            if ((conn == null ? void 0 : conn.store) && isReduxStore(conn.store)) {
              return conn.store;
            }
          }
        }
      }
      if (win.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__) {
        const compose = win.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__;
        if (compose._store && isReduxStore(compose._store)) {
          return compose._store;
        }
      }
      return null;
    }
    function findReduxStore() {
      const win = window;
      const directCandidates = [
        { name: "__REDUX_STORE__", value: win.__REDUX_STORE__ },
        { name: "store", value: win.store },
        { name: "__store__", value: win.__store__ },
        { name: "reduxStore", value: win.reduxStore },
        { name: "__STORE__", value: win.__STORE__ },
        { name: "appStore", value: win.appStore },
        { name: "rootStore", value: win.rootStore }
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
    function deepSanitizeState(value, depth = 0, maxDepth = 15) {
      if (depth > maxDepth) return "[Max depth exceeded]";
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
    function installReduxHook() {
      let attempts = 0;
      const maxAttempts = 20;
      const checkInterval = 1e3;
      const setupStore = (store) => {
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
            sendFromPage("REDUX_ACTION", {
              id: generateId(),
              type: action.type || "UNKNOWN",
              payload: sanitizeValue(action, 0),
              timestamp: Date.now()
            });
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
          const getNestedValue = (obj, path) => {
            let current = obj;
            for (const key of path) {
              if (current == null) return void 0;
              current = current[key];
            }
            return current;
          };
          window.__REACT_DEBUGGER_SET_STATE__ = (path, value) => {
            try {
              const currentState = store.getState();
              const pathKey = path.join(".");
              if (!stateOverrides.has(pathKey)) {
                const originalValue = getNestedValue(currentState, path);
                stateOverrides.set(pathKey, { path, originalValue, currentValue: value, timestamp: Date.now() });
              } else {
                const existing = stateOverrides.get(pathKey);
                existing.currentValue = value;
                existing.timestamp = Date.now();
              }
              const newState = setNestedValue(currentState, path, value);
              injectedState = newState;
              originalDispatch.call(store, { type: "@@REACT_DEBUGGER/INJECT_STATE" });
              setTimeout(() => {
                sendFromPage("REDUX_STATE_CHANGE", deepSanitizeState(store.getState()));
              }, 10);
              log("State updated at path:", pathKey);
            } catch (e) {
              console.error("[React Debugger] Set state error:", e);
            }
          };
          window.__REACT_DEBUGGER_CLEAR_OVERRIDES__ = () => {
            try {
              if (stateOverrides.size === 0) {
                sendFromPage("REDUX_OVERRIDES_CLEARED", null);
                return;
              }
              let currentState = store.getState();
              stateOverrides.forEach((data) => {
                currentState = setNestedValue(currentState, data.path, data.originalValue);
              });
              injectedState = currentState;
              originalDispatch.call(store, { type: "@@REACT_DEBUGGER/INJECT_STATE" });
              stateOverrides.clear();
              setTimeout(() => {
                sendFromPage("REDUX_STATE_CHANGE", deepSanitizeState(store.getState()));
                sendFromPage("REDUX_OVERRIDES_CLEARED", null);
              }, 10);
              log("All overrides cleared, state restored");
            } catch (e) {
              console.error("[React Debugger] Clear overrides error:", e);
            }
          };
          window.__REACT_DEBUGGER_GET_OVERRIDES__ = () => {
            return Array.from(stateOverrides.entries()).map(([key, data]) => ({
              path: key,
              value: data.value,
              timestamp: data.timestamp
            }));
          };
        } catch (e) {
          console.error("[React Debugger] Error setting up Redux hook:", e);
          reduxStore = null;
        }
      };
      const check = setInterval(() => {
        attempts++;
        if (reduxSearchStopped || reduxStore) {
          clearInterval(check);
          return;
        }
        const store = findReduxStore();
        if (store) {
          clearInterval(check);
          setupStore(store);
          return;
        }
        if (attempts >= maxAttempts) {
          clearInterval(check);
          reduxSearchStopped = true;
        }
      }, checkInterval);
      const win = window;
      if (typeof win.__REDUX_DEVTOOLS_EXTENSION__ !== "undefined") {
        const originalConnect = win.__REDUX_DEVTOOLS_EXTENSION__.connect;
        if (originalConnect) {
          win.__REDUX_DEVTOOLS_EXTENSION__.connect = function(...args) {
            const devTools = originalConnect.apply(this, args);
            setTimeout(() => {
              if (!reduxStore && !reduxSearchStopped) {
                const store = findReduxStore();
                if (store) setupStore(store);
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
          setTimeout(() => setupStore(store), 100);
          return store;
        };
      }
      const onReady = () => {
        if (reduxStore || reduxSearchStopped) return;
        setTimeout(() => {
          if (!reduxStore && !reduxSearchStopped) {
            const store = findReduxStore();
            if (store) setupStore(store);
          }
        }, 2e3);
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
    function startMemoryMonitoring() {
      if (memoryMonitoringEnabled) return;
      const snapshot = getMemorySnapshot();
      if (!snapshot) {
        return;
      }
      memoryMonitoringEnabled = true;
      sendFromPage("MEMORY_SNAPSHOT", {
        ...snapshot,
        timestamp: Date.now()
      });
      memoryMonitorInterval = window.setInterval(() => {
        const snap = getMemorySnapshot();
        if (snap) {
          sendFromPage("MEMORY_SNAPSHOT", {
            ...snap,
            timestamp: Date.now()
          });
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
    window.__REACT_DEBUGGER_MEMORY__ = {
      start: startMemoryMonitoring,
      stop: stopMemoryMonitoring,
      getSnapshot: getMemorySnapshot,
      isMonitoring: () => memoryMonitoringEnabled
    };
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
    });
    installReactHook();
    installReduxHook();
    window.__REACT_DEBUGGER_ENABLE_CLOSURE_TRACKING__ = _installClosureTracking;
    console.log("[React Debugger] Inject script loaded");
  })();
})();
