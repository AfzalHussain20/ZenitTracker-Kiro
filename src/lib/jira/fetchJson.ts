/**
 * Client-side JSON fetcher for the Jira API endpoints.
 *
 * The sprint sync (/api/jira/sync) is gzipped once per cache fill on the
 * server; the all-time endpoint streams pre-stored gzip. Both come back as raw
 * gzip bytes (OpenNext strips Content-Encoding headers), so this helper
 * decompresses explicitly and re-attaches the volatile sync metadata that now
 * travels in response headers.
 */

export async function gunzipArrayBuffer(buf: ArrayBuffer): Promise<string> {
    const ds = new DecompressionStream('gzip');
    const stream = new Blob([buf]).stream().pipeThrough(ds);
    return new Response(stream).text();
}

function isGzip(buf: ArrayBuffer): boolean {
    const b = new Uint8Array(buf, 0, 2);
    return b[0] === 0x1f && b[1] === 0x8b;
}

export interface JiraApiMeta {
    cacheAge: number;
    nextRefresh: number;
    fromCache: boolean;
    refreshing: boolean;
}

export async function fetchApiJson<T = any>(url: string, init?: RequestInit): Promise<T & Partial<JiraApiMeta>> {
    const res = await fetch(url, init);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = await res.arrayBuffer();
    const text = isGzip(buf) ? await gunzipArrayBuffer(buf) : new TextDecoder().decode(buf);
    const data = JSON.parse(text) as T & Partial<JiraApiMeta>;

    const h = res.headers;
    const toInt = (v: string | null) => (v === null ? undefined : Number(v));
    const meta: JiraApiMeta = {
        // Headers win; fall back to whatever was embedded in the body (older deploys).
        cacheAge: toInt(h.get('x-cache-age')) ?? data.cacheAge ?? 0,
        nextRefresh: toInt(h.get('x-next-refresh')) ?? data.nextRefresh ?? 600,
        fromCache: h.get('x-from-cache') === '1' || !!data.fromCache,
        refreshing: h.get('x-refreshing') === '1' || !!data.refreshing,
    };
    return { ...data, ...meta };
}