/**
 * Pure filtering/sorting for the Team KPIs member list.
 *
 * Kept outside the page component so the "select one member" behaviour is
 * unit-testable and cannot regress into an empty table: when a member is
 * explicitly selected we always keep their row, even if the active month has
 * no activity for them (the row then shows zeros instead of disappearing).
 */
import type { PersonKPI } from '@/hooks/useJiraKPI';

export type PersonSortKey =
    | 'bugsReported'
    | 'ticketsAssigned'
    | 'storyPointsAssigned'
    | 'storiesReported'
    | 'closeRate'
    | 'bugsToday'
    | 'bugsYesterday';

export interface PeopleFilterOptions {
    memberFilter?: string;
    teamFilter?: string;
    memberSearch?: string;
    filterMonth?: string;
    sortBy?: PersonSortKey;
}

const EMPTY_MONTH = { reported: 0, closed: 0, open: 0, inProgress: 0, assigned: 0, storyPoints: 0 };

export function filterPeople(people: PersonKPI[], options: PeopleFilterOptions = {}): PersonKPI[] {
    const {
        memberFilter = 'all',
        teamFilter = 'all',
        memberSearch = '',
        filterMonth = 'all',
        sortBy = 'bugsReported',
    } = options;

    let result = people;

    if (memberFilter !== 'all') {
        // An explicit member selection is authoritative — never hide it.
        result = result.filter((p) => p.userId === memberFilter);
    } else if (teamFilter !== 'all') {
        result = result.filter((p) => p.teams.includes(teamFilter));
    }

    if (memberSearch) {
        const q = memberSearch.toLowerCase();
        result = result.filter((p) => p.name.toLowerCase().includes(q));
    }

    if (filterMonth !== 'all') {
        const isSingleMember = memberFilter !== 'all';
        result = result
            .map((p) => {
                const m = p.monthly[filterMonth] || EMPTY_MONTH;
                return {
                    ...p,
                    bugsReported: m.reported,
                    bugsClosed: m.closed,
                    bugsOpen: m.open,
                    ticketsAssigned: m.assigned,
                    storyPointsAssigned: m.storyPoints,
                };
            })
            // In team view, drop people with no activity in the month. In
            // individual view keep the row so the user sees explicit zeros.
            .filter((p) => isSingleMember || p.bugsReported > 0 || p.ticketsAssigned > 0 || p.storyPointsAssigned > 0);
    }

    return [...result].sort((a, b) => {
        const av = Number((a as any)[sortBy] ?? 0);
        const bv = Number((b as any)[sortBy] ?? 0);
        return bv - av;
    });
}
