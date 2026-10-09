/**
 * Firebase Admin SDK shim — Cloudflare Workers compatible.
 * Delegates to the v8-compat wrapper over Firebase Web SDK v10.
 */
export { getCompatDb as getAdminDb } from './firebase-compat';
