import { NextRequest, NextResponse } from 'next/server';
import { parseCspReport } from '@/lib/server/csp-report';
import { checkRateLimit } from '@/lib/server/rate-limit';

export const dynamic = 'force-dynamic';

// Reports are tiny; anything large is junk or abuse.
const MAX_BODY_BYTES = 16 * 1024;

/**
 * POST /api/csp-report
 *
 * Receives Content-Security-Policy violation reports while the policy runs in
 * report-only mode. Public by necessity (the browser posts them without a
 * session) but rate-limited, size-capped and write-free: violations are only
 * logged, never stored.
 */
export async function POST(req: NextRequest) {
  if (!checkRateLimit(req, 'csp', 120, 60_000)) {
    return new NextResponse(null, { status: 429 });
  }

  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) {
    return new NextResponse(null, { status: 413 });
  }

  let payload: unknown = null;
  try {
    payload = raw ? JSON.parse(raw) : null;
  } catch {
    return new NextResponse(null, { status: 400 });
  }

  const violations = parseCspReport(payload);
  for (const v of violations) {
    console.warn(
      `[csp] ${v.directive} blocked=${v.blocked || '(inline)'} doc=${v.documentUri}` +
        (v.sourceFile ? ` src=${v.sourceFile}${v.line != null ? `:${v.line}` : ''}` : ''),
    );
  }

  // 204: the browser does not care about the body.
  return new NextResponse(null, { status: 204 });
}
