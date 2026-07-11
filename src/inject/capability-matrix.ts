/**
 * Production-mode capability matrix (M-E.4).
 *
 * Derives, per registered detector, whether it works in production builds
 * (`prodCapable`) alongside its confidence + category, from the detector
 * metadata itself — one row per detector, no hand-maintained list. Feeds the
 * README capability table and the Settings "(dev only)" badge.
 */
import type { Detector } from '../types/registry';

export interface CapabilityRow {
  id: string;
  category: string;
  confidence: string;
  prodCapable: boolean;
}

export function buildCapabilityMatrix(detectors: ReadonlyArray<Detector>): CapabilityRow[] {
  return detectors.map((d) => ({
    id: d.id,
    category: d.category,
    confidence: d.confidence,
    prodCapable: d.prodCapable,
  }));
}

/** Render the matrix as a GitHub-flavored markdown table for the README. */
export function renderCapabilityMarkdown(rows: ReadonlyArray<CapabilityRow>): string {
  const header = '| Detector | Category | Confidence | Production |\n|---|---|---|---|';
  const body = rows
    .map((r) => `| \`${r.id}\` | ${r.category} | ${r.confidence} | ${r.prodCapable ? '✅ prod' : 'dev only'} |`)
    .join('\n');
  return `${header}\n${body}\n`;
}
