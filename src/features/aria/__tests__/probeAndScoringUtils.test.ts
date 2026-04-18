import {
  buildMoment5AppreciationProbeQuestion,
  evaluateMoment5AppreciationSpecificity,
  hasScenarioAQ1ContemptProbeCoverage,
  hasScenarioAQ1VignetteEngagement,
  hasScenarioBQ1OnTopicEngagement,
  hasScenarioCCommitmentThresholdInUserAnswer,
  hasScenarioCVignetteCommitmentThresholdSignal,
  extractScenario3CommitmentThresholdUserAnswerAfterPrompt,
  extractScenario3UserCorpusAfterLastRepairPrompt,
  isScenarioCToPersonalHandoffAssistantContent,
  sliceTranscriptBeforeScenarioCToPersonalHandoff,
  hasScenarioCQ2OnTopicEngagement,
  isLikelyMisplacedPersonalNarrativeForScenarioCThreshold,
  isMoment5AppreciationAbsenceOfSignal,
  isMoment5AppreciationAssistantAnchor,
  isMoment5InexperienceFallbackPrompt,
  isScenarioCRepairAssistantPrompt,
  MOMENT_5_INEXPERIENCE_FALLBACK_QUESTION,
  hasMoment5TemporallySpecificMoment,
  MOMENT5_SPECIFIC_MOMENT_NEGATIVE_EXAMPLES,
  MOMENT5_SPECIFIC_MOMENT_POSITIVE_EXAMPLES,
  moment5AcknowledgesLimitedCloseRelationshipExperience,
  moment5HasHighInformationBehavioralExample,
  moment5HasSubstantiveCelebrationValuesReflection,
  normalizeScoresByEvidence,
} from '../probeAndScoringUtils';

describe('Moment 5 temporal specificity (named fixtures)', () => {
  it('does not mark generic habitual / values-only lines as specific moments', () => {
    for (const s of MOMENT5_SPECIFIC_MOMENT_NEGATIVE_EXAMPLES) {
      expect(hasMoment5TemporallySpecificMoment(s)).toBe(false);
      expect(evaluateMoment5AppreciationSpecificity(s).hasSpecificMoment).toBe(false);
    }
  });
  it('marks anchored occasion narratives as specific moments', () => {
    for (const s of MOMENT5_SPECIFIC_MOMENT_POSITIVE_EXAMPLES) {
      expect(hasMoment5TemporallySpecificMoment(s)).toBe(true);
      expect(evaluateMoment5AppreciationSpecificity(s).hasSpecificMoment).toBe(true);
    }
  });
});

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
    expect(hasScenarioBQ1OnTopicEngagement('James should have said more than congrats.')).toBe(true);
  });

  it('detects Scenario C Q2 on-topic engagement for repair-only answers', () => {
    expect(
      hasScenarioCQ2OnTopicEngagement('They should communicate better and come back to talk it through.')
    ).toBe(true);
  });

  it('does not treat vignette motion alone as Scenario C commitment-threshold signal', () => {
    const vignetteMotion =
      "Daniel leaves when flooded, then comes back — they need to repair by talking it through when he returns.";
    expect(hasScenarioCCommitmentThresholdInUserAnswer(vignetteMotion)).toBe(false);
  });

  it('detects explicit relationship exit criteria in Scenario C answers', () => {
    expect(
      hasScenarioCCommitmentThresholdInUserAnswer(
        'If this pattern keeps happening after they have really tried therapy, I would say the relationship is not working.'
      )
    ).toBe(true);
  });

  it('repair-only Daniel/Sophie answer does not skip Scenario C threshold forcing (no exit/leave framing)', () => {
    const repair =
      'Both of them have something to own. Daniel needs to acknowledge the full pattern. Sophie also needs to look at how they are pursuing. Sophie pursues, Daniel withdraws. They are both keeping that loop going.';
    expect(hasScenarioCVignetteCommitmentThresholdSignal(repair)).toBe(false);
  });

  it('vignette threshold signal requires Daniel or Sophie named (generic "when to leave" repair talk does not qualify)', () => {
    const repairOnly =
      "If they've had this same argument three times, at some point they have to decide when to leave — that's the real question.";
    expect(hasScenarioCCommitmentThresholdInUserAnswer(repairOnly)).toBe(true);
    expect(hasScenarioCVignetteCommitmentThresholdSignal(repairOnly)).toBe(false);
    expect(
      hasScenarioCVignetteCommitmentThresholdSignal(
        'If Daniel keeps leaving and Sophie cannot get a real repair, I would say the relationship is not working.'
      )
    ).toBe(true);
  });

  it('isScenarioCRepairAssistantPrompt accepts model paraphrases of the scripted CQ2 repair ask', () => {
    expect(isScenarioCRepairAssistantPrompt('How do you think this situation could be repaired?')).toBe(true);
    expect(isScenarioCRepairAssistantPrompt('How do you think this could be repaired?')).toBe(true);
    expect(isScenarioCRepairAssistantPrompt('How might this situation be repaired?')).toBe(true);
    expect(isScenarioCRepairAssistantPrompt('How could this be repaired?')).toBe(true);
    expect(isScenarioCRepairAssistantPrompt('How can they repair this?')).toBe(true);
    expect(
      isScenarioCRepairAssistantPrompt(
        "At what point would you say Daniel or Sophie should decide this relationship isn't working?"
      )
    ).toBe(false);
    expect(
      isScenarioCRepairAssistantPrompt(
        'When Daniel comes back and says "I didn\'t know what to say" — what do you make of that?'
      )
    ).toBe(false);
  });

  it('extractScenario3UserCorpusAfterLastRepairPrompt finds CQ2 when assistant paraphrases the repair question', () => {
    const msgs = [
      { role: 'assistant' as const, content: 'When Daniel comes back — what do you make of that?', scenarioNumber: 3 },
      { role: 'user' as const, content: 'He is trying.', scenarioNumber: 3 },
      { role: 'assistant' as const, content: 'How could this situation be repaired?', scenarioNumber: 3 },
      { role: 'user' as const, content: 'They need clearer return agreements.', scenarioNumber: 3 },
    ];
    expect(extractScenario3UserCorpusAfterLastRepairPrompt(msgs)).toBe('They need clearer return agreements.');
  });

  it('extractScenario3UserCorpusAfterLastRepairPrompt ignores pre-repair user turns', () => {
    const msgs = [
      { role: 'assistant' as const, content: 'When Daniel comes back — what do you make of that?', scenarioNumber: 3 },
      {
        role: 'user' as const,
        content: 'I do not think there is a formula for when to leave in my own life.',
        scenarioNumber: 3,
      },
      { role: 'assistant' as const, content: 'How do you think this situation could be repaired?', scenarioNumber: 3 },
      { role: 'user' as const, content: 'They need to talk it through.', scenarioNumber: 3 },
    ];
    expect(extractScenario3UserCorpusAfterLastRepairPrompt(msgs)).toBe('They need to talk it through.');
  });

  it('does not treat Scenario C opening ("more personal" teaser) as Moment 4 handoff', () => {
    expect(
      isScenarioCToPersonalHandoffAssistantContent(
        "Here's the third situation — after this we'll move to something more personal. Sophie and Daniel have had the same argument."
      )
    ).toBe(false);
  });

  it('detects Moment 4 handoff after Scenario C (grudge + finished three situations)', () => {
    expect(
      isScenarioCToPersonalHandoffAssistantContent(
        "We've finished the three situations — the last two questions are more personal. Have you ever held a grudge against someone, or had someone in your life you really didn't like?"
      )
    ).toBe(true);
  });

  it('sliceTranscriptBeforeScenarioCToPersonalHandoff drops personal turns still tagged as scenario 3', () => {
    const msgs = [
      { role: 'assistant' as const, content: 'At what point would you say Daniel or Sophie...', scenarioNumber: 3 },
      { role: 'user' as const, content: 'Threshold answer about Daniel.', scenarioNumber: 3 },
      {
        role: 'assistant' as const,
        content:
          "We've finished the three situations — the last two questions are more personal. Have you ever held a grudge?",
        scenarioNumber: 3,
      },
      { role: 'user' as const, content: 'Personal story about my father.', scenarioNumber: 3 },
    ];
    const sliced = sliceTranscriptBeforeScenarioCToPersonalHandoff(msgs);
    expect(sliced).toHaveLength(2);
    expect(sliced[1].content).toContain('Threshold answer');
  });

  it('extractScenario3UserCorpusAfterLastRepairPrompt stops before commitment-threshold follow-up (no bleed)', () => {
    const msgs = [
      { role: 'assistant' as const, content: 'How do you think this situation could be repaired?', scenarioNumber: 3 },
      {
        role: 'user' as const,
        content: 'Exit framing repair answer only.',
        scenarioNumber: 3,
      },
      {
        role: 'assistant' as const,
        content:
          "At what point would you say Daniel or Sophie should decide this relationship isn't working?",
        scenarioNumber: 3,
      },
      {
        role: 'user' as const,
        content: 'Workable communication pattern — not a values difference yet.',
        scenarioNumber: 3,
      },
    ];
    expect(extractScenario3UserCorpusAfterLastRepairPrompt(msgs)).toBe('Exit framing repair answer only.');
    expect(extractScenario3CommitmentThresholdUserAnswerAfterPrompt(msgs)).toBe(
      'Workable communication pattern — not a values difference yet.'
    );
  });

  it('detects Scenario A vignette engagement when user names hurt without contempt vocabulary', () => {
    expect(
      hasScenarioAQ1VignetteEngagement(
        "Emma felt brushed off when Ryan stayed on the phone that long at dinner."
      )
    ).toBe(true);
    expect(
      hasScenarioAQ1ContemptProbeCoverage(
        "Emma felt brushed off when Ryan stayed on the phone that long at dinner."
      )
    ).toBe(false);
  });

  it('Emma + dismissed at dinner without referencing the final line does not skip contempt probe', () => {
    expect(
      hasScenarioAQ1ContemptProbeCoverage(
        'Emma felt dismissed at dinner when the call ran long — like the date did not matter.'
      )
    ).toBe(false);
  });

  it('reference to final line + passive-aggressive only does not skip contempt probe', () => {
    expect(
      hasScenarioAQ1ContemptProbeCoverage(
        "When Emma says you've made that very clear it's passive aggressive — she's not being direct."
      )
    ).toBe(false);
  });

  it('reference to final line + stating-a-fact minimization does not skip contempt probe', () => {
    expect(
      hasScenarioAQ1ContemptProbeCoverage(
        "Honestly with you've made that very clear I think Emma is just stating a fact about the pattern."
      )
    ).toBe(false);
  });

  it('reference to final line + harsh/dismissive read skips contempt probe', () => {
    expect(
      hasScenarioAQ1ContemptProbeCoverage(
        "Emma's you've made that very clear is dismissive and harsh — it shuts Ryan down and sounds contemptuous."
      )
    ).toBe(true);
  });

  it('long Ryan-centered Scenario A Q1 (incl. “Emma was upset” / family framing) still does not skip contempt probe', () => {
    const answer =
      "Ryan sounds like someone who has never had to put their partner first. The fact that they couldn't even see why Emma was upset says a lot about their emotional maturity. Some people just aren't capable of prioritizing their relationship over their family of origin and that's a real problem.";
    expect(hasScenarioAQ1ContemptProbeCoverage(answer)).toBe(false);
    expect(hasScenarioAQ1VignetteEngagement(answer)).toBe(true);
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

  it('detects Moment 5 appreciation assistant anchors across framework variants', () => {
    expect(
      isMoment5AppreciationAssistantAnchor(
        'Think of a time you really celebrated someone in your life — a partner, a friend, a family member, anyone. What did you do to show them that?'
      )
    ).toBe(true);
    expect(
      isMoment5AppreciationAssistantAnchor(
        "What comes to mind when you think of a time you really got to show someone close to you they mattered?"
      )
    ).toBe(true);
    expect(
      isMoment5AppreciationAssistantAnchor(
        "I'd love to hear about a moment you celebrated someone who mattered to you."
      )
    ).toBe(true);
    expect(
      isMoment5AppreciationAssistantAnchor(
        "Can we talk about a time you really showed up for someone you care about?"
      )
    ).toBe(true);
    expect(
      isMoment5AppreciationAssistantAnchor(
        'Think of a time you really celebrated someone in your life — a partner, a friend, a family member, anyone. What did you do to show them that?'
      )
    ).toBe(true);
    expect(isMoment5AppreciationAssistantAnchor('James should have said more than congrats.')).toBe(false);
  });

  it('flags personal narrative as misplaced for Scenario C threshold probe', () => {
    const personalNarrative =
      'In my last relationship, I kept trying for months and eventually I left when I felt like I was the only one doing the work.';
    expect(isLikelyMisplacedPersonalNarrativeForScenarioCThreshold(personalNarrative)).toBe(true);
  });

  it('does not flag direct Daniel/Sophie threshold answer as misplaced', () => {
    const directScenarioAnswer =
      "Daniel or Sophie should end it when they've repeated this same conflict many times and one person still refuses repair.";
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
