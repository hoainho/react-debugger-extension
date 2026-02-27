import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import type { TimelineEvent, TimelineEventType, RenderEventPayload, StateChangeEventPayload, EffectEventPayload, ErrorEventPayload, MemoryEventPayload, CorrelationResult, ContextChangeEventPayload } from '@/types';

interface TimelineTabProps {
  events: TimelineEvent[];
  tabId: number;
  onClear: () => void;
}

type FilterState = Record<TimelineEventType, boolean>;

interface RenderSnapshotEvent {
  order: number;
  componentName: string;
  trigger: string;
  duration: number;
}

interface TimelineSnapshot {
  id: string;
  createdAt: number;
  events: RenderSnapshotEvent[];
}

const EVENT_CONFIG: Record<TimelineEventType, { iconClass: string; color: string; label: string }> = {
  'render': { iconClass: 'event-type-indicator event-type-indicator--render', color: 'var(--accent-blue)', label: 'Render' },
  'state-change': { iconClass: 'event-type-indicator event-type-indicator--state', color: '#a855f7', label: 'State' },
  'effect': { iconClass: 'event-type-indicator event-type-indicator--effect', color: 'var(--accent-yellow)', label: 'Effect' },
  'error': { iconClass: 'event-type-indicator event-type-indicator--error', color: 'var(--accent-red)', label: 'Error' },
  'memory': { iconClass: 'event-type-indicator event-type-indicator--memory', color: 'var(--accent-green)', label: 'Memory' },
  'context-change': { iconClass: 'event-type-indicator event-type-indicator--context', color: '#f97316', label: 'Context' },
};

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('en-US', { 
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
  } as Intl.DateTimeFormatOptions);
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export function TimelineTab({ events, tabId, onClear }: TimelineTabProps) {
  const [filters, setFilters] = useState<FilterState>({
    'render': true,
    'state-change': true,
    'effect': true,
    'error': true,
    'memory': true,
    'context-change': true,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const expandedIdRef = useRef<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const scrollPositionRef = useRef<number>(0);
  
  useEffect(() => {
    expandedIdRef.current = expandedId;
  }, [expandedId]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [correlatedIds, setCorrelatedIds] = useState<Set<string>>(new Set());
  const [correlationExplanation, setCorrelationExplanation] = useState<string[]>([]);
  const [snapshots, setSnapshots] = useState<TimelineSnapshot[]>([]);
  const [expandedSnapshotId, setExpandedSnapshotId] = useState<string | null>(null);
  const [snapshotPanelOpen, setSnapshotPanelOpen] = useState(true);
  const [isCreatingSnapshot, setIsCreatingSnapshot] = useState(false);
  const [isCorrelating, setIsCorrelating] = useState(false);

  const fetchCorrelation = useCallback((eventId: string) => {
    setIsCorrelating(true);
    chrome.runtime.sendMessage(
      { type: 'GET_CORRELATION', tabId, payload: { eventId } },
      (response) => {
        if (response?.success && response.result) {
          const result = response.result as CorrelationResult;
          setCorrelatedIds(new Set(result.correlatedIds));
          setCorrelationExplanation(result.explanation);
        }
        setIsCorrelating(false);
      }
    );
    setTimeout(() => setIsCorrelating(false), 3000);
  }, [tabId]);

  const clearCorrelation = useCallback(() => {
    setCorrelatedIds(new Set());
    setCorrelationExplanation([]);
    setSelectedId(null);
  }, []);

  const toggleFilter = useCallback((type: TimelineEventType) => {
    setFilters(prev => ({ ...prev, [type]: !prev[type] }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({
      'render': true,
      'state-change': true,
      'effect': true,
      'error': true,
      'memory': true,
      'context-change': true,
    });
    setSearchQuery('');
  }, []);

  const createSnapshot = useCallback(() => {
    setIsCreatingSnapshot(true);
    const renderEvents = events.filter(e => e.type === 'render');
    if (renderEvents.length === 0) {
      setIsCreatingSnapshot(false);
      return;
    }

    const snapshotEvents: RenderSnapshotEvent[] = renderEvents.map((e, index) => {
      const payload = e.payload as RenderEventPayload;
      return {
        order: index + 1,
        componentName: payload.componentName,
        trigger: payload.trigger,
        duration: payload.duration ?? 0,
      };
    });

    const newSnapshot: TimelineSnapshot = {
      id: crypto.randomUUID?.() ?? `snapshot-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      createdAt: Date.now(),
      events: snapshotEvents,
    };

    setSnapshots(prev => [...prev, newSnapshot]);
    setTimeout(() => setIsCreatingSnapshot(false), 500);
  }, [events]);

  const exportSnapshot = useCallback((snapshot: TimelineSnapshot) => {
    const exportData = {
      createdAt: new Date(snapshot.createdAt).toISOString(),
      eventCount: snapshot.events.length,
      events: snapshot.events,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `snapshot-${snapshot.createdAt}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const deleteSnapshot = useCallback((snapshotId: string) => {
    setSnapshots(prev => prev.filter(s => s.id !== snapshotId));
    if (expandedSnapshotId === snapshotId) {
      setExpandedSnapshotId(null);
    }
  }, [expandedSnapshotId]);

  const filteredEvents = useMemo(() => {
    return events
      .filter(e => filters[e.type])
      .filter(e => {
        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();
        if (e.type === 'render') {
          const p = e.payload as RenderEventPayload;
          return p.componentName.toLowerCase().includes(query);
        }
        if (e.type === 'state-change') {
          const p = e.payload as StateChangeEventPayload;
          return (p.actionType?.toLowerCase().includes(query) || p.componentName?.toLowerCase().includes(query));
        }
        if (e.type === 'effect') {
          const p = e.payload as EffectEventPayload;
          return p.componentName.toLowerCase().includes(query);
        }
        if (e.type === 'error') {
          const p = e.payload as ErrorEventPayload;
          return p.message.toLowerCase().includes(query);
        }
        return true;
      })
      .slice().reverse();
  }, [events, filters, searchQuery]);

  const eventCounts = useMemo(() => {
    const counts: Record<TimelineEventType, number> = {
      'render': 0,
      'state-change': 0,
      'effect': 0,
      'error': 0,
      'memory': 0,
      'context-change': 0,
    };
    events.forEach(e => counts[e.type]++);
    return counts;
  }, [events]);
  
  useEffect(() => {
    if (listRef.current && scrollPositionRef.current > 0) {
      listRef.current.scrollTop = scrollPositionRef.current;
    }
  }, [filteredEvents.length]);
  
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    scrollPositionRef.current = e.currentTarget.scrollTop;
  }, []);

  const renderEventSummary = (event: TimelineEvent) => {
    const config = EVENT_CONFIG[event.type];
    
    switch (event.type) {
      case 'render': {
        const p = event.payload as RenderEventPayload;
        return (
          <span className="event-summary">
            {p.renderOrder && (
              <span className="render-order">#{p.renderOrder}</span>
            )}
            {p.fiberDepth !== undefined && (
              <span className="fiber-depth" title={`Depth: ${p.fiberDepth}`}>{'·'.repeat(Math.min(p.fiberDepth, 5))}</span>
            )}
            <strong>{p.componentName}</strong>
            {p.parentComponent && (
              <span className="parent-component">← {p.parentComponent}</span>
            )}
            <span className="event-trigger" style={{ color: config.color }}>
              {p.trigger}
            </span>
            {p.renderReasonSummary && (
              <span className="render-reason-summary" title={p.renderReasonSummary}>
                {p.renderReasonSummary}
              </span>
            )}
            {p.duration !== undefined && p.duration > 0 && (
              <span className="event-duration">{p.duration.toFixed(1)}ms</span>
            )}
          </span>
        );
      }
      case 'state-change': {
        const p = event.payload as StateChangeEventPayload;
        return (
          <span className="event-summary">
            <strong>{p.componentName || 'Unknown'}</strong>
            {p.stateName ? (
              <span className="state-name">{p.stateName}</span>
            ) : p.hookIndex !== undefined ? (
              <span className="hook-index">useState #{p.hookIndex}</span>
            ) : null}
            {p.isExtractable && p.oldValue !== undefined && p.newValue !== undefined && (
              <span className="state-change-value">
                {p.oldValue} → {p.newValue}
              </span>
            )}
            {p.actionType && <span className="action-type">{p.actionType}</span>}
          </span>
        );
      }
      case 'effect': {
        const p = event.payload as EffectEventPayload;
        return (
          <span className="event-summary">
            <strong>{p.componentName}</strong>
            <span className="effect-index">#{p.effectIndex}</span>
            <span className={`event-effect-type ${p.effectType}`}>{p.effectType}</span>
            {p.createFnPreview && (
              <span className="effect-hint" title={p.createFnPreview}>{p.createFnPreview}</span>
            )}
            {p.depsPreview && (
              <span className="effect-deps" title={`Dependencies: ${p.depsPreview}`}>{p.depsPreview}</span>
            )}
            {p.hasCleanup && <span className="effect-cleanup-badge">cleanup</span>}
          </span>
        );
      }
      case 'error': {
        const p = event.payload as ErrorEventPayload;
        return (
          <span className="event-summary event-error">
            <span className="error-type">{p.errorType}</span>
            <span className="error-message">
              {p.message.length > 60 ? p.message.slice(0, 60) + '...' : p.message}
            </span>
          </span>
        );
      }
      case 'memory': {
        const p = event.payload as MemoryEventPayload;
        return (
          <span className="event-summary">
            <span>{formatBytes(p.heapUsed)}</span>
            {p.isSpike && <span className="memory-spike">SPIKE</span>}
          </span>
        );
      }
      case 'context-change': {
        const p = event.payload as ContextChangeEventPayload;
        return (
          <span className="event-summary">
            <strong>{p.componentName}</strong>
            {p.contextType && <span className="context-type">{p.contextType}</span>}
            {p.changedKeys && p.changedKeys.length > 0 && (
              <span className="context-changed-keys">{p.changedKeys.join(', ')}</span>
            )}
          </span>
        );
      }
      default:
        return null;
    }
  };

  const renderEventDetails = (event: TimelineEvent) => {
    switch (event.type) {
      case 'render': {
        const p = event.payload as RenderEventPayload;
        return (
          <div className="event-details">
            <div className="detail-row"><strong>Component:</strong> {p.componentName}</div>
            {p.fiberDepth !== undefined && (
              <div className="detail-row"><strong>Tree Depth:</strong> {p.fiberDepth}</div>
            )}
            {p.renderOrder !== undefined && (
              <div className="detail-row"><strong>Render Order:</strong> #{p.renderOrder} in batch</div>
            )}
            {p.parentComponent && (
              <div className="detail-row"><strong>Parent:</strong> {p.parentComponent}</div>
            )}
            {p.componentPath && p.componentPath.length > 0 && (
              <div className="detail-row">
                <strong>Component Path:</strong>
                <div className="component-path">
                  {p.componentPath.map((name, i) => (
                    <span key={i}>
                      {i > 0 && <span className="path-separator">→</span>}
                      <span className={`path-item ${i === p.componentPath!.length - 1 ? 'current' : ''}`}>
                        {name}
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div className="detail-row"><strong>Trigger:</strong> {p.trigger}</div>
            {p.renderReasonSummary && (
              <div className="detail-row render-reason-box">
                <strong>Why Rendered:</strong> {p.renderReasonSummary}
              </div>
            )}
            {p.propsChanges && p.propsChanges.length > 0 && (
              <div className="detail-row">
                <strong>Props Changes:</strong>
                <div className="changes-list">
                  {p.propsChanges.map((change, i) => (
                    <div key={i} className="change-item">
                      <span className="change-key">{change.key}:</span>
                      <code className="change-old">{change.oldValue}</code>
                      <span className="change-arrow">→</span>
                      <code className="change-new">{change.newValue}</code>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {p.stateChanges && p.stateChanges.length > 0 && (
              <div className="detail-row">
                <strong>State Changes:</strong>
                <div className="changes-list">
                  {p.stateChanges.map((change, i) => (
                    <div key={i} className="change-item">
                      <span className="change-key">{change.key}:</span>
                      <code className="change-old">{change.oldValue}</code>
                      <span className="change-arrow">→</span>
                      <code className="change-new">{change.newValue}</code>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {p.changedKeys && p.changedKeys.length > 0 && !p.propsChanges && !p.stateChanges && (
              <div className="detail-row"><strong>Changed:</strong> {p.changedKeys.join(', ')}</div>
            )}
            {p.duration !== undefined && (
              <div className="detail-row"><strong>Duration:</strong> {p.duration.toFixed(2)}ms</div>
            )}
            {p.batchId && (
              <div className="detail-row"><strong>Batch ID:</strong> <code>{p.batchId}</code></div>
            )}
          </div>
        );
      }
      case 'state-change': {
        const p = event.payload as StateChangeEventPayload;
        return (
          <div className="event-details">
            <div className="detail-row"><strong>Source:</strong> {p.source}</div>
            {p.componentName && <div className="detail-row"><strong>Component:</strong> {p.componentName}</div>}
            {p.stateName && (
              <div className="detail-row"><strong>State Variable:</strong> <code>{p.stateName}</code></div>
            )}
            {p.hookIndex !== undefined && (
              <div className="detail-row"><strong>Hook Index:</strong> useState #{p.hookIndex}</div>
            )}
            {p.valueType && (
              <div className="detail-row"><strong>Type:</strong> {p.valueType}</div>
            )}
            {p.oldValue !== undefined && (
              <div className="detail-row"><strong>Old Value:</strong> <code>{p.oldValue}</code></div>
            )}
            {p.newValue !== undefined && (
              <div className="detail-row"><strong>New Value:</strong> <code>{p.newValue}</code></div>
            )}
            {p.actionType && <div className="detail-row"><strong>Action:</strong> {p.actionType}</div>}
          </div>
        );
      }
      case 'effect': {
        const p = event.payload as EffectEventPayload;
        return (
          <div className="event-details">
            <div className="detail-row"><strong>Component:</strong> {p.componentName}</div>
            <div className="detail-row"><strong>Type:</strong> {p.effectType === 'run' ? 'Effect Run' : 'Cleanup'}</div>
            <div className="detail-row"><strong>Effect Index:</strong> useEffect #{p.effectIndex}</div>
            {p.createFnPreview && (
              <div className="detail-row">
                <strong>Effect Contains:</strong> <code>{p.createFnPreview}</code>
              </div>
            )}
            {p.depsPreview && (
              <div className="detail-row">
                <strong>Dependencies:</strong> <code>{p.depsPreview}</code>
              </div>
            )}
            {p.depCount !== undefined && !p.depsPreview && (
              <div className="detail-row">
                <strong>Dependencies:</strong> {p.depCount === 0 ? 'Empty array []' : `${p.depCount} deps`}
              </div>
            )}
            {p.hasCleanup !== undefined && (
              <div className="detail-row"><strong>Has Cleanup:</strong> {p.hasCleanup ? 'Yes' : 'No'}</div>
            )}
            {p.effectTag && (
              <div className="detail-row"><strong>Effect Tag:</strong> {p.effectTag}</div>
            )}
          </div>
        );
      }
      case 'error': {
        const p = event.payload as ErrorEventPayload;
        return (
          <div className="event-details">
            <div className="detail-row"><strong>Type:</strong> {p.errorType}</div>
            <div className="detail-row"><strong>Message:</strong> {p.message}</div>
            {p.source && <div className="detail-row"><strong>Source:</strong> {p.source}:{p.lineno}</div>}
            {p.stack && <pre className="error-stack">{p.stack}</pre>}
            {p.componentStack && (
              <>
                <strong>Component Stack:</strong>
                <pre className="error-stack">{p.componentStack}</pre>
              </>
            )}
          </div>
        );
      }
      case 'memory': {
        const p = event.payload as MemoryEventPayload;
        return (
          <div className="event-details">
            <div className="detail-row"><strong>Used:</strong> {formatBytes(p.heapUsed)}</div>
            <div className="detail-row"><strong>Total:</strong> {formatBytes(p.heapTotal)}</div>
            <div className="detail-row"><strong>Limit:</strong> {formatBytes(p.heapLimit)}</div>
            {p.growthRate !== undefined && (
              <div className="detail-row"><strong>Growth Rate:</strong> {formatBytes(p.growthRate)}/s</div>
            )}
            {p.isSpike && <div className="detail-row warning">Memory spike detected!</div>}
          </div>
        );
      }
      case 'context-change': {
        const p = event.payload as ContextChangeEventPayload;
        return (
          <div className="event-details">
            <div className="detail-row"><strong>Component:</strong> {p.componentName}</div>
            {p.contextType && (
              <div className="detail-row"><strong>Context Provider:</strong> {p.contextType}</div>
            )}
            {p.changedKeys && p.changedKeys.length > 0 && (
              <div className="detail-row"><strong>Changed Keys:</strong> {p.changedKeys.join(', ')}</div>
            )}
          </div>
        );
      }
      default:
        return null;
    }
  };

  return (
    <div className="tab-panel timeline-panel">
      <div className="tab-header">
        <h2><span className="section-badge section-badge--timeline" /> Debug Timeline</h2>
        <div className="tab-header-actions">
          <span className="event-count">{events.length} events</span>
          {events.length > 0 && (
            <button className="clear-all-btn" onClick={onClear}>
              Clear All
            </button>
          )}
        </div>
      </div>

      <div className="timeline-filters">
        <div className="filter-toggles">
          {(Object.keys(EVENT_CONFIG) as TimelineEventType[]).map(type => {
            const config = EVENT_CONFIG[type];
            return (
              <button
                key={type}
                className={`filter-toggle ${filters[type] ? 'active' : ''}`}
                onClick={() => toggleFilter(type)}
                style={{ borderColor: filters[type] ? config.color : 'transparent' }}
              >
                <span className={`filter-icon ${config.iconClass}`} />
                <span className="filter-label">{config.label}</span>
                <span className="filter-count">{eventCounts[type]}</span>
              </button>
            );
          })}
        </div>
        <div className="filter-search">
          <input
            type="text"
            placeholder="Search events..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="search-input"
          />
          {(searchQuery || !Object.values(filters).every(v => v)) && (
            <button className="clear-filters-btn" onClick={clearFilters}>
              Clear
            </button>
          )}
        </div>
      </div>

      <div className="snapshot-panel">
        <div className="snapshot-header" onClick={() => setSnapshotPanelOpen(!snapshotPanelOpen)}>
          <span className="snapshot-toggle">{snapshotPanelOpen ? '▼' : '▶'}</span>
          <span className="snapshot-title">Snapshots ({snapshots.length})</span>
          <button 
            className={`snapshot-create-btn ${isCreatingSnapshot ? 'btn-loading' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              createSnapshot();
            }}
            disabled={events.filter(e => e.type === 'render').length === 0 || isCreatingSnapshot}
          >
            {isCreatingSnapshot ? <><span className="btn-spinner"></span> Creating...</> : 'Create Snapshot'}
          </button>
        </div>
        
        {snapshotPanelOpen && (
          <div className="snapshot-content">
            {snapshots.length === 0 ? (
              <div className="snapshot-empty">No snapshots yet. Click "Create Snapshot" to capture current render timeline.</div>
            ) : (
              <div className="snapshot-list">
                {snapshots.map(snapshot => (
                  <div key={snapshot.id} className={`snapshot-item ${expandedSnapshotId === snapshot.id ? 'expanded' : ''}`}>
                    <div 
                      className="snapshot-item-header"
                      onClick={() => setExpandedSnapshotId(expandedSnapshotId === snapshot.id ? null : snapshot.id)}
                    >
                      <span className="snapshot-time">
                        {new Date(snapshot.createdAt).toLocaleTimeString()}
                      </span>
                      <span className="snapshot-count">{snapshot.events.length} renders</span>
                      <div className="snapshot-actions">
                        <button 
                          className="snapshot-action-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            exportSnapshot(snapshot);
                          }}
                          title="Export as JSON"
                        >
                          Export
                        </button>
                        <button 
                          className="snapshot-action-btn delete"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteSnapshot(snapshot.id);
                          }}
                          title="Delete snapshot"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                    
                    {expandedSnapshotId === snapshot.id && (
                      <div className="snapshot-details">
                        <table className="snapshot-table">
                          <thead>
                            <tr>
                              <th>#</th>
                              <th>Component</th>
                              <th>Trigger</th>
                              <th>Duration</th>
                            </tr>
                          </thead>
                          <tbody>
                            {snapshot.events.map(event => (
                              <tr key={event.order}>
                                <td>{event.order}</td>
                                <td className="component-name">{event.componentName}</td>
                                <td><span className="trigger-badge">{event.trigger}</span></td>
                                <td>{event.duration.toFixed(2)}ms</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {filteredEvents.length === 0 ? (
        <div className="empty-state">
          <span className="empty-state-icon empty-state-icon--timer" />
          <p>{events.length === 0 ? 'No events captured yet' : 'No events match filters'}</p>
          <p className="hint">
            {events.length === 0 
              ? 'Interact with the page to see debug events.' 
              : 'Try adjusting your filters.'}
          </p>
        </div>
      ) : (
        <div className="timeline-list" ref={listRef} onScroll={handleScroll}>
          {filteredEvents.map(event => {
            const config = EVENT_CONFIG[event.type];
            const isExpanded = expandedId === event.id;
            const isSelected = selectedId === event.id;
            
            const isCorrelated = correlatedIds.has(event.id);
            
            return (
              <div 
                key={event.id} 
                className={`timeline-event ${isExpanded ? 'expanded' : ''} ${isSelected ? 'selected' : ''} ${isCorrelated ? 'correlated' : ''}`}
                style={{ borderLeftColor: config.color }}
              >
                <div 
                  className="event-header"
                  onClick={() => {
                    const newExpanded = isExpanded ? null : event.id;
                    setExpandedId(newExpanded);
                    if (newExpanded) {
                      setSelectedId(event.id);
                      fetchCorrelation(event.id);
                    } else {
                      clearCorrelation();
                    }
                  }}
                >
                  <span className={`event-icon ${config.iconClass}`} />
                  <span className="event-time">{formatTime(event.timestamp)}</span>
                  <span className="event-type" style={{ color: config.color }}>
                    {config.label}
                  </span>
                  {renderEventSummary(event)}
                  <span className="event-expand">{isExpanded ? '▼' : '▶'}</span>
                </div>
                
                {isExpanded && (
                  <>
                    {renderEventDetails(event)}
                    {isCorrelating && (
                      <div className="correlation-panel">
                        <span className="loading-text"><span className="btn-spinner"></span> Finding related events...</span>
                      </div>
                    )}
                    {!isCorrelating && correlationExplanation.length > 0 && (
                      <div className="correlation-panel">
                        <strong>Related Events:</strong>
                        <ul className="correlation-list">
                          {correlationExplanation.map((exp, i) => (
                            <li key={i}>{exp}</li>
                          ))}
                        </ul>
                        <p className="correlation-hint">
                          Highlighted events above are correlated with this event
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
