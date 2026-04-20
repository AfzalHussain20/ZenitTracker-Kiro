# Integration Guide: Intelligent Metric Filtering

## Task 3.2: Integrate analyzer with metric calculation

This guide explains how to integrate the intelligent metric filter service into your KPI dashboard components and API routes.

## Overview

The intelligent metric filter service combines:
- **Work Distribution Analyzer** (Task 3.1) - Analyzes actual work performed
- **Metric Mapping Service** (Task 2.2) - Provides team-type metrics

Result: Only relevant metrics are displayed based on actual work items.

## Quick Start

### 1. Import the Service

```typescript
import { intelligentMetricFilterService } from '@/lib/kpi/intelligent-metric-filter.service';
```

### 2. Get Filtered Metrics

```typescript
const result = intelligentMetricFilterService.getIntelligentMetrics(
  issues,      // Array of Jira issues
  'dev'        // Team type
);
```

### 3. Use the Results

```typescript
// Display filtered metrics
result.metrics.forEach(metric => {
  console.log(`${metric.label}: ${metric.value}`);
});

// Show work focus
console.log(`Primary Focus: ${result.workFocus.primary} (${result.workFocus.percentage}%)`);

// Display work distribution
console.log('Work Distribution:', result.workDistribution);
```

## Integration Patterns

### Pattern 1: Team Section Component

Replace existing metric calculation with intelligent filtering:

**Before:**
```typescript
const TeamSection = ({ team, issues }: Props) => {
  // Old approach: Show all metrics, including zeros
  const metrics = metricMappingService.calculateMetrics(issues, team.teamType);
  
  return (
    <div>
      {metrics.map(m => <MetricCard metric={m} />)}
    </div>
  );
};
```

**After:**
```typescript
const TeamSection = ({ team, issues }: Props) => {
  // New approach: Intelligent filtering
  const result = intelligentMetricFilterService.getIntelligentMetrics(
    issues,
    team.teamType
  );
  
  return (
    <div>
      {/* Work Focus Indicator */}
      <WorkFocusIndicator focus={result.workFocus} />
      
      {/* Work Distribution */}
      <WorkDistributionChart distribution={result.workDistribution} />
      
      {/* Filtered Metrics */}
      {result.metrics.map(m => <MetricCard metric={m} />)}
      
      {/* Info */}
      {result.filteredCount > 0 && (
        <p>{result.filteredCount} irrelevant metrics hidden</p>
      )}
    </div>
  );
};
```

### Pattern 2: API Route

**Before:**
```typescript
export async function GET(req: NextRequest) {
  const issues = await fetchJiraIssues();
  const metrics = metricMappingService.calculateMetrics(issues, 'dev');
  
  return NextResponse.json({ metrics });
}
```

**After:**
```typescript
export async function GET(req: NextRequest) {
  const issues = await fetchJiraIssues();
  const result = intelligentMetricFilterService.getIntelligentMetrics(issues, 'dev');
  
  return NextResponse.json({
    metrics: result.metrics,
    workDistribution: result.workDistribution,
    workFocus: result.workFocus,
    filteredCount: result.filteredCount,
  });
}
```

### Pattern 3: Conditional Rendering

Check if specific metric sections should be displayed:

```typescript
const MetricsDashboard = ({ issues }: Props) => {
  const shouldShowBugSection = intelligentMetricFilterService.shouldDisplayMetric(
    'bugs_found',
    issues
  );
  
  const shouldShowStorySection = intelligentMetricFilterService.shouldDisplayMetric(
    'stories_completed',
    issues
  );
  
  return (
    <div>
      {shouldShowStorySection && <StoryMetricsSection issues={issues} />}
      {shouldShowBugSection && <BugMetricsSection issues={issues} />}
    </div>
  );
};
```

### Pattern 4: Work Focus Indicator Component

Create a reusable component to display work focus:

```typescript
interface WorkFocusIndicatorProps {
  focus: {
    primary: string;
    percentage: number;
    description: string;
  };
}

const WorkFocusIndicator = ({ focus }: WorkFocusIndicatorProps) => {
  return (
    <div className="work-focus-indicator">
      <div className="focus-header">
        <h3>Team Focus</h3>
        <span className="percentage">{focus.percentage}%</span>
      </div>
      <div className="focus-primary">
        <strong>{focus.primary}</strong>
      </div>
      <p className="focus-description">{focus.description}</p>
    </div>
  );
};

// Usage
const result = intelligentMetricFilterService.getIntelligentMetrics(issues, 'dev');
<WorkFocusIndicator focus={result.workFocus} />
```

### Pattern 5: Work Distribution Chart

Display work distribution breakdown:

```typescript
interface WorkDistributionChartProps {
  distribution: WorkDistribution;
}

const WorkDistributionChart = ({ distribution }: WorkDistributionChartProps) => {
  const total = Object.values(distribution).reduce((sum, count) => sum + count, 0);
  
  return (
    <div className="work-distribution-chart">
      <h3>Work Distribution</h3>
      {Object.entries(distribution).map(([type, count]) => {
        if (count === 0) return null;
        
        const percentage = (count / total) * 100;
        
        return (
          <div key={type} className="distribution-item">
            <span className="type">{type}</span>
            <div className="bar" style={{ width: `${percentage}%` }} />
            <span className="count">{count}</span>
          </div>
        );
      })}
    </div>
  );
};

// Usage
const result = intelligentMetricFilterService.getIntelligentMetrics(issues, 'dev');
<WorkDistributionChart distribution={result.workDistribution} />
```

## Advanced Usage

### Debugging Filtering Decisions

Use `getMetricsWithContext()` to understand why metrics are included/excluded:

```typescript
const context = intelligentMetricFilterService.getMetricsWithContext(issues, 'dev');

console.log('Displayed Metrics:');
context.displayedMetrics.forEach(m => {
  console.log(`  ✓ ${m.label}: ${m.value}`);
});

console.log('\nExcluded Metrics:');
context.excludedMetrics.forEach(({ metric, reason }) => {
  console.log(`  ✗ ${metric.label}: ${reason}`);
});
```

### Filtering Summary for Analytics

Get summary statistics about filtering:

```typescript
const summary = intelligentMetricFilterService.getFilteringSummary(issues, 'dev');

console.log(`Total metrics: ${summary.totalMetrics}`);
console.log(`Displayed: ${summary.displayedMetrics}`);
console.log(`Filtered by work type: ${summary.filteredByWorkType}`);
console.log(`Filtered by zero value: ${summary.filteredByZeroValue}`);
```

### Multi-Team Comparison

Compare metrics across multiple teams:

```typescript
const teams = [
  { name: 'Dev Team', type: 'dev', issues: devIssues },
  { name: 'QA Team', type: 'qa', issues: qaIssues },
];

const comparison = teams.map(team => {
  const result = intelligentMetricFilterService.getIntelligentMetrics(
    team.issues,
    team.type
  );
  
  return {
    teamName: team.name,
    workFocus: result.workFocus.primary,
    metricsCount: result.metrics.length,
    filteredCount: result.filteredCount,
  };
});

console.table(comparison);
```

## Migration Checklist

When migrating existing code to use intelligent metric filtering:

- [ ] Replace `metricMappingService.calculateMetrics()` calls with `intelligentMetricFilterService.getIntelligentMetrics()`
- [ ] Add work focus indicator to team sections
- [ ] Add work distribution visualization
- [ ] Update API responses to include work context
- [ ] Add conditional rendering for metric sections
- [ ] Update tests to verify filtering behavior
- [ ] Remove manual zero-value filtering logic (now handled automatically)
- [ ] Add info messages about filtered metrics

## Testing

### Unit Tests

Test that metrics are filtered correctly:

```typescript
import { intelligentMetricFilterService } from '@/lib/kpi/intelligent-metric-filter.service';

describe('Metric Filtering', () => {
  it('should exclude bug metrics when team has no bugs', () => {
    const issues = [
      { issueType: 'Story', statusCategory: 'Done' },
    ];
    
    const result = intelligentMetricFilterService.getIntelligentMetrics(issues, 'dev');
    
    const hasBugMetrics = result.metrics.some(m => 
      m.key === 'bugs_found' || m.key === 'bugs_resolved'
    );
    
    expect(hasBugMetrics).toBe(false);
  });
});
```

### Integration Tests

Test API routes return filtered metrics:

```typescript
describe('GET /api/team-metrics', () => {
  it('should return filtered metrics based on work distribution', async () => {
    const response = await fetch('/api/team-metrics?teamId=dev-team');
    const data = await response.json();
    
    expect(data.metrics).toBeDefined();
    expect(data.workDistribution).toBeDefined();
    expect(data.workFocus).toBeDefined();
    expect(data.filteredCount).toBeGreaterThanOrEqual(0);
  });
});
```

## Performance Considerations

### Caching

The service performs analysis on every call. For better performance:

```typescript
// Cache results for repeated use
const cachedResults = new Map();

function getMetricsWithCache(teamId: string, issues: any[], teamType: TeamType) {
  const cacheKey = `${teamId}-${issues.length}`;
  
  if (cachedResults.has(cacheKey)) {
    return cachedResults.get(cacheKey);
  }
  
  const result = intelligentMetricFilterService.getIntelligentMetrics(issues, teamType);
  cachedResults.set(cacheKey, result);
  
  return result;
}
```

### Memoization in React

Use `useMemo` to avoid recalculation:

```typescript
const TeamSection = ({ team, issues }: Props) => {
  const result = useMemo(
    () => intelligentMetricFilterService.getIntelligentMetrics(issues, team.teamType),
    [issues, team.teamType]
  );
  
  return <div>{/* render result */}</div>;
};
```

## Troubleshooting

### Issue: Metrics not filtering as expected

**Solution:** Check work distribution:
```typescript
const context = intelligentMetricFilterService.getMetricsWithContext(issues, teamType);
console.log('Work Distribution:', context.workDistribution);
console.log('Excluded Metrics:', context.excludedMetrics);
```

### Issue: All metrics filtered out

**Solution:** Verify issues have completed work:
```typescript
const completedIssues = issues.filter(i => i.statusCategory === 'Done');
console.log(`Completed: ${completedIssues.length} / ${issues.length}`);
```

### Issue: Wrong metrics displayed

**Solution:** Verify team type classification:
```typescript
import { teamClassificationService } from '@/lib/kpi/team-classification.service';

const classification = teamClassificationService.classifyTeam(teamName);
console.log('Team Type:', classification.teamType);
console.log('Confidence:', classification.confidence);
```

## Requirements Satisfied

✅ **Requirement 2.2.4**: Filter metrics based on actual work items  
✅ **Requirement 2.2.5**: Exclude metrics for non-existent work types  
✅ **Requirement 2.2.6**: Display work focus indicator  
✅ **Requirement 2.2.8**: Adapt metric displays dynamically  

## Next Steps

1. Integrate into team section components
2. Update API routes to use intelligent filtering
3. Add work focus indicators to UI
4. Add work distribution visualizations
5. Update documentation for end users
6. Monitor filtering effectiveness in production

## Support

For questions or issues:
- See examples: `intelligent-metric-filter.example.ts`
- Check tests: `__tests__/intelligent-metric-filter.service.test.ts`
- Review README: `README.md`
