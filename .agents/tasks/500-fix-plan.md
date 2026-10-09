# Implementation Plan: Fix 500 Internal Server Error in Zenit Cloudflare Workers Deployment

## Investigation Summary

Based on my analysis of the Zenit project configuration and build process, the 500 Internal Server Error is caused by multiple issues that need to be addressed:

1. **Outdated Next.js Version**: Currently using Next.js 14.2.35, which is no longer supported and prevents the OpenNext build from proceeding without a dangerous flag.

2. **Node.js Compatibility Date**: The `wrangler.jsonc` has `compatibility_date: "2025-05-05"` which is in the future and may cause issues. OpenNext documentation recommends using `2024-12-30` or similar recent dates.

3. **Build Process Issues**: The `node:sqlite` external reference is properly configured in both `next.config.js` webpack externals and `open-next.config.ts` edgeExternals, but the outdated Next.js version may be causing compatibility issues.

## Current Configuration Status

✅ **Already Correct:**
- `wrangler.jsonc` has `nodejs_compat` compatibility flag enabled
- `open-next.config.ts` includes `node:sqlite` in `edgeExternals`
- `next.config.js` excludes `node:sqlite` in webpack externals
- Build pipeline in `.github/workflows/deploy.yml` is properly structured

❌ **Issues Found:**
- Next.js 14.2.35 is unsupported and blocks the build process
- Future compatibility date may cause runtime issues
- ESLint config also references the outdated Next.js version

---

# Implementation Plan

- [ ] 1. Update Next.js to latest supported version and related dependencies.
      Upgrade Next.js from 14.2.35 to 15.5.27, and update eslint-config-next to match.
      Files: package.json
      Verify: `npm list next eslint-config-next` shows version 15.5.27 for both packages.

- [ ] 2. Update wrangler compatibility date to recommended value.
      Change compatibility_date from "2025-05-05" to "2024-12-30" as recommended by OpenNext docs.
      Files: wrangler.jsonc
      Verify: `cat wrangler.jsonc | grep compatibility_date` shows "2024-12-30".

- [ ] 3. Install updated dependencies and verify no breaking changes.
      Run npm install with legacy-peer-deps to update packages and check for any new dependency conflicts.
      Files: package-lock.json (generated)
      Verify: `npm install --legacy-peer-deps` completes successfully without errors.

- [ ] 4. Test the OpenNext Cloudflare build process.
      Run the complete build pipeline to ensure no `node:sqlite` resolution errors occur.
      Files: .open-next/ directory (generated)
      Verify: `npx @opennextjs/cloudflare build` completes without "Could not resolve node:sqlite" errors.

- [ ] 5. Test the wrangler deployment locally.
      Run wrangler deploy in dry-run mode to validate the generated bundle passes all checks.
      Files: None (validation only)
      Verify: `npx wrangler deploy --dry-run` succeeds without bundle errors.

- [ ] 6. Deploy to Cloudflare Workers and verify the 500 error is resolved.
      Deploy the updated application and test the main routes to confirm functionality.
      Files: None (deployment only)
      Verify: Visit zenittracker domain and confirm no 500 Internal Server Error, application loads successfully.

## Key Changes Explained

**Next.js Version Update**: The primary fix is upgrading from the unsupported 14.2.35 to 15.5.27. Next.js 15.x includes important fixes for edge runtime compatibility and better support for external Node.js modules like `node:sqlite`.

**Compatibility Date**: The future date "2025-05-05" could cause runtime issues. The recommended "2024-12-30" provides stable access to the nodejs_compat features needed for `node:sqlite`.

**No Changes Needed**: The existing `nodejs_compat` flag and external module configuration is already correct - the issue is purely the outdated Next.js version preventing the build from completing.

## Risk Assessment

- **Low Risk**: Version updates are within the same major version family (Next.js 15.x supports the same features as 14.x with improvements)
- **Backwards Compatible**: No breaking changes expected as the application doesn't use deprecated Next.js 14 features
- **Reversible**: All changes can be rolled back by reverting package.json and wrangler.jsonc

## Expected Outcome

After these changes, the `npx @opennextjs/cloudflare build` command should complete successfully without the "Could not resolve node:sqlite" error, and the deployed application should serve without 500 Internal Server Errors.