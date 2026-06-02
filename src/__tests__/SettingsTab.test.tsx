import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { KNOWN_DETECTORS_DEFAULTS } from '../settings/migrate';
import type { Settings } from '../settings/types';

const { readMock, writeMock, subscribeMock, getSubscribeCallback } = vi.hoisted(() => {
  let _cb: ((s: unknown) => void) | null = null;

  const readMock = vi.fn();
  const writeMock = vi.fn();
  const subscribeMock = vi.fn((cb: (s: unknown) => void) => {
    _cb = cb;
    return () => { _cb = null; };
  });

  return {
    readMock,
    writeMock,
    subscribeMock,
    getSubscribeCallback: () => _cb as ((s: Settings) => void) | null,
  };
});

vi.mock('../settings/storage', () => ({
  read: readMock,
  write: writeMock,
  subscribe: subscribeMock,
}));

import { SettingsTab } from '../panel/tabs/SettingsTab';

const makeFullSettings = (): Settings => ({
  version: 1,
  detectors: Object.fromEntries(
    KNOWN_DETECTORS_DEFAULTS.map(({ id, confidence }) => [
      id,
      { enabled: confidence === 'high' },
    ])
  ),
  perSite: {},
});

describe('SettingsTab', () => {
  beforeEach(() => {
    readMock.mockClear();
    writeMock.mockClear();
    subscribeMock.mockClear();
    readMock.mockResolvedValue(makeFullSettings());
    writeMock.mockResolvedValue(undefined);
  });

  it('C1: renders all known detectors from KNOWN_DETECTORS_DEFAULTS', async () => {
    render(<SettingsTab />);

    for (const { id } of KNOWN_DETECTORS_DEFAULTS) {
      await waitFor(() => {
        expect(screen.getByText(id)).toBeInTheDocument();
      });
    }
  });

  it('C2: confidence badge classes match detector confidence levels', async () => {
    render(<SettingsTab />);

    await waitFor(() => {
      expect(screen.getByText(KNOWN_DETECTORS_DEFAULTS[0].id)).toBeInTheDocument();
    });

    expect(document.querySelectorAll('.confidence-badge--high').length).toBeGreaterThan(0);
    expect(document.querySelectorAll('.confidence-badge--medium').length).toBeGreaterThan(0);

    for (const { id, confidence } of KNOWN_DETECTORS_DEFAULTS) {
      const idEl = screen.getByText(id);
      const row = idEl.closest('.detector-row');
      expect(row?.querySelector(`.confidence-badge--${confidence}`)).toBeTruthy();
    }
  });

  it('C3: toggling a detector calls write() with the flipped enabled value', async () => {
    const settings = makeFullSettings();
    readMock.mockResolvedValue(settings);

    render(<SettingsTab />);

    const targetDetector = KNOWN_DETECTORS_DEFAULTS[0];
    const initialEnabled = settings.detectors[targetDetector.id].enabled;

    await waitFor(() => {
      expect(screen.getByText(targetDetector.id)).toBeInTheDocument();
    });

    const toggle = document.getElementById(
      `detector-toggle-${targetDetector.id}`
    ) as HTMLInputElement;
    expect(toggle).toBeTruthy();

    fireEvent.click(toggle);

    await waitFor(() => {
      expect(writeMock).toHaveBeenCalled();
    });

    const calls = writeMock.mock.calls as [Settings][];
    const lastArg = calls[calls.length - 1][0];
    expect(lastArg.detectors[targetDetector.id].enabled).toBe(!initialEnabled);
  });

  it('C4: adding a site origin creates perSite entry with all detectors disabled', async () => {
    render(<SettingsTab />);

    await waitFor(() => {
      expect(screen.getByText(KNOWN_DETECTORS_DEFAULTS[0].id)).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText('https://app.example.com');
    fireEvent.change(input, { target: { value: 'https://myapp.io' } });

    const addBtn = screen.getByRole('button', { name: 'Add' });
    fireEvent.click(addBtn);

    await waitFor(() => {
      expect(writeMock).toHaveBeenCalled();
    });

    const calls = writeMock.mock.calls as [Settings][];
    const lastArg = calls[calls.length - 1][0];
    expect(lastArg.perSite['https://myapp.io']).toBeDefined();

    for (const { id } of KNOWN_DETECTORS_DEFAULTS) {
      expect(lastArg.perSite['https://myapp.io'].detectors?.[id]?.enabled).toBe(false);
    }
  });

  it('C5: closure-leak help icon shows exact tooltip text on hover/focus', async () => {
    render(<SettingsTab />);

    await waitFor(() => {
      expect(screen.getByText('closure-leak')).toBeInTheDocument();
    });

    const helpIcon = screen.getByRole('img', { name: 'Info' });
    expect(helpIcon).toBeTruthy();

    fireEvent.mouseEnter(helpIcon);

    await waitFor(() => {
      expect(
        screen.getByText(
          'Tracking starts when enabled. Timers created before enable are invisible to the leak detector. Reload the page to capture all timers.'
        )
      ).toBeInTheDocument();
    });

    fireEvent.mouseLeave(helpIcon);

    await waitFor(() => {
      expect(
        screen.queryByText(
          'Tracking starts when enabled. Timers created before enable are invisible to the leak detector. Reload the page to capture all timers.'
        )
      ).not.toBeInTheDocument();
    });
  });

  it('subscribes to external changes and re-renders with updated settings', async () => {
    render(<SettingsTab />);

    await waitFor(() => {
      expect(screen.getByText(KNOWN_DETECTORS_DEFAULTS[0].id)).toBeInTheDocument();
    });

    const updatedSettings: Settings = {
      ...makeFullSettings(),
      detectors: {
        ...makeFullSettings().detectors,
        [KNOWN_DETECTORS_DEFAULTS[0].id]: { enabled: false },
      },
    };

    const cb = getSubscribeCallback();
    expect(cb).toBeTruthy();
    cb!(updatedSettings);

    await waitFor(() => {
      const toggle = document.getElementById(
        `detector-toggle-${KNOWN_DETECTORS_DEFAULTS[0].id}`
      ) as HTMLInputElement;
      expect(toggle.checked).toBe(false);
    });
  });

  it('remove site override button calls write() without that origin', async () => {
    const settingsWithSite: Settings = {
      ...makeFullSettings(),
      perSite: {
        'https://to-remove.com': {
          detectors: Object.fromEntries(
            KNOWN_DETECTORS_DEFAULTS.map(({ id }) => [id, { enabled: false }])
          ),
        },
      },
    };
    readMock.mockResolvedValue(settingsWithSite);

    render(<SettingsTab />);

    await waitFor(() => {
      expect(screen.getByText('https://to-remove.com')).toBeInTheDocument();
    });

    const removeBtn = screen.getByRole('button', {
      name: 'Remove site override for https://to-remove.com',
    });
    fireEvent.click(removeBtn);

    await waitFor(() => {
      expect(writeMock).toHaveBeenCalled();
    });

    const calls = writeMock.mock.calls as [Settings][];
    const lastArg = calls[calls.length - 1][0];
    expect(lastArg.perSite['https://to-remove.com']).toBeUndefined();
  });
});
