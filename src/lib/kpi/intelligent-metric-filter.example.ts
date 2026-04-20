/**
 * Example Usage: Intelligent Metric Filter Service
 * 
 * This file demonstrates how to use the intelligent metric filter service
 * to display only relevant metrics based on actual work performed.
 */

import { intelligentMetricFilterService } from './intelligent-metric-filter.service';
import { TeamType } from '@/types/kpi-dashboard';

/**
 * Example 1: Basic usage - Get filtered metrics for a team
 */
export function example1_BasicUsage() {
  // Sample Jira issues for a dev team
  const issues = [
    { issueType: 'Story', statusCategory: 'Done', storyPoints: 5 },
    { issueType: 'Story', statusCategory: 'Done', storyPoints: 3 },
    { issueType: 'Task', statusCategory: 'Done' },
    // Note: No bugs in this team's work
  ];

  // Get intelligent metrics
  const result = intelligentMetricFilterService.getIntelligentMetrics(issues, 'dev');

  console.log('Displayed Metrics:', result.metrics);
  console.log('Work Distribution:', result.workDistribution);
  console.log('Work Focus:', result.workFocus);
  console.log(`Filtered ${result.filteredCount} irrelevant metrics`);

  // Result will NOT include bug-related metrics since team has no bugs
}

/**
 * Example 2: QA team with bugs - Show bug metrics
 */
export function example2_QATeamWithBugs() {
  const issues = [
    { issueType: 'Bug', statusCategory: 'Done' },
    { issueType: 'Bug', statusCategory: 'Done' },
    { issueType: 'Bug', statusCategory: 'In Progress', priority: 'High' },
    { issueType: 'Task', statusCategory: 'Done', summary: 'Execute test cases' },
  ];

  const result = intelligentMetricFilterService.getIntelligentMetrics(issues, 'qa');

  // Result WILL include bug-related metrics
  const hasBugMetrics = result.metrics.some(m => 
    m.key === 'bugs_found' || m.key === 'bugs_resolved'
  );
  
  console.log('Has bug metrics:', hasBugMetrics); // true
  console.log('Work Focus:', result.workFocus.primary); // "Bugs"
}

/**
 * Example 3: Check if a specific metric should be displayed
 */
export function example3_CheckSpecificMetric() {
  const issues = [
    { issueType: 'Story', statusCategory: 'Done' },
    { issueType: 'Task', statusCategory: 'Done' },
  ];

  // Check if bug metrics should be displayed
  const shouldShowBugMetrics = intelligentMetricFilterService.shouldDisplayMetric(
    'bugs_found',
    issues
  );

  console.log('Should show bug metrics:', shouldShowBugMetrics); // false

  // Check if story metrics should be displayed
  const shouldShowStoryMetrics = intelligentMetricFilterService.shouldDisplayMetric(
    'stories_completed',
    issues
  );

  console.log('Should show story metrics:', shouldShowStoryMetrics); // true
}

/**
 * Example 4: Get detailed context about filtering decisions
 */
export function example4_DetailedContext() {
  const issues = [
    { issueType: 'Story', statusCategory: 'Done', storyPoints: 5 },
    { issueType: 'Task', statusCategory: 'Done' },
  ];

  const context = intelligentMetricFilterService.getMetricsWithContext(issues, 'dev');

  console.log('Displayed Metrics:', context.displayedMetrics);
  console.log('Excluded Metrics with Reasons:');
  context.excludedMetrics.forEach(({ metric, reason }) => {
    console.log(`  - ${metric.label}: ${reason}`);
  });

  // Example output:
  // - Bugs Found: Team has no bugs work items
  // - Commits: Metric value is zero
}

/**
 * Example 5: Get filtering summary for analytics
 */
export function example5_FilteringSummary() {
  const issues = [
    { issueType: 'Story', statusCategory: 'Done', storyPoints: 5 },
    { issueType: 'Bug', statusCategory: 'Done' },
  ];

  const summary = intelligentMetricFilterService.getFilteringSummary(issues, 'dev');

  console.log('Filtering Summary:');
  console.log(`  Total available metrics: ${summary.totalMetrics}`);
  console.log(`  Displayed metrics: ${summary.displayedMetrics}`);
  console.log(`  Filtered by work type: ${summary.filteredByWorkType}`);
  console.log(`  Filtered by zero value: ${summary.filteredByZeroValue}`);
  console.log('  Work Distribution:', summary.workDistribution);
}

/**
 * Example 6: React component usage
 */
export function example6_ReactComponentUsage() {
  // In a React component:
  /*
  const TeamMetricsDisplay = ({ team, issues }: Props) => {
    const result = intelligentMetricFilterService.getIntelligentMetrics(
      issues,
      team.teamType
    );

    return (
      <div>
        <h2>{team.name}</h2>
        
        {/* Work Focus Indicator *\/}
        <div className="work-focus">
          <span>Primary Focus: {result.workFocus.primary}</span>
          <span>{result.workFocus.percentage}%</span>
          <p>{result.workFocus.description}</p>
        </div>

        {/* Work Distribution *\/}
        <div className="work-distribution">
          <h3>Work Distribution</h3>
          {result.workDistribution.stories > 0 && (
            <div>Stories: {result.workDistribution.stories}</div>
          )}
          {result.workDistribution.bugs > 0 && (
            <div>Bugs: {result.workDistribution.bugs}</div>
          )}
          {result.workDistribution.tasks > 0 && (
            <div>Tasks: {result.workDistribution.tasks}</div>
          )}
        </div>

        {/* Filtered Metrics *\/}
        <div className="metrics">
          <h3>Performance Metrics</h3>
          {result.metrics.map((metric) => (
            <div key={metric.key} className="metric-card">
              <h4>{metric.label}</h4>
              <p className="value">{metric.value}</p>
              <p className="description">{metric.description}</p>
            </div>
          ))}
        </div>

        {/* Info about filtered metrics *\/}
        {result.filteredCount > 0 && (
          <p className="info">
            {result.filteredCount} irrelevant metrics hidden
          </p>
        )}
      </div>
    );
  };
  */
}

/**
 * Example 7: API route usage
 */
export function example7_APIRouteUsage() {
  // In an API route:
  /*
  export async function GET(req: NextRequest) {
    const { teamId, teamType } = await getTeamInfo(req);
    
    // Fetch Jira issues for the team
    const issues = await fetchJiraIssues({ teamId });
    
    // Get intelligent metrics
    const result = intelligentMetricFilterService.getIntelligentMetrics(
      issues,
      teamType as TeamType
    );
    
    return NextResponse.json({
      success: true,
      data: {
        metrics: result.metrics,
        workDistribution: result.workDistribution,
        workFocus: result.workFocus,
        filteredCount: result.filteredCount,
      },
    });
  }
  */
}

/**
 * Example 8: Debugging - Understand why metrics are filtered
 */
export function example8_DebuggingFiltering() {
  const issues = [
    { issueType: 'Story', statusCategory: 'Done', storyPoints: 5 },
  ];

  // Get detailed context for debugging
  const context = intelligentMetricFilterService.getMetricsWithContext(issues, 'qa');

  console.log('=== Debugging Metric Filtering ===');
  console.log('\nDisplayed Metrics:');
  context.displayedMetrics.forEach(m => {
    console.log(`  ✓ ${m.label}: ${m.value}`);
  });

  console.log('\nExcluded Metrics:');
  context.excludedMetrics.forEach(({ metric, reason }) => {
    console.log(`  ✗ ${metric.label}: ${reason}`);
  });

  console.log('\nWork Distribution:');
  Object.entries(context.workDistribution).forEach(([type, count]) => {
    if (count > 0) {
      console.log(`  - ${type}: ${count}`);
    }
  });

  console.log('\nWork Focus:');
  console.log(`  Primary: ${context.workFocus.primary} (${context.workFocus.percentage}%)`);
  console.log(`  ${context.workFocus.description}`);
}

/**
 * Example 9: Conditional rendering based on work type
 */
export function example9_ConditionalRendering() {
  const issues = [
    { issueType: 'Bug', statusCategory: 'Done' },
    { issueType: 'Bug', statusCategory: 'In Progress' },
  ];

  // Check if specific sections should be rendered
  const shouldShowBugSection = intelligentMetricFilterService.shouldDisplayMetric(
    'bugs_found',
    issues
  );

  const shouldShowStorySection = intelligentMetricFilterService.shouldDisplayMetric(
    'stories_completed',
    issues
  );

  // In a component:
  /*
  return (
    <div>
      {shouldShowBugSection && (
        <BugMetricsSection issues={issues} />
      )}
      
      {shouldShowStorySection && (
        <StoryMetricsSection issues={issues} />
      )}
    </div>
  );
  */
}

/**
 * Example 10: Multi-team comparison with intelligent filtering
 */
export function example10_MultiTeamComparison() {
  const teams = [
    {
      name: 'Dev Team',
      type: 'dev' as TeamType,
      issues: [
        { issueType: 'Story', statusCategory: 'Done', storyPoints: 5 },
        { issueType: 'Task', statusCategory: 'Done' },
      ],
    },
    {
      name: 'QA Team',
      type: 'qa' as TeamType,
      issues: [
        { issueType: 'Bug', statusCategory: 'Done' },
        { issueType: 'Bug', statusCategory: 'Done' },
        { issueType: 'Task', statusCategory: 'Done', summary: 'Test execution' },
      ],
    },
  ];

  teams.forEach(team => {
    const result = intelligentMetricFilterService.getIntelligentMetrics(
      team.issues,
      team.type
    );

    console.log(`\n${team.name}:`);
    console.log(`  Work Focus: ${result.workFocus.primary}`);
    console.log(`  Metrics Displayed: ${result.metrics.length}`);
    console.log(`  Metrics Filtered: ${result.filteredCount}`);
    
    result.metrics.forEach(m => {
      console.log(`    - ${m.label}: ${m.value}`);
    });
  });
}
