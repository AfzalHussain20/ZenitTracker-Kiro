/**
 * TeamSection Component Usage Example
 * 
 * This file demonstrates how to use the TeamSection component
 * with the intelligent metric filter service.
 */

import { TeamSection } from './TeamSection';
import { intelligentMetricFilterService } from '@/lib/kpi/intelligent-metric-filter.service';
import { JiraTeam, TeamType } from '@/types/kpi-dashboard';

/**
 * Example: Using TeamSection with intelligent metric filtering
 */
export function TeamSectionExample() {
  // Example team data
  const team: JiraTeam = {
    id: 'team-1',
    name: 'Development Team',
    members: [
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
    ],
    teamType: 'dev',
  };

  // Example Jira issues (would come from API in real usage)
  const issues = [
    { issueType: 'Story', statusCategory: 'Done', storyPoints: 5 },
    { issueType: 'Story', statusCategory: 'Done', storyPoints: 8 },
    { issueType: 'Bug', statusCategory: 'Done' },
    { issueType: 'Task', statusCategory: 'Done' },
  ];

  // Get intelligent metrics (automatically filters based on actual work)
  const result = intelligentMetricFilterService.getIntelligentMetrics(
    issues,
    team.teamType as TeamType
  );

  // Handle member click
  const handleMemberClick = (member: any) => {
    console.log('Member clicked:', member);
    // Open member profile modal, navigate to member page, etc.
  };

  return (
    <TeamSection
      team={team}
      metrics={result.metrics}
      workDistribution={result.workDistribution}
      workFocus={result.workFocus}
      members={team.members}
      onMemberClick={handleMemberClick}
    />
  );
}

/**
 * Example: Using TeamSection in a dashboard page
 */
export function DashboardPageExample() {
  // In a real implementation, you would:
  // 1. Fetch teams from /api/jira/teams
  // 2. Fetch issues for each team from /api/jira/issues
  // 3. Use intelligent metric service to calculate metrics
  // 4. Render TeamSection for each team

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">KPI Dashboard</h1>
      
      {/* Multiple team sections would be rendered here */}
      <TeamSectionExample />
      
      {/* Add more team sections as needed */}
    </div>
  );
}

/**
 * Example: Fetching data and using TeamSection
 */
export async function fetchAndRenderTeamSection(teamId: string) {
  // 1. Fetch team data
  const teamResponse = await fetch('/api/jira/teams');
  const { teams } = await teamResponse.json();
  const team = teams.find((t: JiraTeam) => t.id === teamId);

  if (!team) {
    throw new Error('Team not found');
  }

  // 2. Fetch issues for the team
  const issuesResponse = await fetch('/api/jira/issues', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jql: `team = "${team.name}"`,
    }),
  });
  const { issues } = await issuesResponse.json();

  // 3. Calculate intelligent metrics
  const result = intelligentMetricFilterService.getIntelligentMetrics(
    issues,
    team.teamType as TeamType
  );

  // 4. Render component
  return {
    team,
    metrics: result.metrics,
    workDistribution: result.workDistribution,
    workFocus: result.workFocus,
    members: team.members,
  };
}
