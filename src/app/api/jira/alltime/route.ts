/**
 * GET /api/jira/alltime — all-time snapshot served straight from KV.
 *
 * The snapshot is stored gzip-compressed by scripts/refresh-alltime.ts. This
 * route streams those bytes back as the body (OpenNext strips custom
 * Content-Encoding headers, so clients gunzip explicitly — see
 * src/lib/jira/alltime.ts). Worker CPU is near-zero: no decompression, no
 * serialization. HTTP caching keeps later requests off the network.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';

const ALLTIME_KEY = 'alltime.json';

export async function GET(_req: NextRequest) {
    try {
        const { env } = getCloudflareContext();
        const kv: any = (env as any)?.ALLTIME_KV;
        if (!kv) return NextResponse.json({ error: 'cache unavailable' }, { status: 503 });

        const buf: ArrayBuffer | null = await kv.get(ALLTIME_KEY, 'arrayBuffer');
        if (!buf) return NextResponse.json({ error: 'snapshot not ready yet' }, { status: 503 });

        return new Response(buf, {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                // The snapshot itself is rebuilt every 15 minutes by the
                // refresh-alltime workflow. Keep the browser cache short so a
                // tab that stays open picks up new bugs quickly; stale-while-
                // revalidate keeps navigation instant.
                'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
            },
        });
    } catch {
        return NextResponse.json({ error: 'cache unavailable' }, { status: 503 });
    }
}