/**
 * GET /api/google/test — diagnostics for the Google service account.
 *
 * This used to be reachable by any signed-in caller and returned the service
 * account's email, project id and env-key names. It is now staff-only and
 * returns booleans instead of identifiers.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getRequestUser, unauthorized, forbidden, isInternalEmail } from '@/lib/server/request-auth';

export async function GET(req: NextRequest) {
    const user = await getRequestUser(req);
    if (!user) return unauthorized();
    if (!isInternalEmail(user.email)) return forbidden('Staff only');

    try {
        const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
        if (!raw) {
            return NextResponse.json({ ok: false, error: 'GOOGLE_SERVICE_ACCOUNT_KEY is not set' }, { status: 500 });
        }

        let parsed: any;
        try {
            parsed = JSON.parse(raw);
        } catch {
            return NextResponse.json({ ok: false, error: 'GOOGLE_SERVICE_ACCOUNT_KEY is not valid JSON' }, { status: 500 });
        }

        return NextResponse.json({
            ok: true,
            hasClientEmail: Boolean(parsed.client_email),
            hasPrivateKey: Boolean(parsed.private_key),
            hasProjectId: Boolean(parsed.project_id),
        });
    } catch (err: any) {
        return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
    }
}
