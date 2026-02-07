import type { 
  TabState, 
  Message, 
  Issue, 
  CLSEntry,
  ReduxAction,
  ReactDetectedPayload,
  FiberCommitPayload,
  MemorySnapshot,
  PageLoadMetrics,
  CrashEntry,
  TimelineEvent,
  CorrelationResult,
  MemoryEventPayload
} from '@/types';

const tabStates = new Map<number, TabState>();
const debuggerEnabledStates = new Map<number, boolean>();

async function getDebuggerState(tabId: number): Promise<boolean> {
  if (debuggerEnabledStates.has(tabId)) {
    return debuggerEnabledStates.get(tabId)!;
  }
  
  try {
    const result = await chrome.storage.session.get(`debugger_enabled_${tabId}`);
    const enabled = result[`debugger_enabled_${tabId}`] ?? false;
    debuggerEnabledStates.set(tabId, enabled);
    return enabled;
  } catch {
    return false;
  }
}

async function setDebuggerState(tabId: number, enabled: boolean): Promise<void> {
  debuggerEnabledStates.set(tabId, enabled);
  try {
    await chrome.storage.session.set({ [`debugger_enabled_${tabId}`]: enabled });
  } catch (e) {
    console.error('[React Debugger] Failed to save debugger state:', e);
  }
}

async function clearDebuggerState(tabId: number): Promise<void> {
  debuggerEnabledStates.delete(tabId);
  try {
    await chrome.storage.session.remove(`debugger_enabled_${tabId}`);
  } catch {
  }
}

function createInitialState(): TabState {
  return {
    reactDetected: false,
    reactVersion: null,
    reactMode: null,
    reduxDetected: false,
    issues: [],
    components: [],
    renders: new Map(),
    clsReport: null,
    reduxState: null,
    reduxActions: [],
    memoryReport: null,
    pageLoadMetrics: null,
    timelineEvents: [],
  };
}

function getOrCreateState(tabId: number): TabState {
  if (!tabStates.has(tabId)) {
    tabStates.set(tabId, createInitialState());
  }
  return tabStates.get(tabId)!;
}

function serializeState(state: TabState): object {
  return {
    ...state,
    renders: Object.fromEntries(state.renders),
  };
}

chrome.runtime.onMessage.addListener((message: Message, sender, sendResponse) => {
  const tabId = sender.tab?.id ?? message.tabId;
  
  if (!tabId) {
    console.warn('[React Debugger] No tabId found in message');
    return;
  }
  
  const state = getOrCreateState(tabId);
  
  switch (message.type) {
    case 'REACT_DETECTED': {
      const payload = message.payload as ReactDetectedPayload;
      state.reactDetected = true;
      state.reactVersion = payload.version;
      state.reactMode = payload.mode;
      state.reduxDetected = false;
      state.reduxState = null;
      state.reduxActions = [];
      
      broadcastToPanel(tabId, 'REACT_DETECTED', payload);
      
      getDebuggerState(tabId).then(wasEnabled => {
        if (wasEnabled) {
          chrome.tabs.sendMessage(tabId, { type: 'ENABLE_DEBUGGER' }).catch(() => {});
          broadcastToPanel(tabId, 'DEBUGGER_STATE_CHANGED', { enabled: true });
        }
      });
      break;
    }
    
    case 'REDUX_DETECTED': {
      state.reduxDetected = true;
      state.reduxState = message.payload;
      
      broadcastToPanel(tabId, 'REDUX_DETECTED', message.payload);
      break;
    }
    
    case 'FIBER_COMMIT': {
      const payload = message.payload as FiberCommitPayload;
      
      state.components = payload.components;
      
      for (const issue of payload.issues) {
        const existingIndex = state.issues.findIndex(
          i => i.type === issue.type && i.component === issue.component
        );
        if (existingIndex >= 0) {
          state.issues[existingIndex] = issue;
        } else {
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
            triggerReasons: [render.reason],
          });
        }
      }
      
      broadcastToPanel(tabId, 'FIBER_COMMIT', {
        components: payload.components,
        issues: state.issues,
        renders: Object.fromEntries(state.renders),
      });
      break;
    }
    
    case 'ISSUE_DETECTED': {
      const issue = message.payload as Issue;
      const existing = state.issues.find(
        i => i.type === issue.type && i.component === issue.component
      );
      if (!existing) {
        state.issues.push(issue);
        broadcastToPanel(tabId, 'ISSUE_DETECTED', issue);
      }
      break;
    }
    
    case 'STALE_CLOSURE_DETECTED': {
      const issue = message.payload as Issue;
      const existing = state.issues.find(
        i => i.type === issue.type && 
             i.component === issue.component &&
             i.location?.closureInfo?.functionName === issue.location?.closureInfo?.functionName
      );
      if (!existing) {
        state.issues.push(issue);
        broadcastToPanel(tabId, 'STALE_CLOSURE_DETECTED', issue);
      }
      break;
    }
    
    case 'CLS_ENTRY': {
      const entry = message.payload as CLSEntry;
      
      if (!state.clsReport) {
        state.clsReport = {
          totalScore: 0,
          rating: 'good',
          entries: [],
          topContributors: [],
        };
      }
      
      state.clsReport.entries.push(entry);
      state.clsReport.totalScore = entry.cumulativeScore;
      
      if (state.clsReport.totalScore < 0.1) {
        state.clsReport.rating = 'good';
      } else if (state.clsReport.totalScore < 0.25) {
        state.clsReport.rating = 'needs-improvement';
      } else {
        state.clsReport.rating = 'poor';
      }
      
      for (const source of entry.sources) {
        const existing = state.clsReport.topContributors.find(
          c => c.element === source.node
        );
        if (existing) {
          existing.totalShift += entry.value;
          existing.occurrences++;
        } else {
          state.clsReport.topContributors.push({
            element: source.node,
            totalShift: entry.value,
            occurrences: 1,
          });
        }
      }
      
      state.clsReport.topContributors.sort((a, b) => b.totalShift - a.totalShift);
      
      broadcastToPanel(tabId, 'CLS_ENTRY', state.clsReport);
      break;
    }
    
    case 'REDUX_STATE_CHANGE': {
      state.reduxState = message.payload;
      broadcastToPanel(tabId, 'REDUX_STATE_CHANGE', message.payload);
      break;
    }
    
    case 'REDUX_ACTION': {
      const action = message.payload as ReduxAction;
      state.reduxActions.push(action);
      if (state.reduxActions.length > 100) {
        state.reduxActions.shift();
      }
      broadcastToPanel(tabId, 'REDUX_ACTION', action);
      break;
    }
    
    case 'GET_STATE': {
      sendResponse({
        success: true,
        state: serializeState(state),
      });
      return true;
    }
    
    case 'DISPATCH_REDUX_ACTION': {
      chrome.tabs.sendMessage(tabId, {
        type: 'DISPATCH_REDUX_ACTION',
        payload: message.payload,
      });
      break;
    }
    
    case 'SET_REDUX_STATE': {
      chrome.tabs.sendMessage(tabId, {
        type: 'SET_REDUX_STATE',
        payload: message.payload,
      });
      break;
    }
    
    case 'DELETE_ARRAY_ITEM': {
      chrome.tabs.sendMessage(tabId, {
        type: 'DELETE_ARRAY_ITEM',
        payload: message.payload,
      });
      break;
    }
    
    case 'MOVE_ARRAY_ITEM': {
      chrome.tabs.sendMessage(tabId, {
        type: 'MOVE_ARRAY_ITEM',
        payload: message.payload,
      });
      break;
    }
    
    case 'REFRESH_REDUX_STATE': {
      chrome.tabs.sendMessage(tabId, {
        type: 'REFRESH_REDUX_STATE',
      });
      break;
    }
    
    case 'CLEAR_REDUX_OVERRIDES': {
      chrome.tabs.sendMessage(tabId, {
        type: 'CLEAR_REDUX_OVERRIDES',
      });
      break;
    }
    
    case 'CLEAR_ISSUES': {
      state.issues = [];
      broadcastToPanel(tabId, 'CLEAR_ISSUES', null);
      break;
    }
    
    case 'ENABLE_DEBUGGER': {
      setDebuggerState(tabId, true);
      chrome.tabs.sendMessage(tabId, { type: 'ENABLE_DEBUGGER' });
      broadcastToPanel(tabId, 'DEBUGGER_STATE_CHANGED', { enabled: true });
      break;
    }
    
    case 'DISABLE_DEBUGGER': {
      setDebuggerState(tabId, false);
      chrome.tabs.sendMessage(tabId, { type: 'DISABLE_DEBUGGER' });
      broadcastToPanel(tabId, 'DEBUGGER_STATE_CHANGED', { enabled: false });
      break;
    }
    
    case 'GET_DEBUGGER_STATE': {
      getDebuggerState(tabId).then(enabled => {
        sendResponse({ success: true, enabled });
      });
      return true;
    }
    
    case 'MEMORY_SNAPSHOT': {
      const snapshot = message.payload as MemorySnapshot;
      
      if (!state.memoryReport) {
        state.memoryReport = {
          current: null,
          history: [],
          growthRate: 0,
          peakUsage: 0,
          warnings: [],
          crashes: [],
        };
      }
      
      const report = state.memoryReport;
      report.current = snapshot;
      report.history.push(snapshot);
      
      if (report.history.length > 60) {
        report.history.shift();
      }
      
      if (snapshot.usedJSHeapSize > report.peakUsage) {
        report.peakUsage = snapshot.usedJSHeapSize;
      }
      
      if (report.history.length >= 2) {
        const history = report.history;
        const oldSnapshot = history[0];
        const newSnapshot = history[history.length - 1];
        const timeDiff = (newSnapshot.timestamp - oldSnapshot.timestamp) / 1000;
        if (timeDiff > 0) {
          const memoryDiff = newSnapshot.usedJSHeapSize - oldSnapshot.usedJSHeapSize;
          report.growthRate = memoryDiff / timeDiff;
        }
      }
      
      report.warnings = [];
      const usagePercent = snapshot.usedJSHeapSize / snapshot.jsHeapSizeLimit;
      if (usagePercent > 0.9) {
        report.warnings.push('Critical: Memory usage above 90%');
      } else if (usagePercent > 0.7) {
        report.warnings.push('Warning: Memory usage above 70%');
      }
      
      if (report.growthRate > 1024 * 1024) {
        report.warnings.push('Warning: Rapid memory growth detected (>1MB/s)');
      }
      
      broadcastToPanel(tabId, 'MEMORY_SNAPSHOT', report);
      break;
    }
    
    case 'START_MEMORY_MONITORING': {
      chrome.tabs.sendMessage(tabId, { type: 'START_MEMORY_MONITORING' });
      break;
    }
    
    case 'STOP_MEMORY_MONITORING': {
      chrome.tabs.sendMessage(tabId, { type: 'STOP_MEMORY_MONITORING' });
      break;
    }
    
    case 'PAGE_LOAD_METRICS': {
      const metrics = message.payload as PageLoadMetrics;
      state.pageLoadMetrics = metrics;
      broadcastToPanel(tabId, 'PAGE_LOAD_METRICS', metrics);
      break;
    }
    
    case 'CRASH_DETECTED': {
      const crash = message.payload as CrashEntry;
      if (!state.memoryReport) {
        state.memoryReport = {
          current: null,
          history: [],
          growthRate: 0,
          peakUsage: 0,
          warnings: [],
          crashes: [],
        };
      }
      state.memoryReport.crashes.push(crash);
      if (state.memoryReport.crashes.length > 50) {
        state.memoryReport.crashes.shift();
      }
      broadcastToPanel(tabId, 'CRASH_DETECTED', crash);
      break;
    }
    
    case 'TIMELINE_EVENTS': {
      const events = message.payload as TimelineEvent[];
      state.timelineEvents.push(...events);
      if (state.timelineEvents.length > 2000) {
        state.timelineEvents = state.timelineEvents.slice(-2000);
      }
      broadcastToPanel(tabId, 'TIMELINE_EVENTS', events);
      break;
    }
    
    case 'GET_CORRELATION': {
      const { eventId } = message.payload as { eventId: string };
      const result = correlateEvent(eventId, state.timelineEvents);
      sendResponse({ success: true, result });
      return true;
    }
  }
});

// ============================================
// Event Correlation Logic
// ============================================

function correlateEvent(eventId: string, events: TimelineEvent[]): CorrelationResult {
  const selectedEvent = events.find(e => e.id === eventId);
  if (!selectedEvent) {
    return { correlatedIds: [], explanation: [] };
  }

  const correlatedIds: string[] = [];
  const explanation: string[] = [];

  switch (selectedEvent.type) {
    case 'render': {
      // Find state changes within 500ms before this render
      const stateChanges = findEventsBefore(events, selectedEvent.timestamp, 500, 'state-change');
      if (stateChanges.length > 0) {
        correlatedIds.push(...stateChanges.map(e => e.id));
        explanation.push(`Possibly triggered by ${stateChanges.length} state change(s)`);
      }
      
      // Find parent renders within 100ms before
      const parentRenders = findEventsBefore(events, selectedEvent.timestamp, 100, 'render')
        .filter(e => e.id !== eventId);
      if (parentRenders.length > 0) {
        correlatedIds.push(...parentRenders.map(e => e.id));
        explanation.push(`${parentRenders.length} sibling/parent render(s) in same batch`);
      }
      break;
    }
    
    case 'state-change': {
      // Find renders within 500ms after this state change
      const subsequentRenders = findEventsAfter(events, selectedEvent.timestamp, 500, 'render');
      if (subsequentRenders.length > 0) {
        correlatedIds.push(...subsequentRenders.map(e => e.id));
        explanation.push(`Triggered ${subsequentRenders.length} render(s)`);
      }
      break;
    }
    
    case 'error': {
      // Find all events within 1s before the error
      const precedingEvents = findEventsBefore(events, selectedEvent.timestamp, 1000);
      correlatedIds.push(...precedingEvents.map(e => e.id));
      
      if (precedingEvents.length > 0) {
        explanation.push(`${precedingEvents.length} events within 1s before error`);
      }
      
      // Check for memory spike
      const memorySpike = precedingEvents.find(e => 
        e.type === 'memory' && (e.payload as MemoryEventPayload).isSpike
      );
      if (memorySpike) {
        explanation.push('⚠️ Memory spike detected before error');
      }
      
      // Check for excessive renders
      const recentRenders = precedingEvents.filter(e => e.type === 'render');
      if (recentRenders.length > 10) {
        explanation.push(`⚠️ ${recentRenders.length} renders before error (possible infinite loop)`);
      }
      break;
    }
    
    case 'memory': {
      const payload = selectedEvent.payload as MemoryEventPayload;
      
      if (payload.isSpike) {
        // Find renders within 2s before memory spike
        const precedingRenders = findEventsBefore(events, selectedEvent.timestamp, 2000, 'render');
        if (precedingRenders.length > 0) {
          correlatedIds.push(...precedingRenders.map(e => e.id));
          explanation.push(`${precedingRenders.length} render(s) before memory spike`);
        }
        
        // Find state changes
        const stateChanges = findEventsBefore(events, selectedEvent.timestamp, 2000, 'state-change');
        if (stateChanges.length > 0) {
          correlatedIds.push(...stateChanges.map(e => e.id));
          explanation.push(`${stateChanges.length} state change(s) before spike`);
        }
      }
      break;
    }
    
    case 'effect': {
      // Find the render that triggered this effect
      const triggeringRender = findEventsBefore(events, selectedEvent.timestamp, 100, 'render')
        .slice(-1)[0];
      if (triggeringRender) {
        correlatedIds.push(triggeringRender.id);
        explanation.push('Triggered by preceding render');
      }
      break;
    }
  }

  return { correlatedIds, explanation };
}

function findEventsBefore(
  events: TimelineEvent[], 
  timestamp: number, 
  windowMs: number, 
  type?: TimelineEvent['type']
): TimelineEvent[] {
  const startTime = timestamp - windowMs;
  return events.filter(e => 
    e.timestamp >= startTime && 
    e.timestamp < timestamp &&
    (!type || e.type === type)
  );
}

function findEventsAfter(
  events: TimelineEvent[], 
  timestamp: number, 
  windowMs: number, 
  type?: TimelineEvent['type']
): TimelineEvent[] {
  const endTime = timestamp + windowMs;
  return events.filter(e => 
    e.timestamp > timestamp && 
    e.timestamp <= endTime &&
    (!type || e.type === type)
  );
}

function broadcastToPanel(tabId: number, type: string, payload: unknown): void {
  chrome.runtime.sendMessage({
    type,
    tabId,
    payload,
  }).catch(() => {});
}

chrome.tabs.onRemoved.addListener((tabId) => {
  tabStates.delete(tabId);
  clearDebuggerState(tabId);
});



console.log('[React Debugger] Background service worker started');
