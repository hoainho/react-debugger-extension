import { useState } from 'react';
import type { Issue } from '@/types';

interface IssueCardProps {
  issue: Issue;
}

const SEVERITY_CONFIG = {
  error: { iconClass: 'indicator-dot indicator-dot--error', color: '#ff4444', label: 'Error', bgColor: 'rgba(255, 68, 68, 0.1)' },
  warning: { iconClass: 'indicator-dot indicator-dot--warning', color: '#ffaa00', label: 'Warning', bgColor: 'rgba(255, 170, 0, 0.1)' },
  info: { iconClass: 'indicator-dot indicator-dot--info', color: '#4488ff', label: 'Info', bgColor: 'rgba(68, 136, 255, 0.1)' },
};

const ISSUE_INFO: Record<string, { title: string; why: string; learnUrl?: string }> = {
  DIRECT_STATE_MUTATION: {
    title: 'Direct State Mutation',
    why: 'React cannot detect direct state mutations and will not re-render the component.',
    learnUrl: 'https://react.dev/learn/updating-objects-in-state',
  },
  MISSING_KEY: {
    title: 'Missing Key in List',
    why: 'Keys help React identify which items have changed, are added, or removed.',
    learnUrl: 'https://react.dev/learn/rendering-lists#keeping-list-items-in-order-with-key',
  },
  INDEX_AS_KEY: {
    title: 'Index Used as Key',
    why: 'Using index as key can cause issues when list items are reordered or filtered.',
    learnUrl: 'https://react.dev/learn/rendering-lists#why-does-react-need-keys',
  },
  DUPLICATE_KEY: {
    title: 'Duplicate Keys',
    why: 'Duplicate keys will cause React to incorrectly update and render components.',
    learnUrl: 'https://react.dev/learn/rendering-lists',
  },
  MISSING_CLEANUP: {
    title: 'Missing Effect Cleanup',
    why: 'Effects with subscriptions, timers, or event listeners need cleanup to prevent memory leaks.',
    learnUrl: 'https://react.dev/learn/synchronizing-with-effects#step-3-add-cleanup-if-needed',
  },
  MISSING_DEP: {
    title: 'Missing Dependencies',
    why: 'Missing dependencies can cause stale closures and bugs.',
    learnUrl: 'https://react.dev/reference/react/useEffect#specifying-reactive-dependencies',
  },
  EXTRA_DEP: {
    title: 'Unnecessary Dependencies',
    why: 'Extra dependencies can cause effects to run more often than needed.',
    learnUrl: 'https://react.dev/reference/react/useEffect#removing-unnecessary-dependencies',
  },
  INFINITE_LOOP_RISK: {
    title: 'Infinite Loop Risk',
    why: 'This effect may cause infinite re-renders if state is updated without proper guards.',
    learnUrl: 'https://react.dev/reference/react/useEffect#my-effect-runs-twice-in-strict-mode',
  },
  EXCESSIVE_RERENDERS: {
    title: 'Excessive Re-renders',
    why: 'Too many re-renders can cause performance issues and poor user experience.',
    learnUrl: 'https://react.dev/reference/react/memo',
  },
  UNNECESSARY_RERENDER: {
    title: 'Unnecessary Re-render',
    why: 'Component re-rendered when its props and state did not change.',
    learnUrl: 'https://react.dev/reference/react/useMemo',
  },
  DEV_MODE_IN_PROD: {
    title: 'Development Mode in Production',
    why: 'Running React in development mode significantly impacts performance.',
    learnUrl: 'https://react.dev/learn/react-developer-tools#development-vs-production-builds',
  },
  STALE_CLOSURE: {
    title: 'Stale Closure Detected',
    why: 'This callback was created in an earlier render and may be using outdated state or props values. This is one of the most common and hard-to-debug React bugs.',
    learnUrl: 'https://react.dev/learn/referencing-values-with-refs#differences-between-refs-and-state',
  },
  STALE_CLOSURE_RISK: {
    title: 'Potential Stale Closure',
    why: 'This async operation or event handler might capture stale values if the component re-renders before execution.',
    learnUrl: 'https://react.dev/reference/react/useCallback',
  },
};

export function IssueCard({ issue }: IssueCardProps) {
  const [expanded, setExpanded] = useState(false);

  const severity = SEVERITY_CONFIG[issue.severity];
  const info = ISSUE_INFO[issue.type] || { title: issue.type, why: '' };
  const location = issue.location;
  
  const renderCountMatch = issue.message.match(/Rendered (\d+) times/);
  const renderCount = renderCountMatch ? parseInt(renderCountMatch[1], 10) : null;

  return (
    <div
      className={`issue-card severity-${issue.severity}`}
      style={{ borderLeftColor: severity.color }}
    >
      <div className="issue-header" onClick={() => setExpanded(!expanded)}>
        <span className={`issue-icon ${severity.iconClass}`} />
        <div className="issue-info">
          <div className="issue-title-row">
            <h4 className="issue-title">{info.title}</h4>
            <span 
              className="severity-badge" 
              style={{ 
                backgroundColor: severity.bgColor, 
                color: severity.color,
                border: `1px solid ${severity.color}`
              }}
            >
              {severity.label}
            </span>
          </div>
          <div className="issue-location">
            {location?.elementType && (
              <span className="element-type">{location.elementType}</span>
            )}
            <span className="issue-component">
              in <strong>{issue.component}</strong>
            </span>
            {renderCount !== null && (
              <span className="render-count-badge" title="Renders in last second">
                {renderCount}×
              </span>
            )}
            {location?.componentPath && location.componentPath.length > 1 && (
              <span className="component-path">
                ({location.componentPath.join(' → ')})
              </span>
            )}
          </div>
        </div>
        <button className="expand-button">{expanded ? '▼' : '▶'}</button>
      </div>

      {expanded && (
        <div className="issue-details">
          <p className="issue-message">{issue.message}</p>

          {location?.childElements && location.childElements.length > 0 && (
            <div className="issue-elements">
              <strong>Affected Elements:</strong>
              <div className="elements-list">
                {location.childElements.slice(0, 10).map((el, i) => (
                  <div key={i} className={`element-item ${el.key === null ? 'missing-key' : ''}`}>
                    <span className="el-index">[{el.index}]</span>
                    <span className="el-type">{el.type}</span>
                    <span className={`el-key ${el.key === null ? 'null' : ''}`}>
                      key={el.key === null ? 'null' : `"${el.key}"`}
                    </span>
                  </div>
                ))}
                {location.childElements.length > 10 && (
                  <div className="element-item more">
                    ...and {location.childElements.length - 10} more
                  </div>
                )}
              </div>
            </div>
          )}

          {location?.closureInfo && (
            <div className="closure-info">
              <strong><span className="action-badge action-badge--search" /> Closure Timeline:</strong>
              <div className="closure-timeline">
                <div className="timeline-item created">
                  <span className="timeline-badge">Created</span>
                  <span className="timeline-detail">
                    Render #{location.closureInfo.createdAtRender}
                  </span>
                </div>
                <div className="timeline-arrow">→</div>
                <div className="timeline-item executed">
                  <span className="timeline-badge warning">Executed</span>
                  <span className="timeline-detail">
                    Render #{location.closureInfo.executedAtRender}
                  </span>
                </div>
              </div>
              
              <div className="closure-details">
                <div className="closure-row">
                  <span className="closure-label">Function:</span>
                  <code className="closure-value">{location.closureInfo.functionName}()</code>
                </div>
                <div className="closure-row">
                  <span className="closure-label">Type:</span>
                  <span className={`closure-type type-${location.closureInfo.asyncType}`}>
                    {location.closureInfo.asyncType}
                  </span>
                </div>
                <div className="closure-row">
                  <span className="closure-label">Renders behind:</span>
                  <span className="closure-stale-count">
                    {location.closureInfo.executedAtRender - location.closureInfo.createdAtRender} render(s)
                  </span>
                </div>
              </div>

              {location.closureInfo.capturedValues.length > 0 && (
                <div className="captured-values">
                  <strong>Potentially stale variables:</strong>
                  <div className="values-list">
                    {location.closureInfo.capturedValues.map((v, i) => (
                      <div key={i} className="value-item">
                        <code>{v.name}</code>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {info.why && (
            <div className="issue-why">
              <strong>Why this matters:</strong>
              <p>{info.why}</p>
            </div>
          )}

          <div className="issue-suggestion">
            <strong><span className="action-badge action-badge--suggestion" /> Suggestion:</strong>
            <p>{issue.suggestion}</p>
          </div>

          {issue.code && (
            <div className="issue-code">
              <strong>Example:</strong>
              <pre>
                <code>{issue.code}</code>
              </pre>
            </div>
          )}

          <div className="issue-actions">
            {info.learnUrl && (
              <a
                href={info.learnUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="learn-link"
              >
                <span className="action-badge action-badge--learn" /> Learn more
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
