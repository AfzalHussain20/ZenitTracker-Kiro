import { NextRequest, NextResponse } from 'next/server';
import { getAIProvider } from '@/lib/ai/providers';
import { retryWithBackoff } from '@/lib/ai/testCaseGenerator';
import type { AnalyticsTestCase, AnalyticsPlatform } from '@/types/test-cases';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Phase 6: Generate analytics event test cases from a Data Dictionary.
 * Accepts structured event data (from Excel/JSON) and generates validation test cases.
 */

interface DictionaryEvent {
  eventName: string;
  attributes: { name: string; type?: string; required?: boolean; description?: string }[];
  platform?: string;
  category?: string;
  description?: string;
}

interface GenerateFromDictionaryRequest {
  events: DictionaryEvent[];
  platform?: string;
}

const SYSTEM_PROMPT = `You are an analytics QA engineer. Given a list of analytics events from a data dictionary, generate validation test cases with OpenSearch queries.

For each event provided, generate:
- triggerAction: How a QA engineer should trigger this event (user actions in the app)
- openSearchQuery: A ready-to-use OpenSearch/DQL query to validate the event
- priority: P0 for critical conversion events, P1 for core UX events, P2 for tracking/logging events
- notes: Any additional validation notes

Return ONLY a valid JSON array (NO markdown, NO code fences):
[{"eventName": "...", "triggerAction": "...", "openSearchQuery": "...", "priority": "P0|P1|P2", "notes": "..."}]

Rules:
- Keep triggerAction concise (1-3 steps)
- OpenSearch query format: event_name: "event_name" AND platform: "platform" AND timestamp > now-1h
- Include attribute checks in the query where meaningful (e.g., AND content_id: *)
- Priority guide: P0 = payments/auth, P1 = content/navigation, P2 = impressions/logging`;

export async function POST(req: NextRequest) {
  try {
    const body: GenerateFromDictionaryRequest = await req.json();
    const { events, platform } = body;

    if (!events || !Array.isArray(events) || events.length === 0) {
      return NextResponse.json({ error: 'events array is required' }, { status: 400 });
    }

    // For small dictionaries (≤15 events), generate AI-enhanced test cases
    // For larger ones, generate structured cases directly from the dictionary data
    if (events.length <= 15) {
      const eventSummary = events.map(e =>
        `Event: ${e.eventName}\n  Attributes: ${e.attributes.map(a => `${a.name}${a.required ? ' (required)' : ''}`).join(', ')}\n  Platform: ${e.platform || platform || 'All'}\n  Description: ${e.description || 'N/A'}`
      ).join('\n\n');

      const provider = getAIProvider();
      const result = await retryWithBackoff(
        () => provider.askAI({
          systemPrompt: SYSTEM_PROMPT,
          history: [],
          question: `Generate test cases for these analytics events:\n\n${eventSummary}`,
        }),
        1,
        1000
      );

      // Parse AI response
      let parsed: any[];
      try {
        let cleaned = result.answer.trim();
        if (cleaned.startsWith('```')) {
          cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
        }
        parsed = JSON.parse(cleaned);
      } catch {
        parsed = [];
      }

      // Merge AI output with dictionary data
      const testCases: AnalyticsTestCase[] = events.map((event, idx) => {
        const aiResult = parsed.find((p: any) => p.eventName === event.eventName) || parsed[idx] || {};
        const eventPlatform: AnalyticsPlatform = (event.platform || platform || 'All') as AnalyticsPlatform;

        return {
          id: `DD_${String(idx + 1).padStart(3, '0')}`,
          eventName: event.eventName,
          platform: eventPlatform,
          triggerAction: aiResult.triggerAction || `Trigger ${event.eventName} action in the app`,
          fields: event.attributes.map(a => ({
            name: a.name,
            expectedValue: a.type || 'string',
            required: a.required !== false,
          })),
          openSearchQuery: aiResult.openSearchQuery || `event_name: "${event.eventName}" AND platform: "${eventPlatform.toLowerCase()}" AND timestamp > now-1h`,
          priority: aiResult.priority || 'P1',
          module: event.category || 'Data Dictionary',
          notes: aiResult.notes || event.description,
        };
      });

      return NextResponse.json({
        analyticsTestCases: testCases,
        totalEvents: testCases.length,
        source: 'ai_enhanced',
      });
    }

    // Large dictionary — generate structured cases without AI call
    const testCases: AnalyticsTestCase[] = events.map((event, idx) => {
      const eventPlatform: AnalyticsPlatform = (event.platform || platform || 'All') as AnalyticsPlatform;

      return {
        id: `DD_${String(idx + 1).padStart(3, '0')}`,
        eventName: event.eventName,
        platform: eventPlatform,
        triggerAction: `Trigger the "${event.eventName}" event via user interaction`,
        fields: event.attributes.map(a => ({
          name: a.name,
          expectedValue: a.type || 'string',
          required: a.required !== false,
        })),
        openSearchQuery: `event_name: "${event.eventName}" AND platform: "${eventPlatform.toLowerCase()}" AND timestamp > now-1h`,
        priority: inferPriority(event.eventName),
        module: event.category || 'Data Dictionary',
        notes: event.description,
      };
    });

    return NextResponse.json({
      analyticsTestCases: testCases,
      totalEvents: testCases.length,
      source: 'structured',
    });
  } catch (err: any) {
    console.error('[generate-from-dictionary] Error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * Infer priority from event name patterns.
 */
function inferPriority(eventName: string): 'P0' | 'P1' | 'P2' {
  const name = eventName.toLowerCase();
  // P0: Revenue/auth critical
  if (name.includes('purchase') || name.includes('subscribe') || name.includes('payment') ||
      name.includes('login') || name.includes('signup') || name.includes('checkout')) {
    return 'P0';
  }
  // P1: Core user flow
  if (name.includes('play') || name.includes('search') || name.includes('click') ||
      name.includes('view') || name.includes('navigate') || name.includes('select') ||
      name.includes('open') || name.includes('share')) {
    return 'P1';
  }
  // P2: Impressions/logging
  return 'P2';
}
