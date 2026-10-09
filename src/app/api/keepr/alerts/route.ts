/**
 * Keepr Overdue Alerts API
 *
 * GET  /api/keepr/alerts         → returns list of overdue devices
 * POST /api/keepr/alerts         → triggers webhook notification for overdue devices
 *
 * Webhook config (add to .env.local when ready):
 *   KEEPR_WEBHOOK_URL=https://your-teams-or-telegram-webhook-url
 *   KEEPR_WEBHOOK_TYPE=teams|telegram
 *   KEEPR_OVERDUE_HOURS=8        (alert threshold, default 8h)
 *   KEEPR_CRITICAL_HOURS=24      (critical threshold, default 24h)
 *
 * For Microsoft Teams:
 *   Teams channel → Connectors → Incoming Webhook → copy URL → set as KEEPR_WEBHOOK_URL
 *   Set KEEPR_WEBHOOK_TYPE=teams
 *
 * For Telegram:
 *   1. Message @BotFather → /newbot → get token
 *   2. Add bot to group, send a message, get chat_id from:
 *      https://api.telegram.org/bot{TOKEN}/getUpdates
 *   3. KEEPR_WEBHOOK_URL=https://api.telegram.org/bot{TOKEN}/sendMessage?chat_id={CHAT_ID}
 *   Set KEEPR_WEBHOOK_TYPE=telegram
 */
import { NextRequest, NextResponse } from 'next/server';
import { getCompatDb } from '@/lib/firebase-compat';

const COLLECTION      = 'keepr_devices';
const OVERDUE_HOURS   = parseFloat(process.env.KEEPR_OVERDUE_HOURS   ?? '8');
const CRITICAL_HOURS  = parseFloat(process.env.KEEPR_CRITICAL_HOURS  ?? '24');
const WEBHOOK_URL     = process.env.KEEPR_WEBHOOK_URL;
const WEBHOOK_TYPE    = process.env.KEEPR_WEBHOOK_TYPE ?? 'teams';

// ─── Duration helper ──────────────────────────────────────────────────────────
function humanDuration(checkedOutAt: string): string {
    const hours = (Date.now() - new Date(checkedOutAt).getTime()) / 3_600_000;
    if (hours < 1)  return `${Math.round(hours * 60)}m`;
    if (hours < 24) return `${hours.toFixed(1)}h`;
    return `${Math.floor(hours / 24)}d ${Math.round(hours % 24)}h`;
}

// ─── Build Teams (Adaptive Card) message ─────────────────────────────────────
function buildTeamsPayload(overdueDevices: any[], criticalDevices: any[]) {
    const facts = overdueDevices.map(d => ({
        type: 'FactSet',
        facts: [
            { title: '📱 Device',   value: d.name },
            { title: '👤 With',     value: `${d.checkedOutBy?.name ?? 'Unknown'} (${d.checkedOutBy?.team ?? ''})` },
            { title: '⏱ Duration',  value: humanDuration(d.checkedOutAt) },
            { title: '🔴 Status',   value: criticalDevices.find(c => c.id === d.id) ? 'CRITICAL (24h+)' : 'Overdue (8h+)' },
        ],
    }));

    return {
        type: 'message',
        attachments: [{
            contentType: 'application/vnd.microsoft.card.adaptive',
            content: {
                type: 'AdaptiveCard',
                version: '1.4',
                body: [
                    {
                        type: 'TextBlock',
                        text: `⚠️ Keepr: ${overdueDevices.length} device${overdueDevices.length !== 1 ? 's' : ''} overdue`,
                        weight: 'Bolder',
                        size: 'Medium',
                        color: criticalDevices.length > 0 ? 'Attention' : 'Warning',
                    },
                    ...facts,
                    {
                        type: 'TextBlock',
                        text: 'Please return devices to the rack or update the status in Keepr.',
                        wrap: true,
                        isSubtle: true,
                        size: 'Small',
                    },
                ],
                actions: [{
                    type: 'Action.OpenUrl',
                    title: 'Open Keepr',
                    url: `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://zenit-qa.vercel.app'}/keepr`,
                }],
            },
        }],
    };
}

// ─── Build Telegram message ───────────────────────────────────────────────────
function buildTelegramPayload(overdueDevices: any[], criticalDevices: any[]) {
    const lines = overdueDevices.map(d => {
        const isCritical = criticalDevices.find(c => c.id === d.id);
        const emoji = isCritical ? '🔴' : '🟠';
        return `${emoji} *${d.name}* — ${d.checkedOutBy?.name ?? 'Unknown'} (${humanDuration(d.checkedOutAt)})`;
    });

    return {
        text: [
            `⚠️ *Keepr Alert: ${overdueDevices.length} device${overdueDevices.length !== 1 ? 's' : ''} overdue*`,
            '',
            ...lines,
            '',
            '_Please return devices to the rack or update status in Keepr._',
        ].join('\n'),
        parse_mode: 'Markdown',
    };
}

// ─── Send webhook ─────────────────────────────────────────────────────────────
async function sendWebhook(overdueDevices: any[], criticalDevices: any[]): Promise<{ sent: boolean; error?: string }> {
    if (!WEBHOOK_URL) {
        return { sent: false, error: 'KEEPR_WEBHOOK_URL not configured' };
    }

    const payload = WEBHOOK_TYPE === 'telegram'
        ? buildTelegramPayload(overdueDevices, criticalDevices)
        : buildTeamsPayload(overdueDevices, criticalDevices);

    try {
        const res = await fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        if (res.ok) return { sent: true };
        return { sent: false, error: `Webhook HTTP ${res.status}` };
    } catch (err: any) {
        return { sent: false, error: err.message };
    }
}

// ─── GET — list overdue devices ───────────────────────────────────────────────
export async function GET() {
    try {
        const db   = getCompatDb();
        const snap = await db.collection(COLLECTION).where('status', '==', 'checked-out').get();

        const now  = Date.now();
        const all  = snap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];

        const overdue  = all.filter(d => d.checkedOutAt && (now - new Date(d.checkedOutAt).getTime()) / 3_600_000 >= OVERDUE_HOURS);
        const critical = overdue.filter(d => (now - new Date(d.checkedOutAt).getTime()) / 3_600_000 >= CRITICAL_HOURS);

        return NextResponse.json({
            overdueDevices:  overdue.map(d => ({
                id:           d.id,
                name:         d.name,
                checkedOutBy: d.checkedOutBy,
                checkedOutAt: d.checkedOutAt,
                durationHours: parseFloat(((now - new Date(d.checkedOutAt).getTime()) / 3_600_000).toFixed(2)),
                isCritical:   critical.some(c => c.id === d.id),
            })),
            criticalCount:   critical.length,
            overdueCount:    overdue.length,
            webhookConfigured: !!WEBHOOK_URL,
        });
    } catch (err: any) {
        return NextResponse.json({ error: err.message, overdueDevices: [] }, { status: 500 });
    }
}

// ─── POST — send alert webhook ────────────────────────────────────────────────
export async function POST(req: NextRequest) {
    try {
        const db   = getCompatDb();
        const snap = await db.collection(COLLECTION).where('status', '==', 'checked-out').get();

        const now      = Date.now();
        const all      = snap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
        const overdue  = all.filter(d => d.checkedOutAt && (now - new Date(d.checkedOutAt).getTime()) / 3_600_000 >= OVERDUE_HOURS);
        const critical = overdue.filter(d => (now - new Date(d.checkedOutAt).getTime()) / 3_600_000 >= CRITICAL_HOURS);

        if (overdue.length === 0) {
            return NextResponse.json({ sent: false, reason: 'No overdue devices', overdueCount: 0 });
        }

        const result = await sendWebhook(overdue, critical);

        return NextResponse.json({
            ...result,
            overdueCount:  overdue.length,
            criticalCount: critical.length,
            devices:       overdue.map(d => ({ id: d.id, name: d.name, user: d.checkedOutBy?.name, hours: parseFloat(((now - new Date(d.checkedOutAt).getTime()) / 3_600_000).toFixed(2)) })),
        });
    } catch (err: any) {
        return NextResponse.json({ error: err.message, sent: false }, { status: 500 });
    }
}
