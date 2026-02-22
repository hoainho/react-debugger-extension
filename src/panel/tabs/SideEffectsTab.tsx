import type { Issue } from '@/types';
import { IssueCard } from '../components/IssueCard';

interface SideEffectsTabProps {
  issues: Issue[];
}

const EFFECT_ISSUE_TYPES = ['MISSING_CLEANUP', 'MISSING_DEP', 'EXTRA_DEP', 'INFINITE_LOOP_RISK', 'STALE_CLOSURE', 'STALE_CLOSURE_RISK'];

export function SideEffectsTab({ issues }: SideEffectsTabProps) {
  const filteredIssues = issues.filter(i => EFFECT_ISSUE_TYPES.includes(i.type));

  const cleanupIssues = filteredIssues.filter(i => i.type === 'MISSING_CLEANUP');
  const depIssues = filteredIssues.filter(i => 
    i.type === 'MISSING_DEP' || i.type === 'EXTRA_DEP'
  );
  const loopIssues = filteredIssues.filter(i => i.type === 'INFINITE_LOOP_RISK');
  const staleClosureIssues = filteredIssues.filter(i => 
    i.type === 'STALE_CLOSURE' || i.type === 'STALE_CLOSURE_RISK'
  );

  return (
    <div className="tab-panel">
      <div className="tab-header">
        <h2><span className="section-badge section-badge--side-effects" /> Side Effects Analysis</h2>
        <span className="issue-count">
          {filteredIssues.length} issue{filteredIssues.length !== 1 ? 's' : ''}
        </span>
      </div>

      {filteredIssues.length === 0 ? (
        <div className="empty-state">
          <span className="empty-state-icon empty-state-icon--check" />
          <p>No side effect issues detected</p>
          <p className="hint">Your useEffect hooks look good!</p>
        </div>
      ) : (
        <>
          {cleanupIssues.length > 0 && (
            <section className="section">
              <h3><span className="indicator-dot indicator-dot--warning" /> Missing Cleanup ({cleanupIssues.length})</h3>
              <p className="section-desc">
                These effects may cause memory leaks if they have subscriptions, timers, or event listeners.
              </p>
              <div className="issues-list">
                {cleanupIssues.map(issue => (
                  <IssueCard key={issue.id} issue={issue} />
                ))}
              </div>
            </section>
          )}

          {depIssues.length > 0 && (
            <section className="section">
              <h3><span className="action-badge action-badge--learn" /> Dependency Issues ({depIssues.length})</h3>
              <p className="section-desc">
                Missing or incorrect dependencies can cause stale closures or unnecessary re-runs.
              </p>
              <div className="issues-list">
                {depIssues.map(issue => (
                  <IssueCard key={issue.id} issue={issue} />
                ))}
              </div>
            </section>
          )}

          {loopIssues.length > 0 && (
            <section className="section">
              <h3><span className="indicator-dot indicator-dot--critical" /> Infinite Loop Risk ({loopIssues.length})</h3>
              <p className="section-desc">
                These effects may cause infinite re-renders.
              </p>
              <div className="issues-list">
                {loopIssues.map(issue => (
                  <IssueCard key={issue.id} issue={issue} />
                ))}
              </div>
            </section>
          )}

          {staleClosureIssues.length > 0 && (
            <section className="section">
              <h3><span className="action-badge action-badge--search" /> Stale Closures ({staleClosureIssues.length})</h3>
              <p className="section-desc">
                These callbacks may be using outdated state/props from previous renders.
                This is one of the most common and hard-to-debug React issues.
              </p>
              <div className="issues-list">
                {staleClosureIssues.map(issue => (
                  <IssueCard key={issue.id} issue={issue} />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      <section className="section info-section">
        <h3><span className="action-badge action-badge--suggestion" /> Best Practices</h3>
        <ul className="tips-list">
          <li>Always return a cleanup function when using <code>setInterval</code>, <code>addEventListener</code>, or subscriptions</li>
          <li>Include all variables used inside the effect in the dependency array</li>
          <li>Use <code>useCallback</code> for function dependencies to avoid unnecessary re-runs</li>
          <li>Consider splitting effects that have different responsibilities</li>
        </ul>
      </section>
    </div>
  );
}
