/**
 * Tests for the CleverTap user-properties catalog + diff engine.
 * Pure functions — no DOM, no network, no CleverTap key required.
 */

import {
  USER_PROPERTY_CATALOG,
  USER_PROPERTY_NAMES,
  SAMPLE_USER_PROPERTIES,
  analyzeUserProperties,
  buildExtraList,
  buildMissingList,
  buildUserPropertiesCsv,
  lookupUserProperty,
  looseUserPropertyKey,
  normalizeUserPropertyKey,
  parseUserProperties,
} from '@/lib/clevertap/user-properties-catalog';

describe('CleverTap user-properties catalog', () => {
  it('embeds all 27 properties from the User Properties sheet', () => {
    expect(USER_PROPERTY_CATALOG).toHaveLength(27);
    expect(USER_PROPERTY_NAMES.size).toBe(27);
  });

  it('keeps the exact CSV names, including the MSG-whatsapp hyphen', () => {
    const names = USER_PROPERTY_CATALOG.map((p) => p.name);
    expect(names).toEqual(
      expect.arrayContaining([
        'profileType',
        'parentalControl',
        'userStatusD2C',
        'userStatusB2B',
        'countryCode',
        'city',
        'currentLanguage',
        'previousLanguage',
        'platform',
        'loginMethod',
        'Email',
        'Phone',
        'accountID',
        'subscriptionStatusD2C',
        'startDateofSubscription',
        'endDateofSubscription',
        'registrationDate',
        'isEVThread',
        'MSG-whatsapp',
        'Name',
        'Gender',
        'DOB',
        'audioLanguage',
        'currentLanguageShorts',
        'previousLanguageShorts',
        'languagePreferred',
        'languagePreferredShorts',
      ]),
    );
  });

  it('records the owner team for every property', () => {
    for (const property of USER_PROPERTY_CATALOG) {
      expect(['Client', 'Backend', 'Analytics team']).toContain(property.source);
      expect(property.whenUpdated.length).toBeGreaterThan(0);
    }
  });
});

describe('key normalisation', () => {
  it('is case-insensitive and strips profile wrappers', () => {
    expect(normalizeUserPropertyKey('profileData.Site.Email')).toBe('email');
    expect(normalizeUserPropertyKey('email')).toBe('email');
    expect(lookupUserProperty('email')?.name).toBe('Email');
    expect(lookupUserProperty('PROFILE.sitE.Phone')?.name).toBe('Phone');
  });

  it('matches snake_case and kebab-case variants only loosely', () => {
    expect(lookupUserProperty('start_date_of_subscription')?.name).toBe('startDateofSubscription');
    expect(lookupUserProperty('msg-whatsapp')?.name).toBe('MSG-whatsapp');
    expect(looseUserPropertyKey('MSG-whatsapp')).toBe('msgwhatsapp');
  });
});

describe('parseUserProperties', () => {
  it('reads a CleverTap profile push wrapper', () => {
    const parsed = parseUserProperties(
      JSON.stringify({
        type: 'profile',
        profileData: { Site: { Email: 'a@b.com', Name: 'Dilip', profileType: 'Profile' } },
      }),
    );

    expect(parsed.format).toBe('json');
    expect(parsed.errors).toEqual([]);
    expect(Object.keys(parsed.properties)).toEqual(
      expect.arrayContaining(['Email', 'Name', 'profileType']),
    );
    expect(parsed.properties.Email).toEqual(['a@b.com']);
  });

  it('reads a JS object literal with single quotes and bare keys', () => {
    const parsed = parseUserProperties(
      "clevertap.profile.push({ Site: { Email: 'a@b.com', Name: 'Dilip', profileType: 'Profile' } });",
    );

    expect(parsed.format).toBe('js-object');
    expect(parsed.properties.Email).toEqual(['a@b.com']);
    expect(parsed.properties.Name).toEqual(['Dilip']);
    expect(parsed.properties.profileType).toEqual(['Profile']);
  });

  it('decodes a percent-encoded / form DevTools payload', () => {
    const payload = encodeURIComponent(
      JSON.stringify({ type: 'profile', profileData: { Site: { Email: 'a@b.com' } } }),
    );
    const parsed = parseUserProperties(`d=${payload}`);

    expect(parsed.properties.Email).toEqual(['a@b.com']);
  });

  it('reads tooltip HTML copied from the dashboard', () => {
    const parsed = parseUserProperties(
      '<span data-t="tooltip" title="Email">a@b.com</span>' +
        '<span data-t="tooltip" title="profileType">Profile</span>',
    );

    expect(parsed.format).toBe('html');
    expect(parsed.properties.Email).toEqual(['a@b.com']);
    expect(parsed.properties.profileType).toEqual(['Profile']);
  });

  it('reads table HTML from the profile page', () => {
    const parsed = parseUserProperties(
      '<table><tr><td>Property</td><td>Value</td></tr>' +
        '<tr><td>Email</td><td>a@b.com</td></tr>' +
        '<tr><td>Name</td><td>Dilip Kumar</td></tr></table>',
    );

    expect(parsed.format).toBe('html');
    expect(parsed.properties.Email).toEqual(['a@b.com']);
    expect(parsed.properties.Name).toEqual(['Dilip Kumar']);
  });

  it('reads CSV rows and key/value lines', () => {
    const csv = parseUserProperties(
      'User Property,When it should be updated,Sample Values,EV or Client Side\n' +
        'profileType,Every App Launch,Profile,Client\n' +
        'Email,On Registration,a@b.com,backend',
    );
    expect(csv.format).toBe('csv');
    expect(Object.keys(csv.properties)).toEqual(['profileType', 'Email']);

    const lines = parseUserProperties('Email: a@b.com\nName = Dilip Kumar\nprofileType');
    expect(lines.format).toBe('lines');
    expect(lines.properties.Email).toEqual(['a@b.com']);
    expect(lines.properties.Name).toEqual(['Dilip Kumar']);
    expect(lines.properties).toHaveProperty('profileType');
  });

  it('does not treat an event payload as a profile', () => {
    const parsed = parseUserProperties(
      JSON.stringify({ evtName: 'Login', evtData: { source: 'D2C' } }),
    );

    expect(parsed.properties).toEqual({});
    expect(parsed.errors[0]).toMatch(/profile object/i);
  });

  it('reports an empty paste instead of guessing', () => {
    const parsed = parseUserProperties('   ');
    expect(parsed.format).toBe('empty');
    expect(parsed.errors.length).toBe(1);
  });
});

describe('analyzeUserProperties', () => {
  it('splits the sample into matched, missing and extra', () => {
    const result = analyzeUserProperties(SAMPLE_USER_PROPERTIES);

    expect(result.summary.catalogTotal).toBe(27);
    expect(result.summary.matched).toBe(18);
    expect(result.summary.missing).toBe(9);
    expect(result.summary.extra).toBe(1);
    expect(result.summary.renamed).toBe(0);
    expect(result.summary.pastedTotal).toBe(19);
    expect(result.summary.coverage).toBe(67);

    expect(result.extra.map((row) => row.key)).toEqual(['deviceModel']);
    expect(result.missing.map((row) => row.key)).toEqual([
      'userStatusD2C',
      'userStatusB2B',
      'startDateofSubscription',
      'endDateofSubscription',
      'registrationDate',
      'DOB',
      'audioLanguage',
      'languagePreferred',
      'languagePreferredShorts',
    ]);
  });

  it('flags a property that is present under the wrong name', () => {
    const result = analyzeUserProperties(
      JSON.stringify({
        Email: 'a@b.com',
        start_date_of_subscription: '$D_1647484118',
      }),
    );

    expect(result.renamed).toHaveLength(1);
    expect(result.renamed[0].key).toBe('start_date_of_subscription');
    expect(result.renamed[0].canonical).toBe('startDateofSubscription');
    expect(result.missing.map((row) => row.key)).not.toContain('startDateofSubscription');
    expect(result.extra).toHaveLength(0);
  });

  it('matches CSV names case-insensitively', () => {
    const result = analyzeUserProperties(
      JSON.stringify({ email: 'a@b.com', ProfileType: 'Profile' }),
    );

    expect(result.present.map((row) => row.canonical)).toEqual(['profileType', 'Email']);
    expect(result.extra).toHaveLength(0);
    expect(result.renamed).toHaveLength(0);
  });

  it('lists every CSV property as missing when the paste is a partial profile', () => {
    const result = analyzeUserProperties(JSON.stringify({ Email: 'a@b.com' }));

    expect(result.summary.matched).toBe(1);
    expect(result.summary.missing).toBe(26);
    expect(result.summary.coverage).toBe(4);
  });
});

describe('exports', () => {
  const result = analyzeUserProperties(SAMPLE_USER_PROPERTIES);

  it('builds an actionable CSV with every row', () => {
    const csv = buildUserPropertiesCsv(result);
    const lines = csv.split('\n');

    expect(lines[0]).toBe(
      'Property,Status,Canonical name,Value in paste,When it should be updated,Source,Action',
    );
    expect(lines).toHaveLength(1 + 27 + 1); // header + 27 CSV rows + 1 extra
    expect(csv).toContain('userStatusD2C,missing');
    expect(csv).toContain('deviceModel,extra');
    expect(csv).toContain('Email,present');
  });

  it('builds copy-ready missing and extra lists', () => {
    expect(buildMissingList(result).split('\n')).toHaveLength(9);
    expect(buildExtraList(result)).toBe('deviceModel');
  });
});
