/**
 * Team KPI member filtering.
 *
 * Regression guard for the "select one member → empty table" bug: an explicit
 * member selection must always render that member, even when the selected month
 * has no activity for them (the row shows zeros instead of vanishing).
 */
import { filterPeople } from '../people-filter';
import type { PersonKPI } from '@/hooks/useJiraKPI';

function person(overrides: Partial<PersonKPI> & { userId: string; name: string }): PersonKPI {
    return {
        bugsReported: 0,
        bugsOpen: 0,
        bugsClosed: 0,
        bugsInProgress: 0,
        bugsCritical: 0,
        bugsHigh: 0,
        ticketsAssigned: 0,
        assignedOpen: 0,
        assignedClosed: 0,
        assignedInProgress: 0,
        storyPointsAssigned: 0,
        storyPointsCompleted: 0,
        storyPointsInProgress: 0,
        storyPointsTodo: 0,
        storiesReported: 0,
        epicsReported: 0,
        tasksReported: 0,
        totalIssues: 0,
        qualityScore: 0,
        closeRate: 0,
        teams: [],
        daily: {},
        bugsToday: 0,
        bugsYesterday: 0,
        bugsPrevDay: 0,
        monthly: {},
        ...overrides,
    };
}

const ALICE = person({
    userId: 'alice',
    name: 'Alice',
    teams: ['QA'],
    bugsReported: 10,
    bugsToday: 2,
    bugsYesterday: 1,
    monthly: { '2026-11': { reported: 3, closed: 1, open: 2, inProgress: 0, assigned: 4, storyPoints: 5 } },
});

const BOB = person({
    userId: 'bob',
    name: 'Bob',
    teams: ['Dev'],
    bugsReported: 20,
    bugsToday: 0,
    bugsYesterday: 4,
    monthly: { '2026-10': { reported: 8, closed: 4, open: 4, inProgress: 0, assigned: 9, storyPoints: 12 } },
});

const CAROL = person({
    userId: 'carol',
    name: 'Carol',
    teams: ['QA'],
    bugsReported: 5,
    bugsToday: 0,
    bugsYesterday: 0,
    monthly: { '2026-11': { reported: 1, closed: 0, open: 1, inProgress: 0, assigned: 1, storyPoints: 2 } },
});

const PEOPLE = [ALICE, BOB, CAROL];

describe('filterPeople', () => {
    test('returns everyone sorted by the requested metric when unfiltered', () => {
        const out = filterPeople(PEOPLE);
        expect(out.map((p) => p.userId)).toEqual(['bob', 'alice', 'carol']);
    });

    test('an explicit member selection is never hidden by a month with no activity', () => {
        // Bob has no November activity, but selecting Bob must still show Bob.
        const out = filterPeople(PEOPLE, { memberFilter: 'bob', filterMonth: '2026-11' });
        expect(out).toHaveLength(1);
        expect(out[0].userId).toBe('bob');
        expect(out[0].bugsReported).toBe(0);
        expect(out[0].ticketsAssigned).toBe(0);
        expect(out[0].storyPointsAssigned).toBe(0);
    });

    test('a selected member shows the exact numbers for the selected month', () => {
        const out = filterPeople(PEOPLE, { memberFilter: 'alice', filterMonth: '2026-11' });
        expect(out).toHaveLength(1);
        expect(out[0].bugsReported).toBe(3);
        expect(out[0].bugsClosed).toBe(1);
        expect(out[0].bugsOpen).toBe(2);
        expect(out[0].ticketsAssigned).toBe(4);
        expect(out[0].storyPointsAssigned).toBe(5);
    });

    test('team view drops members with no activity in the selected month', () => {
        const out = filterPeople(PEOPLE, { teamFilter: 'QA', filterMonth: '2026-10' });
        // Neither Alice nor Carol has October activity.
        expect(out).toHaveLength(0);
    });

    test('team view keeps only members with month activity', () => {
        const out = filterPeople(PEOPLE, { teamFilter: 'QA', filterMonth: '2026-11' });
        expect(out.map((p) => p.userId).sort()).toEqual(['alice', 'carol']);
    });

    test('member selection takes precedence over the team filter', () => {
        const out = filterPeople(PEOPLE, { memberFilter: 'bob', teamFilter: 'QA' });
        expect(out.map((p) => p.userId)).toEqual(['bob']);
    });

    test('search narrows the result by name', () => {
        const out = filterPeople(PEOPLE, { memberSearch: 'car' });
        expect(out.map((p) => p.userId)).toEqual(['carol']);
    });

    test('sorting by bugsToday puts the most active member first', () => {
        const out = filterPeople(PEOPLE, { sortBy: 'bugsToday' });
        expect(out[0].userId).toBe('alice');
    });

    test('sorting by bugsYesterday is exact', () => {
        const out = filterPeople(PEOPLE, { sortBy: 'bugsYesterday' });
        expect(out.map((p) => p.bugsYesterday)).toEqual([4, 1, 0]);
    });
});
