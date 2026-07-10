/**
 * Panel layout smoke (S4 wiring): the redesigned 5-view shell renders by
 * default and the header toggle switches to the classic 9-tab layout.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Panel } from '../panel/Panel';

const local: Record<string, unknown> = {};

vi.stubGlobal('chrome', {
  runtime: {
    id: 'testextid',
    getManifest: () => ({ version: '2.0.3' }),
    sendMessage: vi.fn(async (msg: { type: string }) => {
      if (msg.type === 'GET_STATE') {
        return { success: true, state: { reactDetected: true, reactVersion: '19.2.0', reduxDetected: true, issues: [], components: [], renders: {}, clsReport: null, reduxState: null, reduxActions: [], memoryReport: null, pageLoadMetrics: null, timelineEvents: [] } };
      }
      if (msg.type === 'GET_DEBUGGER_STATE') return { success: true, enabled: true };
      return { success: true };
    }),
    onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
  },
  devtools: { inspectedWindow: { tabId: 1, reload: vi.fn() } },
  storage: {
    local: {
      get: vi.fn(async (k: string) => ({ [k]: local[k] })),
      set: vi.fn(async (items: Record<string, unknown>) => Object.assign(local, items)),
    },
  },
});

beforeEach(() => Object.keys(local).forEach((k) => delete local[k]));

describe('Panel layout', () => {
  it('renders the redesigned 5-view shell by default', async () => {
    render(<Panel />);
    await waitFor(() => {
      for (const view of ['Dashboard', 'Profiler', 'State', 'Effects', 'Settings']) {
        expect(screen.getByRole('tab', { name: view })).toBeInTheDocument();
      }
    });
    // Dashboard is the default view → its sub-tabs show
    for (const sub of ['Overview', 'AI Analysis']) {
      expect(screen.getByRole('tab', { name: sub })).toBeInTheDocument();
    }
  });

  it('shows Profiler sub-tabs (Timeline/Performance/Memory) when Profiler is selected', async () => {
    render(<Panel />);
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Profiler' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('tab', { name: 'Profiler' }));
    await waitFor(() => {
      for (const sub of ['Timeline', 'Performance', 'Memory']) {
        expect(screen.getByRole('tab', { name: sub })).toBeInTheDocument();
      }
    });
  });

  it('switches to the classic 9-tab layout via the header toggle', async () => {
    render(<Panel />);
    await waitFor(() => expect(screen.getByRole('button', { name: /classic view/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /classic view/i }));
    // Classic tabs appear (e.g. the standalone "CLS" + "AI Analysis" + "Redux")
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'CLS' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'AI Analysis' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'UI & State' })).toBeInTheDocument();
    });
    // toggle now offers going back to the new view
    expect(screen.getByRole('button', { name: /new view/i })).toBeInTheDocument();
  });

  it('switching views changes the sub-tabs (State view → UI State / Redux)', async () => {
    render(<Panel />);
    await waitFor(() => expect(screen.getByRole('tab', { name: 'State' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('tab', { name: 'State' }));
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'UI & State' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Redux' })).toBeInTheDocument();
    });
  });
});
