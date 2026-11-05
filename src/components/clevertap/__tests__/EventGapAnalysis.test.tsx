/**
 * Render-level smoke tests for the Event Catalog & Gap Analysis screen.
 * Verifies the three tabs and the sample-driven analysis flow.
 */

import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
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
    expect(screen.getAllByText(/Console hook/i).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /copy snippet/i })).toBeInTheDocument();
  });

  it('imports a HAR file locally and analyses the CleverTap events', async () => {
    render(<EventGapAnalysis />);
    const har = {
      log: {
        entries: [
          {
            request: {
              method: 'POST',
              url: 'https://wzrkt.com/a?t=secret',
              postData: {
                text: JSON.stringify({
                  evt: [{ evtName: 'Login', evtData: { source: 'D2C', isNewUser: false, loginStatus: 'ok' } }],
                }),
              },
            },
          },
        ],
      },
    };
    const file = new File([JSON.stringify(har)], 'session.har', { type: 'application/json' });

    fireEvent.change(screen.getByLabelText(/import har file/i), { target: { files: [file] } });

    await waitFor(() => expect(screen.getByText(/CSV Catalog/i)).toBeInTheDocument());
    expect(screen.getByText(/CleverTap request/i)).toBeInTheDocument();
    expect(screen.getAllByText('Login').length).toBeGreaterThan(0);
    // The sanitized textarea must not contain captured values or the token.
    const textarea = screen.getByPlaceholderText(/Paste anything/i) as HTMLTextAreaElement;
    expect(textarea.value).toContain('Login');
    expect(textarea.value).not.toContain('D2C');
    expect(textarea.value).not.toContain('secret');
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

  it('picks a catalog event from the searchable event-name dropdown', () => {
    render(<EventGapAnalysis />);
    const input = screen.getByLabelText(/event name for tooltip/i) as HTMLInputElement;

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'Page_' } });
    fireEvent.click(screen.getByRole('option', { name: /Page_View/i }));

    expect(input.value).toBe('Page_View');
  });

  it('analyses a full CleverTap activity-page paste in one shot', () => {
    render(<EventGapAnalysis />);
    const activityHtml = `
      <table data-user-iid="21813" class="ev_37"><tbody><tr>
        <td>11:34:39 am</td>
        <td><span style="font-weight:400">Page_View</span><br>
          <span class="label-gray">
            <span data-t="tooltip" title="previousPage">Search</span>
            <span data-t="tooltip" title="" data-original-title="appName">SunNXT</span>
          </span>
        </td>
      </tr></tbody></table>
      <table data-user-iid="21813" class="ev_58"><tbody><tr>
        <td>11:34:05 am</td>
        <td><span style="font-weight:400">Searched</span><br>
          <span class="label-gray"><span data-t="tooltip" title="searchString">singam</span></span>
        </td>
      </tr></tbody></table>
      <table data-user-iid="21813" class="ev_2"><tbody><tr>
        <td>11:22:31 am</td>
        <td><span style="font-weight:400">App Launched</span><br>
          <span class="label-gray"><span data-t="tooltip" title="CT SDK Version">70701</span></span>
        </td>
      </tr></tbody></table>`;

    fireEvent.change(screen.getByPlaceholderText(/Paste anything/i), { target: { value: activityHtml } });
    fireEvent.click(screen.getByRole('button', { name: /analyse gaps/i }));

    // Activity-page summary is shown instead of the "needs event name" error.
    expect(screen.getByText(/CleverTap activity page/i)).toBeInTheDocument();
    expect(screen.getByText(/3 unique event/i)).toBeInTheDocument();
    // Repeated/captured catalog events are analysed normally.
    expect(screen.getAllByText('Page_View').length).toBeGreaterThan(0);
    // CleverTap-generated events are clearly labelled.
    expect(screen.getAllByText(/CT system/i).length).toBeGreaterThan(0);
  });
});
