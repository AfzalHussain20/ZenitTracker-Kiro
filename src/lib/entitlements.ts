/**
 * Entitlements — the single source of truth for what a user can access.
 *
 * Rules:
 *  • Anyone with an @sunnetwork.in email is treated as INTERNAL → full
 *    enterprise access, free, forever (your own team).
 *  • Everyone else gets the plan stored on their profile/org (default: free).
 */
import type { PlanTier } from '@/types/organization';

export const INTERNAL_DOMAINS = ['@sunnetwork.in'];

export function isInternalEmail(email?: string | null): boolean {
    if (!email) return false;
    const e = email.toLowerCase();
    return INTERNAL_DOMAINS.some(d => e.endsWith(d));
}

export function resolvePlan(email?: string | null, storedPlan?: PlanTier | null): PlanTier {
    if (isInternalEmail(email)) return 'enterprise';
    return storedPlan ?? 'free';
}

export interface Entitlements {
    plan: PlanTier;
    isPremium: boolean;   // pro or enterprise
    isInternal: boolean;  // @sunnetwork.in
    features: {
        jiraSync: boolean;
        automation: boolean;
        advancedAnalytics: boolean;
        deviceFleet: boolean;
        apiAccess: boolean;
        unlimitedPlans: boolean;
        prioritySupport: boolean;
        sso: boolean;
    };
}

export function getEntitlements(email?: string | null, storedPlan?: PlanTier | null): Entitlements {
    const plan = resolvePlan(email, storedPlan);
    const internal = isInternalEmail(email);
    const premium = plan === 'pro' || plan === 'enterprise';
    const enterprise = plan === 'enterprise';
    return {
        plan,
        isPremium: premium,
        isInternal: internal,
        features: {
            jiraSync: premium,
            automation: premium,
            advancedAnalytics: premium,
            deviceFleet: true,        // basic device list available to all
            apiAccess: enterprise,
            unlimitedPlans: premium,
            prioritySupport: premium,
            sso: enterprise,
        },
    };
}

// Human-readable plan label (internal users show a special badge)
export function planLabel(email?: string | null, storedPlan?: PlanTier | null): string {
    if (isInternalEmail(email)) return 'Enterprise (Internal)';
    const p = storedPlan ?? 'free';
    return p === 'free' ? 'Free' : p === 'pro' ? 'Pro' : 'Enterprise';
}
