# Testing Guide for Task 7.5 Completion

## Overview
This guide explains how to test the newly implemented export functionality and troubleshoot the teams API issue.

## 1. Testing Export Functionality

### Prerequisites
- The application should be running (`npm run dev`)
- Navigate to the KPI Dashboard or Analytics/Bugs page

### Testing CSV Export

1. **Open Member Profile Modal**:
   - Go to `/analytics/bugs` or `/kpi` page
   - Click on any team member card
   - The member profile modal should open

2. **Export to CSV**:
   - Scroll to the bottom of the modal
   - Click the "Export CSV" button
   - A CSV file should download automatically
   - File name format: `member-profile-{name}-{timestamp}.csv`

3. **Verify CSV Content**:
   - Open the downloaded CSV file
   - Check that it contains:
     - Profile section (name, account ID, team, team type)
     - Work Distribution section (stories, bugs, tasks, epics, subtasks)
     - Metrics section (all team-relevant KPIs)
     - Issues section (list of all issues)

### Testing PDF Export

1. **Open Member Profile Modal** (same as above)

2. **Export to PDF**:
   - Click the "Export PDF" button
   - A PDF file should download automatically
   - File name format: `member-profile-{name}-{timestamp}.pdf`

3. **Verify PDF Content**:
   - Open the downloaded PDF file
   - Check that it contains:
     - Formatted profile information
     - Work distribution data
     - Metrics with values
     - Issue list with details

### Expected Behavior

- ✅ Export buttons should be enabled when data is loaded
- ✅ Export buttons should be disabled during loading or export
- ✅ Success toast notification should appear after export
- ✅ Error toast notification should appear if export fails
- ✅ Files should download automatically to your Downloads folder

## 2. Troubleshooting Teams API Error

### Current Issue
The `/api/jira/teams` endpoint is returning a 500 Internal Server Error.

### Debugging Steps

1. **Check Server Console**:
   ```bash
   # Look for error messages in the terminal where you ran npm run dev
   # Look for lines starting with [Teams]
   ```

2. **Check Environment Variables**:
   ```bash
   # Verify these are set in .env.local:
   JIRA_BASE_URL=https://sunnetwork-techteam-hanqzy91.atlassian.net
   JIRA_EMAIL=afzal.hussain@sunnetwork.in
   JIRA_API_TOKEN=ATATT3xFfGF0MDxlPWT0IDnz2-x4Kgrc-q8NfEAE3gpuqRvvAwQHhDjBrXHZO6h0lim3DpH2NS9d08kEIPSb5qy7ix6vHWTXO-iMOMEhbBltNc3j4ReG7RvcrRsHjl_8-Mnkv_qHh_MPjk5DY_WHk0wsXUw7TzMbUC8P3G_p8huHKDps8ABg-V0=5321D139
   JIRA_ORG_ID=71e1f60d-3dac-4e87-a7ae-ee5c794b6b1d
   ```

3. **Test Jira API Directly**:
   ```bash
   # Test if Jira API is accessible
   curl -u "afzal.hussain@sunnetwork.in:ATATT3xFfGF0MDxlPWT0IDnz2-x4Kgrc-q8NfEAE3gpuqRvvAwQHhDjBrXHZO6h0lim3DpH2NS9d08kEIPSb5qy7ix6vHWTXO-iMOMEhbBltNc3j4ReG7RvcrRsHjl_8-Mnkv_qHh_MPjk5DY_WHk0wsXUw7TzMbUC8P3G_p8huHKDps8ABg-V0=5321D139" \
     -H "Accept: application/json" \
     "https://api.atlassian.com/gateway/api/public/teams/v1/org/71e1f60d-3dac-4e87-a7ae-ee5c794b6b1d/teams?maxResults=10"
   ```

4. **Check Browser Network Tab**:
   - Open browser DevTools (F12)
   - Go to Network tab
   - Try to load the KPI dashboard
   - Look for the `/api/jira/teams` request
   - Check the response body for error details

5. **Common Issues**:
   - **Invalid API Token**: Token may have expired
   - **Wrong Org ID**: Verify the org ID is correct
   - **Rate Limiting**: Jira API may be rate limiting requests
   - **Network Issues**: Check if you can access Jira from your network

### Temporary Workaround

If the teams API continues to fail, you can still test the export functionality:
1. Go directly to `/analytics/bugs` page
2. This page uses a different data source (useJiraKPI hook)
3. Click on any member to open the profile modal
4. Test the export buttons

## 3. Analytics/Bugs Page Features

### Current Functionality

The analytics/bugs page already has comprehensive features:

1. **Dynamic Tabs**:
   - Overview tab (always visible)
   - Bugs tab (only if member has bugs)
   - Stories tab (only if member has stories)
   - Epics tab (only if member has epics)
   - Tasks tab (only if member has tasks)
   - Live tab (only if member has live tickets)
   - Assigned tab (only if member has assigned work)
   - Monthly tab (always visible)

2. **Tab Content**:
   - Each tab shows filtered data for that specific type
   - Issue lists with full details (key, type, priority, status, summary)
   - Links to Jira for each issue
   - Empty states when no data available

3. **Member Profile Modal**:
   - Hero header with avatar and key metrics
   - Activity summary cards
   - Issue type breakdown
   - Bug status breakdown
   - Work & story points
   - Priority breakdown with visual bars
   - Monthly trend chart
   - Insights section with progress bars

### Testing Tabs

1. **Open Member Profile**:
   - Click on any member card
   - Modal opens with tab bar at the top

2. **Click Each Tab**:
   - Click "Bugs" tab → Shows all bugs reported by member
   - Click "Stories" tab → Shows all stories reported by member
   - Click "Epics" tab → Shows all epics reported by member
   - Click "Tasks" tab → Shows all tasks reported by member
   - Click "Live" tab → Shows all live tickets assigned to member
   - Click "Assigned" tab → Shows all tickets assigned to member
   - Click "Monthly" tab → Shows monthly breakdown

3. **Verify Data**:
   - Each tab should show relevant filtered data
   - Issue counts should match the badge numbers on tabs
   - Empty tabs should show appropriate empty state messages

## 4. Known Limitations

1. **Worklog History**: Currently shows placeholder (not implemented yet)
2. **Day-Wise Breakdown**: Currently shows placeholder (not implemented yet)
3. **Teams API**: Returning 500 error (needs investigation)

## 5. Next Steps

After testing:
1. Report any issues found
2. Verify export files contain correct data
3. Check if teams API error is resolved
4. Continue with remaining tasks (7.6 - component tests)

## Support

If you encounter any issues:
1. Check the browser console for errors
2. Check the server console for API errors
3. Verify environment variables are set correctly
4. Try clearing browser cache and reloading
5. Restart the development server

## Success Criteria

✅ CSV export downloads successfully
✅ PDF export downloads successfully
✅ Export files contain all expected data
✅ Toast notifications appear correctly
✅ All tabs in member profile modal are clickable
✅ Each tab shows relevant filtered data
✅ No TypeScript errors in modified files
