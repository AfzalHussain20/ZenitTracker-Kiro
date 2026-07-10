# Test Session — Bug Creation & Multi-Assignment Feature

## The Problem
During a test session, testers find bugs but have no way to:
1. Create a Jira bug directly from the test result
2. Assign multiple bugs to multiple steps in one session
3. Link the test evidence (pass/fail) to the bug

## Feature Design

### Bug Creation from Test Session
When a test step fails, user can:
1. Click "Report Bug" on the failed step
2. A form pre-fills:
   - Summary: "Bug in [Test Case Name] — Step X: [step description]"
   - Description: auto-includes test session context, device, OS, screenshot
   - Priority: suggested based on severity
   - Assignee: suggest dev who owns that feature
   - Labels: auto-tag with platform, module
3. Bug gets created in Jira via API
4. Bug key (SUN-XXXX) links back to the test session step

### Multi-Bug Assignment
- Multiple steps can fail in one session
- Each failed step can have 0 or 1 bug linked
- Bulk mode: select multiple failed steps → create bugs for all at once
- Bug list visible in session summary: "3 bugs created: SUN-1234, SUN-1235, SUN-1236"

### Session Summary with Bugs
```
Test Session: Login Flow — July 10, 2026
Device: Samsung Galaxy S21 FE 5G | Android 13
Results: 8 Pass | 2 Fail | 1 Bug Created

Bugs Created:
  🐛 SUN-4521 — Login button not responding on slow network (High)
  🐛 SUN-4522 — OTP timer resets on screen rotation (Medium)
```

### Workflow
1. Tester runs test session
2. Step fails → marks as FAIL with comment
3. Option appears: "🐛 Create Bug" or "Skip"
4. If Create Bug:
   - Pre-filled form opens (inline, not full page)
   - Tester adds any extra detail
   - Submit → Jira bug created → linked to session
5. Continue to next step
6. At end of session: summary shows all bugs created

### API Design
- `POST /api/jira/create-bug` — creates bug in Jira
  Body: { summary, description, priority, assigneeId, labels, testSessionId, stepId }
  Returns: { key: "SUN-4521", url: "https://..." }

### Edge Cases
- Jira API fails → save bug locally, retry later, show "pending" state
- Duplicate bug → warn if similar summary exists in last 7 days
- Bug already exists for this step → show "Bug linked: SUN-XXX" instead of create button
- Session without login → can't create bugs (need Jira creds)
- Bulk create fails partially → show which succeeded and which failed
