import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TimelineTab } from '../panel/tabs/TimelineTab';
import type { TimelineEvent, RenderEventPayload, StateChangeEventPayload, EffectEventPayload, ErrorEventPayload } from '../types';

const mockRenderEvent: TimelineEvent = {
  id: 'event-1',
  timestamp: Date.now(),
  type: 'render',
  payload: {
    componentName: 'UserProfile',
    componentId: 'comp-1',
    trigger: 'props',
    changedKeys: ['userId', 'name'],
    duration: 15.5,
    renderOrder: 1,
    parentComponent: 'App',
    componentPath: ['App', 'Dashboard', 'UserProfile'],
  } as RenderEventPayload,
};

const mockStateChangeEvent: TimelineEvent = {
  id: 'event-2',
  timestamp: Date.now() + 100,
  type: 'state-change',
  payload: {
    source: 'local',
    componentName: 'Counter',
    hookIndex: 0,
    oldValue: '5',
    newValue: '6',
    valueType: 'number',
    isExtractable: true,
  } as StateChangeEventPayload,
};

const mockEffectEvent: TimelineEvent = {
  id: 'event-3',
  timestamp: Date.now() + 200,
  type: 'effect',
  payload: {
    componentName: 'DataFetcher',
    effectType: 'run',
    effectIndex: 0,
    depCount: 2,
    hasCleanup: true,
  } as EffectEventPayload,
};

const mockErrorEvent: TimelineEvent = {
  id: 'event-4',
  timestamp: Date.now() + 300,
  type: 'error',
  payload: {
    errorType: 'js-error',
    message: 'Cannot read property "name" of undefined',
    stack: 'Error: Cannot read property...',
    source: 'app.js',
    lineno: 42,
  } as ErrorEventPayload,
};

const mockEvents: TimelineEvent[] = [
  mockRenderEvent,
  mockStateChangeEvent,
  mockEffectEvent,
  mockErrorEvent,
];

describe('TimelineTab', () => {
  const mockOnClear = vi.fn();
  const mockTabId = 1;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders tab header correctly', () => {
      render(<TimelineTab events={[]} tabId={mockTabId} onClear={mockOnClear} />);
      expect(screen.getByText('⏱️ Debug Timeline')).toBeInTheDocument();
    });

    it('displays event count', () => {
      render(<TimelineTab events={mockEvents} tabId={mockTabId} onClear={mockOnClear} />);
      expect(screen.getByText('4 events')).toBeInTheDocument();
    });

    it('displays empty state when no events', () => {
      render(<TimelineTab events={[]} tabId={mockTabId} onClear={mockOnClear} />);
      expect(screen.getByText('No events captured yet')).toBeInTheDocument();
    });
  });

  describe('Event Filters', () => {
    it('renders all filter buttons', () => {
      render(<TimelineTab events={mockEvents} tabId={mockTabId} onClear={mockOnClear} />);
      
      expect(screen.getAllByText(/Render/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/State/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Effect/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Error/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Memory/).length).toBeGreaterThan(0);
    });

    it('shows filter counts', () => {
      render(<TimelineTab events={mockEvents} tabId={mockTabId} onClear={mockOnClear} />);
      
      const filterButtons = screen.getAllByRole('button');
      const renderFilter = filterButtons.find(btn => btn.textContent?.includes('Render'));
      expect(renderFilter?.textContent).toContain('1');
    });

    it('toggles filter when clicked', () => {
      render(<TimelineTab events={mockEvents} tabId={mockTabId} onClear={mockOnClear} />);
      
      const filterToggles = document.querySelectorAll('.filter-toggle');
      const renderFilter = Array.from(filterToggles).find(el => el.textContent?.includes('Render'));
      if (renderFilter) {
        fireEvent.click(renderFilter);
      }
      expect(filterToggles.length).toBeGreaterThan(0);
    });
  });

  describe('Event Display', () => {
    it('displays render events correctly', () => {
      render(<TimelineTab events={[mockRenderEvent]} tabId={mockTabId} onClear={mockOnClear} />);
      
      expect(screen.getByText('UserProfile')).toBeInTheDocument();
      expect(screen.getByText('props')).toBeInTheDocument();
    });

    it('displays state change events correctly', () => {
      render(<TimelineTab events={[mockStateChangeEvent]} tabId={mockTabId} onClear={mockOnClear} />);
      
      expect(screen.getByText('Counter')).toBeInTheDocument();
    });

    it('displays effect events correctly', () => {
      render(<TimelineTab events={[mockEffectEvent]} tabId={mockTabId} onClear={mockOnClear} />);
      
      expect(screen.getByText('DataFetcher')).toBeInTheDocument();
      expect(screen.getByText('run')).toBeInTheDocument();
    });

    it('displays error events correctly', () => {
      render(<TimelineTab events={[mockErrorEvent]} tabId={mockTabId} onClear={mockOnClear} />);
      
      expect(screen.getByText('js-error')).toBeInTheDocument();
    });
  });

  describe('Event Expansion', () => {
    it('expands event when clicked', () => {
      render(<TimelineTab events={[mockRenderEvent]} tabId={mockTabId} onClear={mockOnClear} />);
      
      const eventHeader = screen.getByText('UserProfile').closest('.event-header');
      if (eventHeader) {
        fireEvent.click(eventHeader);
        expect(screen.getByText('Component:')).toBeInTheDocument();
        expect(screen.getByText('Trigger:')).toBeInTheDocument();
      }
    });

    it('shows component path in expanded view', () => {
      render(<TimelineTab events={[mockRenderEvent]} tabId={mockTabId} onClear={mockOnClear} />);
      
      const eventHeader = screen.getByText('UserProfile').closest('.event-header');
      if (eventHeader) {
        fireEvent.click(eventHeader);
        expect(screen.getByText('Component Path:')).toBeInTheDocument();
      }
    });
  });

  describe('Search', () => {
    it('renders search input', () => {
      render(<TimelineTab events={mockEvents} tabId={mockTabId} onClear={mockOnClear} />);
      expect(screen.getByPlaceholderText('Search events...')).toBeInTheDocument();
    });

    it('filters events by search query', () => {
      render(<TimelineTab events={mockEvents} tabId={mockTabId} onClear={mockOnClear} />);
      
      const searchInput = screen.getByPlaceholderText('Search events...');
      fireEvent.change(searchInput, { target: { value: 'Counter' } });
      
      expect(screen.getByText('Counter')).toBeInTheDocument();
      expect(screen.queryByText('UserProfile')).not.toBeInTheDocument();
    });
  });

  describe('Snapshots', () => {
    it('renders snapshot panel', () => {
      render(<TimelineTab events={mockEvents} tabId={mockTabId} onClear={mockOnClear} />);
      expect(screen.getByText(/Snapshots/)).toBeInTheDocument();
    });

    it('shows create snapshot button', () => {
      render(<TimelineTab events={mockEvents} tabId={mockTabId} onClear={mockOnClear} />);
      expect(screen.getByText('Create Snapshot')).toBeInTheDocument();
    });
  });

  describe('Clear All', () => {
    it('shows clear all button when events exist', () => {
      render(<TimelineTab events={mockEvents} tabId={mockTabId} onClear={mockOnClear} />);
      expect(screen.getByText('Clear All')).toBeInTheDocument();
    });

    it('calls onClear when clear button clicked', () => {
      render(<TimelineTab events={mockEvents} tabId={mockTabId} onClear={mockOnClear} />);
      
      const clearButton = screen.getByText('Clear All');
      fireEvent.click(clearButton);
      
      expect(mockOnClear).toHaveBeenCalledTimes(1);
    });
  });
});
