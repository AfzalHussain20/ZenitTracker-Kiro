# Work Analyzer Integration Tests

## Overview

This document describes the integration tests for the Work Distribution Analyzer, which validates the complete flow from Jira issues → work distribution analysis → metric filtering.

## Test File

`src/lib/kpi/__tests__/work-analyzer-integration.test.ts`

## Requirements Validated

These tests validate Requirements 2.2.1-2.2.10 from the Advanced KPI Dashboard System specification:

- **2.2.1**: Query Jira for all work items assigned to a team
- **2.2.2**: Analyze work item types to determine team's actual work focus
- **2.2.3**: Calculate and display metrics based only on work items that exist
- **2.2.4**: Exclude bug-related metrics when team has no bugs
- **2.2.5**: Emphasize story metrics when team primarily works on stories
- **2.2.6**: Emphasize bug metrics when team primarily works on bugs
- **2.2.7**: Display work distribution breakdown with percentages
- **2.2.8**: Adapt metric displays dynamically as work patterns change
- **2.2.9**: Provide "Work Focus" indicator for each team
- **2.2.10**: Allow filtering team displays by work item type

## Test Coverage

### 1. Complete Flow Tests

Tests the full integration from Jira issues through work distribution analysis to intelligent metric filtering:

- **Dev team with stories**: Validates story metrics are included, bug metrics excluded
- **QA team with bugs**: Validates bug metrics are emphasized
- **Mixed work distribution**: Validates all relevant metrics shown for mixed work types

### 2. Edge Case: Empty Teams

Tests handling of teams with no work or incomplete work:

- **No work items**: Validates graceful handling of empty teams
- **Only in-progress work**: Validates teams with no completed items

### 3. Edge Case: Single Work Type

Tests teams focused on a single work type:

- **100% stories**: Validates only story metrics shown
- **100% bugs**: Validates only bug metrics shown
- **100% tasks**: Validates only task metrics shown

### 4. Various Work Item Distributions

Tests different distribution patterns:

- **80/20 distribution**: Validates dominant work type identification
- **Even distribution**: Validates handling of balanced work types
- **Dynamic adaptation**: Validates metrics adapt as work patterns change

### 5. Integration with Metric Mapping Service

Tests integration between services:

- **Metric calculation integration**: Validates work distribution integrates with metric calculation
- **Filtering by work item type**: Validates drill-down filtering capabilities

### 6. Metric Filtering Context and Summary

Tests contextual information:

- **Filtering decisions context**: Validates detailed context for why metrics are included/excluded
- **Filtering summary statistics**: Validates summary statistics for filtering decisions

## Test Results

All 15 integration tests pass successfully:

```
Test Suites: 1 passed, 1 total
Tests:       15 passed, 15 total
```

## Key Testing Patterns

### 1. Three-Step Integration Flow

Each test follows a consistent pattern:

1. **Analyze work distribution**: Use `workDistributionService.analyzeWorkDistribution()`
2. **Calculate metrics**: Use `intelligentMetricFilterService.getIntelligentMetrics()`
3. **Verify results**: Check work distribution, metrics, and filtering decisions

### 2. Team Type Awareness

Tests use appropriate team types based on work items:

- Use `'dev'` team type for story-focused tests
- Use `'qa'` team type for bug-focused tests
- This aligns with the metric mapping configuration

### 3. Edge Case Coverage

Tests explicitly cover edge cases mentioned in task requirements:

- Empty teams (no work items)
- Single work type (100% focus)
- Various distributions (80/20, even, etc.)

## Integration Points Tested

1. **Work Distribution Service** → **Intelligent Metric Filter Service**
   - Work distribution analysis feeds into metric filtering
   - Work focus indicator drives metric selection

2. **Intelligent Metric Filter Service** → **Metric Mapping Service**
   - Metric filtering uses metric mapping configuration
   - Team type determines available metrics

3. **Complete Flow**: Jira Issues → Work Distribution → Metric Filtering
   - End-to-end validation of the entire pipeline
   - Ensures all components work together correctly

## Usage Example

```typescript
// Analyze work distribution
const workAnalysis = workDistributionService.analyzeWorkDistribution(issues);

// Get intelligent filtered metrics
const result = intelligentMetricFilterService.getIntelligentMetrics(issues, 'dev');

// Access results
console.log(result.workDistribution); // { stories: 5, bugs: 0, tasks: 2, ... }
console.log(result.workFocus); // { primary: 'Stories', percentage: 71.4, ... }
console.log(result.metrics); // [{ key: 'stories_completed', value: 5, ... }]
```

## Maintenance Notes

- Tests use mock Jira issue data with minimal required fields
- Tests are independent and can run in any order
- All tests use the actual service implementations (no mocking)
- Tests validate both positive cases and edge cases

## Related Files

- `src/lib/kpi/work-distribution.service.ts` - Work distribution analysis
- `src/lib/kpi/intelligent-metric-filter.service.ts` - Intelligent metric filtering
- `src/lib/kpi/metric-mapping.service.ts` - Metric calculation and mapping
- `src/lib/kpi/metric-mapping.config.ts` - Team type metric definitions
