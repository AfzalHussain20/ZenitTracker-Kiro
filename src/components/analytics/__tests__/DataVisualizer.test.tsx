/**
 * Unit tests for DataVisualizer component
 * Validates: Requirements 8.1, 8.2, 8.5, 8.7
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { DataVisualizer } from '../DataVisualizer';
import { MetricCard } from '../MetricCard';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

// Mock dependencies
jest.mock('html2canvas');
jest.mock('jspdf');

describe('DataVisualizer', () => {
  const mockData = [
    { name: 'Critical', value: 10 },
    { name: 'High', value: 20 },
    { name: 'Medium', value: 30 },
    { name: 'Low', value: 15 },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render chart with title', () => {
    render(
      <DataVisualizer
        title="Bug Distribution"
        data={mockData}
        chartType="pie"
      />
    );

    expect(screen.getByText('Bug Distribution')).toBeInTheDocument();
  });

  it('should render pie chart', () => {
    const { container } = render(
      <DataVisualizer
        title="Bug Distribution"
        data={mockData}
        chartType="pie"
      />
    );

    // Check if Recharts PieChart is rendered
    expect(container.querySelector('.recharts-pie')).toBeInTheDocument();
  });

  it('should render line chart', () => {
    const { container } = render(
      <DataVisualizer
        title="Bug Trends"
        data={mockData}
        chartType="line"
      />
    );

    // Check if Recharts LineChart is rendered
    expect(container.querySelector('.recharts-line')).toBeInTheDocument();
  });

  it('should render bar chart', () => {
    const { container } = render(
      <DataVisualizer
        title="Bug Categories"
        data={mockData}
        chartType="bar"
      />
    );

    // Check if Recharts BarChart is rendered
    expect(container.querySelector('.recharts-bar')).toBeInTheDocument();
  });

  it('should show export buttons when showExport is true', () => {
    render(
      <DataVisualizer
        title="Bug Distribution"
        data={mockData}
        chartType="pie"
        showExport={true}
      />
    );

    expect(screen.getByText('PNG')).toBeInTheDocument();
    expect(screen.getByText('PDF')).toBeInTheDocument();
  });

  it('should hide export buttons when showExport is false', () => {
    render(
      <DataVisualizer
        title="Bug Distribution"
        data={mockData}
        chartType="pie"
        showExport={false}
      />
    );

    expect(screen.queryByText('PNG')).not.toBeInTheDocument();
    expect(screen.queryByText('PDF')).not.toBeInTheDocument();
  });

  it('should export to PNG when PNG button is clicked', async () => {
    const mockCanvas = {
      toDataURL: jest.fn().mockReturnValue('data:image/png;base64,mock'),
    };
    (html2canvas as jest.Mock).mockResolvedValue(mockCanvas);

    // Mock createElement and click
    const mockLink = {
      click: jest.fn(),
      download: '',
      href: '',
    };
    jest.spyOn(document, 'createElement').mockReturnValue(mockLink as any);

    render(
      <DataVisualizer
        title="Bug Distribution"
        data={mockData}
        chartType="pie"
        showExport={true}
      />
    );

    const pngButton = screen.getByText('PNG');
    fireEvent.click(pngButton);

    await new Promise(resolve => setTimeout(resolve, 100));

    expect(html2canvas).toHaveBeenCalled();
  });
});

describe('MetricCard', () => {
  it('should render metric card with title and value', () => {
    render(<MetricCard title="Total Bugs" value={100} />);

    expect(screen.getByText('Total Bugs')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
  });

  it('should render metric card with description', () => {
    render(
      <MetricCard
        title="Total Bugs"
        value={100}
        description="All bugs in the system"
      />
    );

    expect(screen.getByText('All bugs in the system')).toBeInTheDocument();
  });

  it('should render positive trend', () => {
    render(
      <MetricCard
        title="Total Bugs"
        value={100}
        trend={{ value: 10, isPositive: true }}
      />
    );

    expect(screen.getByText(/↑ 10%/)).toBeInTheDocument();
  });

  it('should render negative trend', () => {
    render(
      <MetricCard
        title="Total Bugs"
        value={100}
        trend={{ value: 5, isPositive: false }}
      />
    );

    expect(screen.getByText(/↓ 5%/)).toBeInTheDocument();
  });
});
