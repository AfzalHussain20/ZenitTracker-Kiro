# Vercel Deployment Guide - Fix 500 Errors

## Problem
After deploying to Vercel, the Jira Dashboard shows 500 errors because environment variables are missing.

## Error Messages
```
/api/jira/teams: Failed to load resource: 500
/api/jira/sync: Failed to load resource: 500
```

## Solution: Add Environment Variables to Vercel

### Step 1: Go to Vercel Dashboard
1. Open https://vercel.com
2. Select your project: `zenit-qa`
3. Go to **Settings** → **Environment Variables**

### Step 2: Add Required Environment Variables

Copy these variables from your `.env.local` file to Vercel:

#### Firebase Configuration (Public - can be exposed)
```
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyARGoyDl7VRkePFnSzqUOvNNC_4oVs1mcA
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=zenit-tracker.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=zenit-tracker
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=zenit-tracker.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=1086022836934
NEXT_PUBLIC_FIREBASE_APP_ID=1:1086022836934:web:0b7e8d4734a70e70a1a0c7
```

#### Firebase Admin SDK (Server-side - KEEP SECRET)
```
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@zenit-tracker.iam.gserviceaccount.com
```

**FIREBASE_PRIVATE_KEY** (Important: Keep the quotes and newlines):
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

#### Google Sheets Service Account (Server-side - KEEP SECRET)
**GOOGLE_SERVICE_ACCOUNT_KEY** (Single line JSON):
```json
{"type":"service_account","project_id":"zenit-tracker","private_key_id":"ea7e063345d8fe0bed7e5af1f59d9743adda1acf","private_key":"-----BEGIN PRIVATE KEY-----\\nMIIEvwIBADANBgkqhkiG9w0BAQEFAASCBKkwggSlAgEAAoIBAQC2qBkAYLUYD+Ty\\n9mYtYqFfrNV2RIhgLk72rDCBEDPcgoSwj0HYom7g8gSWWlJ2lfDe7iYkEuWrBKFz\\nejZKIrhL8a2ggoYBUJWNgUYmHTTVFqtZuIXVFvLYK95ap8Cod+PATDNRlpgIOmVl\\nuEJTI/cIf9skFOBHEFArbrI8TIWInLQPgCQSM9Il7x7NmXZkDlG3ujfpJO5wlBHb\\nJcFOJyqQ/UZMu9cUgtUazjEBEjq03OzhzC0qcGiTqazilnC2BiIjORw6XmYhh7KA\\nwKhDc6HHkZu8QSQEE/RamB5W61QkxYSwqWFB2iYgSxqdmnRSNCLEpyQOs2tSuJC2\\nZqfz9a/bAgMBAAECggEAAIjRWQGpPTbNA6Vt/BtVd2H1KPgnn5xr2cqQ1VCdzjsH\\nmW078gH0cBlyFqr8T5chFBYqp6k8wIGfyOyqaM6CZNyOiikgYf4eQaWgK5S78PxB\\nG61fM6ZuIuzaMV1LKZUYF65y8f3UgU7y0hF0KWNwDSLQsx+qg33QUyQUV1T8wtfW\\njsot/fTfc6uWGyocUJLIZ3YEH+1R7QbznGoxpbbrF9V4UPiWeEF+Yxe+Ywn6Zxk/\\nDbGrH2uDKoCJOpXXvmexwZpRGAZNAZDodwDc8pyulDUkkL01fQMK6WNxbjOT4nww\\neWhz5f/w1Zs4Qk2Zxx4gCk3QnK/WRgr6NUN6xm6zxQKBgQDou9OWSVr5789M1z8J\\n7ub+HL8osjwmGgkiB2UpX4cIldxFFm7yvXUXXpZPF0x2kxOnZoyVRXwNL/60zw8j\\nvR8woQ7eYGUEs+jOpuFMj7u19PQlukL1gslB6arSir4XfKvo6dQl93xZcBVMKPD2\\n711YShvU14HG93CzOfyXeJTTxQKBgQDI6rACrMxe0XOvtrcbE9je4AjE1LrxQpLI\\ntWpAVLWp5ulsMyJLJrgLdbfxJZkI6Xk5zeq4T9r2iIUmrs+/tg/KX/BAG9qBR8B7\\niWB3xURAgb6O3Pp0UfGL/W05wQ4X8i4/ccp3IM7Z7rud9JoM9Ah4jlUHyjimWODn\\n/sIqsmGPHwKBgQCz4ajSefQlRiM1wxBoPwyuz804STqQQINal9iqt7kI+7t6crJi\\nT+kWnPcUPm/NHjSMqIh0P3Z4QuZdHcUX3G8lCPcTDfJGRj/kqbttj5KIOsIR/vsO\\nA35GwbJUdQQj5yqAJWrhxX2JK0ZqzSIh2jSNrwn/4mnePRYQkPsYoAx3+QKBgQC3\\n+ccAPBDMBklDrjEPF2Zv93+wFQe1oftc1Fod3DOZB3vY+x286RCAVeQAaigu8/Nw\\njfEPovfi5fHfERXk+6aL7rvFSHwWA4jq1knCgp1T4DqJASpJ1zsyr/YTe4cXQEk/\\nCUiXOzCOeL/ODMv/bnpPQi30eyTSlfIkHbDYfg09iwKBgQCL+8pSxR/AwGVVbAYz\\nBDCX+J2+p7CITCWKIqtk8+dbDNshH+QGJz8cKZEJU6dwHK2xPDASECoYG7mDvrvq\\neBUt/hEZFP0mqDw+oRjYhe39CyBrFDWUFUv0QcQ7yBfBTI+OhGcFQRaPB620JNBY\\ntRGcBQNFAIUVhgRKMlwnx2+Alg==\\n-----END PRIVATE KEY-----\\n","client_email":"clevertap-exporter@zenit-tracker.iam.gserviceaccount.com","client_id":"116826485756416342345","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_x509_cert_url":"https://www.googleapis.com/robot/v1/metadata/x509/clevertap-exporter%40zenit-tracker.iam.gserviceaccount.com","universe_domain":"googleapis.com"}
```

#### Google Drive & OAuth
```
GOOGLE_DRIVE_FOLDER_ID=15Qd4d1yvDa9rCmoH0h8oGtVEcyo7GFxV
GOOGLE_OAUTH_CLIENT_ID=23122688447-mejl7ndpc1ejjtqeqmtbfhjhs9mphmvp.apps.googleusercontent.com
GOOGLE_OAUTH_CLIENT_SECRET=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
GOOGLE_OAUTH_REDIRECT_URI=https://zenit-qa.vercel.app/api/google/callback
```

**⚠️ IMPORTANT**: Update `GOOGLE_OAUTH_REDIRECT_URI` to use your production URL!

#### Jira Integration (CRITICAL - These are causing the 500 errors)
```
JIRA_BASE_URL=https://sunnetwork-techteam-hanqzy91.atlassian.net
JIRA_EMAIL=afzal.hussain@sunnetwork.in
JIRA_API_TOKEN=ATATT3xFfGF0MDxlPWT0IDnz2-x4Kgrc-q8NfEAE3gpuqRvvAwQHhDjBrXHZO6h0lim3DpH2NS9d08kEIPSb5qy7ix6vHWTXO-iMOMEhbBltNc3j4ReG7RvcrRsHjl_8-Mnkv_qHh_MPjk5DY_WHk0wsXUw7TzMbUC8P3G_p8huHKDps8ABg-V0=5321D139
JIRA_PROJECT_KEY=SUN
JIRA_ORG_ID=71e1f60d-3dac-4e87-a7ae-ee5c794b6b1d
JIRA_CLOUD_ID=6a90a0de-7e43-43bd-80e8-c3e4461c7884
```

#### Gemini AI (for AI Bug Creator)
```
GEMINI_API_KEY=AIzaSyCo3zdevDyNmxk_2boEynXB90JMwdpc-HA
```

### Step 3: How to Add Variables in Vercel

For each variable:

1. Click **"Add New"** button
2. Enter the **Key** (e.g., `JIRA_BASE_URL`)
3. Enter the **Value** (e.g., `https://sunnetwork-techteam-hanqzy91.atlassian.net`)
4. Select environments:
   - ✅ Production
   - ✅ Preview
   - ✅ Development
5. Click **"Save"**

### Step 4: Special Handling for Multi-line Variables

For `FIREBASE_PRIVATE_KEY`:
- In Vercel, paste the ENTIRE key including `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----`
- Vercel will automatically handle the newlines
- **DO NOT** add quotes around it in Vercel UI

For `GOOGLE_SERVICE_ACCOUNT_KEY`:
- Paste the entire JSON as a single line
- Keep it as one continuous string
- **DO NOT** add extra quotes

### Step 5: Redeploy

After adding all environment variables:

1. Go to **Deployments** tab
2. Find the latest deployment
3. Click the **"..."** menu
4. Select **"Redeploy"**
5. Check **"Use existing Build Cache"** (optional)
6. Click **"Redeploy"**

OR

Simply push a new commit to trigger automatic deployment.

---

## Quick Checklist

### Required for Jira Dashboard (Fix 500 errors):
- [ ] `JIRA_BASE_URL`
- [ ] `JIRA_EMAIL`
- [ ] `JIRA_API_TOKEN`
- [ ] `JIRA_PROJECT_KEY`
- [ ] `JIRA_ORG_ID`
- [ ] `JIRA_CLOUD_ID`

### Required for Firebase:
- [ ] `NEXT_PUBLIC_FIREBASE_API_KEY`
- [ ] `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- [ ] `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- [ ] `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- [ ] `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- [ ] `NEXT_PUBLIC_FIREBASE_APP_ID`
- [ ] `FIREBASE_CLIENT_EMAIL`
- [ ] `FIREBASE_PRIVATE_KEY`

### Required for Google Sheets Export:
- [ ] `GOOGLE_SERVICE_ACCOUNT_KEY`
- [ ] `GOOGLE_DRIVE_FOLDER_ID`
- [ ] `GOOGLE_OAUTH_CLIENT_ID`
- [ ] `GOOGLE_OAUTH_CLIENT_SECRET`
- [ ] `GOOGLE_OAUTH_REDIRECT_URI` (update to production URL!)

---

## Troubleshooting

### Still Getting 500 Errors?

1. **Check Vercel Logs**:
   - Go to your deployment
   - Click on **"Functions"** tab
   - Look for `/api/jira/sync` and `/api/jira/teams`
   - Check the error messages

2. **Common Issues**:
   - **Missing quotes in private key**: Make sure newlines are preserved
   - **Wrong JIRA_API_TOKEN**: Token might have expired, generate a new one
   - **Wrong JIRA_BASE_URL**: Must include `https://` and no trailing slash
   - **Wrong environment**: Make sure variables are set for "Production"

3. **Verify Variables**:
   - Go to Settings → Environment Variables
   - Check that all required variables are present
   - Check that they're enabled for "Production"

4. **Test Locally First**:
   ```bash
   npm run build
   npm start
   ```
   - If it works locally but not on Vercel, it's an environment variable issue

### How to Generate New JIRA_API_TOKEN

If your token expired:

1. Go to https://id.atlassian.com/manage-profile/security/api-tokens
2. Click **"Create API token"**
3. Give it a name (e.g., "Zenit Tracker")
4. Copy the token
5. Update `JIRA_API_TOKEN` in Vercel
6. Redeploy

---

## Security Notes

⚠️ **NEVER commit these values to Git!**

- `.env.local` is in `.gitignore` - keep it that way
- Only add environment variables through Vercel UI
- Rotate tokens periodically
- Use different tokens for dev/prod if possible

---

## After Deployment

Once all variables are added and redeployed:

1. Visit https://zenit-qa.vercel.app
2. Navigate to Jira Dashboard
3. You should see data loading
4. Check browser console - no more 500 errors
5. Verify team cards display correctly

---

## Summary

The 500 errors are caused by **missing Jira environment variables** in Vercel. 

**Quick Fix**:
1. Add all 6 Jira variables to Vercel
2. Redeploy
3. Dashboard will work

**Time Required**: 5-10 minutes

**Priority Variables** (to fix 500 errors immediately):
1. `JIRA_BASE_URL`
2. `JIRA_EMAIL`
3. `JIRA_API_TOKEN`
4. `JIRA_PROJECT_KEY`
5. `JIRA_ORG_ID`
6. `JIRA_CLOUD_ID`

Add these 6 first, redeploy, and the dashboard will work! 🚀
