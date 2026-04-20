# Bugs KPI Dashboard Filter Fix Design

## Overview

The Bugs KPI Dashboard has multiple interconnected filtering and navigation issues that prevent accurate data display and user interaction. The core problems stem from:

1. **Inconsistent filter application** - Team and member filters don't consistently apply across all tabs
2. **Broken navigation** - KPI metric cards and drill-down buttons don't properly navigate to filtered views
3. **Missing visual feedback** - No clear indication of active filters in the UI
4. **Filter state synchronization** - Filters don't persist or sync correctly when switching tabs

The fix will establish a single source of truth for filter state, ensure consistent filter application across all data views, implement proper navigation with filter synchronization, and add clear visual indicators for active filters.

## Glossary

- **Bug_Condition (C)**: The condition that triggers incorrect filtering or navigation behavior
- **Property (P)**: The desired correct behavior for filtering and navigation
- **Preservation**: Existing functionality that must remain unchanged (data fetching, caching, export, search)
- **teamFilter**: State variable controlling which team's data is displayed (filters by Jira Team custom field)
- **memberFilter**: State variable controlling which specific member's data is displayed (filters by reporter/assignee)
- **issueStatusFilter**: State variable controlling status filtering in Issues tab
- **issuePriorityFilter**: State variable controlling priority filtering in Issues tab
- **filterType**: State variable controlling issue type (Bug, Story, Epic, Task, all)
- **activeTab**: State variable controlling which tab is currently displayed
- **drillToIssues**: Function that navigates to Issues tab with specific filters applied
- **filteredPeople**: Computed array of team members after applying team/member filters
- **filteredIssues**: Computed array of issues after applying all filters
- **teamScopedStats**: Computed period statistics filtered by selected team

## Bug Details

### Bug Condition

The bugs manifest when users interact with filters and navigation elements. The dashboard fails to correctly apply filters, navigate with proper context, or display filter state.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type UserInteraction (tab click, filter change, metric card click, drill-down button click)
  OUTPUT: boolean
  
  RETURN (input.type === 'TAB_CLICK' AND dataNotFilteredForTab(input.tab))
         OR (input.type === 'METRIC_CARD_CLICK' AND NOT navigatedToIssuesTab(input))
         OR (input.type === 'DRILL_DOWN_CLICK' AND NOT filtersSynchronized(input))
         OR (input.type === 'FILTER_CHANGE' AND NOT visualIndicatorShown(input))
         OR (input.type === 'TEAM_FILTER' AND NOT allTabsFiltered(input.team))
         OR (input.type === 'MEMBER_FILTER' AND dataIncorrect(input.member))
         OR (input.type === 'STATUS_FILTER' AND resultsNotMatching(input.status))
         OR (input.type === 'TAB_SWITCH' AND filtersNotMaintained(input))
END FUNCTION
```

### Examples

**Example 1: Tab Click Not Filtering Data**
- User selects "Team KPIs" tab
- Expected: Display team performance data filtered by active team filter
- Actual: Shows all team data regardless of active filters

**Example 2: KPI Metric Card Not Clickable**
- User clicks "Bugs" card in Overall Summary section (showing 150 bugs)
- Expected: Navigate to Issues tab with filterType='Bug' applied
- Actual: Card does not respond to click, no navigation occurs

**Example 3: Drill-Down Filter Not Synchronized**
- User clicks "Open" button in Current Month period card
- Expected: Navigate to Issues tab with status filter set to 'open_group' and scroll to tabs
- Actual: Navigates but filter state not properly set, shows all issues

**Example 4: Filter Bar Shows No Visual Indication**
- User selects "Android Team" from team filter dropdown
- Expected: Filter dropdown highlighted, active filter badge shown, count updated
- Actual: Dropdown shows selection but no visual emphasis, no badge, unclear what's filtered

**Example 5: Team Filter Not Applied to Issues Tab**
- User selects "iOS Team" in team filter, switches to Issues tab
- Expected: Issues list shows only iOS Team issues
- Actual: Shows all issues regardless of team filter

**Example 6: Member Filter Shows Incorrect Data**
- User selects specific member "John Doe" from member filter
- Expected: All tabs show only John Doe's reported bugs and assigned tickets
- Actual: Some tabs show correct data, others show all members or incorrect subset

**Example 7: Status Filter Results Don't Match**
- User selects "Fixed" from status filter in Issues tab
- Expected: Issues list shows only issues with status="Fixed"
- Actual: Shows issues with various statuses including non-Fixed items

**Example 8: Filters Not Maintained Across Tab Switches**
- User applies team filter "Android Team", switches to Monthly tab, then back to Team KPIs
- Expected: Android Team filter remains active and applied
- Actual: Filter state lost or not applied correctly after tab switch

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Data fetching and caching mechanism (useJiraKPI hook) must continue to work exactly as before
- Force Sync button must continue to clear cache and refetch data
- Search functionality in Issues tab must continue to work for bug ID and keyword searches
- Export functionality must continue to export currently filtered datasets
- Work Logs tab independent filtering must continue to work with local state
- Period overview cards (Overall, Current Month, Previous Month) must continue to calculate accurate statistics
- Team performance metrics table must continue to show accurate per-member statistics
- Monthly ticket counts table must continue to display correct historical data

**Scope:**
All data processing, API calls, caching logic, and non-filter-related UI interactions should be completely unaffected by this fix. This includes:
- useJiraKPI hook data fetching and polling
- useExport hook functionality
- Work log loading and display
- Date calculations and month key generation
- Status classification logic
- Quality score calculations

## Hypothesized Root Cause

Based on the bug description and code analysis, the most likely issues are:

1. **Missing Click Handlers on Metric Cards**: The Overall Summary metric cards (Total Issues, Bugs, Stories, Epics, Tasks) have visual styling but may be missing proper onClick handlers or the handlers don't correctly set filterType and navigate to Issues tab.

2. **Incomplete Filter Application in useMemo Dependencies**: The filteredIssues, filteredPeople, and teamScopedStats useMemo hooks may not include all necessary filter state variables in their dependency arrays, causing stale data to be displayed.

3. **Filter State Not Passed to Child Components**: The Work Logs tab and other sub-components may not receive updated filter props or may not react to filter changes properly.

4. **Missing Visual Feedback Components**: There are no dedicated UI components to show active filter badges, highlighted filter controls, or filter summary sections in all tabs.

5. **Drill-Down Navigation Incomplete**: The drillToIssues function sets filter state but may not properly handle all edge cases (e.g., clearing conflicting filters, ensuring scroll happens after state update).

6. **Tab-Specific Filter Logic Missing**: Each tab may need specific filter application logic that's currently missing or incomplete (e.g., Monthly tab not respecting team filter).

## Correctness Properties

Property 1: Bug Condition - Tab Navigation Applies Filters Correctly

_For any_ tab click where the user switches to a different tab (Team KPIs, Monthly, Issues, Live Builds, Story Points, Work Logs), the fixed dashboard SHALL display data accurately filtered according to all active filters (team, member, month, type, status, priority) appropriate for that tab's context.

**Validates: Requirements 2.1, 2.8**

Property 2: Bug Condition - KPI Metric Cards Navigate with Filters

_For any_ KPI metric card click in the Overall Summary section (Total Issues, Bugs, Stories, Epics, Tasks, Story Points, Live Tickets), the fixed dashboard SHALL navigate to the appropriate tab (Issues or Live Builds) AND apply the correct filter for that metric type (e.g., filterType='Bug' for Bugs card) AND maintain any existing team/member filters.

**Validates: Requirements 2.2**

Property 3: Bug Condition - Drill-Down Buttons Apply Correct Filters

_For any_ drill-down button click in period overview cards (Open, Closed, In Progress, Critical, High), the fixed dashboard SHALL navigate to the Issues tab AND apply the correct status or priority filter AND scroll smoothly to the tabs section AND maintain existing team/member filters.

**Validates: Requirements 2.3**

Property 4: Bug Condition - Visual Filter Indicators Display

_For any_ filter application (team, member, month, status, priority), the fixed dashboard SHALL display clear visual indicators including: highlighted filter dropdowns with distinct styling, active filter badge components showing filter name and value, and filter summary sections showing count of filtered results.

**Validates: Requirements 2.4**

Property 5: Bug Condition - Team Filter Applies Across All Tabs

_For any_ team filter selection, the fixed dashboard SHALL filter all data across all tabs (Team KPIs, Monthly, Issues, Live Builds, Story Points) to show only issues where the team field (customfield_10001) matches the selected team.

**Validates: Requirements 2.5**

Property 6: Bug Condition - Member Filter Shows Correct Data

_For any_ member filter selection, the fixed dashboard SHALL filter data to show only that specific member's issues (as reporter for bugs, as assignee for tickets) across all relevant tabs, regardless of team filter state.

**Validates: Requirements 2.6**

Property 7: Bug Condition - Status and Priority Filters Match Exactly

_For any_ status or priority filter selection in the Issues tab, the fixed dashboard SHALL display only issues that exactly match the selected status and priority criteria, with no extraneous results.

**Validates: Requirements 2.7**

Property 8: Preservation - Non-Filter Functionality Unchanged

_For any_ user interaction that does NOT involve filtering or navigation (data fetching, cache refresh, export, search, work log loading), the fixed dashboard SHALL produce exactly the same behavior as the original dashboard, preserving all existing functionality.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `src/app/(app)/analytics/bugs/page.tsx`

**Function**: `KPIDashboard` (main component)

**Specific Changes**:

1. **Add Click Handlers to Overall Summary Metric Cards**:
   - Modify the Overall Summary section metric cards to include proper onClick handlers
   - For "Total Issues", "Bugs", "Stories", "Epics", "Tasks": set filterType and call drillToIssues('total')
   - For "Live Tickets": set activeTab to 'live' and scroll to top
   - For "Story Points": set activeTab to 'storypoints'
   - Add cursor-pointer and hover styles to indicate clickability

2. **Fix filteredIssues useMemo Dependencies**:
   - Ensure dependency array includes: kpi, filterType, filterMonth, issueSearch, issueStatusFilter, issuePriorityFilter, teamFilter
   - Verify team filter is applied: `if (teamFilter !== 'all') issues = issues.filter(i => i.team === teamFilter)`
   - Verify month filter is applied correctly
   - Verify status group filters (open_group, closed_group, in_progress_group) work correctly

3. **Fix filteredPeople useMemo Dependencies**:
   - Ensure dependency array includes: kpi, memberSearch, memberFilter, teamFilter, filterMonth, sortBy
   - Verify member filter takes priority over team filter
   - Verify team filter shows all members of that team
   - Verify re-ranking happens after filtering

4. **Fix teamScopedStats useMemo Dependencies**:
   - Ensure dependency array includes: kpi, teamFilter
   - Verify it returns null when teamFilter === 'all'
   - Verify it correctly filters bugs by team and calculates period stats

5. **Add Visual Filter Indicators**:
   - Add active filter badge section below filter controls in Team KPIs tab
   - Show badges for active team filter and member filter with clear labels
   - Add "X" button to each badge to clear that specific filter
   - Add count summary showing "N members shown (team view)" or "(individual view)"
   - Apply border-primary and bg-primary/5 styling to active filter dropdowns
   - Ensure all tabs show filter state consistently

6. **Fix drillToIssues Function**:
   - Ensure it properly clears conflicting filters before setting new ones
   - Ensure setTimeout for scroll happens after React state update completes
   - Ensure it maintains team and member filters when drilling down
   - Add proper type safety for statusCategory parameter

7. **Add Filter Application to Monthly Tab**:
   - Filter monthly data by teamFilter if active
   - Show team name in section header when filtered
   - Add visual indicator badge for active team filter

8. **Fix Live Builds Tab Filtering**:
   - Ensure filteredLiveTickets respects both teamFilter and liveTeamFilter
   - Verify team filter is applied first, then member filter
   - Ensure filter controls are properly synchronized

9. **Add Filter State Persistence Across Tab Switches**:
   - Verify all filter state variables are maintained when activeTab changes
   - Ensure useMemo hooks recalculate when switching tabs
   - Test that filters remain active and applied after tab navigation

10. **Add Clear All Filters Button**:
    - Add a global "Clear All Filters" button in the header or filter bar
    - Should reset: teamFilter, memberFilter, filterMonth, filterType, issueStatusFilter, issuePriorityFilter
    - Should be visible only when at least one filter is active

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bugs on unfixed code, then verify the fixes work correctly and preserve existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bugs BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write tests that simulate user interactions with filters and navigation elements. Run these tests on the UNFIXED code to observe failures and understand the root causes.

**Test Cases**:
1. **Tab Click Filter Test**: Click Team KPIs tab with team filter active (will fail on unfixed code - shows all teams)
2. **Metric Card Click Test**: Click "Bugs" card in Overall Summary (will fail on unfixed code - no navigation)
3. **Drill-Down Navigation Test**: Click "Open" button in Current Month card (will fail on unfixed code - filter not applied)
4. **Visual Indicator Test**: Apply team filter and check for visual feedback (will fail on unfixed code - no badges shown)
5. **Team Filter Issues Tab Test**: Apply team filter and switch to Issues tab (will fail on unfixed code - shows all issues)
6. **Member Filter Test**: Select specific member and verify data across tabs (will fail on unfixed code - incorrect data)
7. **Status Filter Match Test**: Apply "Fixed" status filter in Issues tab (will fail on unfixed code - shows non-matching statuses)
8. **Tab Switch Persistence Test**: Apply filters, switch tabs, switch back (will fail on unfixed code - filters lost)

**Expected Counterexamples**:
- Metric cards don't respond to clicks or don't navigate
- Filter dropdowns change value but data doesn't update
- No visual badges or highlights appear when filters are active
- Switching tabs causes filters to be ignored or reset
- Possible causes: missing onClick handlers, incomplete useMemo dependencies, missing visual components, state synchronization issues

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL interaction WHERE isBugCondition(interaction) DO
  result := handleInteraction_fixed(interaction)
  ASSERT expectedBehavior(result)
END FOR
```

**Test Cases**:
1. Click each tab and verify filtered data is displayed correctly
2. Click each metric card and verify navigation with correct filters
3. Click each drill-down button and verify filter synchronization
4. Apply each filter type and verify visual indicators appear
5. Apply team filter and verify all tabs show only that team's data
6. Apply member filter and verify only that member's data is shown
7. Apply status/priority filters and verify exact matches only
8. Switch tabs multiple times and verify filters persist

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL interaction WHERE NOT isBugCondition(interaction) DO
  ASSERT handleInteraction_original(interaction) = handleInteraction_fixed(interaction)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain
- It catches edge cases that manual unit tests might miss
- It provides strong guarantees that behavior is unchanged for all non-filter interactions

**Test Plan**: Observe behavior on UNFIXED code first for non-filter interactions, then write property-based tests capturing that behavior.

**Test Cases**:
1. **Data Fetching Preservation**: Verify useJiraKPI hook fetches data identically before and after fix
2. **Force Sync Preservation**: Verify Force Sync button clears cache and refetches correctly
3. **Search Preservation**: Verify bug ID and keyword search work identically
4. **Export Preservation**: Verify export functionality produces same output
5. **Work Logs Preservation**: Verify Work Logs tab loads and filters independently
6. **Period Stats Preservation**: Verify period overview cards show same statistics
7. **Team Performance Preservation**: Verify team performance table shows same metrics
8. **Monthly Counts Preservation**: Verify monthly ticket counts table shows same data

### Unit Tests

- Test drillToIssues function with various statusCategory inputs
- Test filter application logic in useMemo hooks
- Test visual indicator rendering with different filter states
- Test click handlers on metric cards
- Test filter state persistence across tab switches
- Test edge cases (no data, all filters active, conflicting filters)

### Property-Based Tests

- Generate random filter combinations and verify data is correctly filtered
- Generate random navigation sequences and verify filters persist
- Generate random user interaction patterns and verify UI state consistency
- Test that all filter combinations produce valid filtered datasets

### Integration Tests

- Test full user flow: apply filters → switch tabs → drill down → clear filters
- Test filter interaction with search functionality
- Test filter interaction with export functionality
- Test visual feedback appears correctly for all filter types
- Test that filtered data counts match displayed badges and summaries
