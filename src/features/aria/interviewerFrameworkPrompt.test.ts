import {
  INTERVIEWER_SYSTEM_FRAMEWORK,
  buildInterviewerParticipantFirstNameSystemSuffix,
  ensureSpokenTextIncludesParticipantFirstName,
  getInterviewUserFirstNameForPrompt,
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

describe('Participant first name for live interviewer prompt', () => {
  it('prefers basicInfo.firstName over profile.name', () => {
    expect(
      getInterviewUserFirstNameForPrompt({
        basicInfo: { firstName: 'Alex' },
        name: 'Alex Smith',
      })
    ).toBe('Alex');
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
});
