/**
 * Billing Activation API
 * POST — Activate a subscription plan for the signed-in user (and their org).
 *
 * Security notes:
 *  - The uid always comes from the signed session; the body cannot target
 *    another account.
 *  - Paid plans require a payment reference. Manual/demo activation is only
 *    allowed outside production or when ALLOW_MANUAL_BILLING=true.
 *  - Org updates require membership in that org.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getCompatDb } from '@/lib/firebase-compat';
import { PLAN_LIMITS, type PlanTier } from '@/types/organization';
import { getRequestUser, unauthorized, isInternalEmail } from '@/lib/server/request-auth';

export async function POST(req: NextRequest) {
    const user = await getRequestUser(req);
    if (!user) return unauthorized();

    const body = await req.json().catch(() => ({}));
    const { orgId, plan, paymentRef, billingCycle = 'monthly' } = body as {
        orgId?: string; plan: PlanTier; paymentRef?: string; billingCycle?: 'monthly' | 'annual';
    };
    const uid = user.uid;

    if (!plan) {
        return NextResponse.json({ error: 'Missing plan' }, { status: 400 });
    }
    if (!['free', 'pro', 'enterprise'].includes(plan)) {
        return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
    }

    const manualBillingAllowed =
        process.env.ALLOW_MANUAL_BILLING === 'true' || process.env.NODE_ENV !== 'production';
    if (plan !== 'free' && !paymentRef && !manualBillingAllowed) {
        return NextResponse.json(
            { error: 'Payment verification is required to activate a paid plan' },
            { status: 402 },
        );
    }

    const serverNow = new Date().toISOString();
    const periodEnd = new Date(
        Date.now() + (billingCycle === 'annual' ? 365 : 30) * 24 * 60 * 60 * 1000,
    ).toISOString();

    const subscription = {
        plan,
        status: 'active',
        billingCycle,
        provider: paymentRef ? 'razorpay' : 'manual',
        paymentRef: paymentRef ?? null,
        startedAt: serverNow,
        currentPeriodEnd: periodEnd,
    };

    try {
        const db = getCompatDb();

        // An org can only be updated by one of its members (or staff).
        if (orgId && !isInternalEmail(user.email)) {
            const member = await db
                .collection('organizations')
                .doc(orgId)
                .collection('members')
                .doc(uid)
                .get();
            if (!member.exists) {
                return NextResponse.json({ error: 'You do not belong to this organization' }, { status: 403 });
            }
        }

        await db.collection('users').doc(uid).set({ plan, subscription }, { merge: true });

        if (orgId) {
            await db.collection('organizations').doc(orgId).set(
                { plan, limits: PLAN_LIMITS[plan], subscription },
                { merge: true },
            );
        }

        return NextResponse.json({ success: true, plan, subscription });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
