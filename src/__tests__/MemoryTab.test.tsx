import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryTab } from '../panel/tabs/MemoryTab';
import type { MemoryReport } from '../types';

const mockMemoryReport: MemoryReport = {
  current: {
    timestamp: Date.now(),
    usedJSHeapSize: 50 * 1024 * 1024,
    totalJSHeapSize: 100 * 1024 * 1024,
    jsHeapSizeLimit: 200 * 1024 * 1024,
  },
  history: [
    { timestamp: Date.now() - 5000, usedJSHeapSize: 45 * 1024 * 1024, totalJSHeapSize: 95 * 1024 * 1024, jsHeapSizeLimit: 200 * 1024 * 1024 },
    { timestamp: Date.now() - 4000, usedJSHeapSize: 47 * 1024 * 1024, totalJSHeapSize: 97 * 1024 * 1024, jsHeapSizeLimit: 200 * 1024 * 1024 },
    { timestamp: Date.now() - 3000, usedJSHeapSize: 48 * 1024 * 1024, totalJSHeapSize: 98 * 1024 * 1024, jsHeapSizeLimit: 200 * 1024 * 1024 },
    { timestamp: Date.now() - 2000, usedJSHeapSize: 49 * 1024 * 1024, totalJSHeapSize: 99 * 1024 * 1024, jsHeapSizeLimit: 200 * 1024 * 1024 },
    { timestamp: Date.now() - 1000, usedJSHeapSize: 50 * 1024 * 1024, totalJSHeapSize: 100 * 1024 * 1024, jsHeapSizeLimit: 200 * 1024 * 1024 },
  ],
  growthRate: 1024 * 1024,
  peakUsage: 55 * 1024 * 1024,
  warnings: [],
  crashes: [],
};

const mockHighMemoryReport: MemoryReport = {
  current: {
    timestamp: Date.now(),
    usedJSHeapSize: 180 * 1024 * 1024,
    totalJSHeapSize: 190 * 1024 * 1024,
    jsHeapSizeLimit: 200 * 1024 * 1024,
  },
  history: [],
  growthRate: 2 * 1024 * 1024,
  peakUsage: 185 * 1024 * 1024,
  warnings: ['Memory usage is critically high (90%)', 'Rapid memory growth detected'],
  crashes: [],
};

const mockReportWithCrashes: MemoryReport = {
  ...mockMemoryReport,
  crashes: [
    {
      id: 'crash-1',
      timestamp: Date.now() - 60000,
      type: 'js-error',
      message: 'Maximum call stack size exceeded',
      stack: 'RangeError: Maximum call stack size exceeded\n    at recursiveFunction...',
      analysisHints: ['Possible infinite recursion', 'Check recursive function termination conditions'],
      memorySnapshot: {
        timestamp: Date.now() - 60000,
        usedJSHeapSize: 180 * 1024 * 1024,
        totalJSHeapSize: 195 * 1024 * 1024,
        jsHeapSizeLimit: 200 * 1024 * 1024,
      },
    },
  ],
};

describe('MemoryTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial State', () => {
    it('renders tab header correctly', () => {
      render(<MemoryTab report={null} tabId={1} />);
      expect(screen.getByText('🧠 Memory Monitor')).toBeInTheDocument();
    });

    it('shows empty state when no report', () => {
      render(<MemoryTab report={null} tabId={1} />);
      expect(screen.getByText('Memory Monitoring')).toBeInTheDocument();
      expect(screen.getByText(/Click "Start Monitoring"/)).toBeInTheDocument();
    });

    it('renders start monitoring button', () => {
      render(<MemoryTab report={null} tabId={1} />);
      expect(screen.getByText('▶️ Start Monitoring')).toBeInTheDocument();
    });
  });

  describe('With Memory Data', () => {
    it('displays current memory usage', () => {
      render(<MemoryTab report={mockMemoryReport} tabId={1} />);
      expect(screen.getAllByText(/Used Heap/).length).toBeGreaterThan(0);
      expect(screen.getAllByText('50.0 MB').length).toBeGreaterThan(0);
    });

    it('displays total heap size', () => {
      render(<MemoryTab report={mockMemoryReport} tabId={1} />);
      expect(screen.getAllByText(/Total Heap/).length).toBeGreaterThan(0);
      expect(screen.getAllByText('100.0 MB').length).toBeGreaterThan(0);
    });

    it('displays heap limit', () => {
      render(<MemoryTab report={mockMemoryReport} tabId={1} />);
      expect(screen.getByText('Heap Limit')).toBeInTheDocument();
      expect(screen.getByText('200.0 MB')).toBeInTheDocument();
    });

    it('displays peak usage', () => {
      render(<MemoryTab report={mockMemoryReport} tabId={1} />);
      expect(screen.getByText('Peak Usage')).toBeInTheDocument();
      expect(screen.getByText('55.0 MB')).toBeInTheDocument();
    });

    it('displays heap usage percentage', () => {
      render(<MemoryTab report={mockMemoryReport} tabId={1} />);
      expect(screen.getByText(/Heap Usage/)).toBeInTheDocument();
      expect(screen.getByText(/25.0%/)).toBeInTheDocument();
    });

    it('displays growth rate', () => {
      render(<MemoryTab report={mockMemoryReport} tabId={1} />);
      expect(screen.getByText('Memory Growth Rate')).toBeInTheDocument();
    });
  });

  describe('Memory Warnings', () => {
    it('displays warnings when present', () => {
      render(<MemoryTab report={mockHighMemoryReport} tabId={1} />);
      expect(screen.getByText(/Memory usage is critically high/)).toBeInTheDocument();
      expect(screen.getByText(/Rapid memory growth detected/)).toBeInTheDocument();
    });

    it('shows warning icons', () => {
      render(<MemoryTab report={mockHighMemoryReport} tabId={1} />);
      const warningIcons = screen.getAllByText('⚠️');
      expect(warningIcons.length).toBeGreaterThan(0);
    });
  });

  describe('Memory Chart', () => {
    it('renders memory timeline chart when history available', () => {
      render(<MemoryTab report={mockMemoryReport} tabId={1} />);
      expect(screen.getByText('Memory Timeline')).toBeInTheDocument();
    });

    it('shows chart legend', () => {
      render(<MemoryTab report={mockMemoryReport} tabId={1} />);
      expect(screen.getAllByText('Used Heap').length).toBeGreaterThan(0);
    });
  });

  describe('Crash Log', () => {
    it('displays crash log when crashes present', () => {
      render(<MemoryTab report={mockReportWithCrashes} tabId={1} />);
      expect(screen.getByText('Crash Log (1)')).toBeInTheDocument();
    });

    it('shows crash details', () => {
      render(<MemoryTab report={mockReportWithCrashes} tabId={1} />);
      expect(screen.getByText(/Maximum call stack size exceeded/)).toBeInTheDocument();
    });

    it('expands crash entry when clicked', () => {
      render(<MemoryTab report={mockReportWithCrashes} tabId={1} />);
      
      const crashHeader = screen.getByText(/Maximum call stack size exceeded/).closest('.crash-header');
      if (crashHeader) {
        fireEvent.click(crashHeader);
        expect(screen.getByText('Message:')).toBeInTheDocument();
      }
    });
  });

  describe('Monitoring Toggle', () => {
    it('toggles monitoring state when clicked', () => {
      render(<MemoryTab report={null} tabId={1} />);
      
      const startButton = screen.getByText('▶️ Start Monitoring');
      fireEvent.click(startButton);
      
      expect(screen.getByText('⏹️ Stop Monitoring')).toBeInTheDocument();
    });
  });

  describe('Memory Tips', () => {
    it('displays memory tips section', () => {
      render(<MemoryTab report={mockMemoryReport} tabId={1} />);
      expect(screen.getByText('Memory Tips')).toBeInTheDocument();
    });

    it('shows specific tips', () => {
      render(<MemoryTab report={mockMemoryReport} tabId={1} />);
      expect(screen.getByText(/Event listeners not removed/)).toBeInTheDocument();
      expect(screen.getByText(/Timers.*not cleared/)).toBeInTheDocument();
    });
  });
});
