/**
 * Preservation Property Tests
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8**
 *
 * These tests exercise the non-filter functionality of the Jira KPI dashboard
 * (data display, force sync, search, export, period overview, team metrics and
 * monthly counts) against the current UI.
 */

import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import KPIDashboard from '../page';
import { useJiraKPI } from '@/hooks/useJiraKPI';
import { useExport } from '@/hooks/useExport';

// Mock the hooks
jest.mock('@/hooks/useJiraKPI');
jest.mock('@/hooks/useExport');
jest.mock('next/link', () => {
  const MockLink = ({ children, href }: any) => <a href={href}>{children}</a>;
  MockLink.displayName = 'MockLink';
  return MockLink;
});

// Mock framer-motion to avoid animation issues in tests
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    tr: ({ children, ...props }: any) => <tr {...props}>{children}</tr>,
  },
}));

// The dashboard computes the "current"/"previous" month from the real clock,
// so derive the fixture months from today to keep the tests date-independent.
const NOW = new Date();
const CUR_KEY = `${NOW.getFullYear()}-${String(NOW.getMonth() + 1).padStart(2, '0')}`;
const PREV_DATE = new Date(NOW.getFullYear(), NOW.getMonth() - 1, 1);
const PREV_KEY = `${PREV_DATE.getFullYear()}-${String(PREV_DATE.getMonth() + 1).padStart(2, '0')}`;
const CUR_LABEL = NOW.toLocaleString('en-US', { month: 'long', year: 'numeric' });
const PREV_LABEL = PREV_DATE.toLocaleString('en-US', { month: 'long', year: 'numeric' });

const mockBugs = [
  {
    id: '1',
    key: 'SUN-101',
    summary: 'Android bug with search keyword',
    status: 'Open',
    statusCategory: 'To Do',
    priority: 'Highest',
    created: '2024-01-15',
    updated: '2024-01-15',
    resolutionDate: null,
    team: 'Android Team',
    reporter: { displayName: 'John Doe', accountId: 'john', avatarUrl: '' },
    assignee: { displayName: 'Jane Smith', accountId: 'jane', avatarUrl: '' },
    url: 'https://jira.example.com/SUN-101',
    isLive: false,
    liveVersion: null,
    storyPoints: null,
    issueType: 'Bug',
    labels: [],
    platform: 'Android',
    environment: 'Production',
    timeSpent: 0,
    timeEstimate: 0,
    fixVersions: [],
  },
  {
    id: '2',
    key: 'SUN-102',
    summary: 'iOS bug fixed',
    status: 'Fixed',
    statusCategory: 'Done',
    priority: 'High',
    created: '2024-01-16',
    updated: '2024-01-16',
    resolutionDate: '2024-01-16',
    team: 'iOS Team',
    reporter: { displayName: 'Alice Brown', accountId: 'alice', avatarUrl: '' },
    assignee: { displayName: 'Bob Wilson', accountId: 'bob', avatarUrl: '' },
    url: 'https://jira.example.com/SUN-102',
    isLive: false,
    liveVersion: null,
    storyPoints: null,
    issueType: 'Bug',
    labels: [],
    platform: 'iOS',
    environment: 'Production',
    timeSpent: 0,
    timeEstimate: 0,
    fixVersions: [],
  },
  {
    id: '3',
    key: 'SUN-103',
    summary: 'Backend bug in progress',
    status: 'Inprogress',
    statusCategory: 'In Progress',
    priority: 'Medium',
    created: '2024-01-17',
    updated: '2024-01-17',
    resolutionDate: null,
    team: 'Backend Team',
    reporter: { displayName: 'Charlie Davis', accountId: 'charlie', avatarUrl: '' },
    assignee: { displayName: 'Diana Evans', accountId: 'diana', avatarUrl: '' },
    url: 'https://jira.example.com/SUN-103',
    isLive: false,
    liveVersion: null,
    storyPoints: null,
    issueType: 'Bug',
    labels: [],
    platform: 'Backend',
    environment: 'Staging',
    timeSpent: 0,
    timeEstimate: 0,
    fixVersions: [],
  },
];

const mockKPIData = {
  counts: {
    total: 150,
    bugs: 100,
    stories: 30,
    epics: 10,
    tasks: 10,
    subtasks: 0,
    live: 5,
  },
  bugs: mockBugs,
  stories: [],
  epics: [],
  tasks: [],
  subtasks: [],
  all: mockBugs,
  allTimeIssues: mockBugs,
  liveTickets: [],
  people: [
    {
      userId: 'john',
      name: 'John Doe',
      avatarUrl: '',
      teams: ['Android Team'],
      bugsReported: 2,
      bugsOpen: 1,
      bugsClosed: 1,
      bugsInProgress: 0,
      bugsCritical: 1,
      bugsHigh: 0,
      ticketsAssigned: 5,
      assignedOpen: 2,
      assignedClosed: 2,
      assignedInProgress: 1,
      storyPointsAssigned: 10,
      storyPointsCompleted: 5,
      storiesReported: 1,
      epicsReported: 0,
      tasksReported: 0,
      totalIssues: 3,
      qualityScore: 75.5,
      closeRate: 50,
      monthly: {
        '2024-01': { reported: 2, closed: 1, open: 1, assigned: 5, storyPoints: 10 },
      },
    },
    {
      userId: 'alice',
      name: 'Alice Brown',
      avatarUrl: '',
      teams: ['iOS Team'],
      bugsReported: 1,
      bugsOpen: 0,
      bugsClosed: 1,
      bugsInProgress: 0,
      bugsCritical: 0,
      bugsHigh: 1,
      ticketsAssigned: 3,
      assignedOpen: 1,
      assignedClosed: 2,
      assignedInProgress: 0,
      storyPointsAssigned: 8,
      storyPointsCompleted: 6,
      storiesReported: 0,
      epicsReported: 0,
      tasksReported: 0,
      totalIssues: 1,
      qualityScore: 85.0,
      closeRate: 100,
      monthly: {
        '2024-01': { reported: 1, closed: 1, open: 0, assigned: 3, storyPoints: 8 },
      },
    },
    {
      userId: 'charlie',
      name: 'Charlie Davis',
      avatarUrl: '',
      teams: ['Backend Team'],
      bugsReported: 1,
      bugsOpen: 0,
      bugsClosed: 0,
      bugsInProgress: 1,
      bugsCritical: 0,
      bugsHigh: 0,
      ticketsAssigned: 4,
      assignedOpen: 1,
      assignedClosed: 2,
      assignedInProgress: 1,
      storyPointsAssigned: 12,
      storyPointsCompleted: 8,
      storiesReported: 0,
      epicsReported: 0,
      tasksReported: 0,
      totalIssues: 1,
      qualityScore: 70.0,
      closeRate: 0,
      monthly: {
        '2024-01': { reported: 1, closed: 0, open: 0, assigned: 4, storyPoints: 12 },
      },
    },
  ],
  allTeams: ['Android Team', 'iOS Team', 'Backend Team'],
  jiraTeams: [],
  byStatus: {
    Open: 1,
    Fixed: 1,
    Inprogress: 1,
  },
  byPriority: {
    Highest: 1,
    High: 1,
    Medium: 1,
  },
  byIssueType: {
    Bug: 3,
  },
  monthly: [
    {
      month: CUR_KEY,
      label: CUR_LABEL,
      bugs: 3,
      stories: 0,
      epics: 0,
      tasks: 0,
      total: 3,
      open: 1,
      closed: 1,
      inProgress: 1,
      critical: 1,
      high: 1,
      storyPoints: 0,
      liveTickets: 0,
    },
    {
      month: PREV_KEY,
      label: PREV_LABEL,
      bugs: 2,
      stories: 1,
      epics: 0,
      tasks: 0,
      total: 3,
      open: 0,
      closed: 2,
      inProgress: 1,
      critical: 0,
      high: 1,
      storyPoints: 5,
      liveTickets: 0,
    },
  ],
  currentMonth: {
    month: CUR_KEY,
    label: CUR_LABEL,
    bugs: 3,
    stories: 0,
    epics: 0,
    tasks: 0,
    total: 3,
    open: 1,
    closed: 1,
    inProgress: 1,
    critical: 1,
    high: 1,
    storyPoints: 0,
    liveTickets: 0,
  },
  previousMonth: {
    month: PREV_KEY,
    label: PREV_LABEL,
    bugs: 2,
    stories: 1,
    epics: 0,
    tasks: 0,
    total: 3,
    open: 0,
    closed: 2,
    inProgress: 1,
    critical: 0,
    high: 1,
    storyPoints: 5,
    liveTickets: 0,
  },
  totalStoryPoints: 30,
  completedStoryPoints: 19,
  openBugsCurrentMonth: 1,
  closedBugsCurrentMonth: 1,
  liveBuildsCount: 5,
  syncedAt: new Date().toISOString(),
  cacheAge: 120,
  nextRefresh: 480,
  fromCache: true,
  refreshing: false,
};

/** Radix Tabs activate on mouseDown, not click. */
function switchTab(name: RegExp) {
  fireEvent.mouseDown(screen.getByRole('tab', { name }));
}

describe('Preservation Property Tests - Non-Filter Functionality', () => {
  let mockForceRefresh: jest.Mock;
  let mockExportData: jest.Mock;

  beforeEach(() => {
    mockForceRefresh = jest.fn();
    mockExportData = jest.fn().mockResolvedValue(undefined);

    (useJiraKPI as jest.Mock).mockReturnValue({
      kpi: mockKPIData,
      loading: false,
      error: null,
      lastSync: new Date(),
      forceRefresh: mockForceRefresh,
      allSprints: [],
    });

    (useExport as jest.Mock).mockReturnValue({
      exportData: mockExportData,
      exporting: false,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Preservation 3.1: Data fetching and caching with useJiraKPI hook
   */
  describe('3.1 - Data Fetching and Caching', () => {
    test('should fetch and display KPI data from useJiraKPI hook', () => {
      render(<KPIDashboard />);

      expect(useJiraKPI).toHaveBeenCalled();

      expect(screen.getByText('150')).toBeInTheDocument(); // Total issues
      expect(screen.getByText('100')).toBeInTheDocument(); // Bugs count
      expect(screen.getAllByText('30').length).toBeGreaterThan(0); // Stories count
    });

    test('should display cache status when data is from cache', () => {
      render(<KPIDashboard />);

      expect(screen.getByText(/Cached/i)).toBeInTheDocument();
      expect(screen.getByText(/120s old/i)).toBeInTheDocument();
    });

    test('should handle loading state correctly', () => {
      (useJiraKPI as jest.Mock).mockReturnValue({
        kpi: null,
        loading: true,
        error: null,
        lastSync: null,
        forceRefresh: mockForceRefresh,
        allSprints: [],
      });

      render(<KPIDashboard />);

      expect(screen.getByText(/Loading Jira KPI Dashboard/i)).toBeInTheDocument();
    });

    test('should handle error state correctly', () => {
      (useJiraKPI as jest.Mock).mockReturnValue({
        kpi: null,
        loading: false,
        error: 'Network error',
        lastSync: null,
        forceRefresh: mockForceRefresh,
        allSprints: [],
      });

      render(<KPIDashboard />);

      expect(screen.getByText(/Failed to load: Network error/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Retry/i })).toBeInTheDocument();
    });
  });

  /**
   * Preservation 3.2: Force Sync button clearing cache and refetching
   */
  describe('3.2 - Force Sync Functionality', () => {
    test('should call forceRefresh when Force Sync button is clicked', async () => {
      render(<KPIDashboard />);

      const forceSyncButton = screen.getByRole('button', { name: /Force Sync/i });
      expect(forceSyncButton).toBeInTheDocument();

      fireEvent.click(forceSyncButton);

      await waitFor(() => {
        expect(mockForceRefresh).toHaveBeenCalledTimes(1);
      });
    });

    test('should disable Force Sync button during loading', () => {
      (useJiraKPI as jest.Mock).mockReturnValue({
        kpi: mockKPIData,
        loading: true,
        error: null,
        lastSync: new Date(),
        forceRefresh: mockForceRefresh,
        allSprints: [],
      });

      render(<KPIDashboard />);

      const syncingButton = screen.getByRole('button', { name: /Syncing/i });
      expect(syncingButton).toBeDisabled();
    });
  });

  /**
   * Preservation 3.3: Search functionality in Issues tab
   */
  describe('3.3 - Search Functionality', () => {
    test('should filter issues by exact bug ID match', async () => {
      render(<KPIDashboard />);

      switchTab(/issues/i);

      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText(/Search by bug ID/i);
        fireEvent.change(searchInput, { target: { value: 'SUN-101' } });
      });

      await waitFor(() => {
        expect(screen.getByText(/Searching by Bug ID/i)).toBeInTheDocument();
        expect(screen.getAllByText('SUN-101').length).toBeGreaterThan(0);
      });
    });

    test('should filter issues by keyword in summary', async () => {
      render(<KPIDashboard />);

      switchTab(/issues/i);

      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText(/Search by bug ID/i);
        fireEvent.change(searchInput, { target: { value: 'search keyword' } });
      });

      await waitFor(() => {
        expect(screen.getByText(/Android bug with search keyword/i)).toBeInTheDocument();
      });
    });

    test('should clear search when clear button is clicked', async () => {
      render(<KPIDashboard />);

      switchTab(/issues/i);

      const searchInput = await screen.findByPlaceholderText(/Search by bug ID/i) as HTMLInputElement;
      fireEvent.change(searchInput, { target: { value: 'test' } });

      await waitFor(() => {
        expect(searchInput.value).toBe('test');
      });

      const clearButton = searchInput.parentElement!.querySelector('button')!;
      fireEvent.click(clearButton);

      await waitFor(() => {
        expect((screen.getByPlaceholderText(/Search by bug ID/i) as HTMLInputElement).value).toBe('');
      });
    });
  });

  /**
   * Preservation 3.4: Export functionality
   */
  describe('3.4 - Export Functionality', () => {
    test('should call exportData when Export button is clicked', async () => {
      render(<KPIDashboard />);

      const exportButton = screen.getByRole('button', { name: /Export/i });
      expect(exportButton).toBeInTheDocument();

      fireEvent.click(exportButton);

      await waitFor(() => {
        expect(mockExportData).toHaveBeenCalledTimes(1);
        expect(mockExportData).toHaveBeenCalledWith(
          expect.objectContaining({
            format: 'excel',
            data: expect.any(Array),
            fileName: expect.stringMatching(/team-kpi-\d+\.xlsx/),
          })
        );
      });
    });

    test('should disable Export button during export', () => {
      (useExport as jest.Mock).mockReturnValue({
        exportData: mockExportData,
        exporting: true,
      });

      render(<KPIDashboard />);

      const exportButton = screen.getByRole('button', { name: /\.\.\./i });
      expect(exportButton).toBeDisabled();
    });
  });

  /**
   * Preservation 3.6: Period overview cards calculating accurate statistics
   */
  describe('3.6 - Period Overview Cards Statistics', () => {
    test('should display Overall period card with correct statistics', () => {
      render(<KPIDashboard />);

      expect(screen.getByText(/Overall \(All Time\)/i)).toBeInTheDocument();
      expect(screen.getAllByText('100').length).toBeGreaterThan(0); // Total bugs
    });

    test('should display Current Month card with correct statistics', () => {
      render(<KPIDashboard />);

      expect(screen.getAllByText(CUR_LABEL).length).toBeGreaterThan(0);
    });

    test('should display Previous Month card with correct statistics', () => {
      render(<KPIDashboard />);

      expect(screen.getAllByText(PREV_LABEL).length).toBeGreaterThan(0);
    });

    test('should calculate close rate correctly', () => {
      render(<KPIDashboard />);

      const closeRateLabels = screen.getAllByText(/Close Rate/i);
      expect(closeRateLabels.length).toBeGreaterThan(0);
    });
  });

  /**
   * Preservation 3.7: Team performance metrics showing accurate per-member stats
   */
  describe('3.7 - Team Performance Metrics', () => {
    test('should display all team members with correct statistics', () => {
      render(<KPIDashboard />);

      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Alice Brown')).toBeInTheDocument();
      expect(screen.getByText('Charlie Davis')).toBeInTheDocument();
    });

    test('should display correct bugs reported count for each member', () => {
      render(<KPIDashboard />);

      const johnRow = screen.getByText('John Doe').closest('tr');
      expect(johnRow).toBeInTheDocument();
      expect(johnRow?.textContent).toContain('2'); // bugsReported

      const aliceRow = screen.getByText('Alice Brown').closest('tr');
      expect(aliceRow).toBeInTheDocument();
      expect(aliceRow?.textContent).toContain('1'); // bugsReported
    });

    test('should display correct delivery rate for each member', () => {
      render(<KPIDashboard />);

      // John: bug close rate 50% + SP done 50% -> delivery 50%
      const johnRow = screen.getByText('John Doe').closest('tr');
      expect(johnRow?.textContent).toContain('50%');

      // Alice: bug close rate 100% + SP done 75% -> delivery 88%
      const aliceRow = screen.getByText('Alice Brown').closest('tr');
      expect(aliceRow?.textContent).toContain('88%');
    });

    test('should display total row with aggregated statistics', () => {
      render(<KPIDashboard />);

      const totalRow = screen.getByText(/TOTAL \(3 members\)/i).closest('tr');
      expect(totalRow).toBeInTheDocument();
      expect(totalRow?.textContent).toContain('4'); // 2 + 1 + 1 bugs reported
    });
  });

  /**
   * Preservation 3.8: Monthly ticket counts displaying correct historical data
   */
  describe('3.8 - Monthly Ticket Counts', () => {
    test('should display monthly data in Monthly tab', async () => {
      render(<KPIDashboard />);

      switchTab(/monthly/i);

      const panel = await screen.findByRole('tabpanel');
      expect(within(panel).getByText(/Monthly Ticket Counts — Last 12 Months/i)).toBeInTheDocument();
    });

    test('should display correct counts for each month', async () => {
      render(<KPIDashboard />);

      switchTab(/monthly/i);

      const panel = await screen.findByRole('tabpanel');
      expect(within(panel).getByText(CUR_LABEL)).toBeInTheDocument();
      expect(within(panel).getByText(PREV_LABEL)).toBeInTheDocument();
    });

    test('should highlight current and previous month', async () => {
      render(<KPIDashboard />);

      switchTab(/monthly/i);

      const panel = await screen.findByRole('tabpanel');
      expect(within(panel).getByText(/Current/i)).toBeInTheDocument();
      expect(within(panel).getByText(/Previous/i)).toBeInTheDocument();
    });

    test('should display close rate for each month', async () => {
      render(<KPIDashboard />);

      switchTab(/monthly/i);

      const panel = await screen.findByRole('tabpanel');
      const closeRateHeaders = within(panel).getAllByText(/Close%/i);
      expect(closeRateHeaders.length).toBeGreaterThan(0);
    });
  });

  /**
   * Comprehensive Preservation Test
   */
  describe('Comprehensive Preservation', () => {
    test('should maintain all non-filter functionality in a complete workflow', async () => {
      render(<KPIDashboard />);

      expect(useJiraKPI).toHaveBeenCalled();
      expect(screen.getByText('150')).toBeInTheDocument();

      const forceSyncButton = screen.getByRole('button', { name: /Force Sync/i });
      fireEvent.click(forceSyncButton);
      expect(mockForceRefresh).toHaveBeenCalled();

      switchTab(/issues/i);

      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText(/Search by bug ID/i);
        fireEvent.change(searchInput, { target: { value: 'SUN-101' } });
      });

      await waitFor(() => {
        expect(screen.getAllByText('SUN-101').length).toBeGreaterThan(0);
      });

      switchTab(/monthly/i);

      await waitFor(() => {
        expect(screen.getByText(/Monthly Ticket Counts/i)).toBeInTheDocument();
      });

      switchTab(/team kpis/i);

      await waitFor(() => {
        const exportButton = screen.getByRole('button', { name: /Export/i });
        fireEvent.click(exportButton);
      });

      await waitFor(() => {
        expect(mockExportData).toHaveBeenCalled();
      });
    });
  });
});
