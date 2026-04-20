/**
 * Unit tests for TeamSection component
 */

import { render, screen } from '@testing-library/react';
import { TeamSection } from '../TeamSection';
import { JiraTeam, TeamMember, MetricValue, WorkDistribution } from '@/types/kpi-dashboard';

describe('TeamSection', () => {
  const mockTeam: JiraTeam = {
    id: 'team-1',
    name: 'Dev Team',
    members: [],
  };

  const mockMembers: TeamMember[] = [
    {
      accountId: 'user-1',
      displayName: 'John Doe',
      avatarUrl: 'https://example.com/avatar1.jpg',
    },
    {
      accountId: 'user-2',
      displayName: 'Jane Smith',
      avatarUrl: 'https://example.com/avatar2.jpg',
    },
  ];

  const mockMetrics: MetricValue[] = [
    {
      key: 'stories_completed',
      label: 'Stories Completed',
      value: 15,
      description: 'Number of completed stories',
    },
    {
      key: 'story_points',
      label: 'Story Points',
      value: 42,
      description: 'Total story points delivered',
    },
  ];

  const mockWorkDistribution: WorkDistribution = {
    stories: 15,
    bugs: 3,
    tasks: 8,
    epics: 2,
    subtasks: 5,
  };

  const mockWorkFocus = {
    primary: 'Stories',
    percentage: 45.5,
    description: 'Team primarily works on user stories and feature development',
  };

  it('displays team name and member count', () => {
    render(
      <TeamSection
        team={mockTeam}
        metrics={mockMetrics}
        workDistribution={mockWorkDistribution}
        workFocus={mockWorkFocus}
        members={mockMembers}
      />
    );

    expect(screen.getByText('Dev Team')).toBeInTheDocument();
    expect(screen.getByText('2 members')).toBeInTheDocument();
  });

  it('displays work focus indicator', () => {
    render(
      <TeamSection
        team={mockTeam}
        metrics={mockMetrics}
        workDistribution={mockWorkDistribution}
        workFocus={mockWorkFocus}
        members={mockMembers}
      />
    );

    expect(screen.getByText('Work Focus')).toBeInTheDocument();
    expect(screen.getByText(/Stories \(45.5%\)/)).toBeInTheDocument();
    expect(
      screen.getByText('Team primarily works on user stories and feature development')
    ).toBeInTheDocument();
  });

  it('displays work distribution breakdown', () => {
    render(
      <TeamSection
        team={mockTeam}
        metrics={mockMetrics}
        workDistribution={mockWorkDistribution}
        workFocus={mockWorkFocus}
        members={mockMembers}
      />
    );

    expect(screen.getByText('Work Distribution')).toBeInTheDocument();
    expect(screen.getByText('Stories')).toBeInTheDocument();
    expect(screen.getByText('Bugs')).toBeInTheDocument();
    expect(screen.getByText('Tasks')).toBeInTheDocument();
  });

  it('displays relevant metrics', () => {
    render(
      <TeamSection
        team={mockTeam}
        metrics={mockMetrics}
        workDistribution={mockWorkDistribution}
        workFocus={mockWorkFocus}
        members={mockMembers}
      />
    );

    expect(screen.getByText('Key Metrics')).toBeInTheDocument();
    expect(screen.getByText('15')).toBeInTheDocument();
    expect(screen.getByText('Stories Completed')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('Story Points')).toBeInTheDocument();
  });

  it('displays team members list', () => {
    render(
      <TeamSection
        team={mockTeam}
        metrics={mockMetrics}
        workDistribution={mockWorkDistribution}
        workFocus={mockWorkFocus}
        members={mockMembers}
      />
    );

    expect(screen.getByText('Team Members')).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
  });

  it('handles empty member list gracefully', () => {
    render(
      <TeamSection
        team={mockTeam}
        metrics={mockMetrics}
        workDistribution={mockWorkDistribution}
        workFocus={mockWorkFocus}
        members={[]}
      />
    );

    expect(screen.getByText('No members in this team')).toBeInTheDocument();
  });

  it('displays singular "member" for single member', () => {
    const singleMember = [mockMembers[0]];
    
    render(
      <TeamSection
        team={mockTeam}
        metrics={mockMetrics}
        workDistribution={mockWorkDistribution}
        workFocus={mockWorkFocus}
        members={singleMember}
      />
    );

    expect(screen.getByText('1 member')).toBeInTheDocument();
  });

  it('handles empty metrics array', () => {
    render(
      <TeamSection
        team={mockTeam}
        metrics={[]}
        workDistribution={mockWorkDistribution}
        workFocus={mockWorkFocus}
        members={mockMembers}
      />
    );

    expect(screen.queryByText('Key Metrics')).not.toBeInTheDocument();
  });

  it('handles zero work items', () => {
    const emptyDistribution: WorkDistribution = {
      stories: 0,
      bugs: 0,
      tasks: 0,
      epics: 0,
      subtasks: 0,
    };

    const emptyWorkFocus = {
      primary: 'No Work Items',
      percentage: 0,
      description: 'No work items found for this team',
    };

    render(
      <TeamSection
        team={mockTeam}
        metrics={[]}
        workDistribution={emptyDistribution}
        workFocus={emptyWorkFocus}
        members={mockMembers}
      />
    );

    expect(screen.getByText('0 work items')).toBeInTheDocument();
    expect(screen.queryByText('Work Distribution')).not.toBeInTheDocument();
  });

  it('calls onMemberClick when member is clicked', () => {
    const handleMemberClick = jest.fn();

    render(
      <TeamSection
        team={mockTeam}
        metrics={mockMetrics}
        workDistribution={mockWorkDistribution}
        workFocus={mockWorkFocus}
        members={mockMembers}
        onMemberClick={handleMemberClick}
      />
    );

    const memberCards = screen.getAllByTestId('member-card');
    memberCards[0].click();

    expect(handleMemberClick).toHaveBeenCalledWith(mockMembers[0]);
  });

  it('displays total work items count', () => {
    render(
      <TeamSection
        team={mockTeam}
        metrics={mockMetrics}
        workDistribution={mockWorkDistribution}
        workFocus={mockWorkFocus}
        members={mockMembers}
      />
    );

    // Total: 15 + 3 + 8 + 2 + 5 = 33
    expect(screen.getByText('33 work items')).toBeInTheDocument();
  });
});
