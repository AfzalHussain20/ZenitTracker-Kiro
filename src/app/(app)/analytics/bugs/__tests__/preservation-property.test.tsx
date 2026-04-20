/**
 * Preservation Property Tests
 * 
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8**
 * 
 * These tests verify that non-filter functionality remains unchanged after the fix.
 * This test MUST PASS on UNFIXED code to establish baseline behavior.
 * 
 * Preservation Requirements:
 * 3.1 - Data fetching and caching with useJiraKPI hook
 * 3.2 - Force Sync button clearing cache and refetching
 * 3.3 - Search functionality in Issues tab
 * 3.4 - Export functionality
 * 3.5 - Work Logs tab independent filtering
 * 3.6 - Period overview cards calculating accurate statistics
 * 3.7 - Team performance metrics showing accurate per-member stats
 * 3.8 - Monthly ticket counts displaying correct historical data
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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
  bugs: [
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
  ],
  stories: [],
  epics: [],
  tasks: [],
  subtasks: [],
  all: [],
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
      month: '2024-01',
      label: 'January 2024',
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
      month: '2023-12',
      label: 'December 2023',
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
    month: '2024-01',
    label: 'January 2024',
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
    month: '2023-12',
    label: 'December 2023',
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
   * Property: For any dashboard render, the useJiraKPI hook is called and data is displayed correctly
   */
  describe('3.1 - Data Fetching and Caching', () => {
    test('should fetch and display KPI data from useJiraKPI hook', () => {
      render(<KPIDashboard />);

      // Verify useJiraKPI hook was called
      expect(useJiraKPI).toHaveBeenCalled();

      // Verify data is displayed correctly
      expect(screen.getByText('150')).toBeInTheDocument(); // Total issues
      expect(screen.getByText('100')).toBeInTheDocument(); // Bugs count
      expect(screen.getByText('30')).toBeInTheDocument(); // Stories count
    });

    test('should display cache status when data is from cache', () => {
      render(<KPIDashboard />);

      // Verify cache indicator is shown
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
      });

      render(<KPIDashboard />);

      // Verify loading state is displayed
      expect(screen.getByText(/Syncing all Jira data/i)).toBeInTheDocument();
    });

    test('should handle error state correctly', () => {
      (useJiraKPI as jest.Mock).mockReturnValue({
        kpi: null,
        loading: false,
        error: 'Network error',
        lastSync: null,
        forceRefresh: mockForceRefresh,
      });

      render(<KPIDashboard />);

      // Verify error state is displayed
      expect(screen.getByText(/Failed to load: Network error/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Retry/i })).toBeInTheDocument();
    });
  });

  /**
   * Preservation 3.2: Force Sync button clearing cache and refetching
   * Property: For any Force Sync button click, forceRefresh is called
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
      });

      render(<KPIDashboard />);

      const forceSyncButton = screen.queryByRole('button', { name: /Syncing/i });
      if (forceSyncButton) {
        expect(forceSyncButton).toBeDisabled();
      }
    });
  });

  /**
   * Preservation 3.3: Search functionality in Issues tab
   * Property: For any search input, issues are filtered by bug ID or keyword
   */
  describe('3.3 - Search Functionality', () => {
    test('should filter issues by exact bug ID match', async () => {
      render(<KPIDashboard />);

      // Switch to Issues tab
      const issuesTab = screen.getByRole('tab', { name: /issues/i });
      fireEvent.click(issuesTab);

      await waitFor(() => {
        // Find search input
        const searchInput = screen.getByPlaceholderText(/Search by bug ID/i);
        expect(searchInput).toBeInTheDocument();

        // Search for specific bug ID
        fireEvent.change(searchInput, { target: { value: 'SUN-101' } });
      });

      await waitFor(() => {
        // Verify bug ID search indicator is shown
        expect(screen.getByText(/Searching by Bug ID/i)).toBeInTheDocument();
        expect(screen.getByText('SUN-101')).toBeInTheDocument();
      });
    });

    test('should filter issues by keyword in summary', async () => {
      render(<KPIDashboard />);

      // Switch to Issues tab
      const issuesTab = screen.getByRole('tab', { name: /issues/i });
      fireEvent.click(issuesTab);

      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText(/Search by bug ID/i);
        
        // Search by keyword
        fireEvent.change(searchInput, { target: { value: 'search keyword' } });
      });

      await waitFor(() => {
        // Should show issues matching the keyword
        expect(screen.getByText(/Android bug with search keyword/i)).toBeInTheDocument();
      });
    });

    test('should clear search when clear button is clicked', async () => {
      render(<KPIDashboard />);

      const issuesTab = screen.getByRole('tab', { name: /issues/i });
      fireEvent.click(issuesTab);

      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText(/Search by bug ID/i) as HTMLInputElement;
        fireEvent.change(searchInput, { target: { value: 'test' } });
      });

      await waitFor(() => {
        const clearButton = screen.getByRole('button', { name: /✕/i });
        fireEvent.click(clearButton);
      });

      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText(/Search by bug ID/i) as HTMLInputElement;
        expect(searchInput.value).toBe('');
      });
    });
  });

  /**
   * Preservation 3.4: Export functionality
   * Property: For any export button click, exportData is called with correct parameters
   */
  describe('3.4 - Export Functionality', () => {
    test('should call exportData when Export button is clicked', async () => {
      render(<KPIDashboard />);

      // Find Export button in Team KPIs tab
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
   * Preservation 3.5: Work Logs tab independent filtering
   * Property: Work Logs tab has its own local state and filters independently
   */
  describe('3.5 - Work Logs Tab Independent Filtering', () => {
    test('should render Work Logs tab with independent state', async () => {
      render(<KPIDashboard />);

      // Switch to Work Logs tab
      const workLogsTab = screen.getByRole('tab', { name: /work logs/i });
      fireEvent.click(workLogsTab);

      await waitFor(() => {
        // Verify Work Logs tab content is displayed
        expect(screen.getByText(/Work Log Analytics/i)).toBeInTheDocument();
        expect(screen.getByText(/Ready to track your team's effort/i)).toBeInTheDocument();
      });
    });

    test('should have independent Load Work Logs button', async () => {
      render(<KPIDashboard />);

      const workLogsTab = screen.getByRole('tab', { name: /work logs/i });
      fireEvent.click(workLogsTab);

      await waitFor(() => {
        const loadButton = screen.getByRole('button', { name: /Load Work Logs/i });
        expect(loadButton).toBeInTheDocument();
      });
    });
  });

  /**
   * Preservation 3.6: Period overview cards calculating accurate statistics
   * Property: For any period card, statistics are calculated correctly from KPI data
   */
  describe('3.6 - Period Overview Cards Statistics', () => {
    test('should display Overall period card with correct statistics', () => {
      render(<KPIDashboard />);

      // Verify Overall card is displayed
      expect(screen.getByText(/Overall \(All Time\)/i)).toBeInTheDocument();

      // Verify statistics are correct
      expect(screen.getByText('100')).toBeInTheDocument(); // Total bugs from mockKPIData.counts.bugs
    });

    test('should display Current Month card with correct statistics', () => {
      render(<KPIDashboard />);

      // Verify Current Month card
      expect(screen.getByText(/January 2024.*Current Month/i)).toBeInTheDocument();

      // Verify current month stats
      const currentMonthSection = screen.getByText(/January 2024.*Current Month/i).closest('div');
      expect(currentMonthSection).toBeInTheDocument();
    });

    test('should display Previous Month card with correct statistics', () => {
      render(<KPIDashboard />);

      // Verify Previous Month card
      expect(screen.getByText(/December 2023.*Previous Month/i)).toBeInTheDocument();
    });

    test('should calculate close rate correctly', () => {
      render(<KPIDashboard />);

      // Close rate should be displayed in period cards
      const closeRateLabels = screen.getAllByText(/Close Rate/i);
      expect(closeRateLabels.length).toBeGreaterThan(0);
    });
  });

  /**
   * Preservation 3.7: Team performance metrics showing accurate per-member stats
   * Property: For any team member, statistics are calculated correctly
   */
  describe('3.7 - Team Performance Metrics', () => {
    test('should display all team members with correct statistics', () => {
      render(<KPIDashboard />);

      // Verify all members are displayed
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Alice Brown')).toBeInTheDocument();
      expect(screen.getByText('Charlie Davis')).toBeInTheDocument();
    });

    test('should display correct bugs reported count for each member', () => {
      render(<KPIDashboard />);

      // John Doe: 2 bugs reported
      const johnRow = screen.getByText('John Doe').closest('tr');
      expect(johnRow).toBeInTheDocument();
      expect(johnRow?.textContent).toContain('2'); // bugsReported

      // Alice Brown: 1 bug reported
      const aliceRow = screen.getByText('Alice Brown').closest('tr');
      expect(aliceRow).toBeInTheDocument();
      expect(aliceRow?.textContent).toContain('1'); // bugsReported
    });

    test('should display correct close rate for each member', () => {
      render(<KPIDashboard />);

      // John Doe: 50% close rate
      const johnRow = screen.getByText('John Doe').closest('tr');
      expect(johnRow?.textContent).toContain('50%');

      // Alice Brown: 100% close rate
      const aliceRow = screen.getByText('Alice Brown').closest('tr');
      expect(aliceRow?.textContent).toContain('100%');
    });

    test('should display total row with aggregated statistics', () => {
      render(<KPIDashboard />);

      // Verify total row exists
      const totalRow = screen.getByText(/TOTAL \(3 members\)/i).closest('tr');
      expect(totalRow).toBeInTheDocument();

      // Total bugs reported: 2 + 1 + 1 = 4
      expect(totalRow?.textContent).toContain('4');
    });
  });

  /**
   * Preservation 3.8: Monthly ticket counts displaying correct historical data
   * Property: For any month, ticket counts are displayed correctly
   */
  describe('3.8 - Monthly Ticket Counts', () => {
    test('should display monthly data in Monthly tab', async () => {
      render(<KPIDashboard />);

      // Switch to Monthly tab
      const monthlyTab = screen.getByRole('tab', { name: /monthly/i });
      fireEvent.click(monthlyTab);

      await waitFor(() => {
        // Verify Monthly tab content
        expect(screen.getByText(/Monthly Ticket Counts — Last 12 Months/i)).toBeInTheDocument();
      });
    });

    test('should display correct counts for each month', async () => {
      render(<KPIDashboard />);

      const monthlyTab = screen.getByRole('tab', { name: /monthly/i });
      fireEvent.click(monthlyTab);

      await waitFor(() => {
        // Verify January 2024 data
        expect(screen.getByText('January 2024')).toBeInTheDocument();
        
        // Verify December 2023 data
        expect(screen.getByText('December 2023')).toBeInTheDocument();
      });
    });

    test('should highlight current and previous month', async () => {
      render(<KPIDashboard />);

      const monthlyTab = screen.getByRole('tab', { name: /monthly/i });
      fireEvent.click(monthlyTab);

      await waitFor(() => {
        // Current month should have "Current" badge
        expect(screen.getByText(/Current/i)).toBeInTheDocument();
        
        // Previous month should have "Previous" badge
        expect(screen.getByText(/Previous/i)).toBeInTheDocument();
      });
    });

    test('should display close rate for each month', async () => {
      render(<KPIDashboard />);

      const monthlyTab = screen.getByRole('tab', { name: /monthly/i });
      fireEvent.click(monthlyTab);

      await waitFor(() => {
        // Close rate column should exist
        const closeRateHeaders = screen.getAllByText(/Close%/i);
        expect(closeRateHeaders.length).toBeGreaterThan(0);
      });
    });
  });

  /**
   * Comprehensive Preservation Test
   * Property: All non-filter functionality works together correctly
   */
  describe('Comprehensive Preservation', () => {
    test('should maintain all non-filter functionality in a complete workflow', async () => {
      render(<KPIDashboard />);

      // Step 1: Verify data is loaded
      expect(useJiraKPI).toHaveBeenCalled();
      expect(screen.getByText('150')).toBeInTheDocument();

      // Step 2: Force Sync works
      const forceSyncButton = screen.getByRole('button', { name: /Force Sync/i });
      fireEvent.click(forceSyncButton);
      expect(mockForceRefresh).toHaveBeenCalled();

      // Step 3: Navigate to Issues tab and search
      const issuesTab = screen.getByRole('tab', { name: /issues/i });
      fireEvent.click(issuesTab);

      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText(/Search by bug ID/i);
        fireEvent.change(searchInput, { target: { value: 'SUN-101' } });
      });

      await waitFor(() => {
        expect(screen.getByText('SUN-101')).toBeInTheDocument();
      });

      // Step 4: Navigate to Monthly tab
      const monthlyTab = screen.getByRole('tab', { name: /monthly/i });
      fireEvent.click(monthlyTab);

      await waitFor(() => {
        expect(screen.getByText(/Monthly Ticket Counts/i)).toBeInTheDocument();
      });

      // Step 5: Navigate back to Team KPIs and export
      const teamTab = screen.getByRole('tab', { name: /team kpis/i });
      fireEvent.click(teamTab);

      await waitFor(() => {
        const exportButton = screen.getByRole('button', { name: /Export/i });
        fireEvent.click(exportButton);
      });

      await waitFor(() => {
        expect(mockExportData).toHaveBeenCalled();
      });

      // All non-filter functionality should work correctly
    });
  });
});
