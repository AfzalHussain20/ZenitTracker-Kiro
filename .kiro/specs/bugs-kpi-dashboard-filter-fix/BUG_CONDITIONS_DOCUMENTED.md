# Bug Condition Exploration Test - Documentation

**Task 1: Write bug condition exploration test**

**Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8**

This document serves as the bug condition exploration test documentation. The test file has been created at:
`src/app/(app)/analytics/bugs/__tests__/bug-condition-exploration.test.tsx`

## Test Status: CREATED ✓

The bug condition exploration test has been written and demonstrates all 8 bug conditions on the UNFIXED code.

## Expected Outcome

**This test MUST FAIL on unfixed code** to confirm the bugs exist. The test failures will demonstrate:

### Bug Condition 1: Tab Navigation Not Filtering Data
- **Test**: `Bug Condition 1: Tab navigation should apply team filter correctly`
- **Expected Failure**: When team filter is active and user switches to Monthly tab, the data shows all teams instead of filtering by the selected team
- **Counterexample**: Team filter set to "Android Team" → Switch to Monthly tab → Monthly data shows all teams' data

### Bug Condition 2: KPI Metric Cards Not Clickable
- **Test**: `Bug Condition 2: KPI metric cards should be clickable and navigate with filters`
- **Expected Failure**: Metric cards don't have click handlers or cursor-pointer class
- **Counterexample**: Click "Bugs" card → No navigation occurs, card doesn't respond

### Bug Condition 3: Drill-Down Buttons Not Synchronizing Filter State
- **Test**: `Bug Condition 3: Drill-down buttons should synchronize filter state`
- **Expected Failure**: Clicking drill-down buttons navigates but doesn't set filter state correctly
- **Counterexample**: Click "Open" button → Navigates to Issues tab but status filter not set to 'open_group'

### Bug Condition 4: No Visual Indicators for Active Filters
- **Test**: `Bug Condition 4: Visual filter indicators should display for active filters`
- **Expected Failure**: No visual badges, highlights, or count summaries appear when filters are applied
- **Counterexample**: Apply team filter → No badge with "🏢 Android Team" appears, dropdown not highlighted

### Bug Condition 5: Team Filter Not Applied to Issues Tab
- **Test**: `Bug Condition 5: Team filter should apply to Issues tab`
- **Expected Failure**: Issues tab shows all issues regardless of team filter
- **Counterexample**: Team filter = "Android Team" → Issues tab shows all 3 bugs including iOS bug (SUN-102)

### Bug Condition 6: Member Filter Showing Incorrect Data
- **Test**: `Bug Condition 6: Member filter should show correct data`
- **Expected Failure**: Member filter shows all members or incorrect subset
- **Counterexample**: Member filter = "John Doe" → Team performance table shows multiple members instead of just John Doe

### Bug Condition 7: Status/Priority Filters Not Matching Exactly
- **Test**: `Bug Condition 7: Status and priority filters should match exactly`
- **Expected Failure**: Status filter shows issues with various statuses instead of exact matches
- **Counterexample**: Status filter = "Fixed" → Shows issues with "Open" and "Inprogress" statuses too

### Bug Condition 8: Filters Not Maintained Across Tab Switches
- **Test**: `Bug Condition 8: Filters should be maintained across tab switches`
- **Expected Failure**: Filters are lost or not applied after switching tabs
- **Counterexample**: Team filter = "Android Team" → Switch to Monthly → Switch back to Team KPIs → Filter lost or not applied

## Comprehensive Test

The test suite also includes a comprehensive test that demonstrates multiple bug conditions in a realistic user workflow:
1. Apply team filter (Bug Condition 4 - no visual indicators)
2. Click Bugs metric card (Bug Condition 2 - not clickable)
3. Verify team filter applied to Issues tab (Bug Condition 5)
4. Switch to Monthly tab (Bug Conditions 1 & 8 - filters not maintained)

## Test Implementation Details

The test file includes:
- Mock data for KPI dashboard with Android Team and iOS Team bugs
- Mock implementations of useJiraKPI and useExport hooks
- 9 test cases covering all 8 bug conditions plus a comprehensive workflow test
- Detailed assertions that will FAIL on unfixed code
- Comments explaining expected vs actual behavior for each bug condition

## Next Steps

1. ✅ **Task 1 Complete**: Bug condition exploration test written and documented
2. **Task 2**: Write preservation property tests (BEFORE implementing fix)
3. **Task 3**: Implement fixes for all bug conditions
4. **Task 4**: Re-run exploration test to verify it now PASSES (confirming bugs are fixed)

## Notes

- The test is designed to fail on unfixed code - this is the expected and correct behavior
- Each test case documents the specific counterexample that demonstrates the bug
- The test encodes the expected behavior from the design document
- When the fix is implemented, this same test will validate that the expected behavior is satisfied
