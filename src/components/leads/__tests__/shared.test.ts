import {
  buildHoursByName, complianceFor, findMissingLoggers, fmtHours,
  getWorkBadge, downloadCsv, type WorklogUser,
} from '../shared';
import type { PersonKPI } from '@/hooks/useJiraKPI';

const makeUser = (author: string, authorId: string, totalHours: number, logCount = 1): WorklogUser => ({
  author, authorId, totalHours, totalSeconds: Math.round(totalHours * 3600), logCount, issueCount: 1,
});

const makePerson = (userId: string, name: string, teams: string[] = []): PersonKPI =>
  ({ userId, name, teams } as unknown as PersonKPI);

describe('leads portal shared helpers', () => {
  describe('buildHoursByName', () => {
    it('aggregates hours case-insensitively and trims names', () => {
      const map = buildHoursByName([
        makeUser('Alice', 'a1', 3.5),
        makeUser(' alice ', 'a1', 2),
        makeUser('Bob', 'b1', 10),
      ]);
      expect(map.get('alice')).toBe(5.5);
      expect(map.get('bob')).toBe(10);
    });

    it('returns an empty map for no users', () => {
      expect(buildHoursByName([]).size).toBe(0);
    });
  });

  describe('complianceFor', () => {
    it('flags zero hours as Missing', () => {
      expect(complianceFor(0, 30)).toBe('Missing');
    });
    it('flags below half-a-day-per-day as Light', () => {
      expect(complianceFor(10, 30)).toBe('Light');
      expect(complianceFor(14.9, 30)).toBe('Light');
    });
    it('flags at/above the threshold as On track', () => {
      expect(complianceFor(15, 30)).toBe('On track');
      expect(complianceFor(100, 30)).toBe('On track');
    });
  });

  describe('findMissingLoggers', () => {
    const people = [
      makePerson('j1', 'Alice', ['QA']),
      makePerson('j2', 'Bob', ['QA']),
      makePerson('j3', 'Cara', ['Dev']),
    ];

    it('returns roster members with no logged hours', () => {
      const missing = findMissingLoggers(people, [makeUser('Alice', 'j1', 5)], 'all');
      expect(missing.map(m => m.person.name)).toEqual(['Bob', 'Cara']);
    });

    it('scopes to a team when provided', () => {
      const missing = findMissingLoggers(people, [], 'QA');
      expect(missing.map(m => m.person.name)).toEqual(['Alice', 'Bob']);
    });

    it('matches by trimmed, lowercased name', () => {
      const missing = findMissingLoggers([makePerson('j1', 'Alice')], [makeUser(' alice ', 'x', 2)], 'all');
      expect(missing).toHaveLength(0);
    });
  });

  describe('fmtHours / getWorkBadge', () => {
    it('rounds to one decimal', () => {
      expect(fmtHours(3.14159)).toBe('3.1h');
    });
    it('assigns the correct badge tier', () => {
      expect(getWorkBadge(45).label).toBe('On Fire');
      expect(getWorkBadge(0).label).toBe('Getting Started');
    });
  });

  describe('downloadCsv', () => {
    it('escapes cells containing commas/quotes and triggers a download', () => {
      const createObjectURL = jest.fn((_blob: Blob) => 'blob:mock');
      const revokeObjectURL = jest.fn();
      const clickSpy = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
      (global.URL as any).createObjectURL = createObjectURL;
      (global.URL as any).revokeObjectURL = revokeObjectURL;

      downloadCsv('report.csv', [
        ['Name', 'Team'],
        ['Alice, A', 'QA "Core"'],
      ]);

      expect(createObjectURL).toHaveBeenCalledTimes(1);
      const blob = createObjectURL.mock.calls[0][0] as Blob;
      expect(blob).toBeInstanceOf(Blob);
      expect(clickSpy).toHaveBeenCalledTimes(1);
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock');

      clickSpy.mockRestore();
    });
  });
});
