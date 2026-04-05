import {
  buildMoment5AppreciationProbeQuestion,
  evaluateMoment5AppreciationSpecificity,
  hasScenarioAQ1VignetteEngagement,
  hasScenarioBQ1OnTopicEngagement,
  hasScenarioCQ2OnTopicEngagement,
  isLikelyMisplacedPersonalNarrativeForScenarioCThreshold,
  isMoment5AppreciationAbsenceOfSignal,
  isMoment5InexperienceFallbackPrompt,
  MOMENT_5_INEXPERIENCE_FALLBACK_QUESTION,
  moment5AcknowledgesLimitedCloseRelationshipExperience,
  moment5HasHighInformationBehavioralExample,
  moment5HasSubstantiveCelebrationValuesReflection,
  normalizeScoresByEvidence,
} from '../probeAndScoringUtils';

describe('probeAndScoringUtils', () => {
  /**
   * Habitual template is generic for specificity scoring; legacy act-echo probe wording still applies when used.
   * Runtime Moment 5 now uses the inexperience values pivot for generic/absence cases instead of forcing this probe.
   */
  it('treats habitual message/meal template as engaged (not absence) even when isGeneric for scoring', () => {
    const answer =
      "I try to acknowledge when people I care about do something significant. I'll send a message or take them out for a meal.";
    const result = evaluateMoment5AppreciationSpecificity(answer);
    expect(result.isGeneric).toBe(true);
    expect(isMoment5AppreciationAbsenceOfSignal(answer)).toBe(false);
    const q = buildMoment5AppreciationProbeQuestion(answer);
    expect(q).not.toMatch(/on that specifically/i);
    expect(q).toMatch(/^What made you decide to take them out for a meal like that\?$/i);
  });

  it('treats explicit non-answer as Moment 5 absence of signal', () => {
    expect(isMoment5AppreciationAbsenceOfSignal("I don't know")).toBe(true);
    expect(isMoment5AppreciationAbsenceOfSignal('')).toBe(true);
  });

  it('detects Scenario B on-topic engagement for shallow answers', () => {
    expect(hasScenarioBQ1OnTopicEngagement('Jordan should have said more than congrats.')).toBe(true);
  });

  it('detects Scenario C Q2 on-topic engagement for repair-only answers', () => {
    expect(
      hasScenarioCQ2OnTopicEngagement('They should communicate better and come back to talk it through.')
    ).toBe(true);
  });

  it('detects Scenario A vignette engagement when user names hurt without contempt vocabulary', () => {
    expect(
      hasScenarioAQ1VignetteEngagement(
        "Sam felt brushed off when Reese stayed on the phone that long at dinner."
      )
    ).toBe(true);
  });

  it('does not classify the birthday-party answer as generic appreciation', () => {
    const answer =
      "I threw my friend a birthday party when she turned 30 - she'd been going through a hard year and I wanted to do something that would make her feel special. I organized it and invited people she hadn't seen in a while. She seemed really touched by it";
    const result = evaluateMoment5AppreciationSpecificity(answer);
    expect(result.hasSpecificPerson).toBe(true);
    expect(result.hasSpecificMoment).toBe(true);
    expect(result.hasAttunement).toBe(true);
    expect(result.hasRelationalSpecificity).toBe(true);
    expect(result.isGeneric).toBe(false);
    expect(moment5HasHighInformationBehavioralExample(answer)).toBe(true);
  });

  it('treats thin habitual birthday line as needing inexperience fallback (not high-information example)', () => {
    const answer = 'I go to birthdays and say happy birthday.';
    expect(evaluateMoment5AppreciationSpecificity(answer).isGeneric).toBe(true);
    expect(moment5HasHighInformationBehavioralExample(answer)).toBe(false);
    expect(moment5HasSubstantiveCelebrationValuesReflection(answer)).toBe(false);
  });

  it('detects explicit limited close-relationship experience phrasing', () => {
    expect(moment5AcknowledgesLimitedCloseRelationshipExperience("I haven't had many close relationships.")).toBe(
      true
    );
    expect(moment5AcknowledgesLimitedCloseRelationshipExperience('My family was never really demonstrative.')).toBe(
      true
    );
  });

  it('detects substantive values reflection without a behavioral story', () => {
    const answer =
      "I haven't had many close friends, but to me meaningful celebration would be showing up when someone is going through something hard — not just the party, but being there afterward.";
    expect(moment5HasSubstantiveCelebrationValuesReflection(answer)).toBe(true);
  });

  it('matches the exact Moment 5 inexperience fallback prompt text', () => {
    expect(isMoment5InexperienceFallbackPrompt(MOMENT_5_INEXPERIENCE_FALLBACK_QUESTION)).toBe(true);
    expect(isMoment5InexperienceFallbackPrompt('Thanks for sharing that.')).toBe(false);
  });

  it('flags personal narrative as misplaced for Scenario C threshold probe', () => {
    const personalNarrative =
      'In my last relationship, I kept trying for months and eventually I left when I felt like I was the only one doing the work.';
    expect(isLikelyMisplacedPersonalNarrativeForScenarioCThreshold(personalNarrative)).toBe(true);
  });

  it('does not flag direct Theo/Morgan threshold answer as misplaced', () => {
    const directScenarioAnswer =
      "Theo or Morgan should end it when they've repeated this same conflict many times and one person still refuses repair.";
    expect(isLikelyMisplacedPersonalNarrativeForScenarioCThreshold(directScenarioAnswer)).toBe(false);
  });

  it('drops scores that explicitly have no evidence text', () => {
    const cleaned = normalizeScoresByEvidence(
      { regulation: 0, accountability: 3.3, repair: 6.2 },
      {
        regulation: 'No regulation content in this scenario.',
        accountability: 'User acknowledged partial ownership.',
      }
    );
    expect(cleaned.regulation).toBeUndefined();
    expect(cleaned.accountability).toBe(3.3);
    expect(cleaned.repair).toBe(6.2);
  });

  /**
   * MOMENT5_PROBE_WORDING — runtime-forced appreciation probe must mirror the user's described act,
   * not the generic "on that specifically" script whenever extraction matches.
   */
  describe('MOMENT5_PROBE_WORDING (buildMoment5AppreciationProbeQuestion)', () => {
    it('asks about throwing the birthday party they described', () => {
      const answer =
        "I threw my friend a birthday party when she turned 30 — she'd been going through a hard year.";
      const q = buildMoment5AppreciationProbeQuestion(answer);
      expect(q).not.toMatch(/on that specifically/i);
      expect(q).toMatch(/^What made you decide to throw her that party\?$/i);
    });

    it('asks about writing the letter they described', () => {
      const answer = 'I wrote my partner a letter when they were stressed about work.';
      const q = buildMoment5AppreciationProbeQuestion(answer);
      expect(q).not.toMatch(/on that specifically/i);
      expect(q).toMatch(/^What made you decide to write them that letter\?$/i);
    });

    it('asks about flying in as a surprise when they said that', () => {
      const answer = 'I flew in as a surprise for their graduation weekend.';
      const q = buildMoment5AppreciationProbeQuestion(answer);
      expect(q).not.toMatch(/on that specifically/i);
      expect(q).toMatch(/^What made you decide to fly in as a surprise\?$/i);
    });

    it('uses bridged specific-moment wording for habitual/general answers', () => {
      const answer = 'I usually try to check in on friends when they seem down.';
      const q = buildMoment5AppreciationProbeQuestion(answer);
      expect(q).toContain('specific moment');
      expect(q).toContain('nothing surfaces');
      expect(q).not.toMatch(/^It can be anything/i);
    });
  });
});
