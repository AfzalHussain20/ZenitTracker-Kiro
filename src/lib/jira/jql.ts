/**
 * Shared JQL helpers.
 *
 * User-supplied values must never be interpolated into a JQL string raw —
 * a value such as `Open" OR project = "SEC` escapes the quoted literal and
 * turns a scoped read into arbitrary JQL execution.
 */

/** Escape a value for use inside a double-quoted JQL string literal. */
export function escapeJqlValue(value: unknown): string {
    return String(value ?? '')
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/[\r\n\t]+/g, ' ')
        .trim();
}

/** Wrap a value into a safe, double-quoted JQL string literal. */
export function quoteJql(value: unknown): string {
    return `"${escapeJqlValue(value)}"`;
}

/** Coerce a value to a positive integer, or return null when it is not one. */
export function toPositiveInt(value: unknown): number | null {
    const s = String(value ?? '').trim();
    if (!/^\d+$/.test(s)) return null;
    const n = parseInt(s, 10);
    return n > 0 ? n : null;
}

function escapeRegExp(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Ensure an arbitrary JQL query is scoped to `projectKey`.
 * Queries already constrained to the project are returned unchanged; anything
 * else is wrapped so it can never read from another project or the instance.
 */
export function scopeJqlToProject(jql: string, projectKey: string): string {
    const trimmed = (jql || '').trim();
    const fallback = `project = ${projectKey} ORDER BY created DESC`;
    if (!trimmed) return fallback;

    const key = escapeRegExp(projectKey);
    const scopeRe = new RegExp(`project\\s*(=\\s*"?${key}\\b|in\\s*\\([^)]*\\b${key}\\b)`, 'i');
    if (scopeRe.test(trimmed)) return trimmed;

    const orderMatch = trimmed.match(/\s+ORDER BY\s+.+$/i);
    const order = orderMatch ? orderMatch[0] : '';
    const body = orderMatch ? trimmed.slice(0, trimmed.length - order.length) : trimmed;
    return `project = ${projectKey} AND (${body})${order}`;
}
