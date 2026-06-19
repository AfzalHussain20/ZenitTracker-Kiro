/**
 * Org Invite API
 * POST — Send an invite (creates a pending invite doc)
 * GET  — List pending invites for an org
 */
import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';

const INVITES_COLLECTION = 'org_invites';

export async function POST(req: NextRequest) {
    const body = await req.json();
    const { orgId, orgName, email, role = 'member', invitedBy, invitedByName } = body;

    if (!orgId || !email || !invitedBy) {
        return NextResponse.json({ error: 'Missing orgId, email, or invitedBy' }, { status: 400 });
    }

    const serverNow = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

    try {
        const db = getAdminDb();

        // Check if invite already exists and is pending
        const existing = await db.collection(INVITES_COLLECTION)
            .where('orgId', '==', orgId)
            .where('email', '==', email.toLowerCase())
            .where('status', '==', 'pending')
            .limit(1).get();

        if (!existing.empty) {
            return NextResponse.json({ error: 'Invite already pending for this email' }, { status: 409 });
        }

        const invite = {
            orgId,
            orgName: orgName || '',
            email: email.toLowerCase(),
            role,
            invitedBy,
            invitedByName: invitedByName || '',
            status: 'pending',
            createdAt: serverNow,
            expiresAt,
        };

        const ref = await db.collection(INVITES_COLLECTION).add(invite);
        return NextResponse.json({ success: true, inviteId: ref.id });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const orgId = searchParams.get('orgId');
    const email = searchParams.get('email');

    try {
        const db = getAdminDb();
        let q: FirebaseFirestore.Query = db.collection(INVITES_COLLECTION);

        if (orgId) q = q.where('orgId', '==', orgId);
        if (email) q = q.where('email', '==', email.toLowerCase());
        q = q.where('status', '==', 'pending');

        const snap = await q.get();
        const invites = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        return NextResponse.json({ invites });
    } catch (err: any) {
        return NextResponse.json({ invites: [], error: err.message }, { status: 500 });
    }
}
