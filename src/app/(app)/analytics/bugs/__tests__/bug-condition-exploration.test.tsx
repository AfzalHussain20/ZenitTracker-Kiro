/**
 * Jira KPI Dashboard — Filter Behaviour
 *
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8**
 *
 * Originally a "bug condition exploration" suite that asserted the (then broken)
 * filter wiring. The dashboard now uses instant filters (no Apply step) driven by
 * an active-filter bar, so these tests document the current, working behaviour of
 * tab navigation, metric-card drill-down, and filter propagation.
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

const androidBugs = [
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
    issueType: 'Bug',
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
    issueType: 'Bug',
  },
];

const iosBug = {
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
  issueType: 'Bug',
};

const allBugs = [...androidBugs, iosBug];

const mockKPIData = {
  counts: {
    total: 150,
    bugs: 100,
    stories: 30,
    epics: 10,
    tasks: 10,
  },
  bugs: allBugs,
  stories: [],
  epics: [],
  tasks: [],
  all: allBugs,
  allTimeIssues: allBugs,
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
      rank: 1,
      monthly: {},
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
      rank: 2,
      monthly: {},
    },
  ],
  allTeams: ['Android Team', 'iOS Team'],
  jiraTeams: [],
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
      high: 1,
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

/** Radix Tabs activate on mouseDown, not click. */
function switchTab(name: RegExp) {
  fireEvent.mouseDown(screen.getByRole('tab', { name }));
}

/** Radix Select triggers expose role="combobox" and display the selected value. */
function getCombobox(displayText: string): HTMLElement {
  const el = screen
    .getAllByRole('combobox')
    .find((b) => (b.textContent || '').includes(displayText));
  if (!el) throw new Error(`No combobox displaying "${displayText}"`);
  return el;
}

async function selectOption(displayText: string, optionName: string | RegExp) {
  fireEvent.click(getCombobox(displayText));
  const option = await screen.findByRole('option', { name: optionName });
  fireEvent.click(option);
}

describe('Jira KPI Dashboard — Filter Behaviour', () => {
  beforeEach(() => {
    (useJiraKPI as jest.Mock).mockReturnValue({
      kpi: mockKPIData,
      loading: false,
      error: null,
      lastSync: new Date(),
      forceRefresh: jest.fn(),
      allSprints: [],
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
   * Bug Condition 1: Tab navigation and team filter scope.
   * Current behaviour: the global team filter is shared by the Team KPIs, Issues
   * and Live tabs, while the Monthly tab exposes its own independent team filter.
   */
  test('Bug Condition 1: Monthly tab exposes its own independent team filter', async () => {
    render(<KPIDashboard />);

    await selectOption('All Teams', 'Android Team');

    switchTab(/monthly/i);
    const panel = await screen.findByRole('tabpanel');

    // Global team filter does not collapse the monthly series…
    expect(within(panel).getByText(/Monthly Ticket Counts — Last 12 Months/i)).toBeInTheDocument();

    // …the Monthly tab has its own dropdown which filters the months.
    await selectOption('All Teams', 'Android Team');
    await waitFor(() =>
      expect(screen.getByText(/Android Team — Monthly Ticket Counts/i)).toBeInTheDocument()
    );
  });

  /**
   * Bug Condition 2: KPI metric cards navigate to the Issues tab with a filter.
   */
  test('Bug Condition 2: KPI metric cards navigate to Issues tab with filters', async () => {
    render(<KPIDashboard />);

    const bugsCard = screen.getAllByText('Bugs')[0].closest('div[class*="cursor-pointer"]');
    expect(bugsCard).toBeInTheDocument();
    fireEvent.click(bugsCard!);

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /issues/i })).toHaveAttribute('data-state', 'active');
      const bugButton = screen.getByRole('button', { name: /Bug \(/ });
      expect(bugButton.className).toContain('ring-2');
    });
  });

  /**
   * Bug Condition 3: Drill-down buttons synchronize filter state.
   */
  test('Bug Condition 3: Drill-down buttons synchronize filter state', async () => {
    render(<KPIDashboard />);

    const openDrillButtons = screen.getAllByTitle('Click to view Open issues');
    expect(openDrillButtons.length).toBeGreaterThan(0);
    fireEvent.click(openDrillButtons[0]);

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /issues/i })).toHaveAttribute('data-state', 'active');
      // Status filter synced to the "Open" group.
      expect(getCombobox('Open (Group)')).toBeInTheDocument();
    });
  });

  /**
   * Bug Condition 4: Visual indicators display for active filters.
   */
  test('Bug Condition 4: Visual filter indicators display for active filters', async () => {
    render(<KPIDashboard />);

    await selectOption('All Teams', 'Android Team');

    await waitFor(() => {
      expect(screen.getByText('Active Filters:')).toBeInTheDocument();
      expect(screen.getAllByText('Android Team').length).toBeGreaterThan(0);
      // The team dropdown is highlighted while a filter is active.
      expect(getCombobox('Android Team').className).toContain('border-primary');
    });
  });

  /**
   * Bug Condition 5: Team filter applies to the Issues tab.
   */
  test('Bug Condition 5: Team filter applies to Issues tab', async () => {
    render(<KPIDashboard />);

    await selectOption('All Teams', 'Android Team');

    switchTab(/issues/i);

    const panel = await screen.findByRole('tabpanel');
    await waitFor(() => {
      expect(within(panel).getByText(/2 results/i)).toBeInTheDocument();
      expect(within(panel).getByText('SUN-101')).toBeInTheDocument();
      expect(within(panel).getByText('SUN-103')).toBeInTheDocument();
      expect(within(panel).queryByText('SUN-102')).not.toBeInTheDocument();
    });
  });

  /**
   * Bug Condition 6: Member filter shows only that member's data.
   */
  test('Bug Condition 6: Member filter shows correct data', async () => {
    render(<KPIDashboard />);

    await selectOption('All Members', 'John Doe');

    const table = await screen.findByText(/TOTAL \(1 members\)/i);
    expect(table).toBeInTheDocument();
    expect(screen.getAllByText('John Doe').length).toBeGreaterThan(0);
    expect(screen.queryByText('Alice Brown')).not.toBeInTheDocument();
  });

  /**
   * Bug Condition 7: Status filter matches exactly.
   */
  test('Bug Condition 7: Status filter matches exactly', async () => {
    render(<KPIDashboard />);

    switchTab(/issues/i);

    const panel = await screen.findByRole('tabpanel');
    await selectOption('All Status', /^Fixed/);

    await waitFor(() => {
      expect(within(panel).getByText(/1 result/i)).toBeInTheDocument();
      expect(within(panel).getByText('SUN-102')).toBeInTheDocument();
      expect(within(panel).queryByText('SUN-101')).not.toBeInTheDocument();
      expect(within(panel).queryByText('SUN-103')).not.toBeInTheDocument();
    });
  });

  /**
   * Bug Condition 8: Filters are maintained across tab switches.
   */
  test('Bug Condition 8: Filters are maintained across tab switches', async () => {
    render(<KPIDashboard />);

    await selectOption('All Teams', 'Android Team');

    // Team KPIs now shows only Android members.
    await waitFor(() => {
      expect(screen.queryByText('Alice Brown')).not.toBeInTheDocument();
      expect(screen.getAllByText('John Doe').length).toBeGreaterThan(0);
    });

    switchTab(/issues/i);
    await waitFor(() => {
      // Team filter is still active on the Issues tab.
      expect(getCombobox('Android Team')).toBeInTheDocument();
      expect(screen.getByText(/2 results/i)).toBeInTheDocument();
    });

    switchTab(/team kpis/i);
    await waitFor(() => {
      expect(getCombobox('Android Team')).toBeInTheDocument();
      expect(screen.queryByText('Alice Brown')).not.toBeInTheDocument();
    });
  });

  /**
   * Comprehensive: a full workflow exercising several behaviours together.
   */
  test('Comprehensive: filters flow through a realistic workflow', async () => {
    render(<KPIDashboard />);

    // 1. Apply the team filter — active indicator appears.
    await selectOption('All Teams', 'Android Team');
    await waitFor(() => expect(screen.getByText('Active Filters:')).toBeInTheDocument());

    // 2. Drill into bugs from a metric card.
    const bugsCard = screen.getAllByText('Bugs')[0].closest('div[class*="cursor-pointer"]');
    fireEvent.click(bugsCard!);

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /issues/i })).toHaveAttribute('data-state', 'active');
      const panel = screen.getByRole('tabpanel');
      expect(within(panel).getByText(/2 results/i)).toBeInTheDocument();
    });
  });
});
