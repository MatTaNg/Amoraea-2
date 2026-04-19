import {
  INTERVIEWER_SYSTEM_FRAMEWORK,
  buildInterviewerParticipantFirstNameSystemSuffix,
  ensureSpokenTextIncludesParticipantFirstName,
  getInterviewUserFirstNameForPrompt,
  sanitizeInterviewParticipantFirstNameForSpeech,
} from './interviewerFrameworkPrompt';

const SCENARIO_A_VIGNETTE_OPENING = 'Emma and Ryan have dinner plans.';

describe('Scenario A intro (framework copy)', () => {
  it('FIRST SCENARIO INTRO forbids evaluative bridges and requires starting at the Emma/Ryan vignette', () => {
    const marker = 'FIRST SCENARIO INTRO:';
    const idx = INTERVIEWER_SYSTEM_FRAMEWORK.indexOf(marker);
    expect(idx).toBeGreaterThanOrEqual(0);
    const section = INTERVIEWER_SYSTEM_FRAMEWORK.slice(idx, idx + 950);
    expect(section).toMatch(/\*\*Do not\*\* use filler bridges/i);
    expect(section).toContain(`"Let's start with this one:"`);
    expect(section).toContain(`"Here's where we'll begin:"`);
    expect(section).toMatch(/beginning with \*\*"Emma and Ryan have dinner plans/);
    expect(section).toContain('**do not** use evaluative');
  });

  it('mandated Scenario A vignette opening is the Emma/Ryan line', () => {
    expect(SCENARIO_A_VIGNETTE_OPENING).toMatch(/^Emma and Ryan have dinner plans/);
  });
});

describe('sanitizeInterviewParticipantFirstNameForSpeech', () => {
  it('rejects handles and email locals with digits', () => {
    expect(sanitizeInterviewParticipantFirstNameForSpeech('mattang5280')).toBe('');
    expect(sanitizeInterviewParticipantFirstNameForSpeech('user_123')).toBe('');
  });

  it('keeps normal first names', () => {
    expect(sanitizeInterviewParticipantFirstNameForSpeech('Matt')).toBe('Matt');
    expect(sanitizeInterviewParticipantFirstNameForSpeech('Mary Jane')).toBe('Mary');
  });
});

describe('Participant first name for live interviewer prompt', () => {
  it('prefers basicInfo.firstName over profile.name', () => {
    expect(
      getInterviewUserFirstNameForPrompt({
        basicInfo: { firstName: 'Alex' },
        name: 'Alex Smith',
      })
    ).toBe('Alex');
  });

  it('uses sanitized basicInfo when profile.name is a username', () => {
    expect(
      getInterviewUserFirstNameForPrompt({
        basicInfo: { firstName: 'Matt' },
        name: 'mattang5280',
      })
    ).toBe('Matt');
  });

  it('does not use display_name / email-local style when it is not a real name', () => {
    expect(getInterviewUserFirstNameForPrompt({ basicInfo: null, name: 'mattang5280' })).toBe('');
  });

  it('falls back to first token of name when basicInfo is empty', () => {
    expect(getInterviewUserFirstNameForPrompt({ basicInfo: null, name: 'Jordan Lee' })).toBe('Jordan');
  });

  it('embeds the resolved name in the system suffix (no template placeholder)', () => {
    const suffix = buildInterviewerParticipantFirstNameSystemSuffix('Sam');
    expect(suffix).toContain('The user\'s first name is Sam');
    expect(suffix).toContain('Use Sam naturally');
    expect(suffix).toMatch(/Scenario C|Moment 4/);
    expect(suffix).not.toContain('{{');
    expect(suffix).not.toContain('}}');
  });

  it('uses empty-name guidance without a literal placeholder when unknown', () => {
    const suffix = buildInterviewerParticipantFirstNameSystemSuffix('');
    expect(suffix).toMatch(/No first name is available/);
    expect(suffix).not.toContain('{{');
  });
});

describe('ensureSpokenTextIncludesParticipantFirstName', () => {
  it('leaves text unchanged when name already present', () => {
    const t = "Great work, Alex — that's the end of this scenario.";
    expect(ensureSpokenTextIncludesParticipantFirstName(t, 'Alex')).toBe(t);
  });

  it('appends name to first short segment-close sentence', () => {
    const t = "That's the end of this scenario. Here's what stood out to me.";
    expect(ensureSpokenTextIncludesParticipantFirstName(t, 'Jordan')).toBe(
      "That's the end of this scenario, Jordan. Here's what stood out to me."
    );
  });

  it('does not modify vignette-first lines', () => {
    const t = 'Emma and Ryan have dinner plans. Ryan takes a call.';
    expect(ensureSpokenTextIncludesParticipantFirstName(t, 'Sam')).toBe(t);
  });

  it('returns original text when raw first name is empty', () => {
    const t = "Great work — that's the end of this scenario.";
    expect(ensureSpokenTextIncludesParticipantFirstName(t, '')).toBe(t);
    expect(ensureSpokenTextIncludesParticipantFirstName(t, '   ')).toBe(t);
  });

  it('does not append a username when the model already used a real first name', () => {
    const t =
      'Thanks for sticking with all of this, Matt — arranging that birthday surprise really shows you care. Thank you for being so open with me.';
    expect(ensureSpokenTextIncludesParticipantFirstName(t, 'mattang5280')).toBe(t);
  });

  it('returns original when text is empty', () => {
    expect(ensureSpokenTextIncludesParticipantFirstName('', 'Alex')).toBe('');
  });
});
