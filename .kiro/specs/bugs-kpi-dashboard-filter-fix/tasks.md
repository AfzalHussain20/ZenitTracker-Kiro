# Implementation Plan

## Overview
This task list implements fixes for multiple interconnected filtering and navigation issues in the Bugs KPI Dashboard. The fixes ensure consistent filter application across all tabs, proper navigation with filter synchronization, clear visual feedback for active filters, and accurate data filtering.

---

## Phase 1: Exploration Tests (BEFORE Fix)

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Filter and Navigation Failures
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bugs exist
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bugs exist
  - **Scoped PBT Approach**: Test concrete failing cases to ensure reproducibility
  - Test implementation details from Bug Condition in design:
    - Tab clicks not filtering data correctly (teamFilter not applied to all tabs)
    - KPI metric cards not clickable or not navigating properly
    - Drill-down buttons not synchronizing filter state
    - No visual indicators for active filters (missing badges, highlights)
    - Team filter not applied to Issues tab
    - Member filter showing incorrect data
    - Status/priority filters not matching exactly
    - Filters not maintained across tab switches
  - The test assertions should match the Expected Behavior Properties from design:
    - Tab navigation applies filters correctly
    - KPI metric cards navigate with filters
    - Drill-down buttons apply correct filters
    - Visual filter indicators display
    - Team filter applies across all tabs
    - Member filter shows correct data
    - Status and priority filters match exactly
    - Filters persist across tab switches
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bugs exist)
  - Document counterexamples found to understand root cause:
    - Which metric cards don't respond to clicks
    - Which tabs don't respect team filter
    - Which visual indicators are missing
    - Which filter combinations cause incorrect data display
  - Mark task complete when test is written, run, and failures are documented
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8_

---

## Phase 2: Preservation Tests (BEFORE Fix)

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Non-Filter Functionality Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for non-filter interactions:
    - Data fetching and caching with useJiraKPI hook
    - Force Sync button clearing cache and refetching
    - Search functionality in Issues tab (bug ID and keyword searches)
    - Export functionality exporting filtered datasets
    - Work Logs tab independent filtering with local state
    - Period overview cards calculating accurate statistics
    - Team performance metrics table showing accurate per-member stats
    - Monthly ticket counts table displaying correct historical data
  - Write property-based tests capturing observed behavior patterns from Preservation Requirements:
    - For all non-filter user interactions, behavior remains unchanged
    - Data fetching produces same results before and after fix
    - Cache mechanism works identically
    - Search produces same results
    - Export produces same output
    - Work logs load and filter independently
    - Statistics calculations remain accurate
  - Property-based testing generates many test cases for stronger guarantees
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

---

## Phase 3: Implementation

- [ ] 3. Fix for Bugs KPI Dashboard Filter and Navigation Issues

  - [ ] 3.1 Add click handlers to Overall Summary metric cards
    - Modify Overall Summary section metric cards to include proper onClick handlers
    - For "Total Issues" card: set filterType='all' and call drillToIssues('total')
    - For "Bugs" card: set filterType='Bug' and call drillToIssues('total')
    - For "Stories" card: set filterType='Story' and call drillToIssues('total')
    - For "Epics" card: set filterType='Epic' and call drillToIssues('total')
    - For "Tasks" card: set filterType='Task' and call drillToIssues('total')
    - For "Live Tickets" card: set activeTab='live' and scroll to top
    - For "Story Points" card: set activeTab='storypoints'
    - Add cursor-pointer and hover styles (hover:shadow-lg hover:scale-105) to indicate clickability
    - Add visual feedback text "↗ click to view" for clickable cards
    - _Bug_Condition: isBugCondition(input) where input.type === 'METRIC_CARD_CLICK' AND NOT navigatedToIssuesTab(input)_
    - _Expected_Behavior: For any KPI metric card click, navigate to appropriate tab AND apply correct filter_
    - _Preservation: Non-clickable elements remain unchanged_
    - _Requirements: 1.2, 2.2_

  - [ ] 3.2 Fix filteredIssues useMemo dependencies and logic
    - Ensure dependency array includes: kpi, filterType, filterMonth, issueSearch, issueStatusFilter, issuePriorityFilter, teamFilter
    - Add team filter logic: if (teamFilter !== 'all') issues = issues.filter(i => i.team === teamFilter)
    - Verify month filter is applied correctly: if (filterMonth !== 'all') issues = issues.filter(i => i.created.startsWith(filterMonth))
    - Verify status group filters work correctly:
      - 'open_group': filter by OPEN_STATUSES_SET
      - 'closed_group': filter by CLOSED_STATUSES_SET
      - 'in_progress_group': filter by IN_PROGRESS_STATUSES_SET
    - Verify priority filter: if (issuePriorityFilter !== 'all') issues = issues.filter(i => i.priority === issuePriorityFilter)
    - Verify search logic works for bug ID exact match and keyword search
    - _Bug_Condition: isBugCondition(input) where input.type === 'TEAM_FILTER' AND NOT allTabsFiltered(input.team)_
    - _Expected_Behavior: For any team filter selection, all data across all tabs filtered by team_
    - _Preservation: Existing filter logic for status, priority, month, search remains unchanged_
    - _Requirements: 1.5, 1.7, 2.5, 2.7_

  - [ ] 3.3 Fix filteredPeople useMemo dependencies and logic
    - Ensure dependency array includes: kpi, memberSearch, memberFilter, teamFilter, filterMonth, sortBy
    - Verify member filter takes priority: if (memberFilter !== 'all') people = people.filter(p => p.userId === memberFilter)
    - Verify team filter shows all members of that team: else if (teamFilter !== 'all') people = people.filter(p => p.teams.includes(teamFilter))
    - Verify name search works: if (memberSearch) people = people.filter(p => p.name.toLowerCase().includes(q))
    - Verify month filter recalculates stats correctly
    - Verify re-ranking happens after filtering
    - _Bug_Condition: isBugCondition(input) where input.type === 'MEMBER_FILTER' AND dataIncorrect(input.member)_
    - _Expected_Behavior: For any member filter selection, show only that member's data_
    - _Preservation: Sorting and ranking logic remains unchanged_
    - _Requirements: 1.6, 2.6_

  - [ ] 3.4 Fix teamScopedStats useMemo dependencies and logic
    - Ensure dependency array includes: kpi, teamFilter
    - Verify it returns null when teamFilter === 'all'
    - Verify it correctly filters bugs by team: const teamBugs = kpi.bugs.filter(b => b.team === teamFilter)
    - Verify it calculates period stats correctly for overall, currentMonth, previousMonth
    - Verify status classification logic works correctly
    - _Bug_Condition: isBugCondition(input) where input.type === 'TAB_CLICK' AND dataNotFilteredForTab(input.tab)_
    - _Expected_Behavior: For any tab click, display data filtered by active team filter_
    - _Preservation: Period statistics calculation logic remains unchanged_
    - _Requirements: 1.1, 2.1, 2.8_

  - [ ] 3.5 Add visual filter indicators to Team KPIs tab
    - Add active filter badge section below filter controls
    - Show badge for active team filter with format: "🏢 {teamFilter}" with X button
    - Show badge for active member filter with format: "👤 {memberName}" with X button
    - Add count summary showing "{N} member(s) shown (team view)" or "(individual view)"
    - Apply border-primary and bg-primary/5 styling to active filter dropdowns
    - Add conditional className: cn('w-40 h-8 text-xs', teamFilter !== 'all' && 'border-primary bg-primary/5 font-medium')
    - Ensure badges have click handlers to clear individual filters
    - _Bug_Condition: isBugCondition(input) where input.type === 'FILTER_CHANGE' AND NOT visualIndicatorShown(input)_
    - _Expected_Behavior: For any filter application, display clear visual indicators_
    - _Preservation: Existing filter dropdown functionality remains unchanged_
    - _Requirements: 1.4, 2.4_

  - [ ] 3.6 Fix drillToIssues function
    - Ensure it properly clears conflicting filters before setting new ones
    - For statusCategory 'critical': set priorityParam = 'Highest', statusParam = 'all'
    - For statusCategory 'high': set priorityParam = 'High', statusParam = 'all'
    - For statusCategory 'open': set statusParam = 'open_group', priorityParam = 'all'
    - For statusCategory 'closed': set statusParam = 'closed_group', priorityParam = 'all'
    - For statusCategory 'in_progress': set statusParam = 'in_progress_group', priorityParam = 'all'
    - For statusCategory 'total': set statusParam = 'all', priorityParam = 'all'
    - Ensure setTimeout for scroll happens after React state update completes (50ms delay)
    - Ensure it maintains team and member filters when drilling down (don't reset teamFilter or memberFilter)
    - Add proper type safety for statusCategory parameter
    - _Bug_Condition: isBugCondition(input) where input.type === 'DRILL_DOWN_CLICK' AND NOT filtersSynchronized(input)_
    - _Expected_Behavior: For any drill-down button click, navigate to Issues tab AND apply correct filter_
    - _Preservation: Scroll behavior and timing remain unchanged_
    - _Requirements: 1.3, 2.3_

  - [ ] 3.7 Add filter application to Monthly tab
    - Filter monthly data by teamFilter if active
    - Add logic to filter kpi.monthly array by team before displaying
    - Show team name in section header when filtered: "{teamFilter} — Monthly Ticket Counts"
    - Add visual indicator badge for active team filter in Monthly tab header
    - Ensure monthly statistics are recalculated for filtered team only
    - _Bug_Condition: isBugCondition(input) where input.type === 'TAB_CLICK' AND dataNotFilteredForTab('monthly')_
    - _Expected_Behavior: For Monthly tab, display data filtered by active team filter_
    - _Preservation: Monthly data calculation logic remains unchanged_
    - _Requirements: 1.1, 2.1, 2.8_

  - [ ] 3.8 Fix Live Builds tab filtering
    - Ensure filteredLiveTickets respects both teamFilter and liveTeamFilter
    - Apply team filter first: if (teamFilter !== 'all') tickets = tickets.filter(t => t.team === teamFilter)
    - Then apply member filter: if (liveTeamFilter !== 'all') tickets = tickets.filter(t => t.assignee?.displayName === liveTeamFilter || t.reporter?.displayName === liveTeamFilter)
    - Verify filter controls are properly synchronized
    - Add visual indicator for active team filter in Live Builds tab
    - Ensure per-member summary cards respect team filter
    - _Bug_Condition: isBugCondition(input) where input.type === 'TAB_CLICK' AND dataNotFilteredForTab('live')_
    - _Expected_Behavior: For Live Builds tab, display data filtered by active team and member filters_
    - _Preservation: Live tickets data structure and display logic remain unchanged_
    - _Requirements: 1.1, 2.1, 2.8_

  - [ ] 3.9 Add filter state persistence across tab switches
    - Verify all filter state variables are maintained when activeTab changes
    - Ensure useMemo hooks recalculate when switching tabs (dependencies include activeTab if needed)
    - Test that teamFilter, memberFilter, filterMonth, filterType, issueStatusFilter, issuePriorityFilter persist
    - Verify filters remain active and applied after tab navigation
    - Add console logging or debugging to verify filter state during tab switches
    - _Bug_Condition: isBugCondition(input) where input.type === 'TAB_SWITCH' AND filtersNotMaintained(input)_
    - _Expected_Behavior: For any tab switch, filters persist and remain applied_
    - _Preservation: Tab switching mechanism and state management remain unchanged_
    - _Requirements: 1.8, 2.8_

  - [ ] 3.10 Add Clear All Filters button
    - Add a global "Clear All Filters" button in the header or filter bar
    - Should reset: teamFilter='all', memberFilter='all', filterMonth='all', filterType='Bug', issueStatusFilter='all', issuePriorityFilter='all'
    - Should be visible only when at least one filter is active (not all filters are 'all')
    - Add conditional rendering: {(teamFilter !== 'all' || memberFilter !== 'all' || filterMonth !== 'all' || issueStatusFilter !== 'all' || issuePriorityFilter !== 'all') && <Button>Clear All Filters</Button>}
    - Style as destructive variant: variant="ghost" className="text-destructive"
    - Position near other filter controls for easy access
    - _Bug_Condition: isBugCondition(input) where input.type === 'FILTER_CHANGE' AND NOT visualIndicatorShown(input)_
    - _Expected_Behavior: Provide easy way to reset all filters to default state_
    - _Preservation: Individual filter clear buttons remain unchanged_
    - _Requirements: 2.4_

  - [ ] 3.11 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Filter and Navigation Working Correctly
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bugs are fixed)
    - Verify all counterexamples from task 1 are now resolved:
      - Metric cards respond to clicks and navigate correctly
      - Tabs respect team filter and show filtered data
      - Visual indicators appear for all active filters
      - Filter combinations produce correct data display
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8_

  - [ ] 3.12 Verify preservation tests still pass
    - **Property 2: Preservation** - Non-Filter Functionality Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all non-filter functionality still works:
      - Data fetching and caching unchanged
      - Force Sync works correctly
      - Search functionality unchanged
      - Export functionality unchanged
      - Work Logs tab unchanged
      - Period statistics unchanged
      - Team performance metrics unchanged
      - Monthly counts unchanged
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

---

## Phase 4: Checkpoint

- [ ] 4. Checkpoint - Ensure all tests pass
  - Run all exploration tests - should PASS
  - Run all preservation tests - should PASS
  - Manually test all filter combinations in the UI
  - Manually test all navigation flows (metric cards, drill-down buttons, tab switches)
  - Verify visual indicators appear correctly for all filter types
  - Verify data accuracy for all filter combinations
  - Test edge cases: no data, all filters active, conflicting filters
  - Ensure no regressions in non-filter functionality
  - Ask the user if questions arise or if any issues are found

---

## Notes

- All tasks reference specific requirements from the bugfix.md and design.md documents
- The bug condition methodology is applied throughout: identify buggy inputs (C), verify expected behavior (P), preserve non-buggy behavior (¬C)
- Exploration tests MUST fail on unfixed code to confirm bugs exist
- Preservation tests MUST pass on unfixed code to establish baseline
- Implementation tasks include specific code changes with file locations and function names
- All tests are re-run after implementation to verify fixes work and no regressions occurred
