import {
  isPlausibleInterviewStoredName,
  resolveAdminInterviewIntroDisplayName,
  resolveAdminUserListDisplayName,
  resolveReportParticipantDisplayName,
} from '../adminInterviewIntroDisplayName';

describe('isPlausibleInterviewStoredName', () => {
  it('accepts short name tokens', () => {
    expect(isPlausibleInterviewStoredName('Matt')).toBe(true);
    expect(isPlausibleInterviewStoredName('Mary-Jane')).toBe(true);
    expect(isPlausibleInterviewStoredName("O'Brien")).toBe(true);
    expect(isPlausibleInterviewStoredName('Jordan Lee')).toBe(true);
    expect(isPlausibleInterviewStoredName('Tiffany.')).toBe(true);
  });

  it('rejects paragraph / scenario answers', () => {
    const scenario =
      'I think a job search that takes a long time is extremely difficult, and I think James actually acted correctly';
    expect(isPlausibleInterviewStoredName(scenario)).toBe(false);
  });
});

describe('resolveAdminInterviewIntroDisplayName', () => {
  it('ignores corrupt users.name and uses basic_info firstName', () => {
    const corrupt =
      'I think a job search that takes a long time is extremely difficult, and I think James actually acted correctly to celebrate.';
    expect(
      resolveAdminInterviewIntroDisplayName({
        name: corrupt,
        basic_info: { firstName: 'Alex' },
        interview_transcript: [],
        full_name: null,
        display_name: null,
        email: 'x@y.com',
      }),
    ).toBe('Alex');
  });

  it('falls back to email local part when name and basic_info are unusable', () => {
    const corrupt = 'This is not a name at all because it has numbers 123';
    expect(
      resolveAdminInterviewIntroDisplayName({
        name: corrupt,
        basic_info: {},
        interview_transcript: [{ role: 'user', content: corrupt }],
        full_name: null,
        display_name: null,
        email: 'pat@example.com',
      }),
    ).toBe('pat');
  });

  it('prefers attempt.transcript over legacy interview_transcript alias', () => {
    expect(
      resolveAdminInterviewIntroDisplayName({
        name: null,
        basic_info: null,
        transcript: [{ role: 'user', content: 'FromAttempt' }],
        interview_transcript: [{ role: 'user', content: 'Legacy' }],
        email: 'z@z.com',
      }),
    ).toBe('FromAttempt');
  });

  it('uses plausible first transcript line when name missing', () => {
    expect(
      resolveAdminInterviewIntroDisplayName({
        name: null,
        basic_info: null,
        interview_transcript: [{ role: 'user', content: 'Sam' }],
        full_name: null,
        display_name: null,
        email: 'z@z.com',
      }),
    ).toBe('Sam');
  });
});

describe('resolveReportParticipantDisplayName', () => {
  it('prefers interview name over email-derived display_name', () => {
    expect(
      resolveReportParticipantDisplayName({
        name: 'Matt',
        basic_info: null,
        interview_transcript: null,
        email: 'mattang5280@example.com',
      }),
    ).toBe('Matt');
  });

  it('returns null when only email local part would apply', () => {
    expect(
      resolveReportParticipantDisplayName({
        name: null,
        basic_info: {},
        interview_transcript: [],
        full_name: null,
        display_name: 'mattang5280',
        email: 'mattang5280@example.com',
      }),
    ).toBeNull();
  });
});

describe('resolveAdminInterviewIntroDisplayName with display_name', () => {
  it('uses display_name when name is corrupt', () => {
    const corrupt = 'A'.repeat(60);
    expect(
      resolveAdminInterviewIntroDisplayName({
        name: corrupt,
        display_name: 'Riley',
        basic_info: null,
        transcript: [],
        email: 'r@e.com',
      }),
    ).toBe('Riley');
  });
});

describe('resolveAdminUserListDisplayName', () => {
  it('skips corrupt name for list label', () => {
    expect(
      resolveAdminUserListDisplayName({
        name: 'Some long scenario answer that is not a name at all '.repeat(3),
        basic_info: { firstName: 'Riley' },
        email: 'e@e.com',
      }),
    ).toBe('Riley');
  });
});
