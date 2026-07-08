# PRD: Test Case Management & Session Upgrade

## Vision
Transform Zenit from a "test execution tool" into a "test management platform" where test cases are first-class entities that persist, version, and flow into execution sessions seamlessly.

## Current Pain Points
1. Test cases only exist inside sessions — no permanent home
2. Same XLSX uploaded repeatedly for regression
3. No way to add/edit individual test cases without Excel
4. Repository exists but test cases aren't individually manageable
5. No link between a test case's history across multiple sessions

---

## Feature: Test Case Library (Upgrade Repository)

### What it does
The Test Case Library is the permanent home for all test cases. Testers can:
- Browse all test cases across all suites
- Search/filter by module, priority, platform
- Add individual test cases manually (no XLSX needed)
- Edit existing test cases
- Select specific test cases → launch a session with just those
- View execution history per test case (pass/fail across sessions)

### User Stories

**US1**: As a QA Lead, I want to upload an XLSX and have those test cases stored permanently so my team doesn't re-upload every sprint.

**US2**: As a Tester, I want to add a single test case manually when I discover a new scenario during testing.

**US3**: As a Tester, I want to select 5 specific test cases from the library and execute them as a focused session.

**US4**: As a QA Lead, I want to see how many times a test case has been executed and its pass/fail history.

---

## Feature: Session Creation Upgrade

### New Session Flow
```
Step 1: Choose Source
  ├── "From Library" → select test cases from repository
  ├── "Upload XLSX" → one-time upload (also saves to library)
  └── "Re-run Previous" → clone a completed session

Step 2: Select Platform + Details

Step 3: Review & Launch
```

### Key Change
When user uploads XLSX via new-session, those test cases should ALSO be saved to the library (testSuites collection) automatically. This means every upload enriches the library.

---

## Feature: Individual Test Case Management

### Data Model Addition
```typescript
// In testSuites collection, each suite has testCases[]
// But we also want individual test case tracking:

interface TestCaseExecution {
  sessionId: string;
  status: 'Pass' | 'Fail' | 'N/A';
  executedBy: string;
  executedAt: Date;
  bugId?: string;
}

// On the TestCase level (inside testSuites.testCases):
// Add: executionHistory: TestCaseExecution[] (computed at display time from sessions)
```

### UI: Test Case Detail View
When clicking a test case in the library:
- Shows: title, steps, expected result, priority, module
- Shows: execution history (table of all sessions where it was run + result)
- Actions: Edit, Delete, Execute (creates 1-case session)

---

## Feature: Quick Add Test Case

### Where it lives
- Button on Repository page: "+ Add Test Case"
- Opens a form: Title, Module, Priority, Steps, Expected Result
- Saves directly to a "Manual Cases" suite in Firestore

---

## Implementation Priority

| # | Feature | Effort | Impact |
|---|---------|--------|--------|
| 1 | Auto-save uploaded XLSX to library | Small | High |
| 2 | "From Library" option in new-session wizard | Medium | High |
| 3 | Quick Add Test Case form in repository | Small | Medium |
| 4 | Edit test case inline | Small | Medium |
| 5 | Test case execution history view | Large | Medium |

---

## Design Decisions

1. **Don't create a separate `testCases` collection** — keep them embedded in `testSuites` documents. This avoids complex joins and keeps the data model simple.

2. **"From Library" selection** = show all suites, let user check individual cases or select whole suites, then launch.

3. **Auto-save to library** = when creating a session via XLSX upload, also create/update a testSuite document with those cases. Suite name = file name.

4. **The repository IS the library** — no new page needed. Just upgrade `/dashboard/repository` with individual case management.

---

## What to Build Now

### Phase 1 (This Session):
- [x] Auto-save XLSX to library on session creation
- [ ] "Add Test Case" button on repository page
- [ ] Edit test case inline (click to edit title/steps/expected)
- [ ] "From Library" option in new-session Step 2 (select cases)
- [ ] Session creation from selected library cases

### Phase 2 (Future):
- [ ] Test case execution history
- [ ] Bulk edit/delete in repository
- [ ] Import from Jira test management
- [ ] AI-powered test case suggestions
