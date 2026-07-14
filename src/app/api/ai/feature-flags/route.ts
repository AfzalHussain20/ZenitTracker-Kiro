import { NextRequest, NextResponse } from 'next/server';
import {
  getFeatureFlags,
  saveFeatureFlags,
  invalidateFlagsCache,
  DEFAULT_FLAGS,
  FEATURE_LABELS,
  PROVIDER_LABELS,
} from '@/lib/ai/feature-flags';

export const dynamic = 'force-dynamic';

/** GET — returns current flags + metadata for the UI */
export async function GET() {
  try {
    const flags = await getFeatureFlags();
    return NextResponse.json({
      flags,
      defaults: DEFAULT_FLAGS,
      featureLabels: FEATURE_LABELS,
      providerLabels: PROVIDER_LABELS,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/** POST — updates flags */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { features, providers, updatedBy } = body;

    if (!features && !providers) {
      return NextResponse.json({ error: 'features or providers required' }, { status: 400 });
    }

    await saveFeatureFlags({ features, providers }, updatedBy);
    invalidateFlagsCache();

    return NextResponse.json({ success: true, updatedAt: Date.now() });
  } catch (err: any) {
    console.error('[feature-flags] POST error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
