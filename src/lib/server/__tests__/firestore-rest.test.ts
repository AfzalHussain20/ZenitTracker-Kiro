import { decodeFirestoreValue, decodeFirestoreFields } from '../firestore-rest';

describe('decodeFirestoreValue', () => {
  it('decodes string, number, boolean, null and timestamp values', () => {
    expect(decodeFirestoreValue({ stringValue: 'hello' })).toBe('hello');
    expect(decodeFirestoreValue({ integerValue: '42' })).toBe(42);
    expect(decodeFirestoreValue({ doubleValue: 1.5 })).toBe(1.5);
    expect(decodeFirestoreValue({ booleanValue: true })).toBe(true);
    expect(decodeFirestoreValue({ nullValue: null })).toBeNull();
    expect(decodeFirestoreValue({ timestampValue: '2026-01-02T03:04:05Z' })).toBe('2026-01-02T03:04:05Z');
  });

  it('decodes nested arrays and maps', () => {
    const value = {
      arrayValue: {
        values: [
          { stringValue: 'a' },
          { mapValue: { fields: { n: { integerValue: '2' }, ok: { booleanValue: false } } } },
        ],
      },
    };
    expect(decodeFirestoreValue(value)).toEqual(['a', { n: 2, ok: false }]);
  });

  it('returns null for unknown / empty values', () => {
    expect(decodeFirestoreValue(undefined)).toBeNull();
    expect(decodeFirestoreValue(null)).toBeNull();
    expect(decodeFirestoreValue({ unknownValue: 'x' })).toBeNull();
  });
});

describe('decodeFirestoreFields', () => {
  it('decodes a document fields map', () => {
    const fields = {
      id: { stringValue: 'abc' },
      status: { stringValue: 'In Progress' },
      summary: { mapValue: { fields: { total: { integerValue: '10' }, pass: { integerValue: '7' } } } },
      testCases: {
        arrayValue: {
          values: [{ mapValue: { fields: { testCaseTitle: { stringValue: 'T1' }, status: { stringValue: 'Pass' } } } }],
        },
      },
    };
    expect(decodeFirestoreFields(fields)).toEqual({
      id: 'abc',
      status: 'In Progress',
      summary: { total: 10, pass: 7 },
      testCases: [{ testCaseTitle: 'T1', status: 'Pass' }],
    });
  });

  it('handles an empty / missing fields map', () => {
    expect(decodeFirestoreFields({})).toEqual({});
    expect(decodeFirestoreFields(undefined as any)).toEqual({});
  });
});
