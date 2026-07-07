# Session Reports & Team Performance — Requirements

## Context
Zenit needs to evolve from a personal test execution tool into a team-level QA management platform. Key gaps: no shareable reports, no team visibility for leads, execution edge cases, and missing Jira team assignment.

---

## R1: Test Execution End-State Handling
- **R1.1**: When all test cases are executed, show a "Session Complete" card instead of advancing to undefined index
- **R1.2**: The completion card shows summary stats (Pass/Fail/N/A/Total), duration, and action buttons
- **R1.3**: Actions available: "Generate Report", "Review Failed Cases", "Back to Dashboard"
- **R1.4**: Prevent `currentIndex` from exceeding `testCases.length - 1` under any circumstance
- **R1.5**: If user navigates to a session already marked "Completed", redirect to results page

## R2: Shareable Report Links (Public Access)
- **R2.1**: After session completion, the results page URL should be publicly shareable
- **R2.2**: Create a new route `/report/[sessionId]` that renders the report WITHOUT requiring auth
- **R2.3**: The public report shows all KPIs, charts, defect list, and detailed table (read-only)
- **R2.4**: Add a "Copy Link" button and "Share" button on the authenticated results page
- **R2.5**: The public report should show "Powered by Zenit" branding at the bottom
- **R2.6**: No edit capabilities on public view — purely read-only

## R3: Team Performance Page (Lead/Manager Dashboard)
- **R3.1**: Available at `/team-performance` — accessible only to users with role `lead`
- **R3.2**: Shows all team members' test sessions (not just current user)
- **R3.3**: KPI cards: Total Sessions, Total Test Cases Executed, Overall Pass Rate, Total Bugs Filed
- **R3.4**: Per-member breakdown: sessions run, pass rate, bugs filed, last active
- **R3.5**: Filter by date range (today, this week, this month, custom)
- **R3.6**: Filter by platform
- **R3.7**: Export team performance as CSV
- **R3.8**: View individual member's session history by clicking their row

## R4: Jira Bug Creation — Team Assignment
- **R4.1**: Add a "Team" dropdown to the Jira creation form (fetched from Jira boards/teams)
- **R4.2**: Map the team/component to the Jira `components` field when creating the issue
- **R4.3**: Pre-populate platform as a label on the bug

## R5: Firebase Team Member Access
- **R5.1**: Document how to add team members in Firebase Console
- **R5.2**: The `users` collection should have a `role` field: `tester` or `lead`
- **R5.3**: Leads can see all sessions; testers can only see their own

---

## Firebase Console — How to Add Members

### Step-by-step:
1. Go to [Firebase Console](https://console.firebase.google.com) → Your Project → Authentication
2. Click "Add User" → Enter their email and a temporary password
3. They can login and the system auto-creates a profile in Firestore `users` collection
4. To make someone a **Lead**: Go to Firestore → `users` collection → Find their document → Change `role` field from `"tester"` to `"lead"`

### Alternative (programmatic):
- You can also use the Firebase Admin SDK to set custom claims for roles
- But for a small team, manually setting the `role` field in Firestore is fastest

---

## Priority Order
1. R1 (End-state bug fix) — Critical, affects current usage
2. R2 (Shareable reports) — High, immediate value for stakeholders
3. R3 (Team Performance) — High, needed for leads
4. R4 (Jira team assignment) — Medium, enhancement
5. R5 (Documentation) — Already documented above
