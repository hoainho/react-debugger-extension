import { useState, useEffect, useCallback } from 'react';
import type { TabState } from '@/types';
import { UIStateTab } from './tabs/UIStateTab';
import { PerformanceTab } from './tabs/PerformanceTab';
import { SideEffectsTab } from './tabs/SideEffectsTab';
import { CLSTab } from './tabs/CLSTab';
import { ReduxTab } from './tabs/ReduxTab';
import { MemoryTab } from './tabs/MemoryTab';

type TabId = 'ui-state' | 'performance' | 'side-effects' | 'cls' | 'redux' | 'memory';

interface TabConfig {
  id: TabId;
  label: string;
  icon: string;
}

const TABS: TabConfig[] = [
  { id: 'ui-state', label: 'UI & State', icon: '🎯' },
  { id: 'performance', label: 'Performance', icon: '⚡' },
  { id: 'memory', label: 'Memory', icon: '🧠' },
  { id: 'side-effects', label: 'Side Effects', icon: '🔄' },
  { id: 'cls', label: 'CLS', icon: '📐' },
  { id: 'redux', label: 'Redux', icon: '🗄️' },
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
});

export function Panel() {
  const [activeTab, setActiveTab] = useState<TabId>('ui-state');
  const [state, setState] = useState<TabState>(createInitialState);
  const [isLoading, setIsLoading] = useState(true);
  const [extensionVersion] = useState(() => chrome.runtime.getManifest().version);

  const tabId = chrome.devtools.inspectedWindow.tabId;

  const fetchState = useCallback(async () => {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_STATE',
        tabId,
      });

      if (response?.success && response.state) {
        const parsedState = {
          ...response.state,
          renders: new Map(Object.entries(response.state.renders || {})),
        };
        setState(parsedState);
      }
    } catch (error) {
      console.error('[React Debugger] Error fetching state:', error);
    } finally {
      setIsLoading(false);
    }
  }, [tabId]);

  useEffect(() => {
    fetchState();

    const listener = (message: any) => {
      if (message.tabId !== tabId) return;

      switch (message.type) {
        case 'REACT_DETECTED':
          setState(prev => ({
            ...prev,
            reactDetected: true,
            reactVersion: message.payload?.version || null,
            reactMode: message.payload?.mode || null,
          }));
          break;

        case 'REDUX_DETECTED':
          setState(prev => ({
            ...prev,
            reduxDetected: true,
            reduxState: message.payload,
          }));
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
      }
    };

    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, [tabId, fetchState]);

  const clearIssues = useCallback(() => {
    chrome.runtime.sendMessage({ type: 'CLEAR_ISSUES', tabId });
    setState(prev => ({ ...prev, issues: [] }));
  }, [tabId]);

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
        <div className="empty-icon">⚛️</div>
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
      case 'ui-state':
        return <UIStateTab issues={state.issues} onClear={clearIssues} />;
      case 'performance':
        return (
          <PerformanceTab
            issues={state.issues}
            components={state.components}
            renders={state.renders}
            tabId={tabId}
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
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="panel">
      <header className="panel-header">
        <div className="logo">
          <span className="logo-icon">⚛️</span>
          <span className="logo-text">React Debugger</span>
          <span className="version">v{extensionVersion}</span>
        </div>
        <div className="header-badges">
          <span className="mode-badge mode-active">Active</span>
          {state.reduxDetected && (
            <span className="mode-badge mode-redux">Redux</span>
          )}
        </div>
      </header>

      <nav className="tab-nav">
        {TABS.map(tab => {
          const badge = getBadge(tab.id);
          return (
            <button
              key={tab.id}
              className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span className="tab-icon">{tab.icon}</span>
              <span className="tab-label">{tab.label}</span>
              {badge !== undefined && badge > 0 && (
                <span className="tab-badge">{badge}</span>
              )}
            </button>
          );
        })}
      </nav>

      <main className="tab-content">
        {renderContent()}
      </main>
    </div>
  );
}
