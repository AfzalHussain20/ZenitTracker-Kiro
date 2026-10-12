/**
 * Client-side access to the all-time Jira snapshot (/api/jira/alltime).
 *
 * The snapshot is fetched once per session (module-level memo) and served by
 * the browser HTTP cache afterwards, so it is never re-downloaded on every
 * navigation. Merge its result into a sync payload before processing KPIs.
 */

export interface AllTimeSnapshot {
    allTimeBugs: any[];
    allTimeAll: any[];
}

let pending: Promise<AllTimeSnapshot | null> | null = null;

async function gunzipArrayBuffer(buf: ArrayBuffer): Promise<string> {
    const ds = new DecompressionStream('gzip');
    const stream = new Blob([buf]).stream().pipeThrough(ds);
    return new Response(stream).text();
}

export function fetchAllTime(force = false): Promise<AllTimeSnapshot | null> {
    if (!force && pending) return pending;
    pending = fetch('/api/jira/alltime', { cache: force ? 'no-store' : 'default' })
        .then(async (r) => {
            if (!r.ok) return null;
            // The endpoint streams the stored gzip bytes (Content-Encoding is
            // stripped by the OpenNext runtime) — decompress explicitly.
            const buf = await r.arrayBuffer();
            const snap = JSON.parse(await gunzipArrayBuffer(buf));
            if (!Array.isArray(snap?.allTimeBugs) || !Array.isArray(snap?.allTimeAll)) return null;
            return { allTimeBugs: snap.allTimeBugs, allTimeAll: snap.allTimeAll };
        })
        .catch(() => null);
    return pending;
}

/** Attach the all-time snapshot to a raw sync payload (mutates and returns `raw`). */
export async function attachAllTime<T extends Record<string, any>>(raw: T): Promise<T> {
    const snap = await fetchAllTime();
    if (snap) {
        raw.allTimeBugs = snap.allTimeBugs;
        raw.allTimeAll = snap.allTimeAll;
    }
    return raw;
}