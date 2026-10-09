# Implementation Plan: Upgrade Next.js 14 → 15.5.27

**Goal:** Resolve the `@opennextjs/cloudflare@1.20.9` peer-dependency conflict that requires
`next >= 15.5.27`. The Cloudflare Pages build fails at `npm clean-install` because the
project currently pins `next@14.2.35`.

---

## Findings from codebase exploration

### Version to pin
| Package | Current | New (exact pin) |
|---|---|---|
| `next` | `14.2.35` | `15.5.27` |
| `eslint-config-next` | `14.2.5` | `15.5.27` |

`15.5.27` is the latest stable 15.x release without canary/alpha/beta/rc suffix, confirmed
via `npm view next versions --json`.

### React / TypeScript — no change needed
- `react` and `react-dom` are `^18.3.1` — Next.js 15 supports React 18; no bump required.
- `@types/react` and `@types/react-dom` are `^18` — fine.
- `typescript` is `^5` — fine.

### next.config.js — one deprecated option
`swcMinify: true` was silently dropped from Next.js 15 (it is always true and the option
is no longer recognised). Remove the line to eliminate the build warning.

### Middleware — no changes needed
`src/middleware.ts` uses `request.cookies.get(...)` via `NextRequest` — this is the
cookie accessor on the _request object_, not the async `cookies()` from `next/headers`.
No migration required.

### Root layout — no changes needed
`src/app/layout.tsx` is a simple server component with no `params`, `searchParams`,
`cookies()`, or `headers()` calls.

### `cookies()` / `headers()` from `next/headers` — NONE found
A recursive `Select-String` over all `.ts` / `.tsx` files for `from 'next/headers'`
returned **zero matches**. No async `cookies()`/`headers()` migration is needed.

### `params` / `searchParams` in page props — ONE client-component exception
All dynamic-route pages (`[sessionId]`, `[id]`, `[deviceId]`, `[key]`, `[runId]`) use
either:
- `useParams()` from `next/navigation` (client components — unaffected), or
- `params` destructured _inside_ the component body after `useParams()`.

The **one exception** is `src/app/verify/[id]/page.tsx` which is `"use client"` but
accepts `{ params }: { params: { id: string } }` as a prop. In Next.js 15, direct prop
access on a client component still works (the async-params warning applies only to server
components and route handlers). However, the TypeScript type must be updated to avoid the
TS2322 "Type Promise<…> is not assignable" error that Next.js 15's generated types produce.

### API Route handlers with dynamic segments — 3 need migration
In Next.js 15, the second argument to route-handler exports must type `params` as
`Promise<{…}>` and the value must be `await`-ed before use. The Confluence route at
`api/confluence/pages/[id]/route.ts` is **already migrated**. Three others are not:

| File | Handlers | Param name |
|---|---|---|
| `src/app/api/notes/[id]/route.ts` | GET, PATCH, DELETE | `id` |
| `src/app/api/test-runs/[runId]/route.ts` | GET, PATCH | `runId` |
| `src/app/api/jira/issue/[key]/route.ts` | GET | `key` |
| `src/app/api/keepr/device/[deviceId]/route.ts` | GET, PATCH | `deviceId` |

---

## Plan

- [ ] 1. **Update `next` and `eslint-config-next` versions in `package.json`**

  Change `next` from `"14.2.35"` to `"15.5.27"` (exact pin, no caret).
  Change `eslint-config-next` from `"14.2.5"` to `"15.5.27"` (exact pin, no caret).
  Leave `react`, `react-dom`, `@types/react`, `@types/react-dom`, and all other
  dependencies unchanged.

  Files: `package.json`

  Verify: File is valid JSON — `node -e "require('./package.json')"` exits 0.

---

- [ ] 2. **Remove deprecated `swcMinify` option from `next.config.js`**

  Delete the line `swcMinify: true,` from the `nextConfig` object. This option was
  removed in Next.js 15 and triggers a warning (and may cause a build error in strict
  mode). The compiler always uses SWC minification — removing the flag has no behavioural
  effect.

  Files: `next.config.js`

  Verify: `node -e "require('./next.config.js')"` exits 0 (config is valid JS).

---

- [ ] 3. **Migrate `src/app/verify/[id]/page.tsx` props type for Next.js 15**

  This is a `"use client"` component that receives `params` as a prop. Next.js 15 types
  the props with `params: Promise<{ id: string }>`. The component itself is a client
  component so the runtime value is still a plain object, but the TypeScript type must
  change to prevent a TS2322 build error (TypeScript errors are currently suppressed via
  `ignoreBuildErrors: true`, but fixing this now avoids silent type rot).

  **Before:**
  ```tsx
  export default function VerifyCertificatePage({ params }: { params: { id: string } }) {
    const { id } = params;
  ```

  **After:**
  ```tsx
  export default function VerifyCertificatePage({ params }: { params: Promise<{ id: string }> }) {
    // params resolves synchronously for client components in Next.js 15
    const { id } = params as unknown as { id: string };
  ```

  > Alternative (cleaner for a client component): remove the prop entirely and switch to
  > `useParams()`, following the exact pattern used in all other dynamic-route pages in
  > this project. Both approaches satisfy the type system; the `useParams()` approach is
  > the project-consistent pattern.

  **Recommended (consistent with rest of codebase):**
  ```tsx
  import { useParams } from 'next/navigation';

  export default function VerifyCertificatePage() {
    const params = useParams();
    const id = params.id as string;
  ```

  Files: `src/app/verify/[id]/page.tsx`

  Verify: Build step (step 5) passes without TS errors related to this file.

---

- [ ] 4. **Migrate API route handlers: `params` → `Promise<params>`**

  In Next.js 15, the `context` argument of route-handler exports changed: `params` is now
  typed and resolved as a `Promise`. Each handler must be updated in two places:
  1. The type annotation: `{ params }: { params: { x: string } }` →
     `{ params }: { params: Promise<{ x: string }> }`
  2. Destructuring must `await` the promise: `const { x } = params` →
     `const { x } = await params`

  **File: `src/app/api/notes/[id]/route.ts`**

  Apply to all three handlers (GET, PATCH, DELETE):
  ```ts
  // Before
  export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
    ...
    const doc = await adminDb.collection('zenit_notes').doc(params.id).get();

  // After
  export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    ...
    const doc = await adminDb.collection('zenit_notes').doc(id).get();
  ```
  Replace all `params.id` references with the destructured `id` variable.

  ---

  **File: `src/app/api/test-runs/[runId]/route.ts`**

  Apply to both handlers (GET, PATCH):
  ```ts
  // Before
  export async function GET(_req: NextRequest, { params }: { params: { runId: string } }) {
    const { runId } = params;

  // After
  export async function GET(_req: NextRequest, { params }: { params: Promise<{ runId: string }> }) {
    const { runId } = await params;
  ```

  ---

  **File: `src/app/api/jira/issue/[key]/route.ts`**

  Apply to the GET handler:
  ```ts
  // Before
  export async function GET(
    _req: Request,
    { params }: { params: { key: string } }
  ) {
    try {
      const issueKey = params.key;

  // After
  export async function GET(
    _req: Request,
    { params }: { params: Promise<{ key: string }> }
  ) {
    const { key: issueKey } = await params;
    try {
  ```

  ---

  **File: `src/app/api/keepr/device/[deviceId]/route.ts`**

  Apply to both handlers (GET, PATCH):
  ```ts
  // Before (GET)
  export async function GET(_req: NextRequest, { params }: { params: { deviceId: string } }) {
    const { deviceId } = params;

  // After (GET)
  export async function GET(_req: NextRequest, { params }: { params: Promise<{ deviceId: string }> }) {
    const { deviceId } = await params;
  ```
  ```ts
  // Before (PATCH)
  export async function PATCH(req: NextRequest, { params }: { params: { deviceId: string } }) {
    const { deviceId } = params;

  // After (PATCH)
  export async function PATCH(req: NextRequest, { params }: { params: Promise<{ deviceId: string }> }) {
    const { deviceId } = await params;
  ```

  Files:
  - `src/app/api/notes/[id]/route.ts`
  - `src/app/api/test-runs/[runId]/route.ts`
  - `src/app/api/jira/issue/[key]/route.ts`
  - `src/app/api/keepr/device/[deviceId]/route.ts`

  Verify: Build step (step 5) passes; TypeScript does not emit errors for these files.

---

- [ ] 5. **Install dependencies and verify the local build**

  Run the install command using `--legacy-peer-deps` to allow npm to resolve the
  `@opennextjs/cloudflare` peer chain without aborting. This is the same flag the
  Cloudflare Pages build environment should be configured to use (add
  `NPM_FLAGS=--legacy-peer-deps` or set it in the CF Pages environment / build command).

  ```bash
  cd "d:\Zenit Antigravity\In-House"
  npm install --legacy-peer-deps
  ```

  Then run the standard Next.js build to confirm the app compiles:

  ```bash
  npm run build
  ```

  Expected outcome: build completes with "Route (app)" output and no fatal errors.
  `ignoreBuildErrors: true` and `eslint.ignoreDuringBuilds: true` are already set in
  `next.config.js`, so TypeScript / ESLint warnings do not fail the build.

  Then run the Cloudflare build:

  ```bash
  npm run build:cf
  ```

  Expected outcome: `@opennextjs/cloudflare build` completes and produces
  `.open-next/` output without the peer-dependency ERESOLVE error.

  Files: `package-lock.json` (updated by npm install)

  Verify: Both `npm run build` and `npm run build:cf` exit with code 0.

---

- [ ] 6. **Commit and push**

  Stage all changed files and commit on the current branch (do **not** push directly to
  `main` unless the branch policy explicitly allows it — create a feature branch if
  needed).

  ```bash
  git checkout -b feat/nextjs15-upgrade
  git add package.json package-lock.json next.config.js \
    src/app/verify/\[id\]/page.tsx \
    src/app/api/notes/\[id\]/route.ts \
    src/app/api/test-runs/\[runId\]/route.ts \
    src/app/api/jira/issue/\[key\]/route.ts \
    src/app/api/keepr/device/\[deviceId\]/route.ts
  git commit -m "chore: upgrade Next.js 14 → 15.5.27 for Cloudflare Pages compatibility

  - Pin next@15.5.27 and eslint-config-next@15.5.27
  - Remove deprecated swcMinify option from next.config.js
  - Migrate route-handler params to async Promise<> (Next.js 15 breaking change):
    api/notes/[id], api/test-runs/[runId], api/jira/issue/[key],
    api/keepr/device/[deviceId]
  - Update verify/[id]/page.tsx params type (use useParams hook)
  - Fixes ERESOLVE: @opennextjs/cloudflare@1.20.9 requires next>=15.5.27"
  git push -u origin feat/nextjs15-upgrade
  ```

---

## Cloudflare Pages configuration note

Once the build passes locally, ensure the Cloudflare Pages project has this setting
to prevent the same ERESOLVE error in CI:

- **Build command:** `NPM_FLAGS=--legacy-peer-deps npm run build:cf`
  _(or add `--legacy-peer-deps` as an environment variable `NPM_FLAGS` in the CF Pages
  dashboard → Settings → Environment Variables)_
- **Root directory:** _(leave blank — the repo root contains `package.json`)_
- **Build output directory:** `.open-next/assets`

The first deploy attempt used `Root directory: .open-next/assets` which caused
`"Failed: root directory not found"` because that directory is a _build output_, not the
source root. The root directory must be blank (repo root).

---

## Summary of files to change

| File | Change |
|---|---|
| `package.json` | `next`: `14.2.35` → `15.5.27`; `eslint-config-next`: `14.2.5` → `15.5.27` |
| `next.config.js` | Remove `swcMinify: true,` |
| `src/app/verify/[id]/page.tsx` | Switch from prop-based `params` to `useParams()` |
| `src/app/api/notes/[id]/route.ts` | `params: Promise<{id}>`, `await params` in GET/PATCH/DELETE |
| `src/app/api/test-runs/[runId]/route.ts` | `params: Promise<{runId}>`, `await params` in GET/PATCH |
| `src/app/api/jira/issue/[key]/route.ts` | `params: Promise<{key}>`, `await params` in GET |
| `src/app/api/keepr/device/[deviceId]/route.ts` | `params: Promise<{deviceId}>`, `await params` in GET/PATCH |
| `package-lock.json` | Regenerated by `npm install` |
