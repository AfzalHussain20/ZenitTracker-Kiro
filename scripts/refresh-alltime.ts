/**
 * All-time Jira snapshot builder.
 *
 * Runs OUTSIDE Cloudflare (local shell or GitHub Actions runner) so it is never
 * subject to the worker subrequest limit. Fetches the full SUN project history
 * and writes:
 *   - alltime.json      (plain snapshot for inspection)
 *   - alltime.json.gz   (gzipped — what gets uploaded to KV; KV caps values at 25 MiB)
 * The sync route serves both from KV:
 *
 *   node --experimental-strip-types scripts/refresh-alltime.ts
 *   wrangler kv key put alltime.json --binding "ALLTIME_KV" --path alltime.json.gz
 *
 * Credentials come from env (JIRA_BASE_URL / JIRA_EMAIL / JIRA_API_TOKEN /
 * JIRA_PROJECT_KEY) or are read from .env.local when not set.
 */
import { PROJECT_KEY, JIRA_BASE, JIRA_AUTH, ALLTIME_FIELDS, mapIssue } from '../src/lib/jira/sync-data.ts';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';

function loadEnvLocal(file = resolve('.env.local')): Record<string, string> {
    const out: Record<string, string> = {};
    try {
        for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
            const m = line.match(/^\s*([^#=]+)=(.*)$/);
            if (m) out[m[1].trim()] = m[2].trim().replace(/^"(.*)"$/, '$1');
        }
    } catch { /* no .env.local */ }
    return out;
}

const env = { ...loadEnvLocal(), ...process.env };
const base = env.JIRA_BASE_URL || JIRA_BASE;
const auth = env.JIRA_API_TOKEN ? `Basic ${Buffer.from(`${env.JIRA_EMAIL}:${env.JIRA_API_TOKEN}`).toString('base64')}` : JIRA_AUTH();

if (!base || !auth.startsWith('Basic') || !env.JIRA_API_TOKEN) {
    console.error('Missing Jira credentials (JIRA_BASE_URL / JIRA_EMAIL / JIRA_API_TOKEN).');
    process.exit(1);
}

const FIELDS_PARAM = ALLTIME_FIELDS.join(',');

async function fetchAllPages(jql: string): Promise<any[]> {
    const all: any[] = [];
    let token: string | null = null;
    let pages = 0;
    while (true) {
        let url = `${base}/rest/api/3/search/jql?jql=${encodeURIComponent(jql)}&maxResults=100&fields=${encodeURIComponent(FIELDS_PARAM)}`;
        if (token) url += `&nextPageToken=${encodeURIComponent(token)}`;

        const res = await fetch(url, {
            headers: { Authorization: auth, Accept: 'application/json' },
            cache: 'no-store',
        });
        if (!res.ok) {
            throw new Error(`Jira HTTP ${res.status} for JQL: ${jql.slice(0, 60)}`);
        }
        const data = await res.json();
        pages++;
        all.push(...(data.issues || []).map(mapIssue));
        if (data.isLast || !data.nextPageToken) break;
        token = data.nextPageToken;
        console.error(`  page ${pages} -> ${all.length} issues`);
    }
    return all;
}

async function main() {
    const started = Date.now();
    console.error('[alltime] fetching all-time bugs / stories / tasks+epics...');

    const [allTimeBugs, allTimeStories, allTimeTasks] = await Promise.all([
        fetchAllPages(`project = ${PROJECT_KEY} AND issuetype = "Bug" ORDER BY created DESC`),
        fetchAllPages(`project = ${PROJECT_KEY} AND issuetype = "Story" ORDER BY created DESC`),
        fetchAllPages(`project = ${PROJECT_KEY} AND issuetype in ("Task","Epic") ORDER BY created DESC`),
    ]);

    const allTimeAll = [...allTimeBugs, ...allTimeStories, ...allTimeTasks];
    const snapshot = {
        allTimeBugs,
        allTimeAll,
        builtAt: new Date().toISOString(),
        total: allTimeAll.length,
        sprintDataIncluded: false,
    };

    const raw = JSON.stringify(snapshot);
    writeFileSync('alltime.json', raw);
    writeFileSync('alltime.json.gz', gzipSync(raw));
    console.error(`[alltime] done in ${((Date.now() - started) / 1000).toFixed(1)}s: bugs=${allTimeBugs.length}, stories=${allTimeStories.length}, tasks/epics=${allTimeTasks.length}, all=${allTimeAll.length}`);
    console.error(`[alltime] wrote alltime.json (${(raw.length / 1024 / 1024).toFixed(1)} MB) + alltime.json.gz (${(gzipSync(raw).length / 1024 / 1024).toFixed(1)} MB)`);
}

main().catch(err => {
    console.error('[alltime] FAILED:', err.message);
    process.exit(1);
});