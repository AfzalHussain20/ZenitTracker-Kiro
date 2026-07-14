import { NextRequest, NextResponse } from 'next/server';
import { extractPlainText } from '@/lib/ai/extractText';
import { getAIProvider } from '@/lib/ai/providers';
import { getAdminDb } from '@/lib/firebaseAdmin';

export const dynamic = 'force-dynamic';

interface CategorizePrdRequest {
  pageId: string;
  pageTitle: string;
  bodyHtml?: string; // Optional: pass body to avoid re-fetching
}

export interface PrdMetadata {
  pageId: string;
  title: string;
  featureArea: string;
  platforms: string[];
  module: string;
  tags: string[];
  categorizedAt: number;
}

const PRD_METADATA_COLLECTION = 'prd_metadata';

const SYSTEM_PROMPT = `You are a document classifier. Categorize the given PRD (Product Requirements Document) into feature area, platforms, module, and tags.

Return ONLY a valid JSON object (no markdown, no explanation):
{
  "featureArea": "one of: Authentication, Payments, Content, Player, Search, Notifications, Analytics, Settings, Onboarding, Social, Navigation, Ads, Performance, Infrastructure, Other",
  "platforms": ["array of: Web, Android, iOS, Android TV, Fire TV, Apple TV, Samsung TV, LG TV, Roku"],
  "module": "specific module name e.g. 'Login Flow', 'Subscription Plans', 'Video Player', 'Deep Linking'",
  "tags": ["3-5 relevant tags like 'OTT', 'paywall', 'user-flow', 'API', 'UI-redesign', 'bug-fix', 'new-feature'"]
}

Rules:
- featureArea must be one of the listed options
- platforms: include ALL platforms mentioned in the PRD
- module: be specific (not generic) — name the actual feature/flow
- tags: 3-5 short lowercase tags that describe the PRD's scope
- If the PRD doesn't clearly fit a category, use "Other" for featureArea
- Analyze the TITLE and CONTENT to determine categories`;

/**
 * Gets existing metadata from Firestore cache.
 */
async function getExistingMetadata(pageId: string): Promise<PrdMetadata | null> {
  try {
    const db = getAdminDb();
    const doc = await db.collection(PRD_METADATA_COLLECTION).doc(pageId).get();
    if (doc.exists) {
      return doc.data() as PrdMetadata;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Saves metadata to Firestore.
 */
async function saveMetadata(metadata: PrdMetadata): Promise<void> {
  try {
    const db = getAdminDb();
    await db.collection(PRD_METADATA_COLLECTION).doc(metadata.pageId).set(metadata);
  } catch (err) {
    console.error('[categorize-prd] Failed to save metadata:', err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body: CategorizePrdRequest = await req.json();
    const { pageId, pageTitle, bodyHtml } = body;

    if (!pageId || !pageTitle) {
      return NextResponse.json({ error: 'pageId and pageTitle are required' }, { status: 400 });
    }

    // Check if we already have metadata for this page
    const existing = await getExistingMetadata(pageId);
    if (existing) {
      return NextResponse.json({ metadata: existing, cached: true });
    }

    // Get page content for categorization
    let plainText: string;

    if (bodyHtml) {
      plainText = extractPlainText(bodyHtml);
    } else {
      // Fetch from Confluence
      const baseUrl = process.env.CONFLUENCE_BASE_URL;
      const email = process.env.CONFLUENCE_EMAIL;
      const token = process.env.CONFLUENCE_API_TOKEN;

      if (!baseUrl || !email || !token) {
        return NextResponse.json({ error: 'Confluence not configured' }, { status: 500 });
      }

      const authHeader = `Basic ${Buffer.from(`${email}:${token}`).toString('base64')}`;
      const res = await fetch(
        `${baseUrl}/api/v2/pages/${pageId}?body-format=storage`,
        { headers: { Authorization: authHeader, Accept: 'application/json' }, cache: 'no-store' }
      );

      if (!res.ok) {
        return NextResponse.json({ error: 'Page not found' }, { status: 404 });
      }

      const data = await res.json();
      plainText = extractPlainText(data.body?.storage?.value || '');
    }

    // Use first 2000 chars + title for categorization (lightweight call)
    const context = `Title: ${pageTitle}\n\nContent:\n${plainText.substring(0, 2000)}`;

    const provider = getAIProvider();
    let result;

    try {
      result = await provider.askAI({
        systemPrompt: SYSTEM_PROMPT,
        history: [],
        question: context,
      });
    } catch (providerErr: any) {
      // On AI failure, return a basic categorization from title
      const metadata: PrdMetadata = {
        pageId,
        title: pageTitle,
        featureArea: 'Other',
        platforms: [],
        module: pageTitle,
        tags: [],
        categorizedAt: Date.now(),
      };
      await saveMetadata(metadata);
      return NextResponse.json({ metadata, cached: false, fallback: true });
    }

    // Parse the AI response
    let parsed: any;
    try {
      let cleaned = result.answer.trim();
      if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
      }
      parsed = JSON.parse(cleaned);
    } catch {
      // Fallback to title-based categorization
      const metadata: PrdMetadata = {
        pageId,
        title: pageTitle,
        featureArea: 'Other',
        platforms: [],
        module: pageTitle,
        tags: [],
        categorizedAt: Date.now(),
      };
      await saveMetadata(metadata);
      return NextResponse.json({ metadata, cached: false, fallback: true });
    }

    const metadata: PrdMetadata = {
      pageId,
      title: pageTitle,
      featureArea: typeof parsed.featureArea === 'string' ? parsed.featureArea : 'Other',
      platforms: Array.isArray(parsed.platforms) ? parsed.platforms.filter((p: unknown) => typeof p === 'string') : [],
      module: typeof parsed.module === 'string' ? parsed.module : pageTitle,
      tags: Array.isArray(parsed.tags) ? parsed.tags.filter((t: unknown) => typeof t === 'string').slice(0, 5) : [],
      categorizedAt: Date.now(),
    };

    await saveMetadata(metadata);
    return NextResponse.json({ metadata, cached: false });
  } catch (err: any) {
    console.error('[categorize-prd] Error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * GET: Fetch all PRD metadata for the filter/browse view.
 */
export async function GET() {
  try {
    const db = getAdminDb();
    const snapshot = await db.collection(PRD_METADATA_COLLECTION).get();

    const allMetadata: PrdMetadata[] = [];
    snapshot.forEach((doc) => {
      allMetadata.push(doc.data() as PrdMetadata);
    });

    return NextResponse.json({ metadata: allMetadata });
  } catch (err: any) {
    return NextResponse.json({ metadata: [], error: err.message });
  }
}
