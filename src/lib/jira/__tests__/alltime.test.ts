/**
 * attachAllTime — snapshot + live recent overlay.
 *
 * The overlay must never double-count: issues already present in the snapshot
 * are skipped by id. It must also surface the freshest timestamp so the UI can
 * show how old the underlying data is.
 */
import { attachAllTime } from '../alltime';
import { fetchApiJson } from '../fetchJson';
import { fetchRecentIssues } from '../recent';

jest.mock('../fetchJson', () => ({ fetchApiJson: jest.fn() }));
jest.mock('../recent', () => ({ fetchRecentIssues: jest.fn() }));

const mockedFetch = fetchApiJson as jest.Mock;
const mockedRecent = fetchRecentIssues as jest.Mock;

const bug1 = { id: '1', issueType: 'Bug', created: '2026-11-10T10:00:00Z' };
const bug2 = { id: '2', issueType: 'Bug', created: '2026-11-16T10:00:00Z' };
const story1 = { id: '3', issueType: 'Story', created: '2026-11-16T11:00:00Z' };

describe('attachAllTime', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('overlays recent bugs without duplicating snapshot issues', async () => {
        mockedFetch.mockResolvedValue({
            allTimeBugs: [bug1],
            allTimeAll: [bug1],
            builtAt: '2026-11-15T06:00:00.000Z',
        });
        mockedRecent.mockResolvedValue({
            issues: [bug1, bug2, story1],
            fetchedAt: '2026-11-16T05:00:00.000Z',
        });

        const raw = await attachAllTime<Record<string, any>>({}, true);

        expect(raw.allTimeBugs.map((i: any) => i.id)).toEqual(['1', '2']);
        expect(raw.allTimeAll.map((i: any) => i.id)).toEqual(['1', '2', '3']);
        expect(raw.allTimeBuiltAt).toBe('2026-11-16T05:00:00.000Z');
    });

    test('keeps the snapshot timestamp when recent data is older or missing', async () => {
        mockedFetch.mockResolvedValue({
            allTimeBugs: [bug1],
            allTimeAll: [bug1],
            builtAt: '2026-11-16T06:00:00.000Z',
        });
        mockedRecent.mockResolvedValue(null);

        const raw = await attachAllTime<Record<string, any>>({}, true);

        expect(raw.allTimeBugs.map((i: any) => i.id)).toEqual(['1']);
        expect(raw.allTimeBuiltAt).toBe('2026-11-16T06:00:00.000Z');
    });

    test('leaves the payload untouched when the snapshot is unavailable', async () => {
        mockedFetch.mockResolvedValue(null);
        mockedRecent.mockResolvedValue({ issues: [bug2], fetchedAt: '2026-11-16T05:00:00.000Z' });

        const raw = await attachAllTime({ keep: true }, true);

        expect(raw).toEqual({ keep: true });
    });
});
