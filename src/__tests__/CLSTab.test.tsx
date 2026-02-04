import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CLSTab } from '../panel/tabs/CLSTab';
import type { CLSReport } from '../types';

const mockGoodCLSReport: CLSReport = {
  totalScore: 0.05,
  rating: 'good',
  entries: [
    {
      id: 'entry-1',
      timestamp: Date.now() - 5000,
      value: 0.02,
      hadRecentInput: false,
      sources: [{ node: 'IMG.hero-image', previousRect: null, currentRect: null }],
      cumulativeScore: 0.02,
    },
    {
      id: 'entry-2',
      timestamp: Date.now() - 3000,
      value: 0.03,
      hadRecentInput: false,
      sources: [{ node: 'DIV.banner', previousRect: null, currentRect: null }],
      cumulativeScore: 0.05,
    },
  ],
  topContributors: [
    { element: 'IMG.hero-image', totalShift: 0.03, occurrences: 2 },
    { element: 'DIV.banner', totalShift: 0.02, occurrences: 1 },
  ],
};

const mockPoorCLSReport: CLSReport = {
  totalScore: 0.35,
  rating: 'poor',
  entries: [
    {
      id: 'entry-1',
      timestamp: Date.now() - 2000,
      value: 0.15,
      hadRecentInput: false,
      sources: [{ node: 'DIV.ad-container', previousRect: null, currentRect: null }],
      cumulativeScore: 0.15,
    },
    {
      id: 'entry-2',
      timestamp: Date.now() - 1000,
      value: 0.2,
      hadRecentInput: false,
      sources: [{ node: 'IFRAME.embed', previousRect: null, currentRect: null }],
      cumulativeScore: 0.35,
    },
  ],
  topContributors: [
    { element: 'IFRAME.embed', totalShift: 0.2, occurrences: 1 },
    { element: 'DIV.ad-container', totalShift: 0.15, occurrences: 1 },
  ],
};

const mockNeedsImprovementReport: CLSReport = {
  totalScore: 0.15,
  rating: 'needs-improvement',
  entries: [],
  topContributors: [],
};

describe('CLSTab', () => {
  describe('Rendering', () => {
    it('renders tab header correctly', () => {
      render(<CLSTab report={null} />);
      expect(screen.getByText('📐 Layout Shift (CLS) Monitor')).toBeInTheDocument();
    });

    it('displays empty state when no entries', () => {
      render(<CLSTab report={null} />);
      expect(screen.getByText('No layout shifts detected yet')).toBeInTheDocument();
    });
  });

  describe('CLS Score Display', () => {
    it('displays CLS score', () => {
      render(<CLSTab report={mockGoodCLSReport} />);
      expect(screen.getByText('0.050')).toBeInTheDocument();
    });

    it('shows good rating message', () => {
      render(<CLSTab report={mockGoodCLSReport} />);
      expect(screen.getByText('🟢')).toBeInTheDocument();
      expect(screen.getByText(/Good - Meets Core Web Vitals threshold/)).toBeInTheDocument();
    });

    it('shows needs improvement rating message', () => {
      render(<CLSTab report={mockNeedsImprovementReport} />);
      expect(screen.getByText('🟡')).toBeInTheDocument();
      expect(screen.getByText(/Needs Improvement/)).toBeInTheDocument();
    });

    it('shows poor rating message', () => {
      render(<CLSTab report={mockPoorCLSReport} />);
      expect(screen.getByText('🔴')).toBeInTheDocument();
      expect(screen.getByText(/Poor - Significantly impacts user experience/)).toBeInTheDocument();
    });
  });

  describe('Score Bar', () => {
    it('renders score bar', () => {
      const { container } = render(<CLSTab report={mockGoodCLSReport} />);
      expect(container.querySelector('.cls-bar-fill')).toBeInTheDocument();
    });

    it('shows threshold markers', () => {
      render(<CLSTab report={mockGoodCLSReport} />);
      expect(screen.getByText('0.1')).toBeInTheDocument();
      expect(screen.getByText('0.25')).toBeInTheDocument();
    });
  });

  describe('Top Shift Sources', () => {
    it('displays top contributors table', () => {
      render(<CLSTab report={mockGoodCLSReport} />);
      expect(screen.getByText('Top Shift Sources')).toBeInTheDocument();
    });

    it('shows element selectors', () => {
      render(<CLSTab report={mockGoodCLSReport} />);
      expect(screen.getAllByText(/IMG.hero-image/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/DIV.banner/).length).toBeGreaterThan(0);
    });

    it('displays shift values', () => {
      render(<CLSTab report={mockGoodCLSReport} />);
      expect(screen.getByText('0.0300')).toBeInTheDocument();
      expect(screen.getByText('0.0200')).toBeInTheDocument();
    });

    it('shows occurrence counts', () => {
      render(<CLSTab report={mockGoodCLSReport} />);
      const cells = screen.getAllByRole('cell');
      const occurrenceCells = cells.filter(cell => cell.textContent === '2' || cell.textContent === '1');
      expect(occurrenceCells.length).toBeGreaterThan(0);
    });
  });

  describe('Shift Timeline', () => {
    it('displays shift timeline', () => {
      render(<CLSTab report={mockGoodCLSReport} />);
      expect(screen.getByText('Shift Timeline')).toBeInTheDocument();
    });

    it('shows individual shift entries', () => {
      render(<CLSTab report={mockGoodCLSReport} />);
      expect(screen.getAllByText(/IMG.hero-image/).length).toBeGreaterThan(0);
    });
  });

  describe('CLS Tips', () => {
    it('displays how to reduce CLS section', () => {
      render(<CLSTab report={mockGoodCLSReport} />);
      expect(screen.getByText('💡 How to Reduce CLS')).toBeInTheDocument();
    });

    it('shows specific tips', () => {
      render(<CLSTab report={mockGoodCLSReport} />);
      const tipsSection = screen.getByText('💡 How to Reduce CLS');
      expect(tipsSection).toBeInTheDocument();
    });
  });
});
