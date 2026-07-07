# Tasks

## Phase 1: Critical Fixes & Shareable Reports

### Task 1: Fix execution end-state (R1)
- [ ] Add bounds check in `goNext` to prevent exceeding array length
- [ ] When `currentIndex === total - 1` and user marks verdict, show completion dialog instead of advancing
- [ ] Add "Session Complete" screen when all cases are done (in the card area)
- [ ] Handle edge case: if session has 0 test cases, show empty state

### Task 2: Public Report Route (R2)
- [ ] Create `src/app/report/[sessionId]/page.tsx` — public, no auth required
- [ ] Reuse the same KPI + chart + table layout from the results page
- [ ] Remove edit/action buttons from public view
- [ ] Add "Powered by Zenit" footer
- [ ] Add "Copy Share Link" button on the authenticated results page
- [ ] Add copy-to-clipboard toast feedback

### Task 3: Team Performance Page (R3)
- [ ] Create `src/app/(app)/team-performance/page.tsx`
- [ ] Query ALL sessions from Firestore (not filtered by userId) — only for leads
- [ ] Group sessions by `userName`
- [ ] Show KPI cards, per-member stats table, date/platform filters
- [ ] Add CSV export for team report
- [ ] Add role check — redirect testers away

### Task 4: Jira Team/Component Field (R4)
- [ ] Fetch Jira project components via API
- [ ] Add "Team/Component" dropdown to the Jira creation form in session page
- [ ] Pass `components` field to the create-issue API
