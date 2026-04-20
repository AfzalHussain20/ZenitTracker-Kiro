/**
 * Bug Condition Exploration Test
 * 
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8**
 * 
 * This test demonstrates all 8 bug conditions on the UNFIXED code.
 * This test MUST FAIL on unfixed code to confirm the bugs exist.
 * 
 * Bug Conditions:
 * 1. Tab clicks not filtering data correctly
 * 2. KPI metric cards not clickable or not navigating properly
 * 3. Drill-down buttons not synchronizing filter state
 * 4. No visual indicators for active filters
 * 5. Team filter not applied to Issues tab
 * 6. Member filter showing incorrect data
 * 7. Status/priority filters not matching exactly
 * 8. Filters not maintained across tab switches
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
  },
  bugs: [
    {
      id: '1',
      key: 'SUN-101',
      summary: 'Android bug 1',
      status: 'Open',
      priority: 'Highest',
      created: '2024-01-15',
      team: 'Android Team',
      reporter: { displayName: 'John Doe', accountId: 'john' },
      assignee: { displayName: 'Jane Smith', accountId: 'jane' },
      url: 'https://jira.example.com/SUN-101',
      isLive: false,
      storyPoints: null,
    },
    {
      id: '2',
      key: 'SUN-102',
      summary: 'iOS bug 1',
      status: 'Fixed',
      priority: 'High',
      created: '2024-01-16',
      team: 'iOS Team',
      reporter: { displayName: 'Alice Brown', accountId: 'alice' },
      assignee: { displayName: 'Bob Wilson', accountId: 'bob' },
      url: 'https://jira.example.com/SUN-102',
      isLive: false,
      storyPoints: null,
    },
    {
      id: '3',
      key: 'SUN-103',
      summary: 'Android bug 2',
      status: 'Inprogress',
      priority: 'Medium',
      created: '2024-01-17',
      team: 'Android Team',
      reporter: { displayName: 'John Doe', accountId: 'john' },
      assignee: { displayName: 'Charlie Davis', accountId: 'charlie' },
      url: 'https://jira.example.com/SUN-103',
      isLive: false,
      storyPoints: null,
    },
  ],
  stories: [],
  epics: [],
  tasks: [],
  all: [],
  liveTickets: [],
  people: [
    {
      userId: 'john',
      name: 'John Doe',
      teams: ['Android Team'],
      bugsReported: 2,
      bugsOpen: 1,
      bugsClosed: 1,
      bugsCritical: 1,
      ticketsAssigned: 5,
      assignedOpen: 2,
      storyPointsAssigned: 10,
      storyPointsCompleted: 5,
      storiesReported: 1,
      closeRate: 50,
      rank: 1,
      monthly: {},
    },
    {
      userId: 'alice',
      name: 'Alice Brown',
      teams: ['iOS Team'],
      bugsReported: 1,
      bugsOpen: 0,
      bugsClosed: 1,
      bugsCritical: 0,
      ticketsAssigned: 3,
      assignedOpen: 1,
      storyPointsAssigned: 8,
      storyPointsCompleted: 6,
      storiesReported: 0,
      closeRate: 100,
      rank: 2,
      monthly: {},
    },
  ],
  allTeams: ['Android Team', 'iOS Team'],
  byStatus: {
    Open: 1,
    Fixed: 1,
    Inprogress: 1,
  },
  monthly: [
    {
      month: '2024-01',
      label: 'Jan 2024',
      bugs: 3,
      stories: 0,
      epics: 0,
      tasks: 0,
      total: 3,
      open: 1,
      closed: 1,
      inProgress: 1,
      critical: 1,
      storyPoints: 0,
      liveTickets: 0,
    },
  ],
  currentMonth: {
    label: 'Jan 2024',
    bugs: 3,
    open: 1,
    closed: 1,
    inProgress: 1,
    critical: 1,
    high: 1,
  },
  previousMonth: {
    label: 'Dec 2023',
    bugs: 0,
    open: 0,
    closed: 0,
    inProgress: 0,
    critical: 0,
    high: 0,
  },
  totalStoryPoints: 0,
  liveBuildsCount: 0,
  fromCache: false,
  cacheAge: 0,
  refreshing: false,
};

describe('Bug Condition Exploration Tests', () => {
  beforeEach(() => {
    (useJiraKPI as jest.Mock).mockReturnValue({
      kpi: mockKPIData,
      loading: false,
      error: null,
      lastSync: new Date(),
      forceRefresh: jest.fn(),
    });

    (useExport as jest.Mock).mockReturnValue({
      exportData: jest.fn(),
      exporting: false,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Bug Condition 1: Tab clicks not filtering data correctly
   * Expected: When team filter is active and user switches tabs, data should be filtered by team
   * Actual (unfixed): Data shows all teams regardless of filter
   */
  test('Bug Condition 1: Tab navigation should apply team filter correctly', async () => {
    const { container } = render(<KPIDashboard />);

    // Apply team filter
    const teamFilterSelect = container.querySelector('select[value="all"]') as HTMLSelectElement;
    expect(teamFilterSelect).toBeInTheDocument();
    
    // Change to Android Team
    fireEvent.change(teamFilterSelect, { target: { value: 'Android Team' } });

    // Switch to Monthly tab
    const monthlyTab = screen.getByRole('tab', { name: /monthly/i });
    fireEvent.click(monthlyTab);

    await waitFor(() => {
      // Expected: Monthly data should be filtered to show only Android Team data
      // Actual (unfixed): Shows all teams' data
      const monthlyContent = screen.getByRole('tabpanel');
      expect(monthlyContent).toBeInTheDocument();
      
      // This assertion will FAIL on unfixed code because team filter is not applied to Monthly tab
      // The monthly data should show team name in header when filtered
      expect(monthlyContent.textContent).toContain('Android Team');
    });
  });

  /**
   * Bug Condition 2: KPI metric cards not clickable or not navigating properly
   * Expected: Clicking "Bugs" card should navigate to Issues tab with Bug filter applied
   * Actual (unfixed): Card doesn't respond to click or doesn't navigate
   */
  test('Bug Condition 2: KPI metric cards should be clickable and navigate with filters', async () => {
    const { container } = render(<KPIDashboard />);

    // Find the "Bugs" metric card in Overall Summary
    const bugsCard = screen.getByText('Bugs').closest('div[class*="CardContent"]');
    expect(bugsCard).toBeInTheDocument();

    // This assertion will FAIL on unfixed code because cards don't have click handlers
    // Expected: Card should have cursor-pointer class indicating it's clickable
    expect(bugsCard?.parentElement).toHaveClass('cursor-pointer');

    // Click the Bugs card
    if (bugsCard?.parentElement) {
      fireEvent.click(bugsCard.parentElement);
    }

    await waitFor(() => {
      // Expected: Should navigate to Issues tab
      const issuesTab = screen.getByRole('tab', { name: /issues/i });
      expect(issuesTab).toHaveAttribute('data-state', 'active');

      // Expected: Filter should be set to 'Bug'
      const bugButton = screen.getByRole('button', { name: /🐛 Bug/i });
      expect(bugButton).toHaveClass('ring-2'); // Active filter styling
    });
  });

  /**
   * Bug Condition 3: Drill-down buttons not synchronizing filter state
   * Expected: Clicking "Open" button should navigate to Issues tab with status filter set to 'open_group'
   * Actual (unfixed): Navigation occurs but filter state not synchronized
   */
  test('Bug Condition 3: Drill-down buttons should synchronize filter state', async () => {
    render(<KPIDashboard />);

    // Find and click the "Open" drill-down button in Current Month card
    const openButtons = screen.getAllByText(/open/i);
    const openDrillButton = openButtons.find(btn => 
      btn.closest('button')?.textContent?.includes('view')
    );
    
    expect(openDrillButton).toBeInTheDocument();
    
    if (openDrillButton?.closest('button')) {
      fireEvent.click(openDrillButton.closest('button')!);
    }

    await waitFor(() => {
      // Expected: Should navigate to Issues tab
      const issuesTab = screen.getByRole('tab', { name: /issues/i });
      expect(issuesTab).toHaveAttribute('data-state', 'active');

      // This assertion will FAIL on unfixed code because filter state is not synchronized
      // Expected: Status filter should be set to show open issues
      const statusFilter = screen.getByText(/All Status/i).closest('select');
      expect(statusFilter).toHaveValue('open_group');
    });
  });

  /**
   * Bug Condition 4: No visual indicators for active filters
   * Expected: When filters are applied, visual badges and highlights should appear
   * Actual (unfixed): No visual feedback for active filters
   */
  test('Bug Condition 4: Visual filter indicators should display for active filters', async () => {
    const { container } = render(<KPIDashboard />);

    // Apply team filter
    const teamFilterSelect = container.querySelector('select') as HTMLSelectElement;
    fireEvent.change(teamFilterSelect, { target: { value: 'Android Team' } });

    await waitFor(() => {
      // This assertion will FAIL on unfixed code because visual indicators are missing
      // Expected: Active filter badge should be displayed
      const filterBadge = screen.queryByText(/🏢 Android Team/i);
      expect(filterBadge).toBeInTheDocument();

      // Expected: Filter dropdown should have highlighted styling
      expect(teamFilterSelect).toHaveClass('border-primary');
      expect(teamFilterSelect).toHaveClass('bg-primary/5');

      // Expected: Count summary should show filtered member count
      const countSummary = screen.queryByText(/member.*shown.*team view/i);
      expect(countSummary).toBeInTheDocument();
    });
  });

  /**
   * Bug Condition 5: Team filter not applied to Issues tab
   * Expected: When team filter is active, Issues tab should show only that team's issues
   * Actual (unfixed): Shows all issues regardless of team filter
   */
  test('Bug Condition 5: Team filter should apply to Issues tab', async () => {
    const { container } = render(<KPIDashboard />);

    // Apply team filter to Android Team
    const teamFilterSelect = container.querySelector('select') as HTMLSelectElement;
    fireEvent.change(teamFilterSelect, { target: { value: 'Android Team' } });

    // Switch to Issues tab
    const issuesTab = screen.getByRole('tab', { name: /issues/i });
    fireEvent.click(issuesTab);

    await waitFor(() => {
      // This assertion will FAIL on unfixed code because team filter is not applied to Issues tab
      // Expected: Should show only 2 Android Team bugs (SUN-101, SUN-103)
      // Actual (unfixed): Shows all 3 bugs including iOS bug (SUN-102)
      
      const issuesList = screen.getByText(/results/i);
      expect(issuesList.textContent).toContain('2 results'); // Only Android Team bugs
      
      // iOS bug should NOT be visible
      expect(screen.queryByText('SUN-102')).not.toBeInTheDocument();
      
      // Android bugs should be visible
      expect(screen.getByText('SUN-101')).toBeInTheDocument();
      expect(screen.getByText('SUN-103')).toBeInTheDocument();
    });
  });

  /**
   * Bug Condition 6: Member filter showing incorrect data
   * Expected: When member filter is active, should show only that member's issues
   * Actual (unfixed): Shows incorrect data or all members
   */
  test('Bug Condition 6: Member filter should show correct data', async () => {
    const { container } = render(<KPIDashboard />);

    // Apply member filter to John Doe
    const selects = container.querySelectorAll('select');
    const memberFilterSelect = Array.from(selects).find(select => 
      select.querySelector('option[value="john"]')
    ) as HTMLSelectElement;
    
    expect(memberFilterSelect).toBeInTheDocument();
    fireEvent.change(memberFilterSelect, { target: { value: 'john' } });

    await waitFor(() => {
      // This assertion will FAIL on unfixed code because member filter shows incorrect data
      // Expected: Should show only 1 member (John Doe) in the team performance table
      // Actual (unfixed): Shows all members or incorrect subset
      
      const tableRows = container.querySelectorAll('tbody tr');
      expect(tableRows).toHaveLength(1);
      
      // Should show John Doe's data
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      
      // Should NOT show Alice Brown
      expect(screen.queryByText('Alice Brown')).not.toBeInTheDocument();
    });
  });

  /**
   * Bug Condition 7: Status/priority filters not matching exactly
   * Expected: When status filter is set to "Fixed", should show only Fixed issues
   * Actual (unfixed): Shows issues with various statuses
   */
  test('Bug Condition 7: Status and priority filters should match exactly', async () => {
    const { container } = render(<KPIDashboard />);

    // Switch to Issues tab
    const issuesTab = screen.getByRole('tab', { name: /issues/i });
    fireEvent.click(issuesTab);

    await waitFor(() => {
      // Apply status filter to "Fixed"
      const statusFilterSelect = screen.getByText(/All Status/i).closest('select') as HTMLSelectElement;
      fireEvent.change(statusFilterSelect, { target: { value: 'Fixed' } });
    });

    await waitFor(() => {
      // This assertion will FAIL on unfixed code because filter doesn't match exactly
      // Expected: Should show only 1 issue with status "Fixed" (SUN-102)
      // Actual (unfixed): Shows issues with other statuses too
      
      expect(screen.getByText('SUN-102')).toBeInTheDocument();
      
      // Should NOT show Open or Inprogress issues
      expect(screen.queryByText('SUN-101')).not.toBeInTheDocument();
      expect(screen.queryByText('SUN-103')).not.toBeInTheDocument();
      
      const resultsCount = screen.getByText(/results/i);
      expect(resultsCount.textContent).toContain('1 result');
    });
  });

  /**
   * Bug Condition 8: Filters not maintained across tab switches
   * Expected: When filters are applied and user switches tabs, filters should persist
   * Actual (unfixed): Filters are lost or not applied after tab switch
   */
  test('Bug Condition 8: Filters should be maintained across tab switches', async () => {
    const { container } = render(<KPIDashboard />);

    // Apply team filter to Android Team
    const teamFilterSelect = container.querySelector('select') as HTMLSelectElement;
    fireEvent.change(teamFilterSelect, { target: { value: 'Android Team' } });

    // Verify filter is applied in Team KPIs tab
    await waitFor(() => {
      expect(screen.getByText(/Android Team/i)).toBeInTheDocument();
    });

    // Switch to Monthly tab
    const monthlyTab = screen.getByRole('tab', { name: /monthly/i });
    fireEvent.click(monthlyTab);

    await waitFor(() => {
      // This assertion will FAIL on unfixed code because filter is not maintained
      // Expected: Team filter should still be active and applied
      expect(teamFilterSelect).toHaveValue('Android Team');
    });

    // Switch back to Team KPIs tab
    const teamTab = screen.getByRole('tab', { name: /team kpis/i });
    fireEvent.click(teamTab);

    await waitFor(() => {
      // This assertion will FAIL on unfixed code because filter state is lost
      // Expected: Filter should still be active and data should be filtered
      expect(teamFilterSelect).toHaveValue('Android Team');
      
      // Should show only Android Team members
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.queryByText('Alice Brown')).not.toBeInTheDocument();
    });
  });

  /**
   * Comprehensive test: All bug conditions together
   * This test demonstrates multiple bug conditions in a realistic user workflow
   */
  test('Comprehensive: Multiple bug conditions in user workflow', async () => {
    const { container } = render(<KPIDashboard />);

    // Step 1: Apply team filter (Bug Condition 4 - no visual indicators)
    const teamFilterSelect = container.querySelector('select') as HTMLSelectElement;
    fireEvent.change(teamFilterSelect, { target: { value: 'Android Team' } });

    // Bug Condition 4: Visual indicators should appear
    await waitFor(() => {
      expect(screen.queryByText(/🏢 Android Team/i)).toBeInTheDocument();
      expect(teamFilterSelect).toHaveClass('border-primary');
    });

    // Step 2: Click Bugs metric card (Bug Condition 2 - not clickable)
    const bugsCard = screen.getByText('Bugs').closest('div[class*="CardContent"]');
    if (bugsCard?.parentElement) {
      fireEvent.click(bugsCard.parentElement);
    }

    // Bug Condition 2: Should navigate to Issues tab
    await waitFor(() => {
      const issuesTab = screen.getByRole('tab', { name: /issues/i });
      expect(issuesTab).toHaveAttribute('data-state', 'active');
    });

    // Bug Condition 5: Team filter should be applied to Issues tab
    await waitFor(() => {
      // Should show only Android Team bugs (2 bugs)
      const resultsCount = screen.getByText(/results/i);
      expect(resultsCount.textContent).toContain('2 results');
    });

    // Step 3: Switch to Monthly tab (Bug Condition 8 - filters not maintained)
    const monthlyTab = screen.getByRole('tab', { name: /monthly/i });
    fireEvent.click(monthlyTab);

    // Bug Condition 1 & 8: Team filter should persist and apply to Monthly tab
    await waitFor(() => {
      expect(teamFilterSelect).toHaveValue('Android Team');
      const monthlyContent = screen.getByRole('tabpanel');
      expect(monthlyContent.textContent).toContain('Android Team');
    });

    // This comprehensive test will FAIL on unfixed code due to multiple bug conditions
  });
});
