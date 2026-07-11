/**
 * Common components RTL coverage (S4-3). Behavior/roles/props only — the
 * visual appearance is a humanGate.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button, Card, Tooltip } from '../panel/components/common';

describe('Button', () => {
  it('renders a real button, fires onClick, honors disabled', () => {
    const onClick = vi.fn();
    const { rerender } = render(<Button onClick={onClick}>Go</Button>);
    const btn = screen.getByRole('button', { name: 'Go' });
    expect(btn).toHaveAttribute('type', 'button');
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledOnce();

    rerender(<Button onClick={onClick} disabled>Go</Button>);
    fireEvent.click(screen.getByRole('button', { name: 'Go' }));
    expect(onClick).toHaveBeenCalledOnce(); // disabled → no second call
  });

  it('applies a variant class', () => {
    render(<Button variant="primary">P</Button>);
    expect(screen.getByRole('button', { name: 'P' }).className.length).toBeGreaterThan(0);
  });
});

describe('Card', () => {
  it('renders title + children and sets the severity stripe', () => {
    render(<Card title="Perf" severity="warning">body text</Card>);
    expect(screen.getByText('Perf')).toBeInTheDocument();
    expect(screen.getByText('body text')).toBeInTheDocument();
    const section = screen.getByText('body text').closest('section');
    expect(section).toHaveAttribute('data-severity', 'warning');
    expect(section?.getAttribute('style') ?? '').toMatch(/severity-warning/);
  });

  it('renders without a title', () => {
    render(<Card>only body</Card>);
    expect(screen.getByText('only body')).toBeInTheDocument();
  });
});

describe('Tooltip', () => {
  it('shows the tooltip with role=tooltip on hover and hides on leave', () => {
    render(<Tooltip content="help text"><span>hover me</span></Tooltip>);
    expect(screen.queryByRole('tooltip')).toBeNull();
    fireEvent.mouseEnter(screen.getByText('hover me').parentElement as HTMLElement);
    expect(screen.getByRole('tooltip')).toHaveTextContent('help text');
    fireEvent.mouseLeave(screen.getByText('hover me').parentElement as HTMLElement);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });
});
