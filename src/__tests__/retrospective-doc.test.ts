/**
 * Retrospective doc coverage (M-F.3). Asserts the doc exists and names the key
 * shipped work. (Opening the 2027 GitHub Discussion is a humanGate.)
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const doc = resolve(repoRoot, 'docs/RETROSPECTIVE-2026.md');

describe('RETROSPECTIVE-2026.md', () => {
  it('exists and names the 4 hero detectors + MCP + UI redesign', () => {
    expect(existsSync(doc)).toBe(true);
    const text = readFileSync(doc, 'utf8');
    for (const name of ['reconciler-keys', 'hydration-mismatch', 'context-cascade', 'suspense-waterfall']) {
      expect(text).toContain(name);
    }
    expect(text).toMatch(/MCP Server/i);
    expect(text).toMatch(/UI redesign/i);
    expect(text).toMatch(/human gate/i); // documents what was gated to the maintainer
    expect(text).toMatch(/2027/); // kickoff topics
  });
});
