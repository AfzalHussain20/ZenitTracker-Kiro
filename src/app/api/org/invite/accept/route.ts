/**
 * Accept Invite API
 * POST — Accept an org invite (adds user as member)
 */
import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';

const INVITES_COLLECTION = 'org_invites';
const ORG_COLLECTION = 'organizations';

export async function POST(req: NextRequest) {
    const body = await req.json();
    const { inviteId, uid, email, displayName } = body;

    if (!inviteId || !uid || !email) {
        return NextResponse.json({ error: 'Missing inviteId, uid, or email' }, { status: 400 });
    }

    try {
        const db = getAdminDb();
        const inviteRef = db.collection(INVITES_COLLECTION).doc(inviteId);
        const inviteSnap = await inviteRef.get();

        if (!inviteSnap.exists) return NextResponse.json({ error: 'Invite not found' }, { status: 404 });

        const invite = inviteSnap.data()!;

        if (invite.status !== 'pending') return NextResponse.json({ error: 'Invite already used or expired' }, { status: 400 });
        if (invite.email !== email.toLowerCase()) return NextResponse.json({ error: 'Email mismatch' }, { status: 403 });

        // Check expiry
        if (new Date(invite.expiresAt) < new Date()) {
            await inviteRef.update({ status: 'expired' });
            return NextResponse.json({ error: 'Invite expired' }, { status: 410 });
        }

        const serverNow = new Date().toISOString();
        const orgId = invite.orgId;

        // Add as member
        await db.collection(ORG_COLLECTION).doc(orgId).collection('members').doc(uid).set({
            uid,
            email: email.toLowerCase(),
            displayName: displayName || email.split('@')[0],
            role: invite.role || 'member',
            joinedAt: serverNow,
        });

        // Update user profile
        await db.collection('users').doc(uid).set(
            { orgId, orgRole: invite.role || 'member', orgName: invite.orgName || '' },
            { merge: true }
        );

        // Mark invite accepted
        await inviteRef.update({ status: 'accepted', acceptedAt: serverNow });

        return NextResponse.json({ success: true, orgId });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
