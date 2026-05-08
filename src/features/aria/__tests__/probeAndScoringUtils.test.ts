import { describe, expect, it } from 'vitest';
import { buildMoment4ThresholdAnswerToMoment5Bundle } from '../interviewTransitionBundles';
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
  extractScenario3UserCorpusBeforeRepairPrompt,
  isScenarioCToPersonalHandoffAssistantContent,
  sliceTranscriptBeforeScenarioCToPersonalHandoff,
  hasScenarioCQ2OnTopicEngagement,
  isLikelyMisplacedPersonalNarrativeForScenarioCThreshold,
  isMoment5AppreciationAbsenceOfSignal,
  isMoment5AppreciationAssistantAnchor,
  isMoment5InexperienceFallbackPrompt,
  isScenarioCRepairAssistantPrompt,
  assistantContainsScenarioCCommitmentThresholdForcedLine,
  looksLikeScenarioCCommitmentThresholdAssistantPrompt,
  MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT,
  MOMENT_5_ACCOUNTABILITY_PROBE_WITH_GRIEF_ACK_TEXT,
  MOMENT_5_INEXPERIENCE_FALLBACK_QUESTION,
  MOMENT_5_SPECIFICITY_REDIRECT_ALT_TEXT,
  MOMENT_5_SPECIFICITY_REDIRECT_TEXT,
  looksLikeMoment5AccountabilityProbeAssistantPrompt,
  looksLikeMoment5SpecificityRedirectPrompt,
  moment5PersonalNarrativeHasConcreteAnchor,
  moment5ResponseContainsDeathDisclosure,
  hasMoment5TemporallySpecificMoment,
  MOMENT5_SPECIFIC_MOMENT_NEGATIVE_EXAMPLES,
  MOMENT5_SPECIFIC_MOMENT_POSITIVE_EXAMPLES,
  moment5AcknowledgesLimitedCloseRelationshipExperience,
  moment5HasHighInformationBehavioralExample,
  moment5HasSubstantiveCelebrationValuesReflection,
  normalizeScoresByEvidence,
  evaluateMoment5AccountabilityProbe,
  moment5AnswerHasExplicitSelfAccountability,
  shouldProbeMoment5NoSelfReference,
  transcriptAssistantContainsMoment5PrimaryConflictQuestion,
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

  it('assistantContainsScenarioCCommitmentThresholdForcedLine matches client inject and combined turns', () => {
    const forced =
      "At what point would you say Daniel or Sophie should decide this relationship isn't working?";
    expect(assistantContainsScenarioCCommitmentThresholdForcedLine(forced)).toBe(true);
    expect(
      assistantContainsScenarioCCommitmentThresholdForcedLine(
        `Good work — you named the pattern.\n\n${forced}`
      )
    ).toBe(true);
    expect(assistantContainsScenarioCCommitmentThresholdForcedLine('How do you think this situation could be repaired?')).toBe(
      false
    );
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
      looksLikeScenarioCCommitmentThresholdAssistantPrompt(
        "At what point do you decide Daniel and Sophie's relationship isn't working?"
      )
    ).toBe(true);
    expect(
      looksLikeScenarioCCommitmentThresholdAssistantPrompt(
        "At what point would you decide Sophie and Daniel's relationship isn't working?"
      )
    ).toBe(true);
    expect(
      isScenarioCRepairAssistantPrompt(
        "At what point do you decide Daniel and Sophie's relationship isn't working?"
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

  it('extractScenario3UserCorpusBeforeRepairPrompt collects user turns before the repair prompt only', () => {
    const msgs = [
      { role: 'assistant' as const, content: 'When Daniel comes back — what do you make of that?', scenarioNumber: 3 },
      { role: 'user' as const, content: 'He seems overwhelmed.', scenarioNumber: 3 },
      { role: 'assistant' as const, content: 'How do you think this situation could be repaired?', scenarioNumber: 3 },
      { role: 'user' as const, content: 'They should schedule a check-in.', scenarioNumber: 3 },
    ];
    expect(extractScenario3UserCorpusBeforeRepairPrompt(msgs)).toBe('He seems overwhelmed.');
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

  it('implicit interpretive read of Emma line (without exact quote) skips contempt probe', () => {
    expect(
      hasScenarioAQ1ContemptProbeCoverage(
        'What Emma meant was a cutting, dismissive jab that shuts the conversation down.'
      )
    ).toBe(true);
  });

  it('Emma interpretive cue variants skip contempt probe when contempt-quality read is present', () => {
    expect(
      hasScenarioAQ1ContemptProbeCoverage(
        "Emma's point was a loaded jab; that comment from Emma came across as a put-down."
      )
    ).toBe(true);
  });

  it('substantive interpretive read (pattern/accumulated frustration) skips contempt probe', () => {
    expect(
      hasScenarioAQ1ContemptProbeCoverage(
        'It would appear that Emma has accumulated frustration over a current pattern in which Ryan prioritizes his family obligations above their relationship. Her statement, you made that very clear, suggests that this is not an isolated incident but rather a response to established behavior that she has tolerated for some time.'
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

  it('does not flag third-person their/them threshold answer as misplaced (regression: SC3 loop)', () => {
    const theirCoupleAnswer =
      "I would say that at the third time having the same fight, you might want to consider ending their relationship.";
    expect(isLikelyMisplacedPersonalNarrativeForScenarioCThreshold(theirCoupleAnswer)).toBe(false);
  });

  it('does not flag "end the relationship" / third-fight threshold answer without their/Daniel (whisper regression)', () => {
    const whisperStyle =
      "I think because it's the third time to have the same fight, it might be time to end the relationship.";
    expect(isLikelyMisplacedPersonalNarrativeForScenarioCThreshold(whisperStyle)).toBe(false);
    const userParaphrase =
      'I would say after, at the third time having the same fight, you might want to consider ending the relationship.';
    expect(isLikelyMisplacedPersonalNarrativeForScenarioCThreshold(userParaphrase)).toBe(false);
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

  it('transcriptAssistantContainsMoment5PrimaryConflictQuestion matches full M4→M5 client bundle', () => {
    const bundle = buildMoment4ThresholdAnswerToMoment5Bundle('Sam', MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT);
    expect(transcriptAssistantContainsMoment5PrimaryConflictQuestion(bundle)).toBe(true);
  });

  it('transcriptAssistantContainsMoment5PrimaryConflictQuestion matches common model paraphrase of conflict prompt', () => {
    const paraphrase =
      'Tell me about a specific conflict you had with someone important in your life and how it got resolved — or didn\'t.';
    expect(transcriptAssistantContainsMoment5PrimaryConflictQuestion(paraphrase)).toBe(true);
  });

  describe('evaluateMoment5AccountabilityProbe (Moment 5 accountability probe)', () => {
    it('fires for symmetric "we both" generic answer without concrete first-person behavior', () => {
      const answer =
        "Yeah I've had conflicts before. We both had our issues in the situation and eventually things worked themselves out. I think communication is just really important in any relationship.";
      expect(evaluateMoment5AccountabilityProbe(answer)).toEqual({
        shouldProbe: true,
        reason: 'lacks_explicit_self_accountability',
      });
      expect(shouldProbeMoment5NoSelfReference(answer)).toBe(true);
    });

    it('fires for third-person-focused conflict narrative', () => {
      const answer =
        'We had a fight about money. They were totally unreasonable and kept bringing up old grievances every time we talked.';
      expect(evaluateMoment5AccountabilityProbe(answer)).toEqual({
        shouldProbe: true,
        reason: 'lacks_explicit_self_accountability',
      });
    });

    it('fires for first-person emotion and story without explicit ownership (I felt / I remember is not enough)', () => {
      const answer =
        'I felt really dismissed the whole time. I remember we kept going in circles about the same thing and they would not budge an inch. Eventually we just dropped it and moved on.';
      expect(moment5AnswerHasExplicitSelfAccountability(answer)).toBe(false);
      expect(evaluateMoment5AccountabilityProbe(answer).shouldProbe).toBe(true);
    });

    it('fires for substantive conflict narrative without self-accountability cues', () => {
      const answer =
        'It dragged on for months. We would argue late at night and then pretend everything was fine the next morning. In the end we sat down with a mutual friend and hashed it out until we could actually listen.';
      expect(evaluateMoment5AccountabilityProbe(answer).shouldProbe).toBe(true);
    });

    it('does not fire when user gives explicit ownership language', () => {
      const answer =
        'We argued for weeks. I realize I escalated by walking away mid-conversation and I should have stayed to finish it.';
      expect(evaluateMoment5AccountabilityProbe(answer)).toEqual({
        shouldProbe: false,
        reason: 'explicit_self_accountability',
      });
    });

    it('does not fire for "I contributed" style ownership', () => {
      const answer =
        'There was a blowup about chores and fairness. I contributed by shutting down instead of saying what I needed, and my role was to go silent when I felt criticized.';
      expect(moment5AnswerHasExplicitSelfAccountability(answer)).toBe(true);
      expect(evaluateMoment5AccountabilityProbe(answer).reason).toBe('explicit_self_accountability');
    });

    it('does not fire for "I own my feelings / I did yell" ownership phrasing', () => {
      const answer =
        "Well, the conflict story I talked about before is kind of like we use that. So I get resolved by, I own my feelings and I did yell at him. But after I calmed down, I genuinely tried to understand his point of view and try to be open to his criticism.";
      expect(moment5AnswerHasExplicitSelfAccountability(answer)).toBe(true);
      expect(evaluateMoment5AccountabilityProbe(answer)).toEqual({
        shouldProbe: false,
        reason: 'explicit_self_accountability',
      });
    });

    it('does not fire for take-ownership / out-of-line / assumptions phrasing', () => {
      const answer =
        'I took ownership of my side in it. I was out of line, I made assumptions, and I could have communicated better.';
      expect(moment5AnswerHasExplicitSelfAccountability(answer)).toBe(true);
      expect(evaluateMoment5AccountabilityProbe(answer).reason).toBe('explicit_self_accountability');
    });

    it('does not fire for answers that are too short to evaluate', () => {
      expect(evaluateMoment5AccountabilityProbe('Yeah conflicts happen sometimes.')).toEqual({
        shouldProbe: false,
        reason: 'too_short',
      });
    });
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

  describe('Moment 5 concrete narrative anchor (specificity redirect gate)', () => {
    it('detects scripted specificity redirect assistant prompts', () => {
      expect(looksLikeMoment5SpecificityRedirectPrompt(MOMENT_5_SPECIFICITY_REDIRECT_TEXT)).toBe(true);
      expect(looksLikeMoment5SpecificityRedirectPrompt(MOMENT_5_SPECIFICITY_REDIRECT_ALT_TEXT)).toBe(true);
      expect(looksLikeMoment5SpecificityRedirectPrompt('What was your part in how it unfolded?')).toBe(false);
    });

    it('treats generic second-person advice as lacking concrete anchor', () => {
      expect(
        moment5PersonalNarrativeHasConcreteAnchor(
          'When you have a conflict you need to stay calm and listen. You should not escalate things and you need to hear the other person out.',
        ),
      ).toBe(false);
    });

    it('treats first-person process-only habits as lacking concrete anchor', () => {
      expect(
        moment5PersonalNarrativeHasConcreteAnchor(
          'I usually try to address the issue directly and find a middle ground. I discuss how it made me feel and work through it calmly with people.',
        ),
      ).toBe(false);
    });

    it('accepts concrete relational + episode narrative', () => {
      expect(
        moment5PersonalNarrativeHasConcreteAnchor(
          'Last month my partner and I had a fight about money. She said I was not pulling my weight and we argued for an hour before we talked it through.',
        ),
      ).toBe(true);
    });

    it('accepts my best friend + had an argument phrasing (not only we-had-a-fight)', () => {
      expect(
        moment5PersonalNarrativeHasConcreteAnchor(
          "There was a time my best friend, my late best friend and I had an argument, not exactly sure what it was about but it was pretty serious at the time and we stopped talking to each other for a while. We stopped hanging out and texting but when I finally talked to him again it worked out; he passed away two years ago.",
        ),
      ).toBe(true);
    });

    it('returns false for very short answers', () => {
      expect(moment5PersonalNarrativeHasConcreteAnchor('My friend was mad.')).toBe(false);
    });

    it('accepts extended kin + repair language', () => {
      expect(
        moment5PersonalNarrativeHasConcreteAnchor(
          'My cousin and I blew up over money at Christmas and did not speak for months until we finally apologized and cleared the air sitting in her kitchen.',
        ),
      ).toBe(true);
    });

    it('accepts situational hooks without calendar dates', () => {
      expect(
        moment5PersonalNarrativeHasConcreteAnchor(
          'That night my roommate ghosted me after I crossed a line trash-talking her boyfriend over text; we made up weeks later when she showed up at work.',
        ),
      ).toBe(true);
    });

    it('accepts someone i trusted + episode verbs', () => {
      expect(
        moment5PersonalNarrativeHasConcreteAnchor(
          'Someone I trusted gave me the silent treatment for two weeks after I lied to them about something stupid at work, and it escalated until their partner intervened.',
        ),
      ).toBe(true);
    });

    it('accepts non-standard partner phrasing', () => {
      expect(
        moment5PersonalNarrativeHasConcreteAnchor(
          'The guy I was seeing stonewalled me on the drive home right before the wedding trip and I walked away from the whole thing.',
        ),
      ).toBe(true);
    });

    it('accepts explicit long narrative lead with best-friend conflict arc (log regression)', () => {
      expect(
        moment5PersonalNarrativeHasConcreteAnchor(
          "There was a time my best friend, my late best friend and I had an argument, not exactly sure what it was about, but it was pretty serious at the time. We stopped talking to each other for a while and stopped hanging out. We just kind of cut each other out, but what I got from that wasn't that he gave up on me, it was just that both of us were in a situation where we couldn't really fully be there and support each other, and we needed to find a way to be able to do that again for one another. It took a lot of self-reflection, took some tears, a lot of lonely nights without him, but when I finally built up the courage to talk to him again, I was like, hey man, I understand we didn't end our last conversation on the best of terms, and I just wanted to sit down and have a full clear mind, talk about what the issues were, and what we've done in the meantime to get through these things, and it worked out pretty well. I was the best man at his wedding, and I'm the godfather to his daughter. He passed away almost two years ago, and it's kind of hard to be here without him. I'm doing my best for the both of us.",
        ),
      ).toBe(true);
    });
  });

  describe('Moment 5 death disclosure (grief ack before accountability probe)', () => {
    it('detects scripted probe-with-grief assistant text', () => {
      expect(looksLikeMoment5AccountabilityProbeAssistantPrompt(MOMENT_5_ACCOUNTABILITY_PROBE_WITH_GRIEF_ACK_TEXT)).toBe(
        true,
      );
    });

    it('flags explicit death and funeral language', () => {
      expect(
        moment5ResponseContainsDeathDisclosure(
          'After my father passed away we argued constantly about the estate and who would host holidays. It went on for months.',
        ),
      ).toBe(true);
      expect(
        moment5ResponseContainsDeathDisclosure(
          'We had a terrible fight at the funeral because she thought I was not stepping up for my brother.',
        ),
      ).toBe(true);
    });

    it('flags lost family member idioms', () => {
      expect(
        moment5ResponseContainsDeathDisclosure(
          'When I lost my sister I shut down completely and my partner kept pushing me to talk until we exploded.',
        ),
      ).toBe(true);
    });

    it('flags lost partner when death cues appear', () => {
      expect(
        moment5ResponseContainsDeathDisclosure(
          'I lost my partner when she died suddenly and we never resolved the last fight about money.',
        ),
      ).toBe(true);
    });

    it('flags Name died pattern', () => {
      expect(
        moment5ResponseContainsDeathDisclosure(
          'Maria died two years ago and my cousin and I still blame each other for how Mom was cared for.',
        ),
      ).toBe(true);
    });

    it('does not flag relationship-metaphor death or estrangement without bereavement', () => {
      expect(
        moment5ResponseContainsDeathDisclosure(
          'It felt like the death of the relationship when she walked out but nobody died.',
        ),
      ).toBe(false);
      expect(
        moment5ResponseContainsDeathDisclosure(
          'I lost them after we broke up and they blocked me — pure estrangement, messy but not bereavement.',
        ),
      ).toBe(false);
      expect(
        moment5ResponseContainsDeathDisclosure(
          'They are dead to me now after what they pulled and we still fight through lawyers.',
        ),
      ).toBe(false);
      expect(
        moment5ResponseContainsDeathDisclosure(
          'I lost my boyfriend when he moved across the country and stopped answering texts.',
        ),
      ).toBe(false);
    });
  });
});
