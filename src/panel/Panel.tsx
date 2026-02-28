import { useState, useEffect, useCallback, useRef } from 'react';
import type { TabState, TimelineEvent } from '@/types';
import { UIStateTab } from './tabs/UIStateTab';
import { PerformanceTab } from './tabs/PerformanceTab';
import { SideEffectsTab } from './tabs/SideEffectsTab';
import { CLSTab } from './tabs/CLSTab';
import { ReduxTab } from './tabs/ReduxTab';
import { MemoryTab } from './tabs/MemoryTab';
import { TimelineTab } from './tabs/TimelineTab';
import { AIAnalysisTab } from './tabs/AIAnalysisTab';

type TabId = 'timeline' | 'ui-state' | 'performance' | 'side-effects' | 'cls' | 'redux' | 'memory' | 'ai-analysis';

function isExtensionContextValid(): boolean {
  try {
    return !!chrome.runtime?.id;
  } catch {
    return false;
  }
}

async function safeSendMessage<T>(message: object): Promise<T | null> {
  if (!isExtensionContextValid()) {
    return null;
  }
  try {
    return await chrome.runtime.sendMessage(message);
  } catch (error) {
    if ((error as Error)?.message?.includes('Extension context invalidated')) {
      return null;
    }
    throw error;
  }
}

interface TabConfig {
  id: TabId;
  label: string;
}

const TABS: TabConfig[] = [
  { id: 'timeline', label: 'Timeline' },
  { id: 'ui-state', label: 'UI & State' },
  { id: 'performance', label: 'Performance' },
  { id: 'memory', label: 'Memory' },
  { id: 'side-effects', label: 'Side Effects' },
  { id: 'cls', label: 'CLS' },
  { id: 'redux', label: 'Redux' },
  { id: 'ai-analysis', label: 'AI Analysis' },
];

const createInitialState = (): TabState => ({
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
});

export function Panel() {
  const [activeTab, setActiveTab] = useState<TabId>('timeline');
  const [state, setState] = useState<TabState>(createInitialState);
  const [isLoading, setIsLoading] = useState(true);
  const [extensionVersion] = useState(() => chrome.runtime.getManifest().version);
  const [isDebuggerEnabled, setIsDebuggerEnabled] = useState(false);
  const [isTogglingDebugger, setIsTogglingDebugger] = useState(false);
  const [isSearchingRedux, setIsSearchingRedux] = useState(false);

  const tabId = chrome.devtools.inspectedWindow.tabId;
  
  const timelineEventBatchRef = useRef<TimelineEvent[]>([]);
  const timelineBatchTimeoutRef = useRef<number | null>(null);

  const fetchState = useCallback(async () => {
    if (!isExtensionContextValid()) {
      setIsLoading(false);
      return;
    }
    
    try {
      const [stateResponse, debuggerResponse] = await Promise.all([
        safeSendMessage<{ success: boolean; state?: TabState }>({ type: 'GET_STATE', tabId }),
        safeSendMessage<{ success: boolean; enabled?: boolean }>({ type: 'GET_DEBUGGER_STATE', tabId }),
      ]);

      if (!isExtensionContextValid()) {
        setIsLoading(false);
        return;
      }
      if (stateResponse?.success && stateResponse.state) {
        const parsedState = {
          ...stateResponse.state,
          renders: new Map(Object.entries(stateResponse.state.renders || {})),
        };
        setState(parsedState);
      }
      
      const wasEnabled = debuggerResponse?.success ? (debuggerResponse.enabled ?? false) : false;
      if (debuggerResponse?.success) {
        setIsDebuggerEnabled(wasEnabled);
      }

      // Auto-enable debugger when panel opens so inject.js loads and detects React
      // Without this, the panel shows "Waiting for React..." with no way to enable the debugger
      const reactAlreadyDetected = stateResponse?.success && stateResponse.state?.reactDetected;
      if (!wasEnabled && !reactAlreadyDetected) {
        setIsDebuggerEnabled(true);
        safeSendMessage({ type: 'ENABLE_DEBUGGER', tabId });
      }
    } catch (error) {
      if (!(error as Error)?.message?.includes('Extension context invalidated')) {
        console.error('[React Debugger] Error fetching state:', error);
      }
    } finally {
      setIsLoading(false);
    }
  }, [tabId]);

  const toggleDebugger = useCallback(() => {
    if (!isExtensionContextValid()) return;
    
    setIsTogglingDebugger(true);
    const newEnabled = !isDebuggerEnabled;
    setIsDebuggerEnabled(newEnabled);
    safeSendMessage({
      type: newEnabled ? 'ENABLE_DEBUGGER' : 'DISABLE_DEBUGGER',
      tabId,
    });
    setTimeout(() => setIsTogglingDebugger(false), 3000);
  }, [tabId, isDebuggerEnabled]);

  const handleTabChange = useCallback((newTab: TabId) => {
    setActiveTab(newTab);
    // Lazy Redux detection: only search for Redux store when user opens the Redux tab
    if (newTab === 'redux' && !state.reduxDetected) {
      setIsSearchingRedux(true);
      safeSendMessage({ type: 'SEARCH_REDUX', tabId });
      setTimeout(() => setIsSearchingRedux(false), 5000);
    }
  }, [tabId, state.reduxDetected]);

  useEffect(() => {
    fetchState();

    const listener = (message: any) => {
      if (!isExtensionContextValid()) return;
      if (message.tabId !== tabId) return;

      switch (message.type) {
        case 'REACT_DETECTED':
          setState(prev => ({
            ...prev,
            reactDetected: true,
            reactVersion: message.payload?.version || null,
            reactMode: message.payload?.mode || null,
            reduxDetected: false,
            reduxState: null,
            reduxActions: [],
          }));
          setIsLoading(false);
          break;

        case 'REDUX_DETECTED':
          setState(prev => ({
            ...prev,
            reduxDetected: true,
            reduxState: message.payload,
          }));
          setIsSearchingRedux(false);
          break;

        case 'FIBER_COMMIT':
          setState(prev => ({
            ...prev,
            components: message.payload?.components || prev.components,
            issues: message.payload?.issues || prev.issues,
            renders: new Map(Object.entries(message.payload?.renders || {})),
          }));
          break;

        case 'ISSUE_DETECTED':
          setState(prev => ({
            ...prev,
            issues: [...prev.issues, message.payload],
          }));
          break;

        case 'CLS_ENTRY':
          setState(prev => ({
            ...prev,
            clsReport: message.payload,
          }));
          break;

        case 'REDUX_STATE_CHANGE':
          setState(prev => ({
            ...prev,
            reduxState: message.payload,
          }));
          break;

        case 'REDUX_ACTION':
          setState(prev => ({
            ...prev,
            reduxActions: [...prev.reduxActions, message.payload].slice(-100),
          }));
          break;

        case 'CLEAR_ISSUES':
          setState(prev => ({
            ...prev,
            issues: [],
          }));
          break;

        case 'STALE_CLOSURE_DETECTED':
          setState(prev => {
            const exists = prev.issues.find(
              i => i.type === message.payload.type && 
                   i.component === message.payload.component &&
                   i.location?.closureInfo?.functionName === message.payload.location?.closureInfo?.functionName
            );
            if (exists) return prev;
            return {
              ...prev,
              issues: [...prev.issues, message.payload],
            };
          });
          break;

        case 'MEMORY_SNAPSHOT':
          setState(prev => ({
            ...prev,
            memoryReport: message.payload,
          }));
          break;

        case 'PAGE_LOAD_METRICS':
          setState(prev => ({
            ...prev,
            pageLoadMetrics: message.payload,
          }));
          break;

        case 'CRASH_DETECTED':
          setState(prev => ({
            ...prev,
            memoryReport: prev.memoryReport ? {
              ...prev.memoryReport,
              crashes: [...prev.memoryReport.crashes, message.payload],
            } : null,
          }));
          break;

        case 'TIMELINE_EVENTS':
          timelineEventBatchRef.current.push(...(message.payload as TimelineEvent[]));
          
          if (timelineBatchTimeoutRef.current) {
            clearTimeout(timelineBatchTimeoutRef.current);
          }
          
          timelineBatchTimeoutRef.current = window.setTimeout(() => {
            const batchedEvents = timelineEventBatchRef.current;
            timelineEventBatchRef.current = [];
            
            if (batchedEvents.length > 0) {
              setState(prev => ({
                ...prev,
                timelineEvents: [...prev.timelineEvents, ...batchedEvents].slice(-2000),
              }));
            }
          }, 200);
          break;
          
        case 'DEBUGGER_STATE_CHANGED':
          setIsDebuggerEnabled(message.payload?.enabled ?? false);
          setIsTogglingDebugger(false);
          break;
      }
    };

    if (isExtensionContextValid()) {
      chrome.runtime.onMessage.addListener(listener);
    }
    return () => {
      if (isExtensionContextValid()) {
        chrome.runtime.onMessage.removeListener(listener);
      }
    };
  }, [tabId, fetchState]);

  // POLL_DATA: Pull-based architecture — request analysis from inject script
  // instead of inject auto-pushing on every React commit.
  // This ensures ZERO work on the host page's main thread between polls.
  useEffect(() => {
    if (!isDebuggerEnabled || !isExtensionContextValid()) return;
    
    const POLL_INTERVAL = 5000; // 5 seconds — balanced between data freshness and host page impact
    const pollTimer = setInterval(() => {
      if (!isExtensionContextValid()) return;
      safeSendMessage({ type: 'POLL_DATA', tabId });
    }, POLL_INTERVAL);
    
    // Initial poll
    safeSendMessage({ type: 'POLL_DATA', tabId });
    
    return () => clearInterval(pollTimer);
  }, [tabId, isDebuggerEnabled]);

  const clearIssues = useCallback(() => {
    safeSendMessage({ type: 'CLEAR_ISSUES', tabId });
    setState(prev => ({ ...prev, issues: [] }));
  }, [tabId]);

  const clearTimeline = useCallback(() => {
    setState(prev => ({ ...prev, timelineEvents: [] }));
  }, []);

  const getIssueCount = (types: string[]): number => {
    return state.issues.filter(i => types.includes(i.type)).length;
  };

  const getBadge = (tabId: TabId): number | undefined => {
    switch (tabId) {
      case 'ui-state':
        return getIssueCount(['DIRECT_STATE_MUTATION', 'MISSING_KEY', 'INDEX_AS_KEY', 'DUPLICATE_KEY']) || undefined;
      case 'performance':
        return getIssueCount(['EXCESSIVE_RERENDERS', 'UNNECESSARY_RERENDER']) || undefined;
      case 'side-effects':
        return getIssueCount(['MISSING_CLEANUP', 'MISSING_DEP', 'INFINITE_LOOP_RISK']) || undefined;
      case 'cls':
        return state.clsReport && state.clsReport.totalScore >= 0.1 ? 1 : undefined;
      default:
        return undefined;
    }
  };

  if (isLoading) {
    return (
      <div className="panel-loading">
        <div className="spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  if (!state.reactDetected) {
    return (
      <div className="panel-empty">
        <div className="empty-state-icon empty-state-icon--react" />
        <h2>Waiting for React...</h2>
        <p>React has not been detected on this page.</p>
        <p className="hint">Make sure the page uses React 16+ and refresh if needed.</p>
        <button className="refresh-btn" onClick={() => chrome.devtools.inspectedWindow.reload({})}>
          Refresh Page
        </button>
      </div>
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'timeline':
        return <TimelineTab events={state.timelineEvents} tabId={tabId} onClear={clearTimeline} />;
      case 'ui-state':
        return <UIStateTab issues={state.issues} onClear={clearIssues} />;
      case 'performance':
        return (
          <PerformanceTab
            issues={state.issues}
            components={state.components}
            renders={state.renders}
            tabId={tabId}
            pageLoadMetrics={state.pageLoadMetrics}
          />
        );
      case 'memory':
        return <MemoryTab report={state.memoryReport} tabId={tabId} />;
      case 'side-effects':
        return <SideEffectsTab issues={state.issues} />;
      case 'cls':
        return <CLSTab report={state.clsReport} />;
      case 'redux':
        return (
          <ReduxTab
            detected={state.reduxDetected}
            state={state.reduxState}
            actions={state.reduxActions}
            tabId={tabId}
            isSearching={isSearchingRedux}
          />
        );
      case 'ai-analysis':
        return <AIAnalysisTab state={state} />;
      default:
        return null;
    }
  };

  return (
    <div className="panel">
      <header className="panel-header">
        <div className="logo">
          <img src="icons/icon48.png" className="logo-icon" alt="React Debugger" />
          <span className="logo-text">React Debugger</span>
          <span className="version">v{extensionVersion}</span>
        </div>
        <div className="header-right">
          <div className="header-badges">
            {state.reduxDetected && (
              <span className="mode-badge mode-redux">Redux</span>
            )}
          </div>
        </div>
      </header>

      <nav className="tab-nav">
        {TABS.map(tab => {
          const badge = getBadge(tab.id);
          return (
            <button
              key={tab.id}
              className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => handleTabChange(tab.id)}
            >
              <span className="tab-label">{tab.label}</span>
              {badge !== undefined && badge > 0 && (
                <span className="tab-badge">{badge}</span>
              )}
            </button>
          );
        })}
      </nav>

      <main className="tab-content">
        {!isDebuggerEnabled && state.timelineEvents.length === 0 ? (
          <div className="debugger-disabled-placeholder">
            <div className="placeholder-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="12" r="10" />
                <polygon points="10,8 16,12 10,16" fill="currentColor" stroke="none" />
              </svg>
            </div>
            <h2>Debugger Paused</h2>
            <p>Enable debugging to start capturing React renders, state changes, and performance data.</p>
            <button className="enable-btn" onClick={toggleDebugger} disabled={isTogglingDebugger}>
              {isTogglingDebugger ? <><span className="btn-spinner btn-spinner--green"></span> Enabling...</> : 'Enable Debugging'}
            </button>
          </div>
        ) : (
          renderContent()
        )}
      </main>
    </div>
  );
}
