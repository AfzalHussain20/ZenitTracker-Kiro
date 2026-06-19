/**
 * Multi-tenant Organization types for Zenit SaaS.
 */

export type PlanTier = 'free' | 'pro' | 'enterprise';
export type OrgRole = 'owner' | 'admin' | 'member';
export type InviteStatus = 'pending' | 'accepted' | 'expired';

export interface Organization {
    id: string;
    name: string;
    slug: string;             // URL-friendly unique identifier
    plan: PlanTier;
    createdAt: string;        // ISO
    createdBy: string;        // uid
    logoUrl?: string;
    domain?: string;          // auto-join domain (e.g. "zenit.com")
    // limits (enforced at API level)
    limits: {
        maxUsers: number;     // free: 3, pro: 50, enterprise: unlimited
        maxPlans: number;     // free: 5, pro: unlimited, enterprise: unlimited
        maxDevices: number;   // free: 10, pro: unlimited, enterprise: unlimited
    };
    // billing (Stripe)
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    billingEmail?: string;
}

export interface OrgMember {
    uid: string;
    email: string;
    displayName: string;
    role: OrgRole;
    joinedAt: string;         // ISO
    photoUrl?: string;
}

export interface OrgInvite {
    id: string;
    orgId: string;
    orgName: string;
    email: string;
    role: OrgRole;
    invitedBy: string;        // uid
    invitedByName: string;
    status: InviteStatus;
    createdAt: string;        // ISO
    expiresAt: string;        // ISO
    acceptedAt?: string;
}

// Plan limits config
export const PLAN_LIMITS: Record<PlanTier, Organization['limits']> = {
    free:       { maxUsers: 3,   maxPlans: 5,    maxDevices: 10 },
    pro:        { maxUsers: 50,  maxPlans: 9999, maxDevices: 9999 },
    enterprise: { maxUsers: 9999, maxPlans: 9999, maxDevices: 9999 },
};

export const PLAN_PRICING: Record<PlanTier, { monthly: number; annual: number; currency: string; label: string }> = {
    free:       { monthly: 0,    annual: 0,     currency: 'INR', label: 'Free' },
    pro:        { monthly: 999,  annual: 9990,  currency: 'INR', label: 'Pro' },
    enterprise: { monthly: 2499, annual: 24990, currency: 'INR', label: 'Enterprise' },
};
