# Next.js 14 → 15.5.27 upgrade for Cloudflare Pages compatibility

The project was blocked at `npm install` on Cloudflare Pages because `@opennextjs/cloudflare@1.20.9` requires `next >= 15.5.27` while the project pinned `next@14.2.35`. This change upgrades both `next` and `eslint-config-next` to `15.5.27`, migrates the four API route handlers and one page component that needed breaking-change fixes, and removes the deprecated `swcMinify` option from `next.config.js`. The local build completed in 72 seconds, all 84 routes compiled, and no fatal errors were reported. `--legacy-peer-deps` was used for install, as required for the `@opennextjs/cloudflare` peer chain.

Watch for: (1) **confirmed** — the Cloudflare Pages build command itself still needs `NPM_FLAGS=--legacy-peer-deps` set in the dashboard; the local fix does not automatically propagate to CI. (2) **confirmed** — `next` is pinned without a caret (`"15.5.27"` not `"^15.5.27"`), which is correct given the peer constraint but means security patch releases require a manual bump.

**Verdict**: APPROVED

---

## High-level view

The version bump is exact-pinned and both `next` and `eslint-config-next` move together to `15.5.27`, satisfying the `@opennextjs/cloudflare@1.20.9` lower bound precisely. The `@opennextjs/cloudflare` package still needs `--legacy-peer-deps` at install time because its transitive `@opennextjs/aws` dependency advertises `next >= 15.5.27 <16 || >= 16.3.8` while `15.5.27` technically satisfies that range — npm's strict resolver still rejects it without the flag, so the local fix only holds if the CI environment is configured to match.

Every dynamic API route identified in the plan (`notes/[id]`, `test-runs/[runId]`, `jira/issue/[key]`, `keepr/device/[deviceId]`) now types `params` as `Promise<{...}>` and `await`s it before use. No old-style `params: { ... }` signatures survive anywhere in the route layer. The `verify/[id]` page was refactored to `useParams()`, consistent with every other dynamic page in the codebase. No `cookies()` or `headers()` calls from `next/headers` exist in the project, so no async migration was needed there.

The `swcMinify: true` option was removed from `next.config.js`. Nothing else in the config was touched. The standalone output mode guard (`process.env.NETLIFY || process.env.CF_PAGES`) remains in place.

The non-fatal ENOENT warning in the build trace (`Failed to copy traced files ... jdk-17...`) is Windows-specific, pre-existing, and does not affect build output.

---

<details>
<summary>Issues (1)</summary>

1. **CI install flag not propagated** — `--legacy-peer-deps` was used locally but the Cloudflare Pages build command in the dashboard still runs `npm clean-install` without it. The original build log shows the ERESOLVE failure happened at the CI install step; fixing `package.json` alone does not fix CI. Set `NPM_FLAGS=--legacy-peer-deps` as a Cloudflare Pages environment variable, or prefix the build command: `NPM_FLAGS=--legacy-peer-deps npm run build:cf`.

</details>

---

<details>
<summary>Details</summary>

## Peer dependency resolution and install flag

The ERESOLVE error occurred because `@opennextjs/cloudflare@1.20.9` → `@opennextjs/aws@4.1.8` peers `next@">=15.5.27 <16 || >=16.3.8"`. Upgrading to `15.5.27` satisfies that range, but npm's default resolver still aborts when it detects the transitive chain. `--legacy-peer-deps` is the correct escape valve here; it was used locally (`npm install --legacy-peer-deps`) and is confirmed to produce a working lockfile.

The critical gap: the Cloudflare Pages build log shows the failure at `npm clean-install --progress=false` — a command that CF Pages runs autonomously with no flags. `package.json` changes don't affect the CI install command. The environment variable `NPM_FLAGS=--legacy-peer-deps` (or equivalent in the build command prefix) must be set in the Cloudflare Pages project settings for the CI build to succeed. Without it, the upgrade fixes the version constraint but the CI build will still fail at install for the same reason.

## params → Promise migration coverage

All five files identified in the plan were migrated and none missed:

- `api/notes/[id]` — GET, PATCH, DELETE all updated; `params.id` references replaced with the destructured `id` variable throughout.  
- `api/test-runs/[runId]` — GET and PATCH updated; single `await params` at the top of each handler.  
- `api/jira/issue/[key]` — GET updated; destructuring `{ key: issueKey }` at the point of `await params` is clean and preserves the existing local variable name.  
- `api/keepr/device/[deviceId]` — GET and PATCH updated. The POST handler on this same file has no `params` argument and was correctly left untouched.  
- `verify/[id]/page.tsx` — switched to `useParams()` from `next/navigation`, consistent with every other dynamic page in the codebase. The component no longer accepts `params` as a prop at all.

A search for the old-style `params: { someName: string }` signature returns zero matches across all route files, confirming no handlers were missed.


</details>

---

<details>
<summary>File map</summary>

| File | Change |
|---|---|
| `package.json` | `next` bumped from `14.2.35` to `15.5.27` (exact pin); `eslint-config-next` bumped from `14.2.5` to `15.5.27` (exact pin) |
| `next.config.js` | `swcMinify: true` removed (deprecated in Next.js 15) |
| `src/app/verify/[id]/page.tsx` | Removed `params` prop; replaced with `useParams()` from `next/navigation` |
| `src/app/api/notes/[id]/route.ts` | GET, PATCH, DELETE: `params` typed as `Promise<{ id: string }>`, destructured with `await` |
| `src/app/api/test-runs/[runId]/route.ts` | GET, PATCH: `params` typed as `Promise<{ runId: string }>`, destructured with `await` |
| `src/app/api/jira/issue/[key]/route.ts` | GET: `params` typed as `Promise<{ key: string }>`, destructured with `await` |
| `src/app/api/keepr/device/[deviceId]/route.ts` | GET, PATCH: `params` typed as `Promise<{ deviceId: string }>`, destructured with `await`; POST untouched |
| `package-lock.json` | Regenerated by `npm install --legacy-peer-deps` |

</details>
