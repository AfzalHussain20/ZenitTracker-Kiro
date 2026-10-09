/**
 * Organization API
 * POST — Create a new organization (called during onboarding)
 * GET  — Get the current user's organization
 */
import { NextRequest, NextResponse } from 'next/server';
import { getCompatDb } from '@/lib/firebase-compat';
import { PLAN_LIMITS, type PlanTier } from '@/types/organization';

const ORG_COLLECTION = 'organizations';
const MEMBERS_SUB = 'members';

export async function POST(req: NextRequest) {
    const body = await req.json();
    const { name, uid, email, displayName, plan = 'free' } = body;

    if (!name?.trim() || !uid || !email) {
        return NextResponse.json({ error: 'Missing name, uid, or email' }, { status: 400 });
    }

    const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const serverNow = new Date().toISOString();
    const tier = (plan as PlanTier) || 'free';

    try {
        const db = getCompatDb();

        // Check slug uniqueness
        const existing = await db.collection(ORG_COLLECTION).where('slug', '==', slug).limit(1).get();
        if (!existing.empty) {
            return NextResponse.json({ error: 'An organization with that name already exists' }, { status: 409 });
        }

        const orgData = {
            name: name.trim(),
            slug,
            plan: tier,
            createdAt: serverNow,
            createdBy: uid,
            limits: PLAN_LIMITS[tier],
        };

        const orgRef = await db.collection(ORG_COLLECTION).add(orgData);
        const orgId = orgRef.id;

        // Add creator as owner member
        await orgRef.collection(MEMBERS_SUB).doc(uid).set({
            uid,
            email,
            displayName: displayName || email.split('@')[0],
            role: 'owner',
            joinedAt: serverNow,
        });

        // Update user profile with orgId
        await db.collection('users').doc(uid).set(
            { orgId, orgRole: 'owner', orgName: name.trim() },
            { merge: true }
        );

        return NextResponse.json({ success: true, orgId, org: { id: orgId, ...orgData } });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const uid = searchParams.get('uid');

    if (!uid) return NextResponse.json({ error: 'Missing uid' }, { status: 400 });

    try {
        const db = getCompatDb();

        // Find user's org from their profile
        const userDoc = await db.collection('users').doc(uid).get();
        const orgId = userDoc.data()?.orgId;

        if (!orgId) return NextResponse.json({ org: null, members: [] });

        const orgDoc = await db.collection(ORG_COLLECTION).doc(orgId).get();
        if (!orgDoc.exists) return NextResponse.json({ org: null, members: [] });

        // Get members
        const membersSnap = await orgDoc.ref.collection(MEMBERS_SUB).get();
        const members = membersSnap.docs.map(d => d.data());

        return NextResponse.json({
            org: { id: orgDoc.id, ...orgDoc.data() },
            members,
        });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
