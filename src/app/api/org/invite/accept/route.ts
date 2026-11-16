/**
 * Accept Invite API
 * POST — Accept an org invite (adds user as member)
 *
 * The accepting identity and email come from the signed session, so an invite
 * cannot be claimed by someone else.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getCompatDb } from '@/lib/firebase-compat';
import { getRequestUser, unauthorized } from '@/lib/server/request-auth';

const INVITES_COLLECTION = 'org_invites';
const ORG_COLLECTION = 'organizations';

export async function POST(req: NextRequest) {
    const user = await getRequestUser(req);
    if (!user) return unauthorized();

    const body = await req.json().catch(() => ({}));
    const { inviteId, displayName } = body;
    const uid = user.uid;
    const email = user.email;

    if (!inviteId || !email) {
        return NextResponse.json({ error: 'Missing inviteId' }, { status: 400 });
    }

    try {
        const db = getCompatDb();
        const inviteRef = db.collection(INVITES_COLLECTION).doc(inviteId);
        const inviteSnap = await inviteRef.get();

        if (!inviteSnap.exists) return NextResponse.json({ error: 'Invite not found' }, { status: 404 });

        const invite = inviteSnap.data()!;

        if (invite.status !== 'pending') return NextResponse.json({ error: 'Invite already used or expired' }, { status: 400 });
        if (String(invite.email).toLowerCase() !== email.toLowerCase()) {
            return NextResponse.json({ error: 'This invite belongs to a different email address' }, { status: 403 });
        }

        if (new Date(invite.expiresAt) < new Date()) {
            await inviteRef.update({ status: 'expired' });
            return NextResponse.json({ error: 'Invite expired' }, { status: 410 });
        }

        const serverNow = new Date().toISOString();
        const orgId = invite.orgId;

        await db.collection(ORG_COLLECTION).doc(orgId).collection('members').doc(uid).set({
            uid,
            email: email.toLowerCase(),
            displayName: displayName || email.split('@')[0],
            role: invite.role || 'member',
            joinedAt: serverNow,
        });

        await db.collection('users').doc(uid).set(
            { orgId, orgRole: invite.role || 'member', orgName: invite.orgName || '' },
            { merge: true }
        );

        await inviteRef.update({ status: 'accepted', acceptedAt: serverNow });

        return NextResponse.json({ success: true, orgId });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
