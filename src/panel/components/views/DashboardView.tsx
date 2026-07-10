import { useMemo } from 'react';
import type { IssueSeverity, RenderInfo, TabState } from '@/types';
import styles from './DashboardView.module.css';

export interface DashboardViewProps {
  state: TabState;
}

const SPARK_WIDTH = 300;
const SPARK_HEIGHT = 56;
const SPARK_TOP_N = 20;
const OFFENDER_TOP_N = 5;

function average(values: number[] | undefined): number | null {
  if (!values || values.length === 0) return null;
  const sum = values.reduce((total, value) => total + value, 0);
  return sum / values.length;
}

function formatMs(value: number | null): string {
  if (value == null || Number.isNaN(value)) return '—';
  return `${value.toFixed(1)}ms`;
}

function formatCount(value: number): string {
  return value.toLocaleString();
}

interface SparklineGeometry {
  areaPath: string;
  linePoints: string;
  lastPoint: readonly [number, number] | null;
}

/** Builds a hand-authored area+line sparkline path for a series of counts. */
function buildSparklineGeometry(values: number[], width: number, height: number): SparklineGeometry {
  if (values.length === 0) {
    return { areaPath: '', linePoints: '', lastPoint: null };
  }
  const max = Math.max(...values, 1);
  const padY = 4;
  const usableHeight = height - padY * 2;
  const stepX = values.length > 1 ? width / (values.length - 1) : 0;

  const coords: Array<readonly [number, number]> = values.map((value, index) => {
    const x = values.length > 1 ? index * stepX : width / 2;
    const y = height - padY - (value / max) * usableHeight;
    return [x, y] as const;
  });

  const linePoints = coords.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const firstX = coords[0][0].toFixed(1);
  const lastX = coords[coords.length - 1][0].toFixed(1);
  const areaPath =
    `M ${firstX} ${height} ` +
    coords.map(([x, y]) => `L ${x.toFixed(1)} ${y.toFixed(1)}`).join(' ') +
    ` L ${lastX} ${height} Z`;

  return { areaPath, linePoints, lastPoint: coords[coords.length - 1] };
}

interface StatTileProps {
  label: string;
  value: number;
  severity: IssueSeverity | 'total';
}

function StatTile({ label, value, severity }: StatTileProps) {
  const isMuted = value === 0;
  const tileClass = [
    styles.statTile,
    styles[`statTile-${severity}`],
    isMuted ? styles.statTileMuted : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={tileClass}>
      <span className={styles.statValue}>{formatCount(value)}</span>
      <span className={styles.statLabel}>{label}</span>
    </div>
  );
}

interface OffenderRowProps {
  render: RenderInfo;
  rank: number;
}

function OffenderRow({ render, rank }: OffenderRowProps) {
  const avgSelf = average(render.selfDurations);
  const rowClass = [styles.offenderRow, rank === 0 ? styles.offenderRowTop : ''].filter(Boolean).join(' ');

  return (
    <div className={rowClass}>
      <span className={styles.offenderRank}>#{rank + 1}</span>
      <span className={styles.offenderName} title={render.componentName}>
        {render.componentName}
      </span>
      <span className={styles.offenderCount}>{formatCount(render.renderCount)}<span className={styles.offenderUnit}>&times;</span></span>
      <span className={styles.offenderAvg}>{formatMs(avgSelf)}</span>
    </div>
  );
}

interface VitalCellProps {
  label: string;
  value: number | null;
}

function VitalCell({ label, value }: VitalCellProps) {
  return (
    <div className={styles.vitalCell}>
      <span className={styles.vitalValue}>{value == null ? '—' : formatMs(value)}</span>
      <span className={styles.vitalLabel}>{label}</span>
    </div>
  );
}

/**
 * First-screen dashboard: KPI issue counts, React/Redux status, a render-pressure
 * sparkline across the busiest tracked components, the current top offenders,
 * and (when available) a compact page-load vitals strip.
 */
export function DashboardView({ state }: DashboardViewProps) {
  const { issues, renders, reactVersion, reactMode, reduxDetected, pageLoadMetrics } = state;

  const severityCounts = useMemo(() => {
    const counts: Record<IssueSeverity, number> = { error: 0, warning: 0, info: 0 };
    for (const issue of issues) {
      counts[issue.severity] += 1;
    }
    return counts;
  }, [issues]);

  const renderList = useMemo(() => Array.from(renders.values()), [renders]);

  const topRenders = useMemo(
    () => [...renderList].sort((a, b) => b.renderCount - a.renderCount).slice(0, SPARK_TOP_N),
    [renderList],
  );

  const topOffenders = useMemo(() => topRenders.slice(0, OFFENDER_TOP_N), [topRenders]);

  const totalRendersTracked = useMemo(
    () => renderList.reduce((sum, render) => sum + render.renderCount, 0),
    [renderList],
  );

  const sparkline = useMemo(
    () => buildSparklineGeometry(topRenders.map((render) => render.renderCount), SPARK_WIDTH, SPARK_HEIGHT),
    [topRenders],
  );

  const hasVitals =
    pageLoadMetrics != null &&
    (pageLoadMetrics.fcp != null || pageLoadMetrics.lcp != null || pageLoadMetrics.ttfb != null);

  const isOverallEmpty = issues.length === 0 && renderList.length === 0;

  if (isOverallEmpty) {
    return (
      <div className={styles.dashboard}>
        <div className={styles.emptyState}>
          <span className={styles.emptyGlyph} aria-hidden="true">&#9678;</span>
          <p className={styles.emptyTitle}>No metrics captured yet</p>
          <p className={styles.emptyHint}>Interact with the page to populate metrics.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.dashboard}>
      <section className={styles.kpiRow} aria-label="Issue summary">
        <StatTile label="Errors" value={severityCounts.error} severity="error" />
        <StatTile label="Warnings" value={severityCounts.warning} severity="warning" />
        <StatTile label="Info" value={severityCounts.info} severity="info" />
        <StatTile label="Total issues" value={issues.length} severity="total" />
      </section>

      <section className={styles.statusRow} aria-label="React environment status">
        <span className={styles.reactChip}>
          <span className={styles.reactLabel}>{reactVersion ? `React ${reactVersion}` : 'React —'}</span>
          {reactMode && (
            <span
              className={`${styles.pill} ${reactMode === 'development' ? styles.pillDev : styles.pillProd}`}
            >
              {reactMode === 'development' ? 'Dev' : 'Prod'}
            </span>
          )}
        </span>
        {reduxDetected && <span className={`${styles.pill} ${styles.pillRedux}`}>Redux</span>}
      </section>

      <section className={styles.section} aria-label="Render pressure">
        <h3 className={styles.sectionHeading}>Render Pressure</h3>
        {topRenders.length > 0 ? (
          <>
            <div className={styles.sparklineWrap}>
              <svg
                className={styles.sparklineSvg}
                viewBox={`0 0 ${SPARK_WIDTH} ${SPARK_HEIGHT}`}
                preserveAspectRatio="none"
                role="img"
                aria-label="Render counts across top tracked components"
              >
                <path d={sparkline.areaPath} className={styles.sparklineArea} />
                <polyline points={sparkline.linePoints} className={styles.sparklineLine} />
                {sparkline.lastPoint && (
                  <circle
                    cx={sparkline.lastPoint[0]}
                    cy={sparkline.lastPoint[1]}
                    r={2.5}
                    className={styles.sparklineDot}
                  />
                )}
              </svg>
            </div>
            <p className={styles.sparklineCaption}>
              <span className={styles.sparklineCaptionValue}>{formatCount(totalRendersTracked)}</span> renders
              tracked across <span className={styles.sparklineCaptionValue}>{formatCount(renderList.length)}</span>{' '}
              components
            </p>
          </>
        ) : (
          <p className={styles.sparklineEmpty}>No renders captured yet.</p>
        )}
      </section>

      {topOffenders.length > 0 && (
        <section className={styles.section} aria-label="Top offenders">
          <h3 className={styles.sectionHeading}>Top Offenders</h3>
          <div className={styles.offendersList}>
            {topOffenders.map((render, index) => (
              <OffenderRow key={render.componentId} render={render} rank={index} />
            ))}
          </div>
        </section>
      )}

      {hasVitals && (
        <section className={styles.vitalsRow} aria-label="Page load vitals">
          <VitalCell label="FCP" value={pageLoadMetrics.fcp} />
          <VitalCell label="LCP" value={pageLoadMetrics.lcp} />
          <VitalCell label="TTFB" value={pageLoadMetrics.ttfb} />
        </section>
      )}
    </div>
  );
}
