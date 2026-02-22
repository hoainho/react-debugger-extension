import type { CLSReport } from '@/types';

interface CLSTabProps {
  report: CLSReport | null;
}

function getRatingColor(rating: CLSReport['rating']): string {
  switch (rating) {
    case 'good': return '#0cce6b';
    case 'needs-improvement': return '#ffa400';
    case 'poor': return '#ff4e42';
    default: return '#888';
  }
}

function getRatingBadgeClass(rating: CLSReport['rating']): string {
  switch (rating) {
    case 'good': return 'status-badge status-badge--good';
    case 'needs-improvement': return 'status-badge status-badge--warning';
    case 'poor': return 'status-badge status-badge--poor';
    default: return 'status-badge status-badge--neutral';
  }
}

export function CLSTab({ report }: CLSTabProps) {
  const score = report?.totalScore ?? 0;
  const rating = report?.rating ?? 'good';
  const percentage = Math.min(score / 0.5, 1) * 100;

  return (
    <div className="tab-panel">
      <div className="tab-header">
        <h2><span className="section-badge section-badge--cls" /> Layout Shift (CLS) Monitor</h2>
      </div>

      <section className="section cls-score-section">
        <div className="cls-score-card">
          <div className="cls-score-header">
            <span className="cls-label">Current CLS Score</span>
            <span className="cls-value" style={{ color: getRatingColor(rating) }}>
              {score.toFixed(3)}
            </span>
          </div>
          
          <div className="cls-bar-container">
            <div className="cls-bar-bg">
              <div 
                className="cls-bar-fill"
                style={{ 
                  width: `${percentage}%`,
                  backgroundColor: getRatingColor(rating)
                }}
              />
              <div className="cls-threshold cls-threshold-good" style={{ left: '20%' }}>
                <span>0.1</span>
              </div>
              <div className="cls-threshold cls-threshold-poor" style={{ left: '50%' }}>
                <span>0.25</span>
              </div>
            </div>
          </div>

          <div className="cls-rating">
            <span className={`rating-emoji ${getRatingBadgeClass(rating)}`} />
            <span className="rating-text">
              {rating === 'good' && 'Good - Meets Core Web Vitals threshold'}
              {rating === 'needs-improvement' && 'Needs Improvement - Consider optimizing'}
              {rating === 'poor' && 'Poor - Significantly impacts user experience'}
            </span>
          </div>
        </div>
      </section>

      {report && report.topContributors.length > 0 && (
        <section className="section">
          <h3>Top Shift Sources</h3>
          <div className="contributors-table">
            <table>
              <thead>
                <tr>
                  <th>Element</th>
                  <th>Total Shift</th>
                  <th>Occurrences</th>
                </tr>
              </thead>
              <tbody>
                {report.topContributors.slice(0, 10).map((contributor, index) => (
                  <tr key={index}>
                    <td className="element-selector">
                      <code>{contributor.element}</code>
                    </td>
                    <td className="shift-value">
                      {contributor.totalShift.toFixed(4)}
                    </td>
                    <td className="occurrence-count">
                      {contributor.occurrences}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {report && report.entries.length > 0 && (
        <section className="section">
          <h3>Shift Timeline</h3>
          <div className="timeline-list">
            {report.entries.slice(-20).reverse().map((entry, index) => (
              <div key={entry.id || index} className="timeline-entry">
                <span className="timeline-time">
                  {new Date(entry.timestamp).toLocaleTimeString()}
                </span>
                <span className="timeline-source">
                  {entry.sources[0]?.node || 'Unknown'}
                </span>
                <span className="timeline-value" style={{ color: getRatingColor(
                  entry.value < 0.01 ? 'good' : entry.value < 0.05 ? 'needs-improvement' : 'poor'
                )}}>
                  +{entry.value.toFixed(4)}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="section info-section">
        <h3><span className="action-badge action-badge--suggestion" /> How to Reduce CLS</h3>
        <ul className="tips-list">
          <li>Add <code>width</code> and <code>height</code> attributes to images and videos</li>
          <li>Use <code>aspect-ratio</code> CSS property for responsive media</li>
          <li>Reserve space for ads, embeds, and iframes with <code>min-height</code></li>
          <li>Preload fonts and use <code>font-display: swap</code></li>
          <li>Avoid inserting content above existing content</li>
          <li>Use CSS <code>transform</code> for animations instead of layout properties</li>
        </ul>
      </section>

      {(!report || report.entries.length === 0) && (
        <div className="empty-state">
          <span className="empty-state-icon empty-state-icon--chart" />
          <p>No layout shifts detected yet</p>
          <p className="hint">Layout shifts will be recorded as they occur.</p>
        </div>
      )}
    </div>
  );
}
