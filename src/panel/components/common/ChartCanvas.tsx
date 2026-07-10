import { useId, useMemo, type CSSProperties } from 'react';
import styles from './ChartCanvas.module.css';

export interface ChartSeriesPoint {
  x?: number | string;
  y: number;
}

export type ChartCanvasVariant = 'area' | 'line' | 'bars';

export interface ChartCanvasProps {
  /** Bare numeric series, or explicit {x,y} points (x is informational only — layout is index-based). */
  data: number[] | ChartSeriesPoint[];
  /** Required accessible label describing what the chart shows. */
  ariaLabel: string;
  /** Plot height in px. @default 120 */
  height?: number;
  /** @default 'area' */
  variant?: ChartCanvasVariant;
  /** A CSS color value — normally a design-token var(). @default 'var(--accent-blue)' */
  accent?: string;
  /** Formats a raw value for the endpoint label and point tooltips. @default String(round to 2dp) */
  formatValue?: (n: number) => string;
  /** Faint horizontal gridlines + baseline. @default true */
  showGrid?: boolean;
  /** Emphasized last point (area/line only). @default true */
  showEndpoint?: boolean;
  /** Fixed scale ceiling; defaults to the series max. */
  yMax?: number;
  /** @default 'No data yet' */
  emptyLabel?: string;
}

interface PlottedPoint {
  /** 0-100, percent of plot width */
  xPct: number;
  /** 0-100, percent of plot height (0 = top) */
  yPct: number;
  value: number;
}

const GRID_FRACTIONS = [0.25, 0.5, 0.75];

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function clampPct(n: number): number {
  return Math.max(0, Math.min(100, n));
}

function defaultFormatValue(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

function toValues(data: number[] | ChartSeriesPoint[]): number[] {
  if (data.length === 0) return [];
  if (typeof data[0] === 'number') return data as number[];
  return (data as ChartSeriesPoint[]).map((p) => p.y);
}

/**
 * General-purpose inline-SVG sparkline/area/bar chart for DevTools-panel telemetry
 * (memory-over-time, render durations, event rates). No external chart deps.
 */
export function ChartCanvas({
  data,
  ariaLabel,
  height = 120,
  variant = 'area',
  accent = 'var(--accent-blue)',
  formatValue = defaultFormatValue,
  showGrid = true,
  showEndpoint = true,
  yMax,
  emptyLabel = 'No data yet',
}: ChartCanvasProps) {
  const gradientId = useId();
  const values = useMemo(() => toValues(data), [data]);

  const plotted = useMemo(() => {
    const n = values.length;
    if (n === 0) return { points: [] as PlottedPoint[], flat: false };

    const domainMin = Math.min(0, ...values);
    const domainMax = yMax ?? Math.max(...values);
    const flat = domainMax === domainMin;

    const yPctFor = (v: number): number => {
      if (flat) return 50;
      const ratio = (v - domainMin) / (domainMax - domainMin);
      return clampPct(round1(100 - ratio * 100));
    };

    if (n === 1) {
      const y = yPctFor(values[0]);
      return {
        points: [
          { xPct: 0, yPct: y, value: values[0] },
          { xPct: 100, yPct: y, value: values[0] },
        ],
        flat,
      };
    }

    const points = values.map((v, i) => ({
      xPct: round1((i / (n - 1)) * 100),
      yPct: yPctFor(v),
      value: v,
    }));
    return { points, flat };
  }, [values, yMax]);

  const points = plotted.points;
  const isEmpty = points.length === 0;
  const last = points[points.length - 1];

  const linePath = useMemo(() => {
    if (points.length === 0) return '';
    return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.xPct},${p.yPct}`).join(' ');
  }, [points]);

  const areaPath = useMemo(() => {
    if (points.length === 0) return '';
    const first = points[0];
    const lastP = points[points.length - 1];
    return `${linePath} L ${lastP.xPct},100 L ${first.xPct},100 Z`;
  }, [linePath, points]);

  const barSlotWidth = points.length > 0 ? 100 / points.length : 0;
  const barWidth = round1(barSlotWidth * 0.7);

  const endpointLabel = last ? formatValue(last.value) : '';
  const labelAlignRight = last ? last.xPct > 65 : false;
  const labelAlignBottom = last ? last.yPct < 25 : false;

  const rootStyle: CSSProperties = {
    height,
    ['--chart-accent' as string]: accent,
  };

  return (
    <div className={styles.root} style={rootStyle}>
      {isEmpty ? (
        <div className={styles.empty}>{emptyLabel}</div>
      ) : (
        <div className={styles.plot}>
          <svg
            className={styles.svg}
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            role="img"
            aria-label={ariaLabel}
          >
            <title>{ariaLabel}</title>
            {variant === 'area' && (
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" className={styles.gradStart} />
                  <stop offset="100%" className={styles.gradEnd} />
                </linearGradient>
              </defs>
            )}

            {showGrid && (
              <g className={styles.grid}>
                {GRID_FRACTIONS.map((f) => (
                  <line
                    key={f}
                    x1="0"
                    y1={round1(f * 100)}
                    x2="100"
                    y2={round1(f * 100)}
                    className={styles.gridLine}
                    vectorEffect="non-scaling-stroke"
                  />
                ))}
                <line x1="0" y1="100" x2="100" y2="100" className={styles.baseline} vectorEffect="non-scaling-stroke" />
              </g>
            )}

            {variant === 'bars' &&
              points.map((p, i) => {
                const isLast = i === points.length - 1;
                const barHeight = Math.max(0.5, round1(100 - p.yPct));
                const x = round1(p.xPct - barWidth / 2);
                return (
                  <rect
                    key={i}
                    x={Math.max(0, x)}
                    y={p.yPct}
                    width={barWidth}
                    height={barHeight}
                    rx={1.2}
                    ry={1.2}
                    className={isLast ? styles.barLast : styles.bar}
                  >
                    <title>{formatValue(p.value)}</title>
                  </rect>
                );
              })}

            {variant === 'area' && <path d={areaPath} fill={`url(#${gradientId})`} stroke="none" />}
            {(variant === 'area' || variant === 'line') && (
              <path
                d={linePath}
                fill="none"
                className={styles.line}
                vectorEffect="non-scaling-stroke"
              />
            )}
          </svg>

          {showEndpoint && variant !== 'bars' && last && (
            <div
              className={styles.endpoint}
              style={{ left: `${last.xPct}%`, top: `${last.yPct}%` }}
            >
              <span className={styles.dot} />
              <span
                className={styles.label}
                data-align-x={labelAlignRight ? 'right' : 'left'}
                data-align-y={labelAlignBottom ? 'bottom' : 'top'}
                title={endpointLabel}
              >
                {endpointLabel}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
