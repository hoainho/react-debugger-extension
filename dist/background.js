(function() {
  "use strict";
  const tabStates = /* @__PURE__ */ new Map();
  function createInitialState() {
    return {
      reactDetected: false,
      reactVersion: null,
      reactMode: null,
      reduxDetected: false,
      issues: [],
      components: [],
      renders: /* @__PURE__ */ new Map(),
      clsReport: null,
      reduxState: null,
      reduxActions: [],
      memoryReport: null
    };
  }
  function getOrCreateState(tabId) {
    if (!tabStates.has(tabId)) {
      tabStates.set(tabId, createInitialState());
    }
    return tabStates.get(tabId);
  }
  function serializeState(state) {
    return {
      ...state,
      renders: Object.fromEntries(state.renders)
    };
  }
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    var _a;
    const tabId = ((_a = sender.tab) == null ? void 0 : _a.id) ?? message.tabId;
    if (!tabId) {
      console.warn("[React Debugger] No tabId found in message");
      return;
    }
    const state = getOrCreateState(tabId);
    switch (message.type) {
      case "REACT_DETECTED": {
        const payload = message.payload;
        state.reactDetected = true;
        state.reactVersion = payload.version;
        state.reactMode = payload.mode;
        broadcastToPanel(tabId, "REACT_DETECTED", payload);
        break;
      }
      case "REDUX_DETECTED": {
        state.reduxDetected = true;
        state.reduxState = message.payload;
        broadcastToPanel(tabId, "REDUX_DETECTED", message.payload);
        break;
      }
      case "FIBER_COMMIT": {
        const payload = message.payload;
        state.components = payload.components;
        for (const issue of payload.issues) {
          const existing = state.issues.find(
            (i) => i.type === issue.type && i.component === issue.component
          );
          if (!existing) {
            state.issues.push(issue);
          }
        }
        for (const render of payload.renders) {
          const existing = state.renders.get(render.componentId);
          if (existing) {
            existing.renderCount++;
            existing.lastRenderTime = payload.timestamp;
            existing.renderDurations.push(render.duration);
            if (existing.renderDurations.length > 20) {
              existing.renderDurations.shift();
            }
            existing.selfDurations.push(render.selfDuration ?? 0);
            if (existing.selfDurations.length > 20) {
              existing.selfDurations.shift();
            }
            existing.triggerReasons.push(render.reason);
            if (existing.triggerReasons.length > 10) {
              existing.triggerReasons.shift();
            }
          } else {
            state.renders.set(render.componentId, {
              componentId: render.componentId,
              componentName: render.componentName,
              renderCount: 1,
              lastRenderTime: payload.timestamp,
              renderDurations: [render.duration],
              selfDurations: [render.selfDuration ?? 0],
              triggerReasons: [render.reason]
            });
          }
        }
        broadcastToPanel(tabId, "FIBER_COMMIT", {
          components: payload.components,
          issues: state.issues,
          renders: Object.fromEntries(state.renders)
        });
        break;
      }
      case "ISSUE_DETECTED": {
        const issue = message.payload;
        const existing = state.issues.find(
          (i) => i.type === issue.type && i.component === issue.component
        );
        if (!existing) {
          state.issues.push(issue);
          broadcastToPanel(tabId, "ISSUE_DETECTED", issue);
        }
        break;
      }
      case "STALE_CLOSURE_DETECTED": {
        const issue = message.payload;
        const existing = state.issues.find(
          (i) => {
            var _a2, _b, _c, _d;
            return i.type === issue.type && i.component === issue.component && ((_b = (_a2 = i.location) == null ? void 0 : _a2.closureInfo) == null ? void 0 : _b.functionName) === ((_d = (_c = issue.location) == null ? void 0 : _c.closureInfo) == null ? void 0 : _d.functionName);
          }
        );
        if (!existing) {
          state.issues.push(issue);
          broadcastToPanel(tabId, "STALE_CLOSURE_DETECTED", issue);
        }
        break;
      }
      case "CLS_ENTRY": {
        const entry = message.payload;
        if (!state.clsReport) {
          state.clsReport = {
            totalScore: 0,
            rating: "good",
            entries: [],
            topContributors: []
          };
        }
        state.clsReport.entries.push(entry);
        state.clsReport.totalScore = entry.cumulativeScore;
        if (state.clsReport.totalScore < 0.1) {
          state.clsReport.rating = "good";
        } else if (state.clsReport.totalScore < 0.25) {
          state.clsReport.rating = "needs-improvement";
        } else {
          state.clsReport.rating = "poor";
        }
        for (const source of entry.sources) {
          const existing = state.clsReport.topContributors.find(
            (c) => c.element === source.node
          );
          if (existing) {
            existing.totalShift += entry.value;
            existing.occurrences++;
          } else {
            state.clsReport.topContributors.push({
              element: source.node,
              totalShift: entry.value,
              occurrences: 1
            });
          }
        }
        state.clsReport.topContributors.sort((a, b) => b.totalShift - a.totalShift);
        broadcastToPanel(tabId, "CLS_ENTRY", state.clsReport);
        break;
      }
      case "REDUX_STATE_CHANGE": {
        state.reduxState = message.payload;
        broadcastToPanel(tabId, "REDUX_STATE_CHANGE", message.payload);
        break;
      }
      case "REDUX_ACTION": {
        const action = message.payload;
        state.reduxActions.push(action);
        if (state.reduxActions.length > 100) {
          state.reduxActions.shift();
        }
        broadcastToPanel(tabId, "REDUX_ACTION", action);
        break;
      }
      case "GET_STATE": {
        sendResponse({
          success: true,
          state: serializeState(state)
        });
        return true;
      }
      case "DISPATCH_REDUX_ACTION": {
        chrome.tabs.sendMessage(tabId, {
          type: "DISPATCH_REDUX_ACTION",
          payload: message.payload
        });
        break;
      }
      case "SET_REDUX_STATE": {
        chrome.tabs.sendMessage(tabId, {
          type: "SET_REDUX_STATE",
          payload: message.payload
        });
        break;
      }
      case "DELETE_ARRAY_ITEM": {
        chrome.tabs.sendMessage(tabId, {
          type: "DELETE_ARRAY_ITEM",
          payload: message.payload
        });
        break;
      }
      case "MOVE_ARRAY_ITEM": {
        chrome.tabs.sendMessage(tabId, {
          type: "MOVE_ARRAY_ITEM",
          payload: message.payload
        });
        break;
      }
      case "REFRESH_REDUX_STATE": {
        chrome.tabs.sendMessage(tabId, {
          type: "REFRESH_REDUX_STATE"
        });
        break;
      }
      case "CLEAR_REDUX_OVERRIDES": {
        chrome.tabs.sendMessage(tabId, {
          type: "CLEAR_REDUX_OVERRIDES"
        });
        break;
      }
      case "CLEAR_ISSUES": {
        state.issues = [];
        broadcastToPanel(tabId, "CLEAR_ISSUES", null);
        break;
      }
      case "MEMORY_SNAPSHOT": {
        const snapshot = message.payload;
        if (!state.memoryReport) {
          state.memoryReport = {
            current: null,
            history: [],
            growthRate: 0,
            peakUsage: 0,
            warnings: []
          };
        }
        state.memoryReport.current = snapshot;
        state.memoryReport.history.push(snapshot);
        if (state.memoryReport.history.length > 60) {
          state.memoryReport.history.shift();
        }
        if (snapshot.usedJSHeapSize > state.memoryReport.peakUsage) {
          state.memoryReport.peakUsage = snapshot.usedJSHeapSize;
        }
        if (state.memoryReport.history.length >= 2) {
          const history = state.memoryReport.history;
          const oldSnapshot = history[0];
          const newSnapshot = history[history.length - 1];
          const timeDiff = (newSnapshot.timestamp - oldSnapshot.timestamp) / 1e3;
          if (timeDiff > 0) {
            const memoryDiff = newSnapshot.usedJSHeapSize - oldSnapshot.usedJSHeapSize;
            state.memoryReport.growthRate = memoryDiff / timeDiff;
          }
        }
        state.memoryReport.warnings = [];
        const usagePercent = snapshot.usedJSHeapSize / snapshot.jsHeapSizeLimit;
        if (usagePercent > 0.9) {
          state.memoryReport.warnings.push("Critical: Memory usage above 90%");
        } else if (usagePercent > 0.7) {
          state.memoryReport.warnings.push("Warning: Memory usage above 70%");
        }
        if (state.memoryReport.growthRate > 1024 * 1024) {
          state.memoryReport.warnings.push("Warning: Rapid memory growth detected (>1MB/s)");
        }
        broadcastToPanel(tabId, "MEMORY_SNAPSHOT", state.memoryReport);
        break;
      }
      case "START_MEMORY_MONITORING": {
        chrome.tabs.sendMessage(tabId, { type: "START_MEMORY_MONITORING" });
        break;
      }
      case "STOP_MEMORY_MONITORING": {
        chrome.tabs.sendMessage(tabId, { type: "STOP_MEMORY_MONITORING" });
        break;
      }
    }
  });
  function broadcastToPanel(tabId, type, payload) {
    chrome.runtime.sendMessage({
      type,
      tabId,
      payload
    }).catch(() => {
    });
  }
  chrome.tabs.onRemoved.addListener((tabId) => {
    tabStates.delete(tabId);
  });
  chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status === "loading") {
      tabStates.set(tabId, createInitialState());
    }
  });
  console.log("[React Debugger] Background service worker started");
})();
