import { useMemo, useState } from 'react';
import type { Issue, ComponentInfo, RenderInfo } from '@/types';
import { IssueCard } from '../components/IssueCard';

interface PerformanceTabProps {
  issues: Issue[];
  components: ComponentInfo[];
  renders: Map<string, RenderInfo>;
  tabId: number;
}

const PERF_ISSUE_TYPES = ['EXCESSIVE_RERENDERS', 'UNNECESSARY_RERENDER', 'DEV_MODE_IN_PROD', 'SLOW_RENDER'];

function getTimeColor(ms: number): string {
  if (ms > 50) return 'var(--accent-red)';
  if (ms > 16) return 'var(--accent-yellow)';
  return 'var(--accent-green)';
}

export function PerformanceTab({ issues, components, renders, tabId }: PerformanceTabProps) {
  const [scanEnabled, setScanEnabled] = useState(false);
  const filteredIssues = issues.filter(i => PERF_ISSUE_TYPES.includes(i.type));
  
  const toggleScan = () => {
    const newState = !scanEnabled;
    setScanEnabled(newState);
    
    chrome.tabs.sendMessage(tabId, {
      type: 'TOGGLE_SCAN',
      payload: { enabled: newState },
    });
  };

  const renderStats = useMemo(() => {
    const stats = Array.from(renders.values())
      .sort((a, b) => b.renderCount - a.renderCount)
      .slice(0, 15);
    return stats;
  }, [renders]);

  const totalRenders = useMemo(() => {
    return Array.from(renders.values()).reduce((sum, r) => sum + r.renderCount, 0);
  }, [renders]);

  const avgRenderTime = useMemo(() => {
    const allDurations = Array.from(renders.values()).flatMap(r => r.renderDurations);
    const nonZeroDurations = allDurations.filter(d => d > 0);
    if (nonZeroDurations.length === 0) return 0;
    return nonZeroDurations.reduce((sum, d) => sum + d, 0) / nonZeroDurations.length;
  }, [renders]);

  const slowRenders = useMemo(() => {
    return Array.from(renders.values())
      .map(r => {
        const maxDuration = r.renderDurations.length > 0 ? Math.max(...r.renderDurations) : 0;
        const avgDuration = r.renderDurations.length > 0 
          ? r.renderDurations.reduce((a, b) => a + b, 0) / r.renderDurations.length 
          : 0;
        return { ...r, maxDuration, avgDuration };
      })
      .filter(r => r.maxDuration > 16)
      .sort((a, b) => b.maxDuration - a.maxDuration)
      .slice(0, 5);
  }, [renders]);

  const totalSlowRenders = useMemo(() => {
    return Array.from(renders.values())
      .reduce((count, r) => count + r.renderDurations.filter(d => d > 16).length, 0);
  }, [renders]);

  return (
    <div className="tab-panel">
      <div className="tab-header">
        <h2>⚡ Performance Analysis</h2>
        <button 
          className={`scan-toggle ${scanEnabled ? 'active' : ''}`}
          onClick={toggleScan}
          title="Toggle React Scan - highlights component re-renders on the page"
        >
          {scanEnabled ? '🔍 Scan ON' : '🔍 Scan OFF'}
        </button>
      </div>

      {scanEnabled && (
        <div className="scan-info">
          <span className="scan-indicator">●</span>
          <span>React Scan is active - re-renders are highlighted on the page</span>
          <div className="scan-legend">
            <span className="legend-item" style={{background: 'rgba(64, 196, 99, 0.4)'}}>1×</span>
            <span className="legend-item" style={{background: 'rgba(255, 193, 7, 0.5)'}}>2-3×</span>
            <span className="legend-item" style={{background: 'rgba(255, 152, 0, 0.5)'}}>4-5×</span>
            <span className="legend-item" style={{background: 'rgba(255, 87, 34, 0.6)'}}>6-10×</span>
            <span className="legend-item" style={{background: 'rgba(244, 67, 54, 0.7)'}}>10+×</span>
          </div>
        </div>
      )}

      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-value">{components.length}</span>
          <span className="stat-label">Components</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{totalRenders}</span>
          <span className="stat-label">Total Renders</span>
        </div>
        <div className="stat-card">
          <span className="stat-value" style={{ color: getTimeColor(avgRenderTime) }}>
            {avgRenderTime.toFixed(2)}ms
          </span>
          <span className="stat-label">Avg Render Time</span>
        </div>
        <div className="stat-card">
          <span className="stat-value" style={{ color: totalSlowRenders > 0 ? 'var(--accent-yellow)' : undefined }}>
            {totalSlowRenders}
          </span>
          <span className="stat-label">Slow Renders (&gt;16ms)</span>
        </div>
      </div>

      {avgRenderTime === 0 && totalRenders > 0 && (
        <div className="info-banner">
          <span>💡</span>
          <span>
            Render timing requires React's <strong>Profiler</strong> build or <strong>development mode</strong>. 
            In production, actualDuration may not be available.
          </span>
        </div>
      )}

      {filteredIssues.length > 0 && (
        <section className="section">
          <h3>Performance Issues ({filteredIssues.length})</h3>
          <div className="issues-list">
            {filteredIssues.map(issue => (
              <IssueCard key={issue.id} issue={issue} />
            ))}
          </div>
        </section>
      )}

      {slowRenders.length > 0 && (
        <section className="section">
          <h3>🐌 Slowest Components</h3>
          <p className="section-desc">Components exceeding 16ms frame budget (60fps target)</p>
          <div className="render-table">
            <table>
              <thead>
                <tr>
                  <th>Component</th>
                  <th>Max Time</th>
                  <th>Avg Time</th>
                  <th>Renders</th>
                </tr>
              </thead>
              <tbody>
                {slowRenders.map(stat => (
                  <tr key={stat.componentId} className="warning">
                    <td className="component-name">{stat.componentName}</td>
                    <td className="render-time" style={{ color: getTimeColor(stat.maxDuration) }}>
                      {stat.maxDuration.toFixed(2)}ms
                    </td>
                    <td className="render-time" style={{ color: getTimeColor(stat.avgDuration) }}>
                      {stat.avgDuration.toFixed(2)}ms
                    </td>
                    <td className="render-count">{stat.renderCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {renderStats.length > 0 && (
        <section className="section">
          <h3>Top Re-rendering Components</h3>
          <div className="render-table">
            <table>
              <thead>
                <tr>
                  <th>Component</th>
                  <th>Renders</th>
                  <th>Avg Time</th>
                  <th>Self Time</th>
                  <th>Last Trigger</th>
                </tr>
              </thead>
              <tbody>
                {renderStats.map(stat => {
                  const avgTime = stat.renderDurations.length > 0
                    ? stat.renderDurations.reduce((a, b) => a + b, 0) / stat.renderDurations.length
                    : 0;
                  const avgSelfTime = stat.selfDurations.length > 0
                    ? stat.selfDurations.reduce((a, b) => a + b, 0) / stat.selfDurations.length
                    : 0;
                  const lastReason = stat.triggerReasons[stat.triggerReasons.length - 1];
                  
                  return (
                    <tr key={stat.componentId} className={stat.renderCount > 10 ? 'warning' : ''}>
                      <td className="component-name">{stat.componentName}</td>
                      <td className="render-count">{stat.renderCount}</td>
                      <td className="render-time" style={{ color: avgTime > 0 ? getTimeColor(avgTime) : undefined }}>
                        {avgTime > 0 ? `${avgTime.toFixed(2)}ms` : '-'}
                      </td>
                      <td className="render-time" style={{ color: avgSelfTime > 0 ? getTimeColor(avgSelfTime) : undefined }}>
                        {avgSelfTime > 0 ? `${avgSelfTime.toFixed(2)}ms` : '-'}
                      </td>
                      <td className="trigger-reason">
                        <span className={`trigger-badge trigger-${lastReason?.type || 'unknown'}`}>
                          {lastReason?.type || 'unknown'}
                        </span>
                        {lastReason?.changedKeys && (
                          <span className="changed-keys">
                            ({lastReason.changedKeys.slice(0, 3).join(', ')})
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {renderStats.length === 0 && filteredIssues.length === 0 && (
        <div className="empty-state">
          <span className="empty-icon">📊</span>
          <p>No performance data yet</p>
          <p className="hint">Interact with the page to see render statistics.</p>
        </div>
      )}

      <section className="section">
        <h3>Performance Tips</h3>
        <div className="info-section">
          <ul className="tips-list">
            <li>Use <code>React.memo()</code> to prevent unnecessary re-renders</li>
            <li>Use <code>useMemo()</code> for expensive computations</li>
            <li>Use <code>useCallback()</code> for event handler stability</li>
            <li>Avoid creating objects/arrays inline in JSX props</li>
            <li>Consider virtualization for long lists (react-window, react-virtual)</li>
            <li>Split large components into smaller ones for better caching</li>
          </ul>
        </div>
      </section>
    </div>
  );
}
