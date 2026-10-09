/**
 * Billing Activation API
 * POST — Activate a subscription plan for a user (and their org if any).
 *
 * Payment provider integration point:
 *  - If a real payment gateway (Razorpay/Stripe) is wired, verify the payment
 *    signature here before activating. For now we accept a paymentRef and
 *    activate immediately (demo / manual-invoice mode), which lets the full
 *    flow work end-to-end. Internal @sunnetwork.in users never hit this.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getCompatDb } from '@/lib/firebase-compat';
import { PLAN_LIMITS, type PlanTier } from '@/types/organization';

export async function POST(req: NextRequest) {
    const body = await req.json();
    const { uid, orgId, plan, paymentRef, billingCycle = 'monthly' } = body as {
        uid: string; orgId?: string; plan: PlanTier; paymentRef?: string; billingCycle?: 'monthly' | 'annual';
    };

    if (!uid || !plan) {
        return NextResponse.json({ error: 'Missing uid or plan' }, { status: 400 });
    }
    if (!['free', 'pro', 'enterprise'].includes(plan)) {
        return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
    }

    const serverNow = new Date().toISOString();
    const periodEnd = new Date(Date.now() + (billingCycle === 'annual' ? 365 : 30) * 24 * 60 * 60 * 1000).toISOString();

    const subscription = {
        plan,
        status: plan === 'free' ? 'active' : 'active',
        billingCycle,
        provider: paymentRef ? 'razorpay' : 'manual',
        paymentRef: paymentRef ?? null,
        startedAt: serverNow,
        currentPeriodEnd: periodEnd,
    };

    try {
        const db = getCompatDb();

        // Update user profile
        await db.collection('users').doc(uid).set(
            { plan, subscription },
            { merge: true }
        );

        // Update org if provided
        if (orgId) {
            await db.collection('organizations').doc(orgId).set(
                { plan, limits: PLAN_LIMITS[plan], subscription },
                { merge: true }
            );
        }

        return NextResponse.json({ success: true, plan, subscription });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
