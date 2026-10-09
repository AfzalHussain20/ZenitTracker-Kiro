# Cloudflare Pages Compatibility Assessment

**Project:** `d:\Zenit Antigravity\In-House` (Next.js 14 app)  
**Assessment Date:** 2026-07-10  
**Tool:** @cloudflare/next-on-pages  

---

## Verdict

> **NEEDS_CHANGES** — The majority of the app (AI, Jira, Confluence, Keepr, Firebase-backed routes) is compatible with Cloudflare Pages *if* a few hard blockers are resolved. Four routes are fundamentally incompatible and cannot run on Cloudflare Workers at all.

---

## Summary

| Category | Finding |
|---|---|
| Cloudflare Pages compatible (most routes) | ✅ Yes, with env var setup |
| Hard blockers (cannot migrate as-is) | ❌ 4 routes |
| Requires attention (soft blockers) | ⚠️ 3 items |
| Existing deployment config | Firebase App Hosting (`apphosting.yaml`) + Vercel (`vercel.json`) |
| Node.js `runtime` explicit declarations | None found — all routes run Node.js by default |

---

## 1. next.config.js Analysis

**File:** `next.config.js`

Key findings:
- `output: process.env.NETLIFY ? undefined : 'standalone'` — The app already detects a Netlify env variable and disables `standalone` mode. Cloudflare Pages needs `output` to be **unset** (not `'standalone'`). This is easy to fix.
- `webpack.externals`: externalises `usb`, `node-hid`, `serialport`, `adb` — these are all desktop/native modules used by ADB routes. They will flat-out fail on Cloudflare Workers (no native modules, no subprocess execution).
- `webpack.resolve.fallback`: polyfills `fs`, `path`, `child_process` to `false` on the client — this is fine, but it signals that some server routes *do* use these modules.
- No rewrites or redirects are defined in `next.config.js`.
- `swcMinify: true` and `images.unoptimized: true` are both fine for Cloudflare.
- `typescript.ignoreBuildErrors: true` — means the build will succeed even if types are broken. Acceptable.

**Required change:** Remove or conditionally suppress `output: 'standalone'` for Cloudflare builds, similar to how Netlify is handled:
```js
output: process.env.NETLIFY ? undefined : (process.env.CF_PAGES ? undefined : 'standalone'),
```

---

## 2. API Routes — Full Inventory

50+ route handlers found under `src/app/api/`. Categorised below.

### ❌ Hard Blockers — Cannot Run on Cloudflare Workers

These routes use Node.js APIs (`child_process`, `fs` with local disk writes) that have **no equivalent in the Cloudflare Workers runtime**. They must be excluded, redesigned, or moved to a separate Node.js service.

| Route | File | Problem |
|---|---|---|
| `/api/adb` | `src/app/api/adb/route.ts` | Uses `child_process.exec` to shell out to `adb` binary. No subprocess execution in Workers. |
| `/api/devices` | `src/app/api/devices/route.ts` | Uses `child_process.exec` to run `adb devices`. Same blocker. |
| `/api/automation/run` | `src/app/api/automation/run/route.ts` | Uses `child_process.spawn` to launch a Maven/Java process (`mvn test`). Writes/reads a local `reports/` directory via `fs`. Fundamentally incompatible. |
| `/api/tests` | `src/app/api/tests/route.ts` | Reads from a local `reports/` directory on the server filesystem using `fs.readdirSync` / `fs.readFileSync`. No local filesystem on Workers. |

**Assessment:** These four routes exist to control *local hardware* (Android devices via ADB) and spawn local processes (Maven test automation). They are inherently local-machine concerns. Even on a traditional server they require the host to have ADB/Java installed. They make no sense on a serverless edge platform. **They should be left out of the Cloudflare deployment** or served from a local Node.js sidecar.

### ⚠️ Soft Blockers — Need Review

| Route | File | Issue | Severity |
|---|---|---|---|
| `/api/extract-prd` | `src/app/api/extract-prd/route.ts` | Uses `mammoth` (DOCX parsing) and `pdf-parse` (PDF parsing) — both use Node.js `Buffer` extensively. `pdf-parse` in particular spawns native bindings. Cloudflare Workers have no native module support. | Medium — test with `@cloudflare/next-on-pages`; may need polyfill or removal |
| `/api/vision/capture` & `/api/vision/action` | `src/app/api/vision/capture/route.ts` | Dynamically imports `vision-core` which uses `child_process.exec` (adb) and writes screenshots to `public/temp_vision_screenshot.png` via filesystem. | Medium — same fundamental issue as ADB routes |
| `firebase-admin` SDK | Multiple routes | `firebase-admin` works in Node.js environments. On Cloudflare Workers it *may* work via the REST API fallback, but the SDK itself relies on Node.js internals (`net`, `tls`, `http2`). This is the biggest uncertainty. | High — needs explicit testing |

### ✅ Compatible Routes (will work on Cloudflare Pages)

All these routes only use `fetch`, Firestore (via `firebase-admin` REST or client SDK), or external HTTP APIs, which are edge-compatible:

- All `/api/ai/*` routes (ask, ask-global, categorize-prd, check-quota, feature-flags, generate-tests, generate-tests-stream, investigate, investigations, jira-insights, token-usage, agent)
- All `/api/jira/*` routes (analytics, components, create-issue, fields, issue/[key], issues, projects, sprints, sync, teams, users, worklogs)
- All `/api/confluence/*` routes (pages, pages/[id], spaces)
- `/api/keepr/alerts`, `/api/keepr/audit`, `/api/keepr/device/list`, `/api/keepr/device/[deviceId]`, `/api/keepr/history`
- `/api/billing/activate`
- `/api/notes`, `/api/notes/generate-title`, `/api/notes/[id]`
- `/api/org`, `/api/org/invite`, `/api/org/invite/accept`
- `/api/geo`
- `/api/clevertap/sessions`
- `/api/google/test`
- `/api/performance`

---

## 3. Server Components & Middleware

**File:** `src/middleware.ts`

The middleware is **fully edge-compatible**. It:
- Uses only `NextResponse`, `NextRequest`, and `request.cookies`
- Does no filesystem access, no Node.js modules
- Reads a `firebase-auth-session` cookie and performs simple redirects

No changes needed.

No Server Components were found importing Node.js-only modules during this scan.

---

## 4. Dependency Compatibility

**File:** `package.json`

| Package | Version | Edge Compatible? | Notes |
|---|---|---|---|
| `firebase-admin` | `^12.2.0` | ⚠️ Uncertain | Uses Node.js `net`/`tls`. May require polyfills or switching to the REST API / Firebase client SDK. This is the #1 risk. |
| `mammoth` | `^1.8.0` | ❌ Unlikely | DOCX parser using Node.js streams & buffers extensively. Only used in `extract-prd`. |
| `pdf-parse` | `^1.1.1` | ❌ No | Relies on native bindings (`pdfjs-dist` + canvas). Only used in `extract-prd`. |
| `ws` | `^8.19.0` | ❌ No | Node.js WebSocket server. Not used in API routes directly — only in the `vision-stream` script (run locally). Not deployed. |
| `googleapis` | `^171.4.0` | ⚠️ Partial | Some Google APIs work; depends on which endpoints are called. Only used in `/api/google/test`. |
| `dotenv` | `^16.4.5` | N/A | Used in one route (`extract-prd`) but Cloudflare provides env vars natively — `dotenv` is a no-op in Workers and won't cause errors. |
| `cheerio` | `^1.0.0-rc.12` | ⚠️ Check | Used in `vision-core` (dynamically imported, only used by vision routes which are excluded). Safe if those routes are excluded. |
| `xlsx` | `^0.18.5` | ✅ Yes | Pure JS, works in edge environments. |
| `firebase` (client) | `^10.12.3` | ✅ Yes | Designed for browser/edge. |
| All `@radix-ui/*`, `framer-motion`, `recharts`, etc. | — | ✅ Yes (client-only) | Not used in API routes. |
| `firebase-admin` (via Buffer.from for Jira auth) | — | ✅ | `Buffer.from(...)` for base64 encoding: Cloudflare Workers *do* support the `Buffer` global. |

---

## 5. Existing Deployment Configuration

| File | Content |
|---|---|
| `apphosting.yaml` | Firebase App Hosting config (`maxInstances: 1`). This is the **current production deployment target**. |
| `vercel.json` | Vercel config with `maxDuration: 60s` for API routes. Suggests the project has been tested on Vercel too. |
| `netlify.toml` | **Does not exist.** |
| `wrangler.toml` | **Does not exist.** Project has never been configured for Cloudflare. |

---

## 6. Next.js APIs — Headers, Cookies, next/headers

**Middleware:** Uses `request.cookies` from `NextRequest` — fine on edge.

**API routes:** None of the routes scanned import `next/headers` directly. They read cookies from the request object instead, which is edge-compatible.

The session cookie (`firebase-auth-session`) is read in middleware only. No issues.

---

## 7. Environment Variables Referenced in Code

All referenced via `process.env.*`. Cloudflare Pages supports these as "environment variables" set in the dashboard. No special handling needed except ensuring they are configured.

Keys to configure in Cloudflare Pages dashboard:

```
# Firebase (client)
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID

# Firebase Admin (server-side)
FIREBASE_CLIENT_EMAIL
FIREBASE_PRIVATE_KEY          ← must preserve literal \n newlines
NEXT_PUBLIC_FIREBASE_PROJECT_ID   ← reused by admin routes

# Jira
JIRA_BASE_URL
JIRA_EMAIL
JIRA_API_TOKEN
JIRA_PROJECT_KEY
JIRA_ORG_ID

# Confluence
CONFLUENCE_BASE_URL
CONFLUENCE_EMAIL
CONFLUENCE_API_TOKEN

# AI
GOOGLE_AI_API_KEY
GOOGLE_AI_API_KEYS
GROQ_API_KEY
GROQ_API_KEYS
GEMINI_MAX_TOKENS
GEMINI_TEMPERATURE

# Other
HF_API_TOKEN
GOOGLE_SERVICE_ACCOUNT_KEY
RENDER_EXTERNAL_URL
NEXT_PUBLIC_APP_URL
KEEPR_WEBHOOK_URL
KEEPR_WEBHOOK_TYPE
KEEPR_OVERDUE_HOURS
KEEPR_CRITICAL_HOURS
```

`FIREBASE_PRIVATE_KEY` deserves special attention: it contains literal `\n` sequences that the code replaces with real newlines at runtime (`?.replace(/\\n/g, '\n')`). In Cloudflare Pages, set this as a single-line string with `\n` literals (same as you do in Vercel/Firebase).

---

## 8. Rewrites / Redirects

`next.config.js` defines **no rewrites or redirects**. Nothing to replicate.

---

## Blockers Summary

### Hard Blockers (must resolve before deployment)

1. **ADB / subprocess routes** — `/api/adb`, `/api/devices`, `/api/automation/run`, `/api/tests`, `/api/vision/capture`, `/api/vision/action` all shell out to local processes or read/write local disk. These **cannot run on Cloudflare Workers**. Solution: add `export const runtime = 'nodejs'` to these routes and host them separately, or simply disable them in the Cloudflare build. Since they are local hardware tools (Android ADB, Maven), they don't belong on a cloud deployment at all.

2. **`firebase-admin` SDK compatibility** — The Admin SDK (`firebase-admin@12`) uses Node.js-specific internals. `@cloudflare/next-on-pages` uses the Cloudflare Workers runtime, not Node.js. You will need to either:
   - Switch Admin SDK usage to the [Firebase REST API](https://firebase.google.com/docs/firestore/reference/rest/) directly in affected routes, or
   - Use the `nodejs_compat` compatibility flag in Cloudflare (available since 2024) which gives Workers partial Node.js compatibility. This is the **lower-effort path**.

3. **`pdf-parse` and `mammoth`** — Used in `/api/extract-prd`. Both require Node.js internals. Either remove PDF/DOCX parsing support in the Cloudflare build or move that route to a separate Node.js microservice.

4. **`output: 'standalone'`** — Must be disabled for Cloudflare Pages builds, similar to how `NETLIFY` env var disables it now.

### Soft Blockers / Warnings

- **`googleapis`** — Only used in `/api/google/test`, which appears to be a debug/test route. Low risk.
- **`maxDuration: 60` (Vercel)** — Cloudflare Workers have a CPU time limit (50ms on Free, unlimited on Paid). Long-running AI generation routes may hit CPU limits on the free tier. Watch `/api/ai/generate-tests-stream` and `/api/ai/investigate`.
- **In-memory state** — `/api/automation/run` stores process state in module-level variables (`isRunning`, `currentProcess`). Workers don't share memory between requests. This is moot since the whole route is excluded, but worth noting as a pattern to avoid.

---

## Recommended Next Steps

### Step 1 — Quick win: add `next-on-pages` and test
```bash
npm install --save-dev @cloudflare/next-on-pages wrangler
```
Create `wrangler.toml`:
```toml
name = "zenit-in-house"
compatibility_date = "2024-09-23"
compatibility_flags = ["nodejs_compat"]  # ← enables Node.js compat layer

pages_build_output_dir = ".vercel/output/static"
```

The `nodejs_compat` flag resolves the `firebase-admin` concern for most use cases.

### Step 2 — Exclude incompatible routes from Cloudflare build
Add `export const runtime = 'nodejs'` to the routes that use local processes — `@cloudflare/next-on-pages` will skip them at build time and they will return 500 in production (acceptable since they require local hardware):

Routes to tag:
- `src/app/api/adb/route.ts`
- `src/app/api/devices/route.ts`
- `src/app/api/automation/run/route.ts`
- `src/app/api/automation/sessions/route.ts`
- `src/app/api/tests/route.ts`
- `src/app/api/vision/capture/route.ts`
- `src/app/api/vision/action/route.ts`

### Step 3 — Fix next.config.js
```js
output: (process.env.NETLIFY || process.env.CF_PAGES) ? undefined : 'standalone',
```

### Step 4 — Handle `extract-prd` route
Option A: Tag with `export const runtime = 'nodejs'` (disables on Cloudflare but no breakage).  
Option B: Replace `pdf-parse`/`mammoth` with edge-compatible alternatives (`pdf.js-extract` or `unpdf` for PDFs, `docx` npm package for DOCX).

### Step 5 — Connect to Cloudflare Pages
1. Push to GitHub.
2. In Cloudflare Pages dashboard: New project → Connect to Git → select repo.
3. Build command: `npx @cloudflare/next-on-pages`
4. Build output directory: `.vercel/output/static`
5. Add all environment variables from Section 7 above.

### Step 6 — Verify Firebase Admin works
After first deploy, test a Firestore-backed route (e.g., `GET /api/notes?userId=test`) and check for errors in the Cloudflare Pages logs. If the Admin SDK fails despite `nodejs_compat`, the fallback is to replace `firebase-admin` calls in server routes with direct Firestore REST API calls using `fetch`.

---

## Effort Estimate

| Task | Effort |
|---|---|
| Fix `next.config.js` output | 5 min |
| Add `runtime = 'nodejs'` to 7 incompatible routes | 10 min |
| Create `wrangler.toml` | 5 min |
| Configure env vars in Cloudflare dashboard | 15 min |
| Test and fix `firebase-admin` if `nodejs_compat` doesn't work | 2–4 hours |
| Fix `extract-prd` if needed | 1–2 hours |
| **Total (best case)** | **~1 hour** |
| **Total (if firebase-admin needs REST migration)** | **~4–6 hours** |
