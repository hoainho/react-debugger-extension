import type { Issue } from '@/types';
import { IssueCard } from '../components/IssueCard';

interface UIStateTabProps {
  issues: Issue[];
  onClear: () => void;
}

const UI_STATE_ISSUE_TYPES = [
  'DIRECT_STATE_MUTATION',
  'MISSING_KEY',
  'INDEX_AS_KEY',
  'DUPLICATE_KEY',
];

export function UIStateTab({ issues, onClear }: UIStateTabProps) {
  const filteredIssues = issues.filter(i => UI_STATE_ISSUE_TYPES.includes(i.type));

  return (
    <div className="tab-panel">
      <div className="tab-header">
        <h2><span className="section-badge section-badge--ui-state" /> UI & State Issues</h2>
        <div className="tab-actions">
          <span className="issue-count">
            {filteredIssues.length} issue{filteredIssues.length !== 1 ? 's' : ''}
          </span>
          {filteredIssues.length > 0 && (
            <button className="clear-btn" onClick={onClear}>
              Clear All
            </button>
          )}
        </div>
      </div>

      {filteredIssues.length === 0 ? (
        <div className="empty-state">
          <span className="empty-state-icon empty-state-icon--check" />
          <p>No UI or state issues detected</p>
          <p className="hint">Keep coding! Issues will appear here when detected.</p>
        </div>
      ) : (
        <div className="issues-list">
          {filteredIssues.map(issue => (
            <IssueCard key={issue.id} issue={issue} />
          ))}
        </div>
      )}
    </div>
  );
}
