import {
  isPlausibleInterviewStoredName,
  resolveAdminInterviewIntroDisplayName,
  resolveAdminUserListDisplayName,
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
