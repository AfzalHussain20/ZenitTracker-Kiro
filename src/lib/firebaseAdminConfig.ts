/**
 * Cloudflare Workers-compatible Firebase config shims.
 * All functions are synchronous to avoid await issues at module level.
 */
import { getCompatDb } from './firebase-compat';

export const getAdminDb = getCompatDb;
export const getAdminAuth = () => null;
export const getAdminStorage = () => null;
