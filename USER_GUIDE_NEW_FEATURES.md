# User Guide - New KPI Dashboard Features

## 🎯 Quick Access Guide

### Feature 1: Team Monthly Report

**Path:** Analytics → Bugs → Teams → [Click any team]

**Steps:**
1. Click on **"Analytics"** in the sidebar
2. Click on **"Bugs"** tab
3. Click on **"Teams"** tab
4. Click on **any team card** (e.g., "Android Team", "iOS Team")
5. Scroll down to see **"Team Monthly Report"** section

**What you'll see:**
- Month-by-month breakdown of team performance
- 6 metrics per month: Reported, To-Do, Inprogress, Done, Assigned, Story Points
- Color-coded for easy reading
- Sorted by month (newest first)

---

### Feature 2: Member Monthly Report with Decimal Story Points

**Path:** Analytics → Bugs → Teams → [Click team] → [Click member] → Monthly tab

**Steps:**
1. Click on **"Analytics"** in the sidebar
2. Click on **"Bugs"** tab
3. Click on **"Teams"** tab
4. Click on **any team card**
5. Click on **any member card** in the team
6. Click on **"Monthly"** tab in the modal

**What you'll see:**
- 6 columns: Reported, To-Do, Inprogress, Done, Assigned, Story Points
- Story Points with decimal values (e.g., 2.5, 3.0, 1.5)
- Exact labels as requested
- Color-coded status indicators

---

### Feature 3: Exact Status Labels

**Labels Changed:**
- ❌ ~~Open~~ → ✅ **To-Do**
- ❌ ~~In Progress~~ → ✅ **Inprogress**
- ❌ ~~Closed~~ → ✅ **Done**

**Where to see:**
- Member monthly report (in modal)
- Team monthly report (in team detail view)

---

## 📊 Understanding the Metrics

### Reported
- Total bugs/tickets reported in that month
- Includes all issue types

### To-Do
- Bugs that are open and not yet started
- Status: New, Open, To Do

### Inprogress
- Bugs currently being worked on
- Calculated as: `Assigned - To-Do - Done`
- Status: In Progress, Testing, QA, etc.

### Done
- Bugs that are completed/closed
- Status: Done, Closed, Resolved, Fixed, etc.

### Assigned
- Total tickets assigned to the person/team
- Includes all statuses

### Story Points
- Total story points for the month
- **Shows decimal values** (e.g., 2.5, 3.0, 1.5)
- Represents effort/complexity

---

## 🎨 Color Coding

| Metric | Color | Meaning |
|--------|-------|---------|
| To-Do | 🔴 Red | Urgent/Not started |
| Inprogress | 🟠 Amber | Active work |
| Done | 🟢 Green | Completed |
| Story Points | 🟣 Violet | Effort tracking |
| Reported | ⚪ Slate | Neutral |
| Assigned | 🔵 Blue | Workload |

---

## 💡 Tips & Tricks

### For Project Managers
1. **Compare team performance:** Click different teams to see their monthly reports
2. **Identify trends:** Look for patterns in the monthly data
3. **Track story points:** Use decimal values for accurate effort tracking
4. **Monitor close rates:** Check the "% done" badge for each month

### For Team Leads
1. **Review team monthly report:** See overall team performance at a glance
2. **Drill down to members:** Click members to see individual contributions
3. **Track progress:** Compare current month vs previous months
4. **Identify bottlenecks:** Look for high "Inprogress" counts

### For Developers
1. **Check your monthly tab:** See your personal monthly breakdown
2. **Track story points:** Monitor your completed story points
3. **View trends:** See how your performance changes over time
4. **Compare with team:** See how you contribute to team goals

---

## 📱 Mobile Responsive

All new features are fully responsive:
- ✅ Works on desktop
- ✅ Works on tablet
- ✅ Works on mobile
- ✅ Scrollable on small screens

---

## 🔍 Example Scenarios

### Scenario 1: Check Team Performance for April 2026
1. Go to Analytics → Bugs → Teams
2. Click on "Android Team"
3. Scroll to "Team Monthly Report"
4. Find "2026-04" row
5. See: 45 Reported, 8 To-Do, 6 Inprogress, 31 Done, 45 Assigned, 38.5 SP

### Scenario 2: Check Member's Story Points
1. Go to Analytics → Bugs → Teams
2. Click on "iOS Team"
3. Click on "John Doe" member card
4. Click "Monthly" tab
5. See story points with decimals: 2.5, 3.0, 1.5, etc.

### Scenario 3: Compare Months
1. Open team monthly report
2. Look at multiple months side-by-side
3. Compare "Done" counts across months
4. Identify trends (improving/declining)

---

## ❓ FAQ

### Q: Why do I see decimal story points?
**A:** Story points can be fractional (0.5, 1.5, 2.5) to represent smaller tasks or partial completion.

### Q: What does "Inprogress" mean?
**A:** Tickets that are actively being worked on, calculated as: Assigned - To-Do - Done.

### Q: Why is it "Inprogress" not "In Progress"?
**A:** This is the exact label requested by the project manager for consistency.

### Q: Can I export this data?
**A:** Yes, use the "Export" button in the main dashboard to export all data including monthly reports.

### Q: How often is the data updated?
**A:** Data is synced from Jira every 5 minutes. Click "Sync Now" for immediate refresh.

### Q: Why don't I see any monthly data?
**A:** Monthly data is only available for months where there was activity (bugs reported, tickets assigned, etc.).

---

## 🚀 Quick Reference

### Team Monthly Report
- **Location:** Teams tab → Click team → Scroll down
- **Shows:** 6 metrics per month
- **Sorted:** Newest month first
- **Format:** Grid with color coding

### Member Monthly Report
- **Location:** Teams tab → Click team → Click member → Monthly tab
- **Shows:** 6 metrics per month
- **Includes:** Decimal story points
- **Labels:** To-Do, Inprogress, Done

---

## 📞 Support

If you have questions or need help:
1. Check this guide first
2. Review the IMPLEMENTATION_SUMMARY.md
3. Contact your system administrator
4. Report issues via Jira

---

## ✅ Checklist for First-Time Users

- [ ] Navigate to Analytics → Bugs → Teams
- [ ] Click on a team card
- [ ] Find the "Team Monthly Report" section
- [ ] Click on a team member
- [ ] Go to "Monthly" tab
- [ ] Verify you see 6 columns
- [ ] Check that labels are: To-Do, Inprogress, Done
- [ ] Verify story points show decimal values

---

**Last Updated:** April 21, 2026
**Version:** 1.0
**Status:** Production Ready
