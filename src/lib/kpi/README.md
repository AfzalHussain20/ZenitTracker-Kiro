# KPI Dashboard Services

This directory contains the core services for the Advanced KPI Dashboard System.

## Services Overview

### 1. Team Classification Service (`team-classification.service.ts`)
Classifies teams into types (dev, qa, ui_ux, etc.) based on team names and patterns.

**Usage:**
```typescript
import { teamClassificationService } from '@/lib/kpi/team-classification.service';

const result = teamClassificationService.classifyTeam('QA Team');
console.log(result.teamType); // 'qa'
```

### 2. Team Cache Service (`team-cache.service.ts`)
Manages caching of team data with 30-minute TTL to optimize performance.

**Usage:**
```typescript
import { teamCacheService } from '@/lib/kpi/team-cache.service';

// Get cached teams or fetch fresh
const teams = await teamCacheService.getTeams();

// Force refresh
const freshTeams = await teamCacheService.refreshTeams();
```

### 3. Work Distribution Service (`work-distribution.service.ts`)
Analyzes Jira issues to determine what type of work a team actually performs.

**Usage:**
```typescript
import { workDistributionService } from '@/lib/kpi/work-distribution.service';

const analysis = workDistributionService.analyzeWorkDistribution(issues);
console.log(analysis.distribution); // { stories: 5, bugs: 2, tasks: 3, ... }
console.log(analysis.workFocus); // { primary: 'Stories', percentage: 50, ... }
```

### 4. Metric Mapping Service (`metric-mapping.service.ts`)
Provides methods for getting relevant metrics for team types and calculating metric values.

**Usage:**
```typescript
import { metricMappingService } from '@/lib/kpi/metric-mapping.service';

// Get relevant metrics for a team type
const metrics = metricMappingService.getRelevantMetrics('dev');

// Calculate metrics from issues
const calculatedMetrics = metricMappingService.calculateMetrics(issues, 'dev');
```

### 5. Intelligent Metric Filter Service (`intelligent-metric-filter.service.ts`) ⭐ NEW
**Integrates work distribution analysis with metric calculation** to provide intelligent filtering of metrics based on actual work performed.

**Key Features:**
- Filters metrics based on actual work items (e.g., no bugs = no bug metrics)
- Provides work focus indicators
- Excludes zero-value irrelevant metrics
- Supports debugging and context information

**Usage:**
```typescript
import { intelligentMetricFilterService } from '@/lib/kpi/intelligent-metric-filter.service';

// Get intelligently filtered metrics
const result = intelligentMetricFilterService.getIntelligentMetrics(issues, 'dev');

console.log(result.metrics); // Only relevant, non-zero metrics
console.log(result.workDistribution); // { stories: 5, bugs: 0, tasks: 3, ... }
console.log(result.workFocus); // { primary: 'Stories', percentage: 62.5, ... }
console.log(result.filteredCount); // Number of metrics filtered out
```

## Integration: Task 3.2 Implementation

### Problem Statement
Teams should only see metrics relevant to their actual work. For example:
- A team with no bugs shouldn't see bug-related metrics
- A team focused on stories should emphasize story metrics
- Zero-value metrics for non-existent work types should be hidden

### Solution: Intelligent Metric Filter Service

The `intelligent-metric-filter.service.ts` integrates:
1. **Work Distribution Analyzer** (Task 3.1) - Analyzes what work the team actually does
2. **Metric Mapping Service** (Task 2.2) - Provides team-type-specific metrics

### How It Works

```
┌─────────────────┐
│  Jira Issues    │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────────────────────┐
│  Intelligent Metric Filter Service                  │
│                                                     │
│  Step 1: Analyze Work Distribution                 │
│  ┌──────────────────────────────────────┐          │
│  │ Work Distribution Service            │          │
│  │ - Count stories, bugs, tasks, etc.   │          │
│  │ - Determine primary work focus       │          │
│  └──────────────────────────────────────┘          │
│                                                     │
│  Step 2: Calculate All Metrics                     │
│  ┌──────────────────────────────────────┐          │
│  │ Metric Mapping Service               │          │
│  │ - Get team-type metrics              │          │
│  │ - Calculate values from issues       │          │
│  └──────────────────────────────────────┘          │
│                                                     │
│  Step 3: Filter Based on Work Distribution         │
│  ┌──────────────────────────────────────┐          │
│  │ Intelligent Filtering Logic          │          │
│  │ - Exclude metrics for missing work   │          │
│  │ - Remove zero-value metrics          │          │
│  │ - Keep only relevant metrics         │          │
│  └──────────────────────────────────────┘          │
└─────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────┐
│  Filtered       │
│  Metrics +      │
│  Work Context   │
└─────────────────┘
```

### API Methods

#### `getIntelligentMetrics(issues, teamType)`
Main method that returns filtered metrics with work distribution context.

**Returns:**
```typescript
{
  metrics: MetricValue[];           // Filtered metrics
  workDistribution: WorkDistribution; // Work type counts
  workFocus: {                      // Primary work indicator
    primary: string;
    percentage: number;
    description: string;
  };
  filteredCount: number;            // Number of metrics filtered
  totalAvailableMetrics: number;    // Total metrics available
}
```

#### `shouldDisplayMetric(metricKey, issues)`
Check if a specific metric should be displayed based on work performed.

**Returns:** `boolean`

#### `getMetricsWithContext(issues, teamType)`
Get detailed context about filtering decisions (useful for debugging).

**Returns:**
```typescript
{
  displayedMetrics: MetricValue[];
  excludedMetrics: Array<{
    metric: MetricValue;
    reason: string;
  }>;
  workDistribution: WorkDistribution;
  workFocus: { ... };
}
```

#### `getFilteringSummary(issues, teamType)`
Get summary statistics about metric filtering.

**Returns:**
```typescript
{
  totalMetrics: number;
  displayedMetrics: number;
  filteredByWorkType: number;
  filteredByZeroValue: number;
  workDistribution: WorkDistribution;
}
```

### Example Usage in Components

#### Team Section Component
```typescript
import { intelligentMetricFilterService } from '@/lib/kpi/intelligent-metric-filter.service';

const TeamSection = ({ team, issues }: Props) => {
  const result = intelligentMetricFilterService.getIntelligentMetrics(
    issues,
    team.teamType
  );

  return (
    <div>
      <h2>{team.name}</h2>
      
      {/* Work Focus Indicator */}
      <div className="work-focus">
        <span>{result.workFocus.primary}</span>
        <span>{result.workFocus.percentage}%</span>
      </div>

      {/* Work Distribution */}
      <WorkDistributionChart data={result.workDistribution} />

      {/* Filtered Metrics */}
      <div className="metrics-grid">
        {result.metrics.map((metric) => (
          <MetricCard key={metric.key} metric={metric} />
        ))}
      </div>
    </div>
  );
};
```

#### API Route
```typescript
import { intelligentMetricFilterService } from '@/lib/kpi/intelligent-metric-filter.service';

export async function GET(req: NextRequest) {
  const { teamId, teamType } = await getTeamInfo(req);
  const issues = await fetchJiraIssues({ teamId });
  
  const result = intelligentMetricFilterService.getIntelligentMetrics(
    issues,
    teamType
  );
  
  return NextResponse.json({
    success: true,
    data: result,
  });
}
```

### Requirements Satisfied

This implementation satisfies the following requirements:

✅ **Requirement 2.2.4**: Filter metrics based on actual work items
- Analyzes Jira issues to determine work types
- Excludes metrics for non-existent work types

✅ **Requirement 2.2.5**: Exclude metrics for non-existent work types
- If team has no bugs, bug metrics are excluded
- If team has no stories, story metrics are excluded

✅ **Requirement 2.2.6**: Display work focus indicator
- Provides primary work type with percentage
- Includes descriptive text about team's work focus

✅ **Requirement 2.2.8**: Adapt metric displays dynamically
- Metrics automatically adjust as work patterns change
- No hardcoded filtering rules

### Testing

Comprehensive unit tests are provided in:
- `__tests__/intelligent-metric-filter.service.test.ts`

Run tests:
```bash
npm test -- intelligent-metric-filter.service.test.ts
```

### Examples

See `intelligent-metric-filter.example.ts` for 10 detailed usage examples including:
1. Basic usage
2. QA team with bugs
3. Checking specific metrics
4. Detailed context
5. Filtering summary
6. React component usage
7. API route usage
8. Debugging filtering
9. Conditional rendering
10. Multi-team comparison

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    KPI Dashboard System                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Service Layer                          │
│                                                             │
│  ┌──────────────────┐  ┌──────────────────┐               │
│  │ Team             │  │ Team Cache       │               │
│  │ Classification   │  │ Service          │               │
│  └──────────────────┘  └──────────────────┘               │
│                                                             │
│  ┌──────────────────┐  ┌──────────────────┐               │
│  │ Work             │  │ Metric Mapping   │               │
│  │ Distribution     │  │ Service          │               │
│  └────────┬─────────┘  └────────┬─────────┘               │
│           │                     │                          │
│           └──────────┬──────────┘                          │
│                      ▼                                      │
│           ┌──────────────────────┐                         │
│           │ Intelligent Metric   │ ⭐ NEW                  │
│           │ Filter Service       │                         │
│           └──────────────────────┘                         │
└─────────────────────────────────────────────────────────────┘
```

## Next Steps

To use the intelligent metric filter service in your application:

1. **Import the service** in your component or API route
2. **Fetch Jira issues** for the team
3. **Call `getIntelligentMetrics()`** with issues and team type
4. **Render the filtered metrics** and work distribution
5. **Display work focus indicator** to show team's primary work

See the examples file for detailed implementation patterns.
