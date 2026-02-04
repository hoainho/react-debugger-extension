import { useState, useEffect, useMemo } from 'react';
import type { MemoryReport, CrashEntry } from '@/types';

interface MemoryTabProps {
  report: MemoryReport | null;
  tabId: number;
}

function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null || isNaN(bytes) || !isFinite(bytes)) return '--';
  if (bytes === 0) return '0 B';
  
  const absBytes = Math.abs(bytes);
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(absBytes) / Math.log(k));
  const value = bytes / Math.pow(k, i);
  
  return `${value.toFixed(1)} ${sizes[i]}`;
}

function formatGrowthRate(rate: number | null | undefined): string {
  if (rate == null || isNaN(rate) || !isFinite(rate)) return '--';
  const prefix = rate >= 0 ? '+' : '';
  return `${prefix}${formatBytes(rate)}/s`;
}

export function MemoryTab({ report, tabId }: MemoryTabProps) {
  const [isMonitoring, setIsMonitoring] = useState(false);

  const toggleMonitoring = () => {
    const newState = !isMonitoring;
    setIsMonitoring(newState);
    
    chrome.runtime.sendMessage({
      type: newState ? 'START_MEMORY_MONITORING' : 'STOP_MEMORY_MONITORING',
      tabId,
    });
  };

  useEffect(() => {
    return () => {
      if (isMonitoring) {
        chrome.runtime.sendMessage({
          type: 'STOP_MEMORY_MONITORING',
          tabId,
        });
      }
    };
  }, [isMonitoring, tabId]);

  const chartData = useMemo(() => {
    if (!report?.history || report.history.length === 0) return [];
    return report.history.map((snapshot, index) => ({
      index,
      used: snapshot.usedJSHeapSize / (1024 * 1024),
      total: snapshot.totalJSHeapSize / (1024 * 1024),
      timestamp: snapshot.timestamp,
    }));
  }, [report?.history]);

  const maxMemory = useMemo(() => {
    if (chartData.length === 0) return 100;
    return Math.max(...chartData.map(d => d.total)) * 1.1;
  }, [chartData]);

  const getUsageColor = (used: number, limit: number): string => {
    const percent = used / limit;
    if (percent > 0.9) return 'var(--accent-red)';
    if (percent > 0.7) return 'var(--accent-yellow)';
    return 'var(--accent-green)';
  };

  const getGrowthRateColor = (rate: number): string => {
    if (rate > 1024 * 1024) return 'var(--accent-red)';
    if (rate > 512 * 1024) return 'var(--accent-yellow)';
    if (rate < 0) return 'var(--accent-green)';
    return 'var(--text-secondary)';
  };

  if (!report?.current) {
    return (
      <div className="tab-panel">
        <div className="tab-header">
          <h2>🧠 Memory Monitor</h2>
          <button
            className={`scan-toggle ${isMonitoring ? 'active' : ''}`}
            onClick={toggleMonitoring}
          >
            {isMonitoring ? '⏹️ Stop Monitoring' : '▶️ Start Monitoring'}
          </button>
        </div>

        <div className="empty-state">
          <span className="empty-icon">🧠</span>
          <h2>Memory Monitoring</h2>
          <p>Click "Start Monitoring" to track JavaScript heap usage.</p>
          <p className="hint">Note: Requires Chrome with memory API support.</p>
        </div>
      </div>
    );
  }

  const usagePercent = (report.current.usedJSHeapSize / report.current.jsHeapSizeLimit) * 100;

  return (
    <div className="tab-panel memory-panel">
      <div className="tab-header">
        <h2>🧠 Memory Monitor</h2>
        <button
          className={`scan-toggle ${isMonitoring ? 'active' : ''}`}
          onClick={toggleMonitoring}
        >
          {isMonitoring ? '⏹️ Stop Monitoring' : '▶️ Start Monitoring'}
        </button>
      </div>

      <div className="memory-warnings-container">
        {report.warnings.length > 0 ? (
          <div className="memory-warnings">
            {report.warnings.map((warning, i) => (
              <div key={i} className="memory-warning">
                <span className="warning-icon">⚠️</span>
                <span>{warning}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="memory-warnings-placeholder" />
        )}
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <span 
            className="stat-value" 
            style={{ color: getUsageColor(report.current.usedJSHeapSize, report.current.jsHeapSizeLimit) }}
          >
            {formatBytes(report.current.usedJSHeapSize)}
          </span>
          <span className="stat-label">Used Heap</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{formatBytes(report.current.totalJSHeapSize)}</span>
          <span className="stat-label">Total Heap</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{formatBytes(report.current.jsHeapSizeLimit)}</span>
          <span className="stat-label">Heap Limit</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{formatBytes(report.peakUsage)}</span>
          <span className="stat-label">Peak Usage</span>
        </div>
      </div>

      <section className="section">
        <h3>Heap Usage ({usagePercent.toFixed(1)}%)</h3>
        <div className="memory-bar-container">
          <div className="memory-bar-bg">
            <div 
              className="memory-bar-fill"
              style={{ 
                width: `${usagePercent}%`,
                background: getUsageColor(report.current.usedJSHeapSize, report.current.jsHeapSizeLimit),
              }}
            />
          </div>
          <div className="memory-bar-labels">
            <span>0%</span>
            <span className="threshold-70">70%</span>
            <span className="threshold-90">90%</span>
            <span>100%</span>
          </div>
        </div>
      </section>

      <section className="section">
        <h3>Memory Growth Rate</h3>
        <div className="growth-rate-display">
          <span 
            className="growth-rate-value"
            style={{ color: getGrowthRateColor(report.growthRate) }}
          >
            {formatGrowthRate(report.growthRate)}
          </span>
          <span className="growth-rate-hint">
            {report.growthRate == null || isNaN(report.growthRate)
              ? 'Collecting data...'
              : report.growthRate > 1024 * 1024 
                ? 'Rapid growth - possible memory leak' 
                : report.growthRate < -512 * 1024
                  ? 'Memory decreasing (GC running)'
                  : 'Normal'}
          </span>
        </div>
      </section>

      {chartData.length > 1 && (
        <section className="section">
          <h3>Memory Timeline</h3>
          <div className="memory-chart">
            <div className="chart-y-axis">
              <span>{maxMemory.toFixed(0)} MB</span>
              <span>{(maxMemory / 2).toFixed(0)} MB</span>
              <span>0 MB</span>
            </div>
            <div className="chart-area">
              <svg viewBox={`0 0 ${chartData.length * 10} 100`} preserveAspectRatio="none">
                <polyline
                  fill="none"
                  stroke="var(--accent-blue)"
                  strokeWidth="2"
                  points={chartData.map((d, i) => 
                    `${i * 10},${100 - (d.used / maxMemory) * 100}`
                  ).join(' ')}
                />
                <polyline
                  fill="none"
                  stroke="var(--text-muted)"
                  strokeWidth="1"
                  strokeDasharray="4"
                  points={chartData.map((d, i) => 
                    `${i * 10},${100 - (d.total / maxMemory) * 100}`
                  ).join(' ')}
                />
              </svg>
            </div>
          </div>
          <div className="chart-legend">
            <span className="legend-item">
              <span className="legend-color" style={{ background: 'var(--accent-blue)' }}></span>
              Used Heap
            </span>
            <span className="legend-item">
              <span className="legend-color" style={{ background: 'var(--text-muted)' }}></span>
              Total Heap
            </span>
          </div>
        </section>
      )}

      {report.crashes && report.crashes.length > 0 && (
        <CrashLogSection crashes={report.crashes} />
      )}

      <section className="section">
        <h3>Memory Tips</h3>
        <div className="info-section">
          <ul className="tips-list">
            <li>Large arrays or objects kept in state can cause memory growth</li>
            <li>Event listeners not removed on unmount cause memory leaks</li>
            <li>Timers (setInterval/setTimeout) not cleared cause leaks</li>
            <li>Subscriptions not unsubscribed cause leaks</li>
            <li>Closures capturing large data in useCallback/useMemo</li>
          </ul>
        </div>
      </section>
    </div>
  );
}

function CrashLogSection({ crashes }: { crashes: CrashEntry[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const getCrashIcon = (type: CrashEntry['type']) => {
    switch (type) {
      case 'js-error': return '❌';
      case 'unhandled-rejection': return '⚠️';
      case 'react-error': return '🔴';
      default: return '❌';
    }
  };

  const getCrashLabel = (type: CrashEntry['type']) => {
    switch (type) {
      case 'js-error': return 'JS Error';
      case 'unhandled-rejection': return 'Promise Rejection';
      case 'react-error': return 'React Error';
      default: return 'Error';
    }
  };

  return (
    <section className="section">
      <h3>Crash Log ({crashes.length})</h3>
      <div className="crash-list">
        {crashes.slice().reverse().map(crash => (
          <div key={crash.id} className="crash-entry">
            <div 
              className="crash-header"
              onClick={() => setExpandedId(expandedId === crash.id ? null : crash.id)}
            >
              <span className="crash-icon">{getCrashIcon(crash.type)}</span>
              <span className="crash-time">
                {new Date(crash.timestamp).toLocaleTimeString()}
              </span>
              <span className="crash-type-badge">{getCrashLabel(crash.type)}</span>
              <span className="crash-message">
                {crash.message.length > 80 ? crash.message.slice(0, 80) + '...' : crash.message}
              </span>
              <span className="crash-expand">{expandedId === crash.id ? '▼' : '▶'}</span>
            </div>
            
            {expandedId === crash.id && (
              <div className="crash-details">
                <div className="crash-detail-row">
                  <strong>Message:</strong>
                  <span>{crash.message}</span>
                </div>
                
                {crash.source && (
                  <div className="crash-detail-row">
                    <strong>Source:</strong>
                    <span>{crash.source}{crash.lineno ? `:${crash.lineno}` : ''}{crash.colno ? `:${crash.colno}` : ''}</span>
                  </div>
                )}
                
                {crash.stack && (
                  <div className="crash-detail-row">
                    <strong>Stack:</strong>
                    <pre className="crash-stack">{crash.stack}</pre>
                  </div>
                )}
                
                {crash.componentStack && (
                  <div className="crash-detail-row">
                    <strong>Component Stack:</strong>
                    <pre className="crash-stack">{crash.componentStack}</pre>
                  </div>
                )}
                
                {crash.memorySnapshot && (
                  <div className="crash-detail-row">
                    <strong>Memory at crash:</strong>
                    <span>
                      {formatBytes(crash.memorySnapshot.usedJSHeapSize)} / {formatBytes(crash.memorySnapshot.jsHeapSizeLimit)}
                      ({((crash.memorySnapshot.usedJSHeapSize / crash.memorySnapshot.jsHeapSizeLimit) * 100).toFixed(1)}%)
                    </span>
                  </div>
                )}
                
                {crash.analysisHints && crash.analysisHints.length > 0 && (
                  <div className="crash-hints">
                    {crash.analysisHints.map((hint, i) => (
                      <div key={i} className="crash-hint">💡 {hint}</div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
