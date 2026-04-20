# Comprehensive Jira Dashboard Upgrade Plan

## Issues to Fix

### 1. Cache Not Clearing
**Problem**: When clicking filters in member profile modal, old cached data is shown
**Solution**: 
- Add force refresh when filters change
- Clear cache before applying new filters
- Add cache busting mechanism

### 2. Bug Tracker Navigation
**Problem**: Bug Tracker in Apps goes to /analytics/bugs instead of /bugs
**Solution**:
- Revert the redirect in /bugs page
- Create a professional /bugs dashboard (separate from /analytics/bugs)
- Keep /analytics/bugs as the advanced KPI dashboard
- Make /bugs the main Jira bug dashboard

### 3. Advanced Filters Need Apply Button
**Problem**: Filters apply immediately, causing too many API calls
**Solution**:
- Add "Apply Filters" button
- Store filter selections in temporary state
- Only fetch data when Apply is clicked
- Show "Filters changed" indicator

### 4. About Page Needs Upgrade
**Problem**: About page is static
**Solution**:
- Make sections clickable
- Show relevant data when clicked
- Add interactive elements

### 5. Team KPI Needs More Data
**Problem**: Team KPI doesn't show enough information
**Solution**:
- Add comprehensive team statistics
- Show team member breakdown
- Add team performance metrics
- Add team trends

## Implementation Plan

### Phase 1: Fix Cache Issues (Priority: HIGH)
1. Add `forceRefresh` parameter to useJiraKPI
2. Clear cache when filters change from member profile
3. Add loading state during refresh
4. Show "Refreshing..." indicator

### Phase 2: Create Professional /bugs Dashboard (Priority: HIGH)
1. Design new /bugs page layout
2. Add comprehensive bug statistics
3. Add advanced filtering with Apply button
4. Add bug trends and analytics
5. Add team-wise bug breakdown
6. Add priority distribution
7. Add status distribution
8. Add assignee breakdown
9. Add reporter breakdown
10. Add monthly trends

### Phase 3: Add Apply Button to Filters (Priority: HIGH)
1. Create temporary filter state
2. Add "Apply Filters" button
3. Add "Reset Filters" button
4. Show "Filters changed" indicator
5. Only fetch data on Apply click

### Phase 4: Upgrade About Page (Priority: MEDIUM)
1. Add clickable sections
2. Add interactive statistics
3. Add team information
4. Add project information

### Phase 5: Enhance Team KPI (Priority: MEDIUM)
1. Add team member list
2. Add team performance metrics
3. Add team bug statistics
4. Add team story point tracking
5. Add team monthly trends

## Detailed Requirements

### /bugs Dashboard Requirements

#### Layout
```
┌─────────────────────────────────────────────────────────────┐
│  HEADER                                                     │
│  - Title: "Jira Bug Dashboard"                             │
│  - Subtitle: "SunNXT Project (SUN)"                        │
│  - Refresh button                                           │
│  - Link to Jira board                                       │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  SUMMARY CARDS (4 cards)                                    │
│  - Total Bugs                                               │
│  - Open Bugs                                                │
│  - Critical Bugs                                            │
│  - Bugs This Month                                          │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  ADVANCED FILTERS (with Apply button)                       │
│  - Status (dropdown)                                        │
│  - Priority (dropdown)                                      │
│  - Assignee (dropdown)                                      │
│  - Reporter (dropdown)                                      │
│  - Date Range (from/to)                                     │
│  - [Apply Filters] [Reset]                                  │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  TABS                                                       │
│  - Dashboard (charts and stats)                             │
│  - Bug List (table with all bugs)                          │
│  - Team View (team-wise breakdown)                          │
│  - Analytics (trends and insights)                          │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  DASHBOARD TAB                                              │
│  ┌───────────────────┐  ┌───────────────────┐             │
│  │ Priority Chart    │  │ Status Chart      │             │
│  └───────────────────┘  └───────────────────┘             │
│  ┌───────────────────┐  ┌───────────────────┐             │
│  │ Assignee Chart    │  │ Monthly Trend     │             │
│  └───────────────────┘  └───────────────────┘             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  BUG LIST TAB                                               │
│  - Search box                                               │
│  - Bug table with columns:                                  │
│    * Key                                                    │
│    * Summary                                                │
│    * Status                                                 │
│    * Priority                                               │
│    * Assignee                                               │
│    * Reporter                                               │
│    * Created Date                                           │
│  - Pagination                                               │
│  - Export button                                            │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  TEAM VIEW TAB                                              │
│  - Team cards showing:                                      │
│    * Team name                                              │
│    * Total bugs                                             │
│    * Open bugs                                              │
│    * Team members                                           │
│    * Click to drill down                                    │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  ANALYTICS TAB                                              │
│  - Bug trends over time                                     │
│  - Top reporters                                            │
│  - Top assignees                                            │
│  - Resolution time analysis                                 │
│  - Bug age analysis                                         │
└─────────────────────────────────────────────────────────────┘
```

#### Features
1. **Real-time Data**: Fetch fresh data from Jira (no 10-minute cache)
2. **Advanced Filtering**: All filters with Apply button
3. **Export**: Export filtered bugs to CSV/Excel
4. **Drill-down**: Click on charts to filter bugs
5. **Search**: Search by bug ID or summary
6. **Sorting**: Sort by any column
7. **Pagination**: Handle large datasets
8. **Responsive**: Works on all screen sizes

### Apply Button Behavior

```typescript
// Temporary filter state (not applied yet)
const [tempFilters, setTempFilters] = useState({
  status: 'all',
  priority: 'all',
  assignee: 'all',
  reporter: 'all',
  dateFrom: '',
  dateTo: ''
});

// Applied filters (used for fetching data)
const [appliedFilters, setAppliedFilters] = useState({...});

// Check if filters have changed
const filtersChanged = JSON.stringify(tempFilters) !== JSON.stringify(appliedFilters);

// Apply button handler
const handleApplyFilters = () => {
  setAppliedFilters({...tempFilters});
  fetchData(tempFilters); // Fetch with new filters
};

// Reset button handler
const handleResetFilters = () => {
  const defaultFilters = { status: 'all', priority: 'all', ... };
  setTempFilters(defaultFilters);
  setAppliedFilters(defaultFilters);
  fetchData(defaultFilters);
};
```

### Cache Clearing Strategy

```typescript
// In useJiraKPI hook
export function useJiraKPI(forceRefresh = false) {
  useEffect(() => {
    if (forceRefresh) {
      // Clear cache
      // Fetch fresh data
    }
  }, [forceRefresh]);
}

// In member profile modal
const handleFilterBugs = (filters) => {
  // Clear cache
  localStorage.removeItem('jira-kpi-cache');
  
  // Apply filters
  onFilterBugs(filters);
  
  // Force refresh
  forceRefresh();
  
  // Close modal
  onClose();
};
```

## File Structure

```
src/
├── app/
│   └── (app)/
│       ├── bugs/
│       │   └── page.tsx (NEW: Professional bug dashboard)
│       ├── analytics/
│       │   └── bugs/
│       │       └── page.tsx (EXISTING: Advanced KPI dashboard)
│       └── about/
│           └── page.tsx (UPGRADE: Make interactive)
├── hooks/
│   ├── useJiraKPI.ts (UPDATE: Add forceRefresh)
│   └── useJiraBugs.ts (NEW: Dedicated hook for bugs page)
└── components/
    └── bugs/
        ├── BugSummaryCards.tsx (NEW)
        ├── BugFilters.tsx (NEW: With Apply button)
        ├── BugList.tsx (NEW)
        ├── BugCharts.tsx (NEW)
        └── TeamBugView.tsx (NEW)
```

## Priority Order

1. **HIGH**: Fix cache clearing issue
2. **HIGH**: Add Apply button to filters
3. **HIGH**: Create professional /bugs dashboard
4. **MEDIUM**: Upgrade About page
5. **MEDIUM**: Enhance Team KPI

## Estimated Effort

- Phase 1 (Cache fix): 30 minutes
- Phase 2 (Bugs dashboard): 2-3 hours
- Phase 3 (Apply button): 1 hour
- Phase 4 (About page): 1 hour
- Phase 5 (Team KPI): 1 hour

**Total**: 5-6 hours

## Next Steps

1. Get approval on the plan
2. Start with Phase 1 (cache fix) - quick win
3. Move to Phase 3 (Apply button) - improves UX
4. Then Phase 2 (bugs dashboard) - main feature
5. Finally Phases 4 & 5 - enhancements

## Questions

1. Should /bugs and /analytics/bugs be completely separate, or should they share some components?
2. Do you want WebSocket real-time updates, or is polling every minute acceptable?
3. Should the Apply button be on all filter pages, or just /bugs?
4. What specific data should be clickable on the About page?

---

**Status**: Plan ready for review and approval
**Next**: Implement Phase 1 (cache fix) after approval
