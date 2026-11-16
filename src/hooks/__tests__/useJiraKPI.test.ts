/**
 * useJiraKPI — exact daily bug counts and snapshot freshness.
 *
 * Vijay's Jira report showed 13 today + 19 yesterday + 1 the day before, while
 * the dashboard showed a smaller number because it counted a stale, once-a-day
 * snapshot. These tests pin the counting rules:
 *   - daily buckets come from the all-time snapshot's `created` date,
 *   - "today" is the viewer's local calendar day,
 *   - the snapshot timestamp is surfaced so the UI can show its age.
 */
import { processKPI } from '../useJiraKPI';
import type { JiraIssueRaw } from '../useJiraKPI';

function localDay(offset: number): string {
    const d = new Date();
    d.setDate(d.getDate() - offset);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function issue(id: string, createdDay: string, overrides: Partial<JiraIssueRaw> = {}): JiraIssueRaw {
    return {
        id,
        key: `SUN-${id}`,
        url: `https://example.atlassian.net/browse/SUN-${id}`,
        summary: `Issue ${id}`,
        issueType: 'Bug',
        status: 'Open',
        statusCategory: 'To Do',
        priority: 'Medium',
        assignee: null,
        reporter: { accountId: 'vijay', displayName: 'Vijay Hariharan' },
        labels: [],
        platform: null,
        environment: null,
        created: `${createdDay}T10:00:00.000Z`,
        updated: `${createdDay}T10:00:00.000Z`,
        resolutionDate: null,
        timeSpent: 0,
        timeEstimate: 0,
        storyPoints: null,
        isLive: false,
        liveVersion: null,
        fixVersions: [],
        team: null,
        isSubTask: false,
        sprint: null,
        ...overrides,
    };
}

function rawWith(issues: JiraIssueRaw[], extra: Record<string, any> = {}) {
    return {
        bugs: [],
        stories: [],
        epics: [],
        tasks: [],
        subtasks: [],
        allForSP: [],
        allTimeBugs: issues,
        allTimeAll: issues,
        ...extra,
    };
}

describe('processKPI — exact daily bug counts', () => {
    test('counts today, yesterday, and the day before from created dates', () => {
        const issues = [
            issue('1', localDay(0)),
            issue('2', localDay(0)),
            issue('3', localDay(0)),
            ...Array.from({ length: 19 }, (_, i) => issue(`y${i}`, localDay(1))),
            issue('p1', localDay(2)),
            // Older bug must not leak into the three-day window.
            issue('old', localDay(5)),
        ];

        const kpi = processKPI(rawWith(issues));
        const vijay = kpi.people.find((p) => p.userId === 'vijay')!;

        expect(vijay.bugsToday).toBe(3);
        expect(vijay.bugsYesterday).toBe(19);
        expect(vijay.bugsPrevDay).toBe(1);
        expect(vijay.bugsReported).toBe(24);
    });

    test('daily buckets count only bugs, not stories or tasks', () => {
        const bug = issue('b1', localDay(0));
        const story = issue('s1', localDay(0), { issueType: 'Story', status: 'Done' });
        const task = issue('t1', localDay(0), { issueType: 'Task' });

        const kpi = processKPI({
            ...rawWith([bug]),
            allTimeBugs: [bug],
            allTimeAll: [bug, story, task],
        });
        const vijay = kpi.people.find((p) => p.userId === 'vijay')!;

        expect(vijay.bugsToday).toBe(1);
        expect(vijay.bugsReported).toBe(1);
    });

    test('exposes the snapshot build timestamp', () => {
        const builtAt = '2026-11-16T09:00:00.000Z';
        const kpi = processKPI(rawWith([], { allTimeBuiltAt: builtAt }));
        expect(kpi.snapshotBuiltAt).toBe(builtAt);
    });

    test('reports null when the snapshot timestamp is absent', () => {
        const kpi = processKPI(rawWith([]));
        expect(kpi.snapshotBuiltAt).toBeNull();
    });

    test('falls back to the sprint payload when the all-time snapshot is empty', () => {
        const sprintBug = issue('sprint-1', localDay(0));
        const kpi = processKPI({
            ...rawWith([]),
            bugs: [sprintBug],
            allTimeBugs: [],
            allTimeAll: [],
        });
        const vijay = kpi.people.find((p) => p.userId === 'vijay')!;
        expect(vijay.bugsToday).toBe(1);
        expect(vijay.bugsReported).toBe(1);
    });
});
