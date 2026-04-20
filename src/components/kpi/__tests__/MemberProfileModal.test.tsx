/**
 * Tests for MemberProfileModal Component
 * 
 * Validates team-contextualized metrics display functionality
 */

import { render, screen, waitFor } from '@testing-library/react';
import { MemberProfileModal } from '../MemberProfileModal';
import { JiraTeam, TeamMember } from '@/types/kpi-dashboard';

// Mock the services
jest.mock('@/lib/kpi/team-classification.service', () => ({
  teamClassificationService: {
    classifyTeam: jest.fn(() => ({
      teamType: 'dev',
      confidence: 0.9,
      reasons: ['Team name contains dev'],
    })),
  },
}));

jest.mock('@/lib/kpi/metric-mapping.service', () => ({
  metricMappingService: {
    calculateMetrics: jest.fn(() => [
      {
        key: 'stories_completed',
        label: 'Stories Completed',
        value: 5,
        description: 'Number of Story-type issues completed',
      },
      {
        key: 'tasks_done',
        label: 'Tasks Done',
        value: 3,
        description: 'Number of Task-type issues completed',
      },
    ]),
  },
}));

// Mock fetch
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () =>
      Promise.resolve({
        issues: [
          { issueType: 'Story', statusCategory: 'Done' },
          { issueType: 'Story', statusCategory: 'Done' },
          { issueType: 'Story', statusCategory: 'Done' },
          { issueType: 'Story', statusCategory: 'Done' },
          { issueType: 'Story', statusCategory: 'Done' },
          { issueType: 'Task', statusCategory: 'Done' },
          { issueType: 'Task', statusCategory: 'Done' },
          { issueType: 'Task', statusCategory: 'Done' },
        ],
      }),
  })
) as jest.Mock;

describe('MemberProfileModal - Team-Contextualized Metrics', () => {
  const mockMember: TeamMember = {
    accountId: 'user-123',
    displayName: 'John Doe',
    avatarUrl: 'https://example.com/avatar.jpg',
  };

  const mockTeam: JiraTeam = {
    id: 'team-1',
    name: 'Dev Team',
    members: [mockMember],
    teamType: 'dev',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should display member profile information', () => {
    render(
      <MemberProfileModal
        member={mockMember}
        team={mockTeam}
        isOpen={true}
        onClose={() => {}}
      />
    );

    expect(screen.getAllByText('John Doe').length).toBeGreaterThan(0);
    expect(screen.getByText('Member Profile - Dev Team')).toBeInTheDocument();
  });

  it('should fetch and display team-contextualized metrics', async () => {
    render(
      <MemberProfileModal
        member={mockMember}
        team={mockTeam}
        isOpen={true}
        onClose={() => {}}
      />
    );

    // Wait for metrics to load
    await waitFor(() => {
      expect(screen.getByText('Stories Completed')).toBeInTheDocument();
    });

    expect(screen.getByText('Tasks Done')).toBeInTheDocument();
    expect(screen.getAllByTestId('metric-card')).toHaveLength(2);
  });

  it('should display work distribution', async () => {
    render(
      <MemberProfileModal
        member={mockMember}
        team={mockTeam}
        isOpen={true}
        onClose={() => {}}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Work Distribution')).toBeInTheDocument();
    });

    expect(screen.getByText('Stories')).toBeInTheDocument();
    expect(screen.getByText('Tasks')).toBeInTheDocument();
  });

  it('should exclude zero-value metrics', async () => {
    render(
      <MemberProfileModal
        member={mockMember}
        team={mockTeam}
        isOpen={true}
        onClose={() => {}}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Stories Completed')).toBeInTheDocument();
    });

    // Verify that only non-zero metrics are displayed
    const metricValues = screen.getAllByTestId('metric-value');
    metricValues.forEach((value) => {
      expect(value.textContent).not.toBe('0');
    });
  });

  it('should show loading state while fetching metrics', () => {
    render(
      <MemberProfileModal
        member={mockMember}
        team={mockTeam}
        isOpen={true}
        onClose={() => {}}
      />
    );

    expect(screen.getByText('Loading metrics...')).toBeInTheDocument();
  });

  it('should handle fetch errors gracefully', async () => {
    (global.fetch as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({
        ok: false,
        json: () => Promise.resolve({}),
      })
    );

    render(
      <MemberProfileModal
        member={mockMember}
        team={mockTeam}
        isOpen={true}
        onClose={() => {}}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Failed to fetch member issues')).toBeInTheDocument();
    });
  });

  it('should display team type badge', () => {
    render(
      <MemberProfileModal
        member={mockMember}
        team={mockTeam}
        isOpen={true}
        onClose={() => {}}
      />
    );

    const badges = screen.getAllByText('dev');
    expect(badges.length).toBeGreaterThan(0);
  });

  it('should not fetch metrics when modal is closed', () => {
    render(
      <MemberProfileModal
        member={mockMember}
        team={mockTeam}
        isOpen={false}
        onClose={() => {}}
      />
    );

    expect(global.fetch).not.toHaveBeenCalled();
  });
});
