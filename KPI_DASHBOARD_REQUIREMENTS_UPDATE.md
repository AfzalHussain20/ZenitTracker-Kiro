# KPI Dashboard Requirements Update

## Project Manager Requirements

### 1. Team-wise Split Need Monthly Report
**Current State:**
- Teams tab shows team cards with overall stats
- No monthly breakdown per team

**Required Changes:**
- Add monthly report view for each team
- Show month-by-month breakdown of team performance
- Include all team metrics split by month

### 2. Particular Member Detail Monthly Report Need Decimal Value
**Current State:**
- Member profile modal has "Monthly" tab
- Shows: `reported`, `closed`, `open`, `assigned` (all integers)
- Missing: `storyPoints` (currently exists in data but not displayed)

**Required Changes:**
- Display story points in monthly report (can be decimal: 0.5, 1.5, 2.5, etc.)
- Format decimal values properly (e.g., "2.5 SP" not "2.5000")

### 3. Particular Member Detail Monthly Report Need Exact Keys: To-Do, Inprogress, Done
**Current State:**
- Monthly tab shows: `Reported`, `Open`, `Closed`, `Assigned`
- Uses generic status labels

**Required Changes:**
- Replace labels with exact keys:
  - `To-Do` (instead of "Open")
  - `Inprogress` (instead of "In Progress" - note: no space, lowercase 'p')
  - `Done` (instead of "Closed")
- Keep `Reported` and `Assigned` as they are
- Update the grid to show: `Reported`, `To-Do`, `Inprogress`, `Done`, `Assigned`, `Story Points`

---

## Implementation Plan

### Phase 1: Update Member Monthly Report (Member Profile Modal)
**File:** `src/app/(app)/analytics/bugs/page.tsx`
**Location:** `MemberProfileModal` component, `tab==='monthly'` section

**Changes:**
1. Update grid from 4 columns to 6 columns
2. Change labels:
   - `Open` → `To-Do`
   - Keep `Inprogress` (already correct in data)
   - `Closed` → `Done`
3. Add `Story Points` column with decimal formatting
4. Update color coding to match new labels

**Data Structure (already exists in `person.monthly`):**
```typescript
monthly: Record<string, {
  reported: number;
  closed: number;
  open: number;
  assigned: number;
  storyPoints: number; // ← This exists but not displayed!
}>
```

### Phase 2: Add Team Monthly Report
**File:** `src/app/(app)/analytics/bugs/page.tsx`
**Location:** `TeamsTab` component

**Changes:**
1. Add "Monthly Report" button/toggle for each team card
2. Create expandable monthly breakdown section
3. Calculate team-level monthly stats by aggregating all team members
4. Display same format as member monthly report but at team level

**Team Monthly Stats to Calculate:**
- Total bugs reported by team per month
- To-Do, Inprogress, Done counts per month
- Total assigned tickets per month
- Total story points per month (with decimals)
- Team close rate per month

---

## Technical Details

### Decimal Formatting Function
```typescript
function formatDecimal(value: number): string {
  return value % 1 === 0 ? value.toString() : value.toFixed(1);
}
```

### Status Mapping
- `To-Do` = `open` status in data
- `Inprogress` = `inProgress` status in data (note: data uses camelCase)
- `Done` = `closed` status in data

### Color Coding
- `To-Do`: Red theme (`text-red-600`, `bg-red-500/5`)
- `Inprogress`: Amber theme (`text-amber-600`, `bg-amber-500/5`)
- `Done`: Green theme (`text-green-600`, `bg-green-500/5`)
- `Story Points`: Violet theme (`text-violet-600`, `bg-violet-500/5`)

---

## Files to Modify

1. **src/app/(app)/analytics/bugs/page.tsx**
   - Update `MemberProfileModal` monthly tab (lines ~433-453)
   - Add team monthly report to `TeamsTab` component

2. **src/hooks/useJiraKPI.ts** (if needed)
   - Verify monthly data structure includes all required fields
   - Ensure `storyPoints` is being calculated correctly

---

## Testing Checklist

- [ ] Member monthly report shows 6 columns: Reported, To-Do, Inprogress, Done, Assigned, Story Points
- [ ] Story Points display with decimal values (e.g., 2.5, 3.0)
- [ ] Labels are exactly: "To-Do", "Inprogress", "Done" (case-sensitive)
- [ ] Team cards have monthly report option
- [ ] Team monthly report aggregates all team members correctly
- [ ] Decimal formatting works (no trailing zeros for whole numbers)
- [ ] Color coding matches new labels

---

## Priority

**HIGH** - Project manager requirement, affects reporting accuracy

**Timeline:** Immediate implementation required
