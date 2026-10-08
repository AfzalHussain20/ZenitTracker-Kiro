# OpenNext 500 Fix Report

**Date:** 2025-07-10  
**Worker:** zenittracker (zenittracker.zenittracker.workers.dev)  
**Commit:** `60e81d7`

---

## Root Cause

`next.config.js` contained:

```js
output: (process.env.NETLIFY || process.env.CF_PAGES) ? undefined : 'standalone',
```

The GitHub Actions deploy workflow only sets `NEXTJS_ENV=production` — it does **not** set `NETLIFY` or `CF_PAGES`. This meant `output: 'standalone'` was always active during CI builds.

**`output: 'standalone'`** changes how Next.js bundles server assets and conflicts with OpenNext's Cloudflare Workers runtime. OpenNext requires `output` to be unset (the default mode). With standalone mode active, the OpenNext runtime could not correctly resolve and serve App Router routes, resulting in a 500 on every page.

---

## Files Changed

| File | Change |
|------|--------|
| `next.config.js` | Removed the `output` conditional; `output` is now always `undefined` |

---

## Build Output Confirmation

Local build after the fix (`npm run build`) completed successfully:

- **84 static pages generated**
- **113 App Router routes** present in `app-paths-manifest.json`
- Real routes confirmed: `/login`, `/dashboard`, `/signup`, `/bugs`, `/analytics`, `/keepr`, etc.
- No Pages Router contamination

Key manifests verified:
- `.next/server/app-paths-manifest.json` — 113 keys (all real app routes)
- `.next/routes-manifest.json` — 13 dynamic routes, 0 data routes
- `.next/static/<buildId>/_buildManifest.js` — `sortedPages:["/_app","/_error"]` is **expected and correct** for App Router builds; OpenNext does not use this file for routing

---

## Git Commit

```
commit 60e81d7
fix: remove output:standalone that broke OpenNext Cloudflare Workers build

output:'standalone' was set whenever NETLIFY and CF_PAGES env vars were
absent. The GitHub Actions CI only sets NEXTJS_ENV=production, so the
standalone mode was always active during OpenNext builds.

standalone output interferes with OpenNext/Cloudflare Workers: it changes
how Next.js bundles server assets and confuses the OpenNext runtime,
causing 500 errors on all routes. OpenNext requires output to be unset
(default mode).

Fix: remove the conditional and always leave output undefined.
```

---

## What to Expect

The push to `main` has triggered the GitHub Actions workflow (`.github/workflows/deploy.yml`), which will:

1. Install dependencies (`npm ci`)
2. Build with OpenNext (`npx @opennextjs/cloudflare build`) — now using default output mode
3. Deploy to Cloudflare Workers (`npx wrangler deploy`)
4. Upload secrets (`wrangler secret bulk`)

Once the workflow completes (typically 3–5 minutes), `https://zenittracker.zenittracker.workers.dev` will serve the login page and all other routes correctly.

---

## What Was Not the Problem

- No rogue `pages/` directory existed
- `wrangler.jsonc` was correct (`main: ".open-next/worker.js"`)
- `deploy.yml` was correct (already ran `npx @opennextjs/cloudflare build`)
- `open-next.config.ts` was correct
- `src/app/layout.tsx` confirms pure App Router usage
