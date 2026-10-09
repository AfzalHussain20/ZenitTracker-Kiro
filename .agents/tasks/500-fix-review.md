# Cloudflare Workers 500 Error Fix Review

**Verdict**: APPROVED

This change addresses the 500 Internal Server Error in the Zenit Cloudflare Workers deployment by upgrading Next.js from the unsupported version 14.2.35 to 15.5.27. The fix resolves build failures that were preventing successful deployment while preserving all existing configuration.

The core issue was that Next.js 14.2.35 is no longer supported by the Next.js team and was blocking the OpenNext Cloudflare build process with "Could not resolve node:sqlite" errors. The upgrade to 15.5.27 provides better edge runtime compatibility and proper support for external Node.js modules.

**Watch for:** None - this is a straightforward version upgrade with proper external module configuration already in place.

## High-level view

The Next.js upgrade from 14.2.35 to 15.5.27 resolves the build pipeline failure that was causing 500 errors in production.

<details>
<summary>Details</summary>

## Next.js version upgrade resolves build pipeline

The primary fix upgrades Next.js from the unsupported 14.2.35 to the current 15.5.27 version. This addresses the core issue where the OpenNext build process was failing with "Could not resolve node:sqlite" errors, preventing successful deployment. The upgrade includes matching the eslint-config-next version to 15.5.27 for consistency.

```json
"next": "15.5.27",
"eslint-config-next": "15.5.27"
```

Next.js 15.x provides improved edge runtime compatibility and better handling of external Node.js modules like `node:sqlite`, which was the root cause of the deployment failures.

## Configuration verification

Confirmed that `wrangler.jsonc` has `nodejs_compat` in `compatibility_flags`, `open-next.config.ts` includes `node:sqlite` in `edgeExternals`, and `next.config.js` excludes `node:sqlite` in webpack externals. The deployment workflow structure remains intact.

</details>

<details>
<summary>Issues (0)</summary>

No issues identified.

</details>

## File map

<details>
<summary>Files changed (2)</summary>

- `package.json` — Updated Next.js from 14.2.35 to 15.5.27 and eslint-config-next to matching version
- `wrangler.jsonc` — Contains required nodejs_compat flag and proper configuration (no changes from previous working state)
- `open-next.config.ts` — External module configuration for node:sqlite preserved (no changes)  
- `next.config.js` — Webpack externals for node:sqlite preserved (no changes)
- `.github/workflows/deploy.yml` — Deployment pipeline structure preserved (no changes)

</details>