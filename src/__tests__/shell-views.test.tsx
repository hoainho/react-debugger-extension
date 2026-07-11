/**
 * Redesigned-shell view wiring (S4-5): MCP pairing mounts in SettingsView;
 * ProfilerView hydrates + persists snapshots via the S3 session helper.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SettingsView } from '../panel/views/SettingsView';
import { ProfilerView } from '../panel/views/ProfilerView';
import { SNAPSHOT_STORAGE_KEY } from '../panel/snapshot-persistence';

const session: Record<string, unknown> = {};
function makeArea(store: Record<string, unknown>) {
  return {
    get: vi.fn(async (k: string | string[]) => {
      const arr = Array.isArray(k) ? k : [k];
      return Object.fromEntries(arr.map((x) => [x, store[x]]));
    }),
    set: vi.fn(async (items: Record<string, unknown>) => Object.assign(store, items)),
    remove: vi.fn(async (k: string | string[]) => (Array.isArray(k) ? k : [k]).forEach((x) => delete store[x])),
  };
}
vi.stubGlobal('chrome', { storage: { session: makeArea(session), local: makeArea({}) } });

beforeEach(() => {
  Object.keys(session).forEach((k) => delete session[k]);
  window.location.hash = '';
});

describe('SettingsView', () => {
  it('mounts the MCP pairing panel (Disconnected status visible)', async () => {
    render(<SettingsView />);
    await waitFor(() => expect(screen.getByText('Disconnected')).toBeInTheDocument());
  });
});

describe('ProfilerView snapshot persistence', () => {
  it('hydrates persisted snapshots from session on mount', async () => {
    session[SNAPSHOT_STORAGE_KEY] = [{ id: 1, commits: 3 }, { id: 2, commits: 5 }];
    const { container } = render(<ProfilerView />);
    await waitFor(() =>
      expect(container.querySelector('.profiler-view')).toHaveAttribute('data-snapshot-count', '2'),
    );
  });

  it('persists a captured snapshot to session (survives a remount)', async () => {
    const first = render(<ProfilerView />);
    await waitFor(() =>
      expect(first.container.querySelector('.profiler-view')).toHaveAttribute('data-snapshot-count', '0'),
    );
    fireEvent.click(screen.getByRole('button', { name: /capture snapshot/i }));
    await waitFor(() => expect((session[SNAPSHOT_STORAGE_KEY] as unknown[])?.length).toBe(1));
    first.unmount();

    // remount → the helper rehydrates from session
    const second = render(<ProfilerView />);
    await waitFor(() =>
      expect(second.container.querySelector('.profiler-view')).toHaveAttribute('data-snapshot-count', '1'),
    );
  });
});
