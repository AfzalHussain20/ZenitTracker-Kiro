/**
 * Example: Using Work Distribution Service with Team Classification
 * 
 * This example demonstrates how to use the work distribution analyzer
 * in conjunction with team classification to display intelligent metrics.
 */

import { workDistributionService } from './work-distribution.service';
import { teamClassificationService } from './team-classification.service';
import { metricMappingService } from './metric-mapping.service';
import { JiraTeam } from '@/types/kpi-dashboard';

/**
 * Example 1: Analyze team work distribution and display relevant metrics
 */
export async function analyzeTeamAndDisplayMetrics(
  team: JiraTeam,
  jiraIssues: any[]
) {
  // Step 1: Analyze work distribution
  const workAnalysis = workDistributionService.analyzeWorkDistribution(jiraIssues);

  console.log('Work Distribution Analysis:');
  console.log('- Total work items:', workAnalysis.total);
  console.log('- Primary focus:', workAnalysis.workFocus.primary);
  console.log('- Focus percentage:', workAnalysis.workFocus.percentage + '%');
  console.log('- Description:', workAnalysis.workFocus.description);

  // Step 2: Generate breakdown for display
  const breakdown = workDistributionService.generateBreakdown(
    workAnalysis.distribution,
    workAnalysis.total
  );

  console.log('\nWork Distribution Breakdown:');
  breakdown.forEach(item => {
    console.log(`- ${item.type}: ${item.count} items (${item.percentage}%)`);
  });

  // Step 3: Classify team using work patterns
  const classification = teamClassificationService.classifyTeam(
    team,
    workAnalysis.distribution
  );

  console.log('\nTeam Classification:');
  console.log('- Type:', classification.teamType);
  console.log('- Confidence:', classification.confidence);
  console.log('- Reasons:', classification.reasons.join(', '));

  // Step 4: Get relevant metrics for this team type
  const relevantMetrics = metricMappingService.getRelevantMetrics(
    classification.teamType
  );

  console.log('\nRelevant Metrics for', classification.teamType, 'team:');
  relevantMetrics.forEach(metric => {
    console.log(`- ${metric.label}: ${metric.description}`);
  });

  // Step 5: Calculate metric values (excluding zero values)
  const calculatedMetrics = metricMappingService.calculateMetrics(
    jiraIssues,
    classification.teamType,
    true // Exclude zero values
  );

  console.log('\nCalculated Metrics:');
  calculatedMetrics.forEach(metric => {
    console.log(`- ${metric.label}: ${metric.value}`);
  });

  return {
    workAnalysis,
    breakdown,
    classification,
    metrics: calculatedMetrics,
  };
}

/**
 * Example 2: Filter metrics based on actual work performed
 */
export function shouldDisplayMetric(
  metricKey: string,
  workDistribution: any,
  teamType: string
): boolean {
  // Check if metric is relevant for team type
  const isRelevant = metricMappingService.isMetricRelevant(metricKey, teamType as any);
  
  if (!isRelevant) {
    return false;
  }

  // Check if team actually has this type of work
  // For example, don't show bug metrics if team has no bugs
  if (metricKey.includes('bug') && !workDistributionService.hasWorkType(workDistribution, 'bugs')) {
    return false;
  }

  if (metricKey.includes('story') && !workDistributionService.hasWorkType(workDistribution, 'stories')) {
    return false;
  }

  return true;
}

/**
 * Example 3: Generate team section data for UI
 */
export function generateTeamSectionData(team: JiraTeam, issues: any[]) {
  const analysis = workDistributionService.analyzeWorkDistribution(issues);
  const breakdown = workDistributionService.generateBreakdown(
    analysis.distribution,
    analysis.total
  );
  const classification = teamClassificationService.classifyTeam(
    team,
    analysis.distribution
  );

  // Get dominant work types (above 20% threshold)
  const dominantWorkTypes = workDistributionService.getDominantWorkTypes(
    analysis.distribution,
    analysis.total,
    20
  );

  return {
    teamName: team.name,
    memberCount: team.members.length,
    workFocus: {
      primary: analysis.workFocus.primary,
      percentage: analysis.workFocus.percentage,
      description: analysis.workFocus.description,
    },
    workBreakdown: breakdown,
    dominantWorkTypes,
    teamType: classification.teamType,
    totalWorkItems: analysis.total,
    hasWork: analysis.hasWork,
  };
}

/**
 * Example 4: Determine which metrics to show in member profile
 */
export function getMemberRelevantMetrics(
  memberIssues: any[],
  teamType: string
) {
  // Analyze member's work distribution
  const memberWorkAnalysis = workDistributionService.analyzeWorkDistribution(memberIssues);

  // Get all metrics for team type
  const allMetrics = metricMappingService.getRelevantMetrics(teamType as any);

  // Filter metrics based on member's actual work
  const relevantMetrics = allMetrics.filter(metric => {
    // If metric is about stories, only show if member has stories
    if (metric.key.includes('story') || metric.key.includes('stories')) {
      return memberWorkAnalysis.distribution.stories > 0;
    }

    // If metric is about bugs, only show if member has bugs
    if (metric.key.includes('bug')) {
      return memberWorkAnalysis.distribution.bugs > 0;
    }

    // If metric is about tasks, only show if member has tasks
    if (metric.key.includes('task')) {
      return memberWorkAnalysis.distribution.tasks > 0;
    }

    // Show other metrics by default
    return true;
  });

  // Calculate values for relevant metrics
  const calculatedMetrics = relevantMetrics.map(metric => ({
    key: metric.key,
    label: metric.label,
    value: metric.calculation(memberIssues),
    description: metric.description,
  }));

  // Filter out zero values
  return calculatedMetrics.filter(m => m.value > 0);
}

/**
 * Example 5: Generate work focus indicator for UI
 */
export function generateWorkFocusIndicator(issues: any[]) {
  const analysis = workDistributionService.analyzeWorkDistribution(issues);

  if (!analysis.hasWork) {
    return {
      icon: '📭',
      color: 'gray',
      text: 'No work items',
      description: 'This team has no work items assigned',
    };
  }

  const { primary, percentage } = analysis.workFocus;

  // Determine icon and color based on primary work type
  const indicators: Record<string, { icon: string; color: string }> = {
    'Stories': { icon: '📖', color: 'blue' },
    'Bugs': { icon: '🐛', color: 'red' },
    'Tasks': { icon: '✅', color: 'green' },
    'Epics': { icon: '🎯', color: 'purple' },
    'Subtasks': { icon: '📝', color: 'orange' },
  };

  const indicator = indicators[primary] || { icon: '📊', color: 'gray' };

  return {
    ...indicator,
    text: `${primary} (${percentage}%)`,
    description: analysis.workFocus.description,
  };
}
