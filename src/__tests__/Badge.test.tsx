/**
 * Badge common-component + CSS-Modules smoke (S4-2/S4-3).
 * Proves the CSS-Module import resolves to applied class names in the pipeline.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge } from '../panel/components/common/Badge';

describe('Badge', () => {
  it('renders children with the severity data-attr and applied CSS-module classes', () => {
    render(<Badge severity="error">Critical</Badge>);
    const el = screen.getByText('Critical');
    expect(el).toHaveAttribute('data-severity', 'error');
    expect(el.className.length).toBeGreaterThan(0); // CSS-Module class applied
  });

  it('defaults to info severity', () => {
    render(<Badge>Note</Badge>);
    expect(screen.getByText('Note')).toHaveAttribute('data-severity', 'info');
  });

  it('supports all severities', () => {
    for (const s of ['error', 'warning', 'info', 'ok'] as const) {
      const { unmount } = render(<Badge severity={s}>{s}</Badge>);
      expect(screen.getByText(s)).toHaveAttribute('data-severity', s);
      unmount();
    }
  });
});
