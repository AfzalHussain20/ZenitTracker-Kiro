# Work Distribution Analyzer Service

## Overview

The Work Distribution Analyzer Service analyzes Jira issues to determine what type of work a team actually performs (Stories, Bugs, Tasks, Epics, Subtasks). This service is used to intelligently display only relevant metrics based on actual work patterns, not just team names.

## Purpose

This service addresses **Requirements 2.2.1, 2.2.2, 2.2.3, 2.2.7, and 2.2.9** by:
- Analyzing Jira issue types to determine team work focus
- Calculating work distribution percentages
- Identifying dominant work types
- Generating work distribution breakdowns for display

## Usage

### Basic Analysis

```typescript
import { workDistributionService } from '@/lib/kpi/work-distribution.service';

// Analyze a team's Jira issues
const issues = [
  { issueType: 'Story' },
  { issueType: 'Story' },
  { issueType: 'Bug' },
  { issueType: 'Task' },
];

const analysis = workDistributionService.analyzeWorkDistribution(issues);

console.log(analysis);
// {
//   distribution: { stories: 2, bugs: 1, tasks: 1, epics: 0, subtasks: 0 },
//   total: 4,
//   workFocus: {
//     primary: 'Stories',
//     percentage: 50,
//     description: 'Team primarily works on user stories and feature development'
//   },
//   hasWork: true
// }
```

### Calculate Percentages

```typescript
const distribution = {
  stories: 5,
  bugs: 3,
  tasks: 2,
  epics: 0,
  subtasks: 0,
};

const percentages = workDistributionService.calculatePercentages(distribution, 10);

console.log(percentages);
// { stories: 50, bugs: 30, tasks: 20, epics: 0, subtasks: 0 }
```

### Generate Display Breakdown

```typescript
const breakdown = workDistributionService.generateBreakdown(distribution, 10);

console.log(breakdown);
// [
//   { type: 'Stories', count: 5, percentage: 50 },
//   { type: 'Bugs', count: 3, percentage: 30 },
//   { type: 'Tasks', count: 2, percentage: 20 }
// ]
// Note: Zero-count items are excluded
```

### Check for Specific Work Types

```typescript
const hasStories = workDistributionService.hasWorkType(distribution, 'stories');
// true

const hasBugs = workDistributionService.hasWorkType(distribution, 'bugs');
// true

const hasEpics = workDistributionService.hasWorkType(distribution, 'epics');
// false
```

### Get Dominant Work Types

```typescript
// Get work types above 20% threshold (default)
const dominant = workDistributionService.getDominantWorkTypes(distribution, 10);
// ['Stories', 'Bugs', 'Tasks']

// Use custom threshold (e.g., 40%)
const majorWork = workDistributionService.getDominantWorkTypes(distribution, 10, 40);
// ['Stories']
```

## API Reference

### `analyzeWorkDistribution(issues: any[]): WorkDistributionAnalysis`

Analyzes Jira issues to determine work distribution.

**Parameters:**
- `issues`: Array of Jira issues with `issueType` property

**Returns:**
```typescript
{
  distribution: WorkDistribution;  // Count of each work type
  total: number;                   // Total number of work items
  workFocus: WorkFocus;            // Primary work focus information
  hasWork: boolean;                // Whether team has any work items
}
```

### `calculatePercentages(distribution: WorkDistribution, total: number): Record<string, number>`

Calculates percentage for each work type.

**Parameters:**
- `distribution`: Work distribution counts
- `total`: Total number of work items

**Returns:** Object with percentage for each work type

### `determineWorkFocus(distribution: WorkDistribution, total: number): WorkFocus`

Determines the team's primary work focus.

**Returns:**
```typescript
{
  primary: string;        // Primary work type (e.g., 'Stories', 'Bugs')
  percentage: number;     // Percentage of primary work type
  description: string;    // Human-readable description
}
```

### `generateBreakdown(distribution: WorkDistribution, total: number): Array<{type, count, percentage}>`

Generates work distribution breakdown for display, sorted by count descending.

**Returns:** Array of work type breakdown items (excludes zero-count items)

### `hasWorkType(distribution: WorkDistribution, workType: keyof WorkDistribution): boolean`

Checks if a team has specific work types.

**Parameters:**
- `distribution`: Work distribution counts
- `workType`: Work type to check ('stories', 'bugs', 'tasks', 'epics', 'subtasks')

**Returns:** True if team has this work type

### `getDominantWorkTypes(distribution: WorkDistribution, total: number, threshold?: number): string[]`

Gets work types above a threshold percentage.

**Parameters:**
- `distribution`: Work distribution counts
- `total`: Total number of work items
- `threshold`: Minimum percentage to be considered dominant (default: 20%)

**Returns:** Array of dominant work types

## Issue Type Normalization

The service automatically normalizes various Jira issue type variations:

| Jira Issue Type | Normalized To |
|----------------|---------------|
| Story, User Story | stories |
| Bug, Defect | bugs |
| Task | tasks |
| Epic | epics |
| Subtask, Sub-task | subtasks |
| Unknown types | tasks (default) |

Normalization is case-insensitive and handles extra whitespace.

## Integration with Team Classification

This service works in conjunction with the Team Classification Service to provide intelligent metric mapping:

```typescript
import { teamClassificationService } from '@/lib/kpi/team-classification.service';
import { workDistributionService } from '@/lib/kpi/work-distribution.service';

// Analyze work distribution
const analysis = workDistributionService.analyzeWorkDistribution(issues);

// Use work patterns for team classification
const classification = teamClassificationService.classifyTeam(
  team,
  analysis.distribution
);

// Now you can display only relevant metrics for this team
```

## Example: Team Section Display

```typescript
// In a React component
const TeamSection = ({ team, issues }) => {
  const analysis = workDistributionService.analyzeWorkDistribution(issues);
  const breakdown = workDistributionService.generateBreakdown(
    analysis.distribution,
    analysis.total
  );

  return (
    <div>
      <h2>{team.name}</h2>
      
      {/* Work Focus Indicator */}
      <div className="work-focus">
        <strong>Primary Focus:</strong> {analysis.workFocus.primary} 
        ({analysis.workFocus.percentage}%)
        <p>{analysis.workFocus.description}</p>
      </div>

      {/* Work Distribution Breakdown */}
      <div className="breakdown">
        <h3>Work Distribution</h3>
        {breakdown.map(item => (
          <div key={item.type}>
            {item.type}: {item.count} ({item.percentage}%)
          </div>
        ))}
      </div>

      {/* Only show metrics for work types that exist */}
      {analysis.distribution.stories > 0 && (
        <MetricCard metric="stories_completed" />
      )}
      {analysis.distribution.bugs > 0 && (
        <MetricCard metric="bugs_resolved" />
      )}
    </div>
  );
};
```

## Testing

The service includes comprehensive unit tests covering:
- Issue type counting and normalization
- Percentage calculations
- Work focus determination
- Breakdown generation
- Edge cases (empty lists, single types, unknown types)

Run tests:
```bash
npm test -- src/lib/kpi/__tests__/work-distribution.service.test.ts
```

## Design Decisions

1. **Singleton Pattern**: Exported as a singleton instance for consistent usage across the application
2. **Zero-Value Exclusion**: Breakdown generation excludes zero-count items by default to avoid cluttering the UI
3. **Normalization**: Handles various Jira issue type variations to ensure consistent analysis
4. **Rounding**: Percentages rounded to 1 decimal place for display clarity
5. **Default Fallback**: Unknown issue types default to 'tasks' to prevent data loss

## Future Enhancements

- Support for custom issue types beyond the standard five
- Historical trend analysis of work distribution changes
- Team work pattern recommendations based on distribution
- Integration with Jira API for real-time analysis
