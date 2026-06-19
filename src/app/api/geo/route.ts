/**
 * Geo API — returns the visitor's country + matched currency config.
 * Uses Vercel's edge geo headers (works behind a VPN — reflects the egress IP).
 */
import { NextRequest, NextResponse } from 'next/server';
import { currencyForCountry, CURRENCIES } from '@/lib/pricing';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    // Vercel sets these headers automatically in production
    const country =
        req.headers.get('x-vercel-ip-country') ||
        req.headers.get('cf-ipcountry') ||
        (req as any).geo?.country ||
        '';

    const currency = currencyForCountry(country);
    return NextResponse.json(
        {
            country: country || null,
            currency,
            config: CURRENCIES[currency],
        },
        { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
}
