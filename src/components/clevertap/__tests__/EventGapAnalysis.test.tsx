/**
 * Render-level smoke tests for the Event Catalog & Gap Analysis screen.
 * Verifies the three tabs and the sample-driven analysis flow.
 */

import { render, screen, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import EventGapAnalysis from '../EventGapAnalysis';

jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

describe('EventGapAnalysis', () => {
  it('renders the catalog intro with the CSV event count', () => {
    render(<EventGapAnalysis />);
    expect(screen.getByText(/Event Catalog & Gap Analysis/i)).toBeInTheDocument();
    expect(screen.getByText(/39 CSV events/i)).toBeInTheDocument();
  });

  it('runs the built-in sample and shows the summary + table', () => {
    render(<EventGapAnalysis />);
    fireEvent.click(screen.getByRole('button', { name: /load sample/i }));

    expect(screen.getByText(/CSV Catalog/i)).toBeInTheDocument();
    expect(screen.getByText(/Prop coverage/i)).toBeInTheDocument();
    // Sample includes Page_View, which must appear in the results table.
    expect(screen.getAllByText('Page_View').length).toBeGreaterThan(0);
  });

  it('shows the catalog tab with CSV and Zenit-specific events', () => {
    render(<EventGapAnalysis />);
    fireEvent.click(screen.getByRole('button', { name: /event catalog/i }));
    expect(screen.getAllByText('Login').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Test_Case_Executed').length).toBeGreaterThan(0);
  });

  it('shows the capture guide without an API key', () => {
    render(<EventGapAnalysis />);
    fireEvent.click(screen.getByRole('button', { name: /how to capture/i }));
    expect(screen.getByText(/Getting the data without an API key/i)).toBeInTheDocument();
    expect(screen.getByText(/Browser DevTools/i)).toBeInTheDocument();
  });

  it('filters results to missing events after analysing the sample', () => {
    render(<EventGapAnalysis />);
    fireEvent.click(screen.getByRole('button', { name: /load sample/i }));

    const missingButton = screen.getByRole('button', { name: /^Missing \d+/i });
    fireEvent.click(missingButton);

    // A catalog event absent from the sample must remain visible.
    expect(screen.getAllByText('Subscription_Initiated').length).toBeGreaterThan(0);
    // A captured event from the sample should be filtered out.
    expect(screen.queryByText('Page_View')).not.toBeInTheDocument();
  });

  it('analyses a CleverTap tooltip HTML paste once the event name is set', () => {
    render(<EventGapAnalysis />);
    const html =
      '<span data-t="tooltip" title="previousPage">Profile Page</span>' +
      '<span data-t="tooltip" title="contentLanguage">Tamil</span>';

    fireEvent.change(screen.getByPlaceholderText(/Paste anything/i), { target: { value: html } });
    fireEvent.change(screen.getByLabelText(/event name for tooltip/i), { target: { value: 'Page_View' } });
    fireEvent.click(screen.getByRole('button', { name: /analyse gaps/i }));

    expect(screen.getByText(/CSV Catalog/i)).toBeInTheDocument();
    expect(screen.getAllByText('Page_View').length).toBeGreaterThan(0);
  });
});
