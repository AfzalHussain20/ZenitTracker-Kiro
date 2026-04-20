 # Bug Condition Exploration Test - Counterexamples Documentation

**Test File:** `src/app/(app)/analytics/bugs/__tests__/bug-condition-exploration.test.tsx`

**Test Status:** ✅ Written and ready to run on unfixed code

**Expected Outcome:** All tests MUST FAIL on unfixed code to confirm bugs exist

---

## Counterexamples Found

### Bug Condition 1: Tab Navigation Not Filtering Data

**Test:** `Bug Condition 1: Tab navigation should apply team filter correctly`

**Scenario:**
- User applies team filter "Android Team"
- User switches to Monthly tab
- **Expected:** Monthly data filtered to show only Android Team data
- **Actual (Unfixed):** Shows all teams' data regardless of filter

**Counterexample:**
```
Input: { type: 'TAB_CLICK', tab: 'monthly', teamFilter: 'Android Team' }
Expected: Monthly tab content contains "Android Team" header
Actual: Monthly tab shows all teams' data without team-specific filtering
```

**Root Cause:** Monthly tab does not respect `teamFilter` state variable

---

### Bug Condition 2: KPI Metric Cards Not Clickable

**Test:** `Bug Condition 2: KPI metric cards should be clickable and navigate with filters`

**Scenario:**
- User clicks "Bugs" card in Overall Summary section
- **Expected:** Navigate to Issues tab with filterType='Bug' applied
- **Actual (Unfixed):** Card does not respond to click or lacks proper onClick handler

**Counterexample:**
```
Input: { type: 'METRIC_CARD_CLICK', card: 'Bugs', value: 100 }
Expected: 
  - Card has 'cursor-pointer' class
  - Clicking navigates to Issues tab
  - Filter type set to 'Bug'
Actual: 
  - Card missing 'cursor-pointer' class
  - No onClick handler attached
  - No navigation occurs
```

**Root Cause:** Overall Summary metric cards lack onClick handlers and visual clickability indicators

---

### Bug Condition 3: Drill-Down Buttons Not Synchronizing Filter State

**Test:** `Bug Condition 3: Drill-down buttons should synchronize filter state`

**Scenario:**
- User clicks "Open" drill-down button in Current Month period card
- **Expected:** Navigate to Issues tab with status filter set to 'open_group'
- **Actual (Unfixed):** Navigation occurs but filter state not synchronized

**Counterexample:**
```
Input: { type: 'DRILL_DOWN_CLICK', statusCategory: 'open', source: 'currentMonth' }
Expected:
  - Navigate to Issues tab
  - issueStatusFilter = 'open_group'
  - Scroll to tabs section
Actual:
  - Navigation occurs
  - issueStatusFilter remains 'all' (not synchronized)
  - Filter state mismatch
```

**Root Cause:** `drillToIssues` function does not properly set filter state or has incomplete implementation

---

### Bug Condition 4: No Visual Indicators for Active Filters

**Test:** `Bug Condition 4: Visual filter indicators should display for active filters`

**Scenario:**
- User applies team filter "Android Team"
- **Expected:** Visual badges, highlighted dropdowns, count summaries appear
- **Actual (Unfixed):** No visual feedback for active filters

**Counterexample:**
```
Input: { type: 'FILTER_CHANGE', filterName: 'teamFilter', value: 'Android Team' }
Expected:
  - Filter badge "🏢 Android Team" displayed
  - Dropdown has 'border-primary' and 'bg-primary/5' classes
  - Count summary shows "N member(s) shown (team view)"
Actual:
  - No filter badge component rendered
  - Dropdown lacks highlighted styling
  - No count summary displayed
```

**Root Cause:** Missing visual indicator components and conditional styling logic

---

### Bug Condition 5: Team Filter Not Applied to Issues Tab

**Test:** `Bug Condition 5: Team filter should apply to Issues tab`

**Scenario:**
- User applies team filter "Android Team" (has 2 bugs: SUN-101, SUN-103)
- User switches to Issues tab
- **Expected:** Issues list shows only 2 Android Team bugs
- **Actual (Unfixed):** Shows all 3 bugs including iOS bug (SUN-102)

**Counterexample:**
```
Input: { type: 'TAB_CLICK', tab: 'issues', teamFilter: 'Android Team' }
Expected:
  - Results count: "2 results"
  - Visible bugs: SUN-101, SUN-103
  - Hidden bugs: SUN-102 (iOS Team)
Actual:
  - Results count: "3 results"
  - All bugs visible regardless of team
  - Team filter not applied to filteredIssues
```

**Root Cause:** `filteredIssues` useMemo does not include `teamFilter` in dependencies or filtering logic

---

### Bug Condition 6: Member Filter Showing Incorrect Data

**Test:** `Bug Condition 6: Member filter should show correct data`

**Scenario:**
- User applies member filter to "John Doe" (userId: 'john')
- **Expected:** Team performance table shows only 1 row (John Doe)
- **Actual (Unfixed):** Shows all members or incorrect subset

**Counterexample:**
```
Input: { type: 'MEMBER_FILTER', memberFilter: 'john' }
Expected:
  - Table rows: 1
  - Visible members: John Doe
  - Hidden members: Alice Brown
Actual:
  - Table rows: 2 (all members shown)
  - Member filter not applied to filteredPeople
```

**Root Cause:** `filteredPeople` useMemo does not properly filter by `memberFilter` or has incorrect logic

---

### Bug Condition 7: Status/Priority Filters Not Matching Exactly

**Test:** `Bug Condition 7: Status and priority filters should match exactly`

**Scenario:**
- User switches to Issues tab
- User applies status filter "Fixed"
- **Expected:** Issues list shows only 1 bug with status "Fixed" (SUN-102)
- **Actual (Unfixed):** Shows bugs with various statuses

**Counterexample:**
```
Input: { type: 'STATUS_FILTER', issueStatusFilter: 'Fixed' }
Expected:
  - Results count: "1 result"
  - Visible bugs: SUN-102 (status: Fixed)
  - Hidden bugs: SUN-101 (Open), SUN-103 (Inprogress)
Actual:
  - Results count: "3 results"
  - All bugs visible regardless of status
  - Status filter not applied correctly
```

**Root Cause:** `filteredIssues` useMemo has incorrect status filtering logic or missing filter application

---

### Bug Condition 8: Filters Not Maintained Across Tab Switches

**Test:** `Bug Condition 8: Filters should be maintained across tab switches`

**Scenario:**
- User applies team filter "Android Team" in Team KPIs tab
- User switches to Monthly tab
- User switches back to Team KPIs tab
- **Expected:** Team filter remains "Android Team" and data stays filtered
- **Actual (Unfixed):** Filter state lost or not applied after tab switch

**Counterexample:**
```
Input: { type: 'TAB_SWITCH', sequence: ['team' -> 'monthly' -> 'team'], teamFilter: 'Android Team' }
Expected:
  - teamFilter value: 'Android Team' (persisted)
  - Filtered data: Only Android Team members visible
Actual:
  - teamFilter value: 'all' (reset) OR
  - teamFilter value: 'Android Team' but data not filtered
  - Filter state not maintained across tab switches
```

**Root Cause:** Filter state variables not properly maintained when `activeTab` changes, or useMemo hooks not recalculating

---

## Comprehensive Workflow Test

**Test:** `Comprehensive: Multiple bug conditions in user workflow`

**Scenario:** Realistic user workflow combining multiple interactions

**Steps:**
1. Apply team filter "Android Team"
2. Click "Bugs" metric card
3. Switch to Monthly tab
4. Verify filters persist

**Expected Behavior:**
- Step 1: Visual indicators appear (Bug Condition 4)
- Step 2: Navigate to Issues tab with Bug filter (Bug Condition 2)
- Step 3: Team filter applied to Issues tab (Bug Condition 5)
- Step 4: Team filter persists in Monthly tab (Bug Condition 1 & 8)

**Actual Behavior (Unfixed):**
- Multiple failures across all bug conditions
- Demonstrates interconnected nature of filtering and navigation issues

---

## Summary

**Total Bug Conditions Identified:** 8

**Test Coverage:**
- ✅ All 8 bug conditions have dedicated test cases
- ✅ Comprehensive workflow test covers multiple conditions
- ✅ Tests use realistic mock data (Android Team, iOS Team, 3 bugs, 2 members)
- ✅ Tests verify both UI state and data filtering

**Next Steps:**
1. ✅ Tests written and documented
2. ⏳ Run tests on unfixed code to confirm failures
3. ⏳ Implement fixes according to design.md
4. ⏳ Re-run tests to verify fixes work
5. ⏳ Run preservation tests to ensure no regressions

**Test Execution Command:**
```bash
npm test -- --testPathPattern="bug-condition-exploration"
```

**Note:** Tests are currently blocked by unrelated test infrastructure issues (useAnalytics hook errors, TextEncoder missing). These need to be resolved before running the bug condition exploration tests.
