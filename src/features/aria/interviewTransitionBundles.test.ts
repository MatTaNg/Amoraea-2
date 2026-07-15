import {
  assistantTextLooksLikeMoment4HandoffLead,
  buildClientScenarioBoundaryHandoffBundle,
  buildMoment4HandoffForInterview,
  buildMoment4ThresholdAnswerToMoment5Bundle,
  buildScenario1To2BundleForInterview,
  buildScenarioBoundaryLeadForInterview,
  buildScenario2To3TransitionBody,
  ensureScenario2BundleWhenOpeningWithoutVignette,
  MOMENT_4_HANDOFF_NO_NAME_LEAD,
  SCENARIO_1_TO_2_TRANSITION_FALLBACK,
  SCENARIO_2_TO_3_TRANSITION_FALLBACK,
} from './interviewTransitionBundles';
import { MOMENT_4_GRUDGE_QUESTION_TEXT } from './moment4ProbeLogic';
import { MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT } from './probeAndScoringUtils';

const STUB_S2 = 'SARAH_VIGNETTE\n\nWhat do you think is going on here?';
const REFLECTION_ANCHOR =
  /(?:what (?:i heard|i got|came through)|landed for me|stuck with me|you (?:focused on|named|framed|pointed to|highlighted|spelled out))/i;
const STUB_S3 = 'SOPHIE_VIGNETTE\n\nWhen Daniel comes back — what do you make of that?';
const STUB_M4_CARD = 'Grudge question line one. Grudge question line two.';

describe('buildClientScenarioBoundaryHandoffBundle', () => {
  it('returns S1→S2 bundle with canonical scenario 2 text', () => {
    const out = buildClientScenarioBoundaryHandoffBundle(
      1,
      'Matt',
      { scenario1: 'Emma needed Ryan to prioritize their time together.' },
      STUB_M4_CARD,
    );
    expect(out).toMatch(/Sarah has been job hunting/i);
    expect(out).toContain(SCENARIO_1_TO_2_TRANSITION_FALLBACK);
    expect(out).not.toMatch(/last of the three|two short personal|two questions left/i);
  });

  it('returns S3→M4 bundle with personal card', () => {
    const out = buildClientScenarioBoundaryHandoffBundle(
      3,
      'Matt',
      { scenario3: 'Daniel needed to return and stay present.' },
      STUB_M4_CARD,
    );
    expect(out).toContain(STUB_M4_CARD);
    expect(out).toMatch(/three described situations|two questions left/i);
  });
});

describe('buildScenario1To2BundleForInterview', () => {
  it('uses fallback transition when first name is empty', () => {
    const out = buildScenario1To2BundleForInterview('', STUB_S2);
    expect(out.startsWith(SCENARIO_1_TO_2_TRANSITION_FALLBACK)).toBe(true);
    expect(out).toContain('\n\nSARAH_VIGNETTE');
  });

  it('uses short wrap transition with no content reflection when a first name is provided', () => {
    const out = buildScenario1To2BundleForInterview('  Alex  ', STUB_S2);
    expect(out.startsWith(SCENARIO_1_TO_2_TRANSITION_FALLBACK)).toBe(true);
    expect(out).toContain(STUB_S2);
  });

  it('omits boundary reflections for now (short wrap only)', () => {
    const corpus = [
      'James should have listened more instead of jumping to logistics when Sarah was upset about the trip.',
      'She must have felt dismissed because he went straight to fixing the plan instead of hearing her out.',
      "Just wait until she brings it up again when she's ready to talk about it.",
    ].join('\n');
    const out = buildScenario1To2BundleForInterview('Alex', STUB_S2, corpus);
    expect(out.startsWith(SCENARIO_1_TO_2_TRANSITION_FALLBACK)).toBe(true);
    expect(out).not.toMatch(REFLECTION_ANCHOR);
    expect(out).not.toContain('Nice work, Alex');
    expect(out).toContain(SCENARIO_1_TO_2_TRANSITION_FALLBACK);
    expect(out).not.toMatch(/last of the three|two short personal|two questions left/i);
    expect(out).toContain('SARAH_VIGNETTE');
  });

  it('omits boundary reflections for a substantive Ryan repair answer alone', () => {
    const repair =
      'I would make sure all calls go to voicemail during dates and commit to it.';
    const out = buildScenario1To2BundleForInterview('Alex', STUB_S2, repair);
    expect(out.startsWith(SCENARIO_1_TO_2_TRANSITION_FALLBACK)).toBe(true);
    expect(out).not.toMatch(REFLECTION_ANCHOR);
    expect(out).not.toContain('Nice work, Alex');
  });
});

describe('buildScenarioBoundaryLeadForInterview', () => {
  it('returns short wrap transition without reflection or next vignette', () => {
    const repair =
      'I would assure her that this would not happen again and actually follow through.';
    const lead = buildScenarioBoundaryLeadForInterview(1, 'Vaishnava', repair);
    expect(lead).toBe(SCENARIO_1_TO_2_TRANSITION_FALLBACK);
    expect(lead).not.toContain('Nice work, Vaishnava');
    expect(lead).not.toContain('Sarah has been job hunting');
  });
});

describe('buildScenario2To3TransitionBody', () => {
  it('uses fallback transition when first name is empty', () => {
    const out = buildScenario2To3TransitionBody('', STUB_S3);
    expect(out.startsWith(SCENARIO_2_TO_3_TRANSITION_FALLBACK)).toBe(true);
    expect(out).toContain('SOPHIE_VIGNETTE');
  });

  it('uses the no-name transition when a first name is provided', () => {
    const out = buildScenario2To3TransitionBody('Jordan', STUB_S3);
    expect(out.startsWith(SCENARIO_2_TO_3_TRANSITION_FALLBACK)).toBe(true);
    expect(out).toContain(STUB_S3);
  });

  it('omits boundary reflections for deferral repair answers', () => {
    const corpus = [
      'James should have listened more instead of jumping to logistics when Sarah was upset about the trip.',
      'She must have felt dismissed because he went straight to fixing the plan instead of hearing her out.',
      "Just wait until she brings it up again when she's ready to talk about it.",
    ].join('\n');
    const out = buildScenario2To3TransitionBody('Jordan', STUB_S3, corpus);
    expect(out.startsWith(SCENARIO_2_TO_3_TRANSITION_FALLBACK)).toBe(true);
    expect(out).not.toMatch(REFLECTION_ANCHOR);
    expect(out).not.toContain('Nice work, Jordan');
    expect(out).toContain("One more situation and then we'll get personal.");
    expect(out).toContain('SOPHIE_VIGNETTE');
  });
});

describe('buildMoment4ThresholdAnswerToMoment5Bundle', () => {
  it('includes pivot and the scripted Moment 5 question without praise when no threshold answer', () => {
    const out = buildMoment4ThresholdAnswerToMoment5Bundle('', MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT);
    expect(out).not.toContain('Great work');
    expect(out.toLowerCase()).toContain('one more question about you');
    expect(out).toContain(MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT);
  });

  it('omits ack/reflection when boundary reflections are disabled (current default)', () => {
    const out = buildMoment4ThresholdAnswerToMoment5Bundle(
      'Alex',
      MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT,
      'It really depends on many different factors each time honestly.',
    );
    expect(out).not.toContain('Thanks for sharing that.');
    expect(out).not.toMatch(REFLECTION_ANCHOR);
    expect(out).toContain('one more question about you');
    expect(out).toContain(MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT);
  });

  it('omits pattern reflection when threshold answer is provided (reflections disabled)', () => {
    const out = buildMoment4ThresholdAnswerToMoment5Bundle(
      'Alex',
      MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT,
      'I would keep trying to work through it unless there is no path forward and then I walk away.',
    );
    expect(out).not.toMatch(REFLECTION_ANCHOR);
    expect(out).not.toContain('Great work');
    expect(out).toContain(MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT);
  });
});

describe('assistantTextLooksLikeMoment4HandoffLead', () => {
  it('matches canonical no-name lead without the grudge question line', () => {
    expect(assistantTextLooksLikeMoment4HandoffLead(MOMENT_4_HANDOFF_NO_NAME_LEAD)).toBe(true);
  });

  it('matches paraphrase: three situations + two questions / more about you', () => {
    const t =
      "Nice work — you've finished the three situations. Only two questions left, and they're more about you.";
    expect(assistantTextLooksLikeMoment4HandoffLead(t)).toBe(true);
  });

  it('does not match unrelated scenario chatter', () => {
    expect(assistantTextLooksLikeMoment4HandoffLead('What do you think Sophie is feeling here?')).toBe(false);
  });

  it('matches episodic M4 grudge question wording', () => {
    expect(assistantTextLooksLikeMoment4HandoffLead(MOMENT_4_GRUDGE_QUESTION_TEXT)).toBe(true);
  });
});

describe('buildMoment4HandoffForInterview', () => {
  it('uses shared no-name lead and appends personal card', () => {
    const out = buildMoment4HandoffForInterview('', STUB_M4_CARD);
    expect(out.startsWith(MOMENT_4_HANDOFF_NO_NAME_LEAD)).toBe(true);
    expect(out.endsWith(STUB_M4_CARD)).toBe(true);
    expect(out).toContain(`\n\n${STUB_M4_CARD}`);
  });

  it('uses the no-name handoff lead when a first name is provided', () => {
    const out = buildMoment4HandoffForInterview('Sam', STUB_M4_CARD);
    expect(out.startsWith(MOMENT_4_HANDOFF_NO_NAME_LEAD)).toBe(true);
    expect(out).toContain(STUB_M4_CARD);
  });
});

describe('ensureScenario2BundleWhenOpeningWithoutVignette', () => {
  it('returns original text when interview moment is not 1', () => {
    const t = 'What do you think is going on here?';
    expect(ensureScenario2BundleWhenOpeningWithoutVignette(t, 2, 'Alex', STUB_S2)).toBe(t);
  });

  it('returns original when already in scenario 2 even if moment index still 1', () => {
    const t = 'What do you think is going on here?';
    expect(ensureScenario2BundleWhenOpeningWithoutVignette(t, 1, 'Alex', STUB_S2, 2)).toBe(t);
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

  it('replaces stripped Scenario B-only opening with full canonical bundle (no name in lead)', () => {
    const t = 'What do you think is going on here?';
    const out = ensureScenario2BundleWhenOpeningWithoutVignette(t, 1, 'Riley', STUB_S2);
    expect(out).toContain(SCENARIO_1_TO_2_TRANSITION_FALLBACK);
    expect(out).toContain('SARAH_VIGNETTE');
  });

  it('uses fallback transition in repair bundle when first name is empty', () => {
    const t = 'What do you think is going on here?';
    const out = ensureScenario2BundleWhenOpeningWithoutVignette(t, 1, '', STUB_S2);
    expect(out).toContain(SCENARIO_1_TO_2_TRANSITION_FALLBACK);
  });
});
