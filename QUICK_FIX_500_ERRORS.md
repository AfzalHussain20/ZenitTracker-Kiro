# Quick Fix: 500 Errors on Vercel Deployment

## Problem
```
/api/jira/teams: 500 error
/api/jira/sync: 500 error
```

## Cause
Missing environment variables in Vercel deployment.

## Solution (5 minutes)

### Step 1: Go to Vercel
1. Open https://vercel.com
2. Select project: **zenit-qa**
3. Go to **Settings** → **Environment Variables**

### Step 2: Add These 6 Variables

Click "Add New" for each:

| Key | Value |
|-----|-------|
| `JIRA_BASE_URL` | `https://sunnetwork-techteam-hanqzy91.atlassian.net` |
| `JIRA_EMAIL` | `afzal.hussain@sunnetwork.in` |
| `JIRA_API_TOKEN` | `ATATT3xFfGF0MDxlPWT0IDnz2-x4Kgrc-q8NfEAE3gpuqRvvAwQHhDjBrXHZO6h0lim3DpH2NS9d08kEIPSb5qy7ix6vHWTXO-iMOMEhbBltNc3j4ReG7RvcrRsHjl_8-Mnkv_qHh_MPjk5DY_WHk0wsXUw7TzMbUC8P3G_p8huHKDps8ABg-V0=5321D139` |
| `JIRA_PROJECT_KEY` | `SUN` |
| `JIRA_ORG_ID` | `71e1f60d-3dac-4e87-a7ae-ee5c794b6b1d` |
| `JIRA_CLOUD_ID` | `6a90a0de-7e43-43bd-80e8-c3e4461c7884` |

**For each variable:**
- Select all 3 environments: ✅ Production ✅ Preview ✅ Development
- Click "Save"

### Step 3: Redeploy
1. Go to **Deployments** tab
2. Click **"..."** on latest deployment
3. Select **"Redeploy"**
4. Wait 2-3 minutes

### Step 4: Test
Visit https://zenit-qa.vercel.app/analytics/bugs

✅ Should load without 500 errors!

---

## Still Not Working?

### Add Firebase Variables Too:

| Key | Value |
|-----|-------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | `AIzaSyARGoyDl7VRkePFnSzqUOvNNC_4oVs1mcA` |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | `zenit-tracker.firebaseapp.com` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | `zenit-tracker` |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | `zenit-tracker.appspot.com` |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | `1086022836934` |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | `1:1086022836934:web:0b7e8d4734a70e70a1a0c7` |
| `FIREBASE_CLIENT_EMAIL` | `firebase-adminsdk-fbsvc@zenit-tracker.iam.gserviceaccount.com` |

**FIREBASE_PRIVATE_KEY** (paste entire key including BEGIN/END lines):
```
-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDRvwctb4tEcdc5
SBw1EjLWkuYMCqL4gy0ztc1+eLtO4ZJBM559/avu1tDA8aOgJf78dm3TGxL1qZvX
ibRK6Vojc58v8czJDTegDD7zlhR7jrY2vdefXCNz9cOBdRW8kzHv3NUmFkODcQ54
qjR6xOWsRfupj1XXYxjBIMb1eIyP0vbFSlXhX3uis2t7b13IHd39n8MSF+sEPnQl
dcteKyeOEdVlSRKFTkeN38d4Dom6D0JqNbHQs5JHjWTxUMlYmRdzM51gTbdW/+Nm
jXxJFdzkj5ptguSJknKCrDtW+9fLr7YTWQbXSBOcZOq0MftNsT82vO5N/S4YxR7A
t0+s+c/RAgMBAAECggEACqmpxWnglu0r93yD+pVfQkCbiKHYdnEXZi6S23VrHZp4
De/VhIArMmwh6/0cyAfGdl0q6MrSjuySwJqpMLm7hwaEttzq/+Q3ygof/9AcYHT5
LGqVle4K21qeGBcKBi58IRPak3du8oqtJVM5xxf6uQ73DpVRKYRJ04pFXbXwJ2Dc
LvGKynTuir7CkK/KzEuoIM4GSNNfRD1EZuNhrOyR1vV57wptEL819TBVvC9B4XmO
7BgAQmz8/0c2zcT00+pFIs68ZEFVj6eAI7KpnSkzer4FICVVnUNZkcXnbuCdanbi
i6WSFZYE5asjQp0qkl3kZNmqwRDPgze1OYYfPOG3FQKBgQD9zoJDvgPgrN1y3aYo
Ks4trO2UkqrhP31NZtW5kTUobJFDAShvKpDkYvUibcA9/t38SEpp31vdffKUM8p7
gqfVOB4pUsWBak0VAL/fxKxyh1CHqdwBks5uootp+Ppj+HWtZxzsScvnJYc3Gxt2
RVJMtWSjFUEfqyKp5evJjd1aAwKBgQDTjwuOLldnqDSwZ7cqmCDPc1aidVxh+7rT
sishHoTU7nucd+yVsIV/T59zisEwmitgy+rK+H7CQ9aj/vvYt92O/IWFCOrO9kXd
fnU5JzIEWlBSJKnZuRfBmxC3l4dBvvguvmkz8tO07YB59nCCQEyZ7itFdCN2STjL
lmHWkjFwmwKBgQDMaPuE745T7yVTE6x0gTUYmEOn+w/g5a9XHVFYaNh1PCsp2c7k
6VVUe1aOafIAfDnwq5AzAI8OLhemwKd9Hddp5A52nZEwD5sRJU9jOxTgEJcNDAKC
yee0NvktWjbfOQYdqAQlUbIE8baa7RwK/v2vhhANQFr41G3Qg7qI09bIXQKBgEbE
7CWkxOJM90sndrNN7nPW7l0sCzpPvgCA8kKC9gZQvJLr3v137kBXP0ykVtnOSMJ5
lFJPa//KN6vmaRLm9ruVJ4kIIZwX7+kXG1mCDg48s++2igbmDtdZ6u6vRrSskFL6
qTCSg1VbuYWS9bHslnNLo7f5EL/J4LDh3lqrztQPAoGABCW6MB9Pg498c1tiWYm9
JPVToHLpg8/jZxnM+7nAV4Mk9V37ps6982CcboZzCS1SPAlXufvQCfXhx4BnnK+e
ZntzHNSw2uGgcGoktrIH6omMytqSsdHn9qP8saWdsD2vxF6VMIH+HSaqXUPNtCGk
HaDT/sZpaL1n1lzlmv089gI=
-----END PRIVATE KEY-----
```

---

## Why This Happens

Your local `.env.local` file has all these variables, but Vercel doesn't automatically copy them. You must manually add them to Vercel's environment variables.

## Prevention

Always add environment variables to Vercel when deploying projects that use:
- External APIs (Jira, Google, etc.)
- Database connections
- Authentication services
- Third-party integrations

---

## Complete List of All Variables

See `VERCEL_DEPLOYMENT_GUIDE.md` for the complete list including:
- Firebase (8 variables)
- Google Sheets (4 variables)
- Jira (6 variables)

Total: ~18 environment variables needed for full functionality.

---

## Quick Commands

### Check if variables are set:
```bash
# In Vercel dashboard
Settings → Environment Variables → Search for "JIRA"
```

### Force redeploy:
```bash
# Option 1: Through UI
Deployments → ... → Redeploy

# Option 2: Push empty commit
git commit --allow-empty -m "Trigger redeploy"
git push
```

---

## Success Indicators

✅ No 500 errors in browser console
✅ Team cards display with data
✅ Bug counts show correctly
✅ Charts render properly
✅ No "Failed to load resource" errors

---

## Time to Fix

- **Adding variables**: 5 minutes
- **Redeployment**: 2-3 minutes
- **Total**: ~8 minutes

**Priority**: HIGH - Dashboard won't work without these! 🚨
