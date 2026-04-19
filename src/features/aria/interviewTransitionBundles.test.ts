import {
  buildMoment4HandoffForInterview,
  buildScenario1To2BundleForInterview,
  buildScenario2To3TransitionBody,
  ensureScenario2BundleWhenOpeningWithoutVignette,
  MOMENT_4_HANDOFF_NO_NAME_LEAD,
  SCENARIO_1_TO_2_TRANSITION_FALLBACK,
  SCENARIO_2_TO_3_TRANSITION_FALLBACK,
} from './interviewTransitionBundles';

const STUB_S2 = 'SARAH_VIGNETTE\n\nWhat do you think is going on here?';
const STUB_S3 = 'SOPHIE_VIGNETTE\n\nWhen Daniel comes back — what do you make of that?';
const STUB_M4_CARD = 'Grudge question line one. Grudge question line two.';

describe('buildScenario1To2BundleForInterview', () => {
  it('uses fallback transition when first name is empty', () => {
    const out = buildScenario1To2BundleForInterview('', STUB_S2);
    expect(out.startsWith(SCENARIO_1_TO_2_TRANSITION_FALLBACK)).toBe(true);
    expect(out).toContain('\n\nSARAH_VIGNETTE');
  });

  it('embeds trimmed first name in the transition lead', () => {
    const out = buildScenario1To2BundleForInterview('  Alex  ', STUB_S2);
    expect(out).toContain('Great work, Alex — that\'s the end of that scenario.');
    expect(out).toContain(STUB_S2);
  });
});

describe('buildScenario2To3TransitionBody', () => {
  it('uses fallback transition when first name is empty', () => {
    const out = buildScenario2To3TransitionBody('', STUB_S3);
    expect(out.startsWith(SCENARIO_2_TO_3_TRANSITION_FALLBACK)).toBe(true);
    expect(out).toContain('SOPHIE_VIGNETTE');
  });

  it('embeds trimmed first name in the transition lead', () => {
    const out = buildScenario2To3TransitionBody('Jordan', STUB_S3);
    expect(out).toContain('Great work, Jordan — that\'s the end of this one, too.');
    expect(out).toContain(STUB_S3);
  });
});

describe('buildMoment4HandoffForInterview', () => {
  it('uses shared no-name lead and appends personal card', () => {
    const out = buildMoment4HandoffForInterview('', STUB_M4_CARD);
    expect(out.startsWith(MOMENT_4_HANDOFF_NO_NAME_LEAD)).toBe(true);
    expect(out.endsWith(STUB_M4_CARD)).toBe(true);
    expect(out).toContain(`\n\n${STUB_M4_CARD}`);
  });

  it('uses first name in comma form before personal card', () => {
    const out = buildMoment4HandoffForInterview('Sam', STUB_M4_CARD);
    expect(out).toContain('Good work, Sam, you just finished the three situations');
    expect(out).toContain(STUB_M4_CARD);
  });
});

describe('ensureScenario2BundleWhenOpeningWithoutVignette', () => {
  it('returns original text when interview moment is not 1', () => {
    const t = 'What do you think is going on here?';
    expect(ensureScenario2BundleWhenOpeningWithoutVignette(t, 2, 'Alex', STUB_S2)).toBe(t);
  });

  it('returns original when text is empty', () => {
    expect(ensureScenario2BundleWhenOpeningWithoutVignette('', 1, 'Alex', STUB_S2)).toBe('');
  });

  it('returns original when Sarah job-hunting line (repair path)', () => {
    const t = 'Sarah has been job hunting. What do you think is going on here?';
    expect(ensureScenario2BundleWhenOpeningWithoutVignette(t, 1, 'Alex', STUB_S2)).toBe(t);
  });

  it('returns original when line does not end with Scenario B opening', () => {
    const t = 'Something else entirely.';
    expect(ensureScenario2BundleWhenOpeningWithoutVignette(t, 1, 'Alex', STUB_S2)).toBe(t);
  });

  it('replaces stripped Scenario B-only opening with full canonical bundle including name', () => {
    const t = 'What do you think is going on here?';
    const out = ensureScenario2BundleWhenOpeningWithoutVignette(t, 1, 'Riley', STUB_S2);
    expect(out).toContain('Great work, Riley —');
    expect(out).toContain('SARAH_VIGNETTE');
  });

  it('uses fallback transition in repair bundle when first name is empty', () => {
    const t = 'What do you think is going on here?';
    const out = ensureScenario2BundleWhenOpeningWithoutVignette(t, 1, '', STUB_S2);
    expect(out).toContain(SCENARIO_1_TO_2_TRANSITION_FALLBACK);
  });
});
