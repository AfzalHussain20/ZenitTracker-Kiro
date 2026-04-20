# MetricMappingService

## Overview

The `MetricMappingService` is a core service class that provides intelligent metric mapping and calculation for the Advanced KPI Dashboard System. It uses the metric mapping configuration to provide methods for getting relevant metrics for team types, calculating metric values from Jira issues, and filtering out zero-value metrics.

## Features

- **Team-Specific Metrics**: Returns only metrics relevant to a specific team type
- **Dynamic Calculation**: Calculates metric values from actual Jira issues
- **Zero-Value Filtering**: Automatically excludes metrics with zero values (configurable)
- **Type Safety**: Full TypeScript support with proper type definitions
- **Singleton Pattern**: Exported as a singleton instance for consistent usage

## API Reference

### `getRelevantMetrics(teamType: TeamType): MetricDefinition[]`

Returns all metric definitions applicable to a specific team type.

**Parameters:**
- `teamType`: The type of team ('dev', 'qa', 'ui_ux', 'database', 'api', 'sms', 'analytics', 'generic')

**Returns:** Array of `MetricDefinition` objects

**Example:**
```typescript
const devMetrics = metricMappingService.getRelevantMetrics('dev');
// Returns: [{ key: 'stories_completed', label: 'Stories Completed', ... }, ...]
```

### `calculateMetrics(issues: any[], teamType: TeamType, excludeZeroValues?: boolean): MetricValue[]`

Calculates metric values from Jira issues for a specific team type.

**Parameters:**
- `issues`: Array of Jira issues to calculate metrics from
- `teamType`: The type of team to calculate metrics for
- `excludeZeroValues`: Whether to exclude metrics with zero values (default: `true`)

**Returns:** Array of `MetricValue` objects with calculated values

**Example:**
```typescript
const issues = [
  { issueType: 'Story', statusCategory: 'Done', storyPoints: 5 },
  { issueType: 'Task', statusCategory: 'Done' }
];

const metrics = metricMappingService.calculateMetrics(issues, 'dev');
// Returns: [{ key: 'stories_completed', label: 'Stories Completed', value: 1 }, ...]
```

### `isMetricRelevant(metricKey: string, teamType: TeamType): boolean`

Checks if a metric is relevant for a specific team type.

**Parameters:**
- `metricKey`: The key of the metric to check
- `teamType`: The type of team to check against

**Returns:** `true` if the metric is relevant, `false` otherwise

**Example:**
```typescript
const isRelevant = metricMappingService.isMetricRelevant('stories_completed', 'dev');
// Returns: true

const isNotRelevant = metricMappingService.isMetricRelevant('bugs_found', 'dev');
// Returns: false
```

### `getMetricKeys(teamType: TeamType): string[]`

Returns all metric keys for a specific team type.

**Parameters:**
- `teamType`: The type of team

**Returns:** Array of metric key strings

**Example:**
```typescript
const keys = metricMappingService.getMetricKeys('dev');
// Returns: ['stories_completed', 'tasks_done', 'story_points', ...]
```

### `getMetricDefinition(metricKey: string, teamType: TeamType): MetricDefinition | undefined`

Gets a specific metric definition by key and team type.

**Parameters:**
- `metricKey`: The key of the metric to retrieve
- `teamType`: The type of team

**Returns:** The `MetricDefinition` or `undefined` if not found

**Example:**
```typescript
const metric = metricMappingService.getMetricDefinition('stories_completed', 'dev');
// Returns: { key: 'stories_completed', label: 'Stories Completed', ... }
```

### `calculateSingleMetric(metricKey: string, issues: any[], teamType: TeamType): number | null`

Calculates a single metric value.

**Parameters:**
- `metricKey`: The key of the metric to calculate
- `issues`: Array of Jira issues
- `teamType`: The type of team

**Returns:** The calculated value or `null` if metric not found

**Example:**
```typescript
const value = metricMappingService.calculateSingleMetric('story_points', issues, 'dev');
// Returns: 8
```

### `getSupportedTeamTypes(): TeamType[]`

Returns all supported team types.

**Returns:** Array of all team type strings

**Example:**
```typescript
const types = metricMappingService.getSupportedTeamTypes();
// Returns: ['dev', 'qa', 'ui_ux', 'database', 'api', 'sms', 'analytics', 'generic']
```

## Usage Examples

See `metric-mapping.service.example.ts` for comprehensive usage examples.

## Requirements Satisfied

This service satisfies the following requirements from the Advanced KPI Dashboard System spec:

- **Requirement 2.9**: Fetches work items from Jira filtered by team assignment to determine actual work performed
- **Requirement 2.10**: Excludes metrics with zero values when those metrics are not applicable to the team's work type
- **Requirement 2.11**: Allows administrators to configure custom metric mappings for teams with unique work types (via `METRIC_DEFINITIONS` configuration)

## Testing

Comprehensive unit tests are available in `__tests__/metric-mapping.service.test.ts` with 24 test cases covering all methods and edge cases.

Run tests:
```bash
npm test -- src/lib/kpi/__tests__/metric-mapping.service.test.ts
```

## Integration

The service integrates with:
- `metric-mapping.config.ts`: Metric definitions and calculations
- `team-classification.service.ts`: Team type detection
- Type definitions from `@/types/kpi-dashboard`

## Future Enhancements

- Support for custom metric formulas
- Metric aggregation across multiple teams
- Historical metric tracking
- Metric comparison and benchmarking
