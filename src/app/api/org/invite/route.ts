/**
 * Org Invite API
 * POST — Send an invite (creates a pending invite doc)
 * GET  — List pending invites for an org (members only) or for yourself
 */
import { NextRequest, NextResponse } from 'next/server';
import { getCompatDb, type CompatQuery } from '@/lib/firebase-compat';
import { getRequestUser, unauthorized, isInternalEmail } from '@/lib/server/request-auth';

const INVITES_COLLECTION = 'org_invites';
const ORG_COLLECTION = 'organizations';

async function isOrgMember(orgId: string, uid: string): Promise<boolean> {
    const db = getCompatDb();
    const member = await db.collection(ORG_COLLECTION).doc(orgId).collection('members').doc(uid).get();
    return member.exists;
}

export async function POST(req: NextRequest) {
    const user = await getRequestUser(req);
    if (!user) return unauthorized();

    const body = await req.json().catch(() => ({}));
    const { orgId, orgName, email, role = 'member', invitedByName } = body;

    if (!orgId || !email) {
        return NextResponse.json({ error: 'Missing orgId or email' }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) {
        return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    }
    if (!['member', 'admin'].includes(role)) {
        return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    try {
        if (!isInternalEmail(user.email) && !(await isOrgMember(orgId, user.uid))) {
            return NextResponse.json({ error: 'You do not belong to this organization' }, { status: 403 });
        }

        const db = getCompatDb();
        const normalizedEmail = String(email).toLowerCase();
        const serverNow = new Date().toISOString();
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

        const existing = await db.collection(INVITES_COLLECTION)
            .where('orgId', '==', orgId)
            .where('email', '==', normalizedEmail)
            .where('status', '==', 'pending')
            .limit(1).get();

        if (!existing.empty) {
            return NextResponse.json({ error: 'Invite already pending for this email' }, { status: 409 });
        }

        const invite = {
            orgId,
            orgName: orgName || '',
            email: normalizedEmail,
            role,
            invitedBy: user.uid,
            invitedByName: invitedByName || user.email,
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
    const user = await getRequestUser(req);
    if (!user) return unauthorized();

    const { searchParams } = new URL(req.url);
    const orgId = searchParams.get('orgId');
    const requestedEmail = searchParams.get('email');

    try {
        if (orgId && !isInternalEmail(user.email) && !(await isOrgMember(orgId, user.uid))) {
            return NextResponse.json({ invites: [], error: 'You do not belong to this organization' }, { status: 403 });
        }

        // Only staff may look up another person's invites.
        const email = requestedEmail && isInternalEmail(user.email)
            ? requestedEmail
            : user.email;

        const db = getCompatDb();
        let q: CompatQuery = db.collection(INVITES_COLLECTION);

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
