/**
 * CSP violation reports arrive in two shapes:
 *   - legacy:      `application/csp-report` → `{ "csp-report": { ... } }`
 *   - Reporting:   `application/reports+json` → `[{ type, body: { ... } }]`
 * Normalise both into a small, loggable record. Kept pure so the parsing can be
 * unit-tested without a Request.
 */

export interface CspViolation {
  directive: string;
  blocked: string;
  documentUri: string;
  sourceFile: string;
  line: number | null;
}

/** Strip query strings/fragments so logs do not accumulate user-specific data. */
function cleanUrl(value: unknown): string {
  if (typeof value !== 'string' || !value) return '';
  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname}`;
  } catch {
    return value.slice(0, 200);
  }
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function fromBody(body: Record<string, any>): CspViolation {
  return {
    directive: String(
      body['violated-directive'] || body['effective-directive'] || body.effectiveDirective || 'unknown',
    ).slice(0, 80),
    blocked: String(body['blocked-uri'] || body.blockedURL || '').slice(0, 200),
    documentUri: cleanUrl(body['document-uri'] || body.documentURL),
    sourceFile: cleanUrl(body['source-file'] || body.sourceFile),
    line: asNumber(body['line-number'] ?? body.lineNumber),
  };
}

/** Returns at most `limit` violations, ignoring anything unrecognised. */
export function parseCspReport(payload: unknown, limit = 10): CspViolation[] {
  const out: CspViolation[] = [];

  if (Array.isArray(payload)) {
    for (const entry of payload) {
      if (out.length >= limit) break;
      const body = entry && typeof entry === 'object' ? (entry as any).body : null;
      if (body && typeof body === 'object') out.push(fromBody(body));
    }
    return out;
  }

  if (payload && typeof payload === 'object') {
    const legacy = (payload as any)['csp-report'];
    if (legacy && typeof legacy === 'object') out.push(fromBody(legacy));
  }

  return out.slice(0, limit);
}
