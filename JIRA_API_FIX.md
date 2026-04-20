# Jira API Migration Fix

## Issue
The Jira API endpoint `/rest/api/3/search` was deprecated and returned a 410 Gone error with the message:
```
The requested API has been removed. Please migrate to the /rest/api/3/search/jql API.
```

## Solution Implemented

### 1. Updated API Route (`src/app/api/jira/issues/route.ts`)
- Changed from POST with JSON body to GET with URL query parameters
- Updated endpoint from `/rest/api/3/search` to `/rest/api/3/search/jql`
- Properly encoded JQL query string for URL parameters

### 2. Request Format Change
**Before (deprecated):**
```typescript
POST /rest/api/3/search
Body: { jql: "...", startAt: 0, maxResults: 100, fields: [...] }
```

**After (current):**
```typescript
GET /rest/api/3/search/jql?jql=...&startAt=0&maxResults=100&fields=...
```

### 3. Build Cache Cleared
- Removed `.next` directory to clear cached build
- Restarted dev server to apply changes

## Testing
The dev server is now running on port 3001. Please:
1. Open http://localhost:3001/bugs
2. Navigate to the Analytics tab
3. Check the browser console for fetch logs
4. Verify that data is now loading correctly

## Expected Behavior
- No more 410 errors
- Issues should be fetched successfully with pagination
- Leaderboard and analytics should display data
- "Last Month's Hero" card should show Arun if he logged 60+ bugs last month

## Next Steps
If data is still not showing:
1. Check browser console for any new errors
2. Verify environment variables are set correctly (JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN)
3. Test the API endpoint directly using the test script: `node test-jira-api.js`
