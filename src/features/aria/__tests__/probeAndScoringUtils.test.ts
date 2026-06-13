import { describe, expect, it } from '@jest/globals';
import { personalMomentBundleWasScored } from '../interviewCompletionGate';
import { buildMoment4ThresholdAnswerToMoment5Bundle } from '../interviewTransitionBundles';
import {
  aggregateScenario1Moment1UserTextForContemptGate,
  buildMoment5AppreciationProbeQuestion,
  evaluateMoment5AppreciationSpecificity,
  evaluateScenarioAQ1ContemptProbePreProbeSkip,
  hasScenarioAQ1ContemptProbeCoverage,
  hasScenarioAQ1VignetteEngagement,
  isReplyingToScenarioAQ1AfterDelivery,
  hasScenarioBQ1OnTopicEngagement,
  hasScenarioCCommitmentThresholdInUserAnswer,
  hasScenarioCVignetteCommitmentThresholdSignal,
  extractScenario3CommitmentThresholdUserAnswerAfterPrompt,
  extractScenario3UserCorpusAfterLastRepairPrompt,
  extractScenario3UserCorpusBeforeRepairPrompt,
  isScenarioCToPersonalHandoffAssistantContent,
  sliceTranscriptBeforeScenarioCToPersonalHandoff,
  sliceTranscriptForScenario3Scoring,
  hasScenarioCQ2OnTopicEngagement,
  isLikelyMisplacedPersonalNarrativeForScenarioCThreshold,
  isMoment5AppreciationAbsenceOfSignal,
  isMoment5AppreciationAssistantAnchor,
  isMoment5InexperienceFallbackPrompt,
  isScenarioCRepairAssistantPrompt,
  assistantContainsScenarioCCommitmentThresholdForcedLine,
  looksLikeScenarioCCommitmentThresholdAssistantPrompt,
  MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT,
  MOMENT_5_CONFLICT_VALIDITY_CLARIFICATION_TEXT,
  MOMENT_5_ACCOUNTABILITY_PROBE_WITH_GRIEF_ACK_TEXT,
  MOMENT_5_ACCOUNTABILITY_PROBE_TEXT,
  MOMENT_5_INEXPERIENCE_FALLBACK_QUESTION,
  MOMENT_5_SPECIFICITY_REDIRECT_ALT_TEXT,
  MOMENT_5_SPECIFICITY_REDIRECT_TEXT,
  MOMENT_5_RESOLUTION_FOLLOWUP_TEXT,
  MOMENT_5_ACCOUNTABILITY_PROBE_PHILOSOPHY_WITH_GRIEF_ACK_TEXT,
  looksLikeMoment5AccountabilityProbeAssistantPrompt,
  looksLikeMoment5ConflictValidityClarificationPrompt,
  looksLikeMoment5ResolutionFollowUpPrompt,
  looksLikeMoment5SpecificityRedirectPrompt,
  transcriptHasMoment5ResolutionFollowUpAsked,
  stripEmbeddedMoment5SpecificityRedirectAsk,
  stripEmbeddedMoment5AccountabilityProbeAsk,
  stripMoment5SpecificityRedirectStreamingEcho,
  stripMoment5AccountabilityProbeStreamingEcho,
  looksLikeScenarioAContemptProbeQuestion,
  scenarioAEmmaVeryClearContemptReask,
  mergeDeferredScenarioAContemptProbeLeadWithNextSentence,
  isIncompleteScenarioAContemptProbeLeadSentence,
  stripScenarioAContemptProbeQuestion,
  stripEmbeddedScenarioAContemptProbeAsk,
  stripScenarioAContemptProbeStreamingEcho,
  SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY,
  SCENARIO_A_CONTEMPT_PROBE_RESUME_REPEAT_TTS_COPY,
  SCENARIO_A_CONTEMPT_PROBE_TTS_SPOKEN_COPY,
  scenarioAContemptProbeResumeRepeatTtsText,
  scenarioAContemptProbeTtsSpokenText,
  classifyConflictValidity,
  extractPriorM5TranscriptBeforeClarification,
  moment5ConflictValidityIsLow,
  evaluateMoment5AccountabilitySelfReference,
  moment5PersonalNarrativeHasConcreteAnchor,
  combineMoment5UserTurnText,
  combineMoment5UserTextIncludingCurrent,
  moment5TranscriptHasConcreteAnchor,
  moment5UserOrTranscriptHasConcreteAnchor,
  moment5UserDeclinesConcreteReask,
  shouldInjectMoment5SpecificityRedirect,
  buildMoment5ConfusionRepeatReplayAfterPriorAnswer,
  moment5ResponseAddsTensionDetail,
  moment5ResponseContainsDeathDisclosure,
  hasMoment5TemporallySpecificMoment,
  MOMENT5_SPECIFIC_MOMENT_NEGATIVE_EXAMPLES,
  MOMENT5_SPECIFIC_MOMENT_POSITIVE_EXAMPLES,
  moment5AcknowledgesLimitedCloseRelationshipExperience,
  moment5HasHighInformationBehavioralExample,
  moment5HasSubstantiveCelebrationValuesReflection,
  normalizeScoresByEvidence,
  coerceScenarioScoreParsedModelRecord,
  mergeSalvagedScenarioPillarScoresIntoParsed,
  fillScenarioKeyEvidenceWhenNumericScoreButMissingQuote,
  mergeMoment4PillarScoresAfterEvidenceNormalize,
  mergeMoment5PillarScoresAfterEvidenceNormalize,
  mergeSalvagedMoment4PillarScoresIntoParsed,
  coerceScoreToFiniteNumber,
  backfillMoment4KeyEvidenceIfScoresOtherwiseUnpersistable,
  backfillMoment5KeyEvidenceIfScoresOtherwiseUnpersistable,
  fillMoment5KeyEvidenceWhenNumericScoreButMissingQuote,
  MOMENT4_SCORE_RECOVERED_EVIDENCE_LINE,
  mergeSalvagedMoment5PillarScoresIntoParsed,
  evaluateMoment5AccountabilityProbe,
  pickMoment5AccountabilityProbeSpokenText,
  shouldFireAccountabilityProbe,
  moment5AnswerHasExplicitSelfAccountability,
  moment5ResponseIsAbstract,
  shouldProbeMoment5NoSelfReference,
  transcriptAssistantContainsMoment5PrimaryConflictQuestion,
  spokenTextStartsMoment5PrimaryConflictQuestion,
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

  it('sliceTranscriptForScenario3Scoring cuts on three described situations handoff and drops M5 by interviewMoment', () => {
    const msgs = [
      { role: 'assistant' as const, content: 'Sophie and Daniel have had the same argument.', scenarioNumber: 3, interviewMoment: 3 },
      { role: 'user' as const, content: 'Daniel avoids and Sophie feels dismissed.', scenarioNumber: 3, interviewMoment: 3 },
      {
        role: 'assistant' as const,
        content:
          "That's the end of the three described situations. Now let's shift to something more personal.\n\nHave you ever held a grudge against someone?",
        scenarioNumber: 3,
        interviewMoment: 4,
      },
      { role: 'user' as const, content: 'Grudge story about a coworker.', scenarioNumber: 3, interviewMoment: 4 },
      {
        role: 'assistant' as const,
        content: 'Tell me about a conflict with someone important — how did it get resolved?',
        scenarioNumber: 3,
        interviewMoment: 5,
      },
      {
        role: 'user' as const,
        content: 'My friend cancelled plans last minute and I felt disrespected.',
        scenarioNumber: 3,
        interviewMoment: 5,
      },
    ];
    const sliced = sliceTranscriptForScenario3Scoring(msgs);
    expect(sliced).toHaveLength(2);
    expect(sliced.map((m) => m.content).join(' ')).toContain('Daniel avoids');
    expect(sliced.map((m) => m.content).join(' ')).not.toContain('friend');
  });

  it('extractScenario3UserCorpusAfterLastRepairPrompt ignores Moment 5 conflict narrative tagged scenario 3', () => {
    const msgs = [
      { role: 'assistant' as const, content: 'How do you think this situation could be repaired?', scenarioNumber: 3, interviewMoment: 3 },
      { role: 'user' as const, content: 'Daniel should name the pattern and ask Sophie what she needs.', scenarioNumber: 3, interviewMoment: 3 },
      {
        role: 'assistant' as const,
        content: "We've finished the three situations. Have you ever held a grudge?",
        scenarioNumber: 3,
        interviewMoment: 4,
      },
      {
        role: 'assistant' as const,
        content: 'Tell me about a conflict with someone important.',
        scenarioNumber: 3,
        interviewMoment: 5,
      },
      {
        role: 'user' as const,
        content: 'My friend cancelled and I still resent the cancellation.',
        scenarioNumber: 3,
        interviewMoment: 5,
      },
    ];
    expect(extractScenario3UserCorpusAfterLastRepairPrompt(msgs)).toBe(
      'Daniel should name the pattern and ask Sophie what she needs.',
    );
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

  it('passive-aggressive read of Emma final line skips via pre-probe (register_addressed)', () => {
    const s =
      "When Emma says that last thing to him it's passive aggressive — she's not being direct.";
    expect(hasScenarioAQ1ContemptProbeCoverage(s)).toBe(false);
    expect(evaluateScenarioAQ1ContemptProbePreProbeSkip(s)).toEqual({
      skip: true,
      reason: 'register_addressed',
    });
  });

  it('deictic "that line" mis-ASR as Lotline + shutdown still skips scripted contempt probe', () => {
    const s =
      "Ryan has been doing this for a while and Emma's had enough. She's not asking him to stop. She's telling him she already knows he won't. Lotline is a shutdown, not a complaint.";
    expect(evaluateScenarioAQ1ContemptProbePreProbeSkip(s)).toEqual({
      skip: true,
      reason: 'register_addressed',
    });
    expect(hasScenarioAQ1ContemptProbeCoverage(s)).toBe(true);
  });

  it('Emma/Ryan + "not asking / already knows he won\'t" rhetoric counts as referencing final line for coverage', () => {
    const s =
      "Emma's had enough — she's not asking Ryan to stop anymore; she's telling him she already knows he won't change.";
    expect(hasScenarioAQ1ContemptProbeCoverage(s)).toBe(true);
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
    expect(evaluateScenarioAQ1ContemptProbePreProbeSkip(answer).skip).toBe(false);
    expect(hasScenarioAQ1VignetteEngagement(answer)).toBe(true);
  });

  describe('isReplyingToScenarioAQ1AfterDelivery', () => {
    const verboseAnswer =
      "Ryan shouldn't have took a 25 minute call during their date, that was disrespectful to Emma. Emma can be a little more open and honest instead of being condescending with her statement.";
    const welcomeBack =
      "Welcome back — we'll pick up where we left off. If you'd like me to repeat what I said, let me know.";
    const vignette =
      "Emma and Ryan have dinner plans. Ryan takes a call from his mother halfway through. It runs 25 minutes.";

    it('returns true after resume welcome-back when user gives substantive Scenario A answer', () => {
      expect(
        isReplyingToScenarioAQ1AfterDelivery({
          currentMoment: 1,
          contemptProbeAlreadyAsked: false,
          lastAssistantWasContemptProbe: false,
          lastAssistantWasRepair: false,
          assistantTexts: [welcomeBack],
          userAnswerText: verboseAnswer,
        })
      ).toBe(true);
    });

    it('returns true when last assistant is vignette-only delivery', () => {
      expect(
        isReplyingToScenarioAQ1AfterDelivery({
          currentMoment: 1,
          contemptProbeAlreadyAsked: false,
          lastAssistantWasContemptProbe: false,
          lastAssistantWasRepair: false,
          assistantTexts: [vignette],
          userAnswerText: verboseAnswer,
        })
      ).toBe(true);
    });

    it('returns true when Q1 is in lastQuestionText ref but not last assistant bubble', () => {
      expect(
        isReplyingToScenarioAQ1AfterDelivery({
          currentMoment: 1,
          contemptProbeAlreadyAsked: false,
          lastAssistantWasContemptProbe: false,
          lastAssistantWasRepair: false,
          assistantTexts: ['', welcomeBack, "What's going on between these two?"],
          userAnswerText: verboseAnswer,
        })
      ).toBe(true);
    });

    it('returns false after contempt probe was already asked', () => {
      expect(
        isReplyingToScenarioAQ1AfterDelivery({
          currentMoment: 1,
          contemptProbeAlreadyAsked: true,
          lastAssistantWasContemptProbe: false,
          lastAssistantWasRepair: false,
          assistantTexts: [welcomeBack],
          userAnswerText: verboseAnswer,
        })
      ).toBe(false);
    });

    it('returns true after a brief Scenario A LLM reflection before the contempt probe', () => {
      const alexAnswer =
        'I think it was a bit condescending, Emma is not expressing her real thoughts to Ryan and this can never be resolved until she does.';
      expect(
        isReplyingToScenarioAQ1AfterDelivery({
          currentMoment: 1,
          contemptProbeAlreadyAsked: false,
          lastAssistantWasContemptProbe: false,
          lastAssistantWasRepair: false,
          assistantTexts: [
            'That makes sense — Emma sounds frustrated that Ryan keeps prioritizing his family over their time together.',
          ],
          userAnswerText: alexAnswer,
        })
      ).toBe(true);
    });
  });

  describe('aggregateScenario1Moment1UserTextForContemptGate', () => {
    it('joins prior Q1 answer with a short follow-up so Emma-line pre-skip still applies', () => {
      const msgs = [
        { role: 'assistant', content: 'vignette' },
        {
          role: 'user',
          content:
            "Her comment about you've made that very clear signals she stopped expecting things to change.",
          scenarioNumber: 1,
          interviewMoment: 1,
        },
        { role: 'assistant', content: 'Welcome back — pick up where we left off.' },
        { role: 'user', content: 'Continue.', scenarioNumber: 1, interviewMoment: 1 },
      ];
      const agg = aggregateScenario1Moment1UserTextForContemptGate(msgs);
      expect(agg).toContain("you've made that very clear");
      expect(evaluateScenarioAQ1ContemptProbePreProbeSkip(agg).skip).toBe(true);
    });

    it('joins split user bubbles so Emma-line echo is detected across fragments', () => {
      const msgs = [
        { role: 'user', content: 'Her comment about you', scenarioNumber: 1, interviewMoment: 1 },
        {
          role: 'user',
          content: 'made that very clear in how she frames it toward Ryan.',
          scenarioNumber: 1,
          interviewMoment: 1,
        },
      ];
      const agg = aggregateScenario1Moment1UserTextForContemptGate(msgs);
      expect(agg).toContain('made that very clear');
      expect(evaluateScenarioAQ1ContemptProbePreProbeSkip(msgs[0]!.content).skip).toBe(false);
      expect(evaluateScenarioAQ1ContemptProbePreProbeSkip(msgs[1]!.content).skip).toBe(false);
      expect(evaluateScenarioAQ1ContemptProbePreProbeSkip(agg).skip).toBe(true);
    });
  });

  describe('evaluateScenarioAQ1ContemptProbePreProbeSkip', () => {
    it('literal quote skips with literal_quote_present', () => {
      expect(
        evaluateScenarioAQ1ContemptProbePreProbeSkip(
          "She said you've made that very clear and walked away.",
        ),
      ).toEqual({ skip: true, reason: 'literal_quote_present' });
    });

    it('skips when user echoes the line with capital Y (normalized)', () => {
      expect(
        evaluateScenarioAQ1ContemptProbePreProbeSkip(
          "What's happening is Emma feels sidelined — You've made that very clear lands as a shutdown.",
        ).skip,
      ).toBe(true);
    });

    it('skips when ASR drops the apostrophe in youve', () => {
      expect(evaluateScenarioAQ1ContemptProbePreProbeSkip(
        'Emma tells Ryan youve made that very clear and it ends the conversation.',
      ).skip).toBe(true);
    });

    it('skips for close variant really clear', () => {
      expect(
        evaluateScenarioAQ1ContemptProbePreProbeSkip(
          "I think when she says you've made that really clear she's not asking for dialogue anymore.",
        ).skip,
      ).toBe(true);
    });

    it('made + that very clear in proximity skips', () => {
      expect(
        evaluateScenarioAQ1ContemptProbePreProbeSkip(
          'The part where she made it that very clear stuck with me.',
        ),
      ).toEqual({ skip: true, reason: 'literal_quote_present' });
    });

    it('pattern tied to the line skips', () => {
      expect(
        evaluateScenarioAQ1ContemptProbePreProbeSkip(
          "That comment is about more than just this one call — it's the pattern.",
        ),
      ).toEqual({ skip: true, reason: 'pattern_interpretation_tied_to_line' });
    });

    it('generic upset-only framing does not pre-skip', () => {
      expect(
        evaluateScenarioAQ1ContemptProbePreProbeSkip(
          'Emma is frustrated and Ryan always puts family first.',
        ).skip,
      ).toBe(false);
    });

    it('generic condescending + Emma without closing-line engagement does not pre-skip (Alex session)', () => {
      const answer =
        'I think it was a bit condescending, Emma is not expressing her real thoughts to Ryan and this can never be resolved until she does.';
      expect(evaluateScenarioAQ1ContemptProbePreProbeSkip(answer)).toEqual({
        skip: false,
        reason: null,
      });
      expect(hasScenarioAQ1ContemptProbeCoverage(answer)).toBe(false);
    });
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

  it('normalizeScoresByEvidence keeps string numeric pillars when keyEvidence is empty', () => {
    const cleaned = normalizeScoresByEvidence(
      {
        mentalizing: '7',
        accountability: ' 6 ',
        contempt_recognition: null,
      },
      {},
    );
    expect(cleaned.mentalizing).toBe(7);
    expect(cleaned.accountability).toBe(6);
    expect(cleaned.contempt_recognition).toBeUndefined();
  });

  it('coerceScoreToFiniteNumber handles common model shapes', () => {
    expect(coerceScoreToFiniteNumber('8')).toBe(8);
    expect(coerceScoreToFiniteNumber('null')).toBeUndefined();
    expect(coerceScoreToFiniteNumber(null)).toBeUndefined();
    expect(coerceScoreToFiniteNumber(Number.NaN)).toBeUndefined();
  });

  it('backfillMoment4KeyEvidenceIfScoresOtherwiseUnpersistable makes all-null bundles gate-persistable', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const merged = mergeMoment4PillarScoresAfterEvidenceNormalize({});
    const row = { pillarScores: merged, keyEvidence: {} as Record<string, string> };
    expect(personalMomentBundleWasScored(row)).toBe(false);
    backfillMoment4KeyEvidenceIfScoresOtherwiseUnpersistable(row);
    expect(personalMomentBundleWasScored(row)).toBe(true);
    expect(row.keyEvidence?.mentalizing).toContain('Moment 4 incomplete model output');
    warnSpy.mockRestore();
  });

  it('mergeSalvagedMoment4PillarScoresIntoParsed recovers numerics from truncated JSON text', () => {
    const raw =
      '{"pillar_scores":{"mentalizing":null},"x":1}\nLater prose then "mentalizing": 6, "accountability": 5';
    const merged = mergeSalvagedMoment4PillarScoresIntoParsed(raw, { mentalizing: null });
    expect(merged.mentalizing).toBe(6);
    expect(merged.accountability).toBe(5);
  });

  it('mergeMoment4PillarScoresAfterEvidenceNormalize restores explicit nulls when normalize drops all numerics', () => {
    const merged = mergeMoment4PillarScoresAfterEvidenceNormalize({});
    expect(merged).toEqual({
      contempt_recognition: null,
      contempt_expression: null,
      commitment_threshold: null,
      accountability: null,
      mentalizing: null,
    });
  });

  it('mergeMoment4PillarScoresAfterEvidenceNormalize keeps surviving numeric pillars', () => {
    const merged = mergeMoment4PillarScoresAfterEvidenceNormalize({ mentalizing: 6 });
    expect(merged.mentalizing).toBe(6);
    expect(merged.contempt_recognition).toBeNull();
  });

  it('mergeMoment5PillarScoresAfterEvidenceNormalize restores explicit nulls when normalize drops all numerics', () => {
    const merged = mergeMoment5PillarScoresAfterEvidenceNormalize({});
    expect(merged).toEqual({
      accountability: null,
      mentalizing: null,
      repair: null,
      regulation: null,
      contempt_expression: null,
    });
  });

  it('mergeMoment5PillarScoresAfterEvidenceNormalize keeps surviving numeric pillars', () => {
    const merged = mergeMoment5PillarScoresAfterEvidenceNormalize({ accountability: 7 });
    expect(merged.accountability).toBe(7);
    expect(merged.mentalizing).toBeNull();
  });

  it('normalizeScoresByEvidence keeps numerics when evidence is intentionally recovered', () => {
    const cleaned = normalizeScoresByEvidence(
      { accountability: 7, mentalizing: 6 },
      {
        accountability: MOMENT4_SCORE_RECOVERED_EVIDENCE_LINE,
        mentalizing: MOMENT4_SCORE_RECOVERED_EVIDENCE_LINE,
      },
    );
    expect(cleaned.accountability).toBe(7);
    expect(cleaned.mentalizing).toBe(6);
  });

  it('fillMoment5KeyEvidenceWhenNumericScoreButMissingQuote adds recovery lines before normalize', () => {
    const row = {
      pillarScores: { accountability: 8, mentalizing: '7' } as Record<string, unknown>,
      keyEvidence: {} as Record<string, string>,
    };
    fillMoment5KeyEvidenceWhenNumericScoreButMissingQuote(row);
    expect(row.keyEvidence?.accountability).toContain('Score recovered');
    expect(row.keyEvidence?.mentalizing).toContain('Score recovered');
  });

  it('coerceScenarioScoreParsedModelRecord lifts snake_case keys', () => {
    const coerced = coerceScenarioScoreParsedModelRecord({
      pillar_scores: { mentalizing: 7, appreciation: '6' },
      key_evidence: { mentalizing: 'Named demand-withdraw.' },
    });
    expect(coerced.pillarScores.mentalizing).toBe(7);
    expect(coerced.keyEvidence.mentalizing).toContain('demand-withdraw');
  });

  it('mergeSalvagedScenarioPillarScoresIntoParsed recovers truncated scenario JSON', () => {
    const raw = '{"pillarScores":{"mentalizing":null}}\n"appreciation": 8, "repair": 6';
    const merged = mergeSalvagedScenarioPillarScoresIntoParsed(raw, ['mentalizing', 'appreciation', 'repair'], {
      mentalizing: null,
    });
    expect(merged.appreciation).toBe(8);
    expect(merged.repair).toBe(6);
  });

  it('fillScenarioKeyEvidenceWhenNumericScoreButMissingQuote uses transcript excerpt', () => {
    const row = {
      pillarScores: { mentalizing: 7 },
      keyEvidence: {} as Record<string, string>,
    };
    fillScenarioKeyEvidenceWhenNumericScoreButMissingQuote(
      ['mentalizing'],
      row,
      'Emma felt hurt when Ryan took the call.',
    );
    expect(row.keyEvidence?.mentalizing).toContain('Emma felt hurt');
    expect(row.keyEvidence?.mentalizing).not.toContain('Score recovered');
  });

  it('backfillMoment5KeyEvidenceIfScoresOtherwiseUnpersistable makes all-null bundles gate-persistable', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const merged = mergeMoment5PillarScoresAfterEvidenceNormalize({});
    const row = { pillarScores: merged, keyEvidence: {} as Record<string, string> };
    expect(personalMomentBundleWasScored(row)).toBe(false);
    backfillMoment5KeyEvidenceIfScoresOtherwiseUnpersistable(row);
    expect(personalMomentBundleWasScored(row)).toBe(true);
    expect(row.keyEvidence?.accountability).toContain('Moment 5 incomplete model output');
    warnSpy.mockRestore();
  });

  it('mergeSalvagedMoment5PillarScoresIntoParsed recovers numerics from truncated JSON text', () => {
    const raw =
      '{"pillar_scores":{"repair":null},"x":1}\nLater prose then "repair": 6, "accountability": 5';
    const merged = mergeSalvagedMoment5PillarScoresIntoParsed(raw, { repair: null });
    expect(merged.repair).toBe(6);
    expect(merged.accountability).toBe(5);
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

  it('spokenTextStartsMoment5PrimaryConflictQuestion matches first streaming sentence only', () => {
    expect(
      spokenTextStartsMoment5PrimaryConflictQuestion(
        'Think of a time when you had a conflict with someone important to you.',
      ),
    ).toBe(true);
    expect(
      spokenTextStartsMoment5PrimaryConflictQuestion(
        'Great work — what you shared about when something feels worth working through.',
      ),
    ).toBe(false);
  });

  describe('evaluateMoment5AccountabilityProbe (Moment 5 accountability probe)', () => {
    it('fires for symmetric "we both" generic answer without concrete first-person behavior', () => {
      const answer =
        "Yeah I've had conflicts before. We both had our issues in the situation and eventually things worked themselves out. I think communication is just really important in any relationship.";
      expect(evaluateMoment5AccountabilityProbe(answer)).toMatchObject({
        shouldProbe: true,
        reason: 'lacks_explicit_self_accountability',
        selfReference: {
          accountability_probe_self_reference_detected: false,
          self_reference_type: 'general_advice',
        },
      });
      expect(shouldProbeMoment5NoSelfReference(answer)).toBe(true);
    });

    it('fires for third-person-focused conflict narrative', () => {
      const answer =
        'We had a fight about money. They were totally unreasonable and kept bringing up old grievances every time we talked.';
      expect(evaluateMoment5AccountabilityProbe(answer)).toMatchObject({
        shouldProbe: true,
        reason: 'lacks_explicit_self_accountability',
      });
    });

    it('fires for conflict story with only process description and no specific first-person behavior', () => {
      const answer =
        'The conflict went in circles for a long time. We kept revisiting the same issue and they would not budge an inch. Eventually the only way forward was to slow down, repeat back what was said, and move on.';
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
      expect(evaluateMoment5AccountabilityProbe(answer)).toMatchObject({
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
      expect(evaluateMoment5AccountabilityProbe(answer)).toMatchObject({
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
      expect(evaluateMoment5AccountabilityProbe('Yeah conflicts happen sometimes.')).toMatchObject({
        shouldProbe: false,
        reason: 'too_short',
      });
    });

    it('fires when a conflict story is paired with general process language but no specific self-reference', () => {
      const answer =
        "I had a conflict with a guy at an event. I think it's important to take turns speaking and let the other person feel heard. I find it helpful to repeat back what someone said and then make a new commitment.";
      const evalResult = evaluateMoment5AccountabilityProbe(answer);
      expect(evalResult).toMatchObject({
        shouldProbe: true,
        reason: 'lacks_explicit_self_accountability',
        selfReference: {
          accountability_probe_self_reference_detected: false,
          self_reference_type: 'general_advice',
        },
      });
    });

    it('does not fire when the user anchors specific feelings or behavior in the conflict', () => {
      const answer =
        'I had a conflict with my brother. I felt hurt when he said that, got triggered, and later I realized I was being defensive.';
      expect(evaluateMoment5AccountabilitySelfReference(answer)).toMatchObject({
        accountability_probe_self_reference_detected: true,
        self_reference_type: 'specific_ownership',
      });
      expect(evaluateMoment5AccountabilityProbe(answer).shouldProbe).toBe(false);
    });

    it('fires for philosophy-style response with moderate self-ref but no conflict context (Deb pattern)', () => {
      const answer =
        "I've had that scenario many times but at this point in my life it's a conversation in a way that maybe I don't need feedback but I need you or the person to know how I feel about something and try and work through those feelings if possible with that person sometimes there is no response needed it's just a matter of I need to dump my feelings out and I need you to hear them";
      expect(shouldFireAccountabilityProbe(answer)).toBe(true);
      expect(evaluateMoment5AccountabilityProbe(answer)).toMatchObject({
        shouldProbe: true,
        reason: 'lacks_explicit_self_accountability',
      });
      expect(pickMoment5AccountabilityProbeSpokenText(answer, { griefAckPrefix: true })).toContain(
        'specific time you had a conflict'
      );
    });

    it('does not fire for specific boundary expression in the conflict story', () => {
      const answer =
        "I had a conflict with someone who criticized my coaching. I told him I would have appreciated if he were more open to my feedback, and I don't take criticism seriously from people who haven't experienced my work.";
      expect(evaluateMoment5AccountabilityProbe(answer)).toMatchObject({
        shouldProbe: false,
        reason: 'explicit_self_accountability',
        selfReference: {
          accountability_probe_self_reference_detected: true,
          self_reference_type: 'boundary_expression',
        },
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
      expect(
        looksLikeMoment5SpecificityRedirectPrompt(
          'Could you think of a specific time — maybe with a partner — and walk me through what happened?',
        ),
      ).toBe(true);
      expect(looksLikeMoment5SpecificityRedirectPrompt('What was your part in how it unfolded?')).toBe(false);
    });

    it('detects the scripted Moment 5 resolution follow-up', () => {
      expect(looksLikeMoment5ResolutionFollowUpPrompt(MOMENT_5_RESOLUTION_FOLLOWUP_TEXT)).toBe(true);
      expect(
        looksLikeMoment5ResolutionFollowUpPrompt('How did it get resolved between the two of you?'),
      ).toBe(true);
      expect(looksLikeMoment5ResolutionFollowUpPrompt(MOMENT_5_SPECIFICITY_REDIRECT_TEXT)).toBe(false);
    });

    it('transcriptHasMoment5ResolutionFollowUpAsked ignores welcome-back rows', () => {
      expect(
        transcriptHasMoment5ResolutionFollowUpAsked([
          { role: 'assistant', content: MOMENT_5_RESOLUTION_FOLLOWUP_TEXT },
        ]),
      ).toBe(true);
      expect(
        transcriptHasMoment5ResolutionFollowUpAsked([
          { role: 'assistant', content: MOMENT_5_RESOLUTION_FOLLOWUP_TEXT, isWelcomeBack: true },
        ]),
      ).toBe(false);
    });

    it('detects specificity redirect when typographic quotes appear in the same turn', () => {
      expect(
        looksLikeMoment5SpecificityRedirectPrompt(
          'Is there a specific person or situation that comes to mind when you think about \u201cconflict\u201d?',
        ),
      ).toBe(true);
    });

    it('detects philosophy-style accountability probe as specificity-redirect phase', () => {
      expect(
        looksLikeMoment5SpecificityRedirectPrompt(MOMENT_5_ACCOUNTABILITY_PROBE_PHILOSOPHY_WITH_GRIEF_ACK_TEXT),
      ).toBe(true);
    });

    it('accepts proper-name subject + conflict episode (Devanshu regression)', () => {
      const answer =
        'Devanshu called me a bad coach during a session and I got upset and judged him for walking away. It got resolved when we both shared perspectives with a facilitator.';
      expect(moment5PersonalNarrativeHasConcreteAnchor(answer)).toBe(true);
      expect(moment5ResponseIsAbstract(answer)).toBe(false);
      expect(
        shouldInjectMoment5SpecificityRedirect({
          userText: answer,
          narrativeConcrete: false,
          answeringAfterSpecificityRedirect: false,
          specificityRedirectIssued: false,
          specificityRedirectInTranscript: false,
        }),
      ).toBe(false);
    });

    it('stripEmbeddedMoment5SpecificityRedirectAsk removes a glued-in redirect from a single paragraph', () => {
      const draft =
        'Great work, Matt — what you shared comes through clearly. Can you think of a specific time — maybe with a partner, friend, or family member — and walk me through what happened? Here is one more question.';
      expect(stripEmbeddedMoment5SpecificityRedirectAsk(draft)).toBe(
        'Great work, Matt — what you shared comes through clearly. Here is one more question.',
      );
    });

    it('stripEmbeddedMoment5SpecificityRedirectAsk returns empty for a full redirect block', () => {
      expect(stripEmbeddedMoment5SpecificityRedirectAsk(MOMENT_5_SPECIFICITY_REDIRECT_TEXT)).toBe('');
    });

    it('stripEmbeddedMoment5SpecificityRedirectAsk leaves unrelated abstract answers unchanged', () => {
      const t =
        'I think the key to resolving conflict is communication. You have to be willing to have hard conversations.';
      expect(stripEmbeddedMoment5SpecificityRedirectAsk(t)).toBe(t);
    });

    it('stripMoment5SpecificityRedirectStreamingEcho leaves text unchanged when redirect was not injected', () => {
      expect(stripMoment5SpecificityRedirectStreamingEcho(MOMENT_5_SPECIFICITY_REDIRECT_TEXT, false)).toBe(
        MOMENT_5_SPECIFICITY_REDIRECT_TEXT,
      );
    });

    it('stripMoment5SpecificityRedirectStreamingEcho drops a model echo of the redirect after client inject', () => {
      expect(
        stripMoment5SpecificityRedirectStreamingEcho(
          'Can you think of a specific time — maybe with a partner, friend, or family member — and walk me through what happened?',
          true,
        ),
      ).toBeNull();
    });

    it('stripMoment5SpecificityRedirectStreamingEcho keeps accountability ask when glued after the redirect', () => {
      const glued =
        'Can you think of a specific time — maybe with a partner, friend, or family member — and walk me through what happened? What was your part in how it unfolded?';
      expect(stripMoment5SpecificityRedirectStreamingEcho(glued, true)).toBe(
        'What was your part in how it unfolded?',
      );
    });

    it('stripMoment5SpecificityRedirectStreamingEcho handles walk me thru spelling with accountability tail', () => {
      const glued =
        'Could you think of a specific time with someone close to you and walk me thru what happened? What was your part in how it unfolded?';
      expect(stripMoment5SpecificityRedirectStreamingEcho(glued, true)).toBe(
        'What was your part in how it unfolded?',
      );
    });

    it('detects common model paraphrases of the accountability probe', () => {
      expect(MOMENT_5_ACCOUNTABILITY_PROBE_TEXT).toBe(
        'What do you think you did or said that contributed to the conflict?',
      );
      expect(MOMENT_5_ACCOUNTABILITY_PROBE_WITH_GRIEF_ACK_TEXT).toContain(
        'What do you think you did or said that contributed to the conflict?',
      );
      expect(looksLikeMoment5AccountabilityProbeAssistantPrompt(MOMENT_5_ACCOUNTABILITY_PROBE_TEXT)).toBe(true);
      expect(looksLikeMoment5AccountabilityProbeAssistantPrompt('What was your part in how it all started?')).toBe(
        true,
      );
      expect(looksLikeMoment5AccountabilityProbeAssistantPrompt('What was your part in how it began?')).toBe(true);
      expect(looksLikeMoment5AccountabilityProbeAssistantPrompt(MOMENT_5_ACCOUNTABILITY_PROBE_WITH_GRIEF_ACK_TEXT)).toBe(
        true,
      );
    });

    it('does not treat conflict-validity clarification with soft your-part nudge as accountability probe', () => {
      expect(
        looksLikeMoment5AccountabilityProbeAssistantPrompt(
          "Thanks for sharing that.\n\nWas there a point it got tense between you two? or did it resolve smoothly\n\nI'd like to hear more about your part.",
        ),
      ).toBe(false);
    });

    it('stripEmbeddedMoment5AccountabilityProbeAsk removes glued accountability from a longer paragraph', () => {
      const draft =
        'Thanks for sharing that. What was your part in how it all started? What helped you two repair things after that?';
      expect(stripEmbeddedMoment5AccountabilityProbeAsk(draft)).toBe(
        'Thanks for sharing that. What helped you two repair things after that?',
      );
    });

    it('stripMoment5AccountabilityProbeStreamingEcho drops duplicate accountability after client inject', () => {
      expect(
        stripMoment5AccountabilityProbeStreamingEcho('What was your part in how it all started?', true),
      ).toBeNull();
      expect(
        stripMoment5AccountabilityProbeStreamingEcho('What was your part in how it unfolded?', true),
      ).toBeNull();
    });

    const SCENARIO_A_CONTEMPT_PROBE =
      "What about when Emma says 'you've made that very clear' — what do you make of that?";

    it('looksLikeScenarioAContemptProbeQuestion matches canonical framework copy', () => {
      expect(looksLikeScenarioAContemptProbeQuestion(SCENARIO_A_CONTEMPT_PROBE)).toBe(true);
    });

    it('looksLikeScenarioAContemptProbeQuestion matches common model paraphrase', () => {
      expect(
        looksLikeScenarioAContemptProbeQuestion(
          'What did you think when Emma said you made that very clear?',
        ),
      ).toBe(true);
      expect(
        scenarioAEmmaVeryClearContemptReask(
          "What did you think when she said you've made that very clear?",
        ),
      ).toBe(true);
    });

    it('mergeDeferredScenarioAContemptProbeLeadWithNextSentence avoids duplicating full probe', () => {
    const lead = "What about when Emma says 'you've made that very clear' —";
    const full =
      "What about when Emma says 'you've made that very clear' — what do you make of that?";
    expect(mergeDeferredScenarioAContemptProbeLeadWithNextSentence(lead, full)).toBe(full);
    expect(mergeDeferredScenarioAContemptProbeLeadWithNextSentence(lead, 'what do you make of that?')).toBe(
      `${lead} what do you make of that?`,
    );
  });

  it('isIncompleteScenarioAContemptProbeLeadSentence detects em-dash split lead', () => {
      expect(
        isIncompleteScenarioAContemptProbeLeadSentence(
          "What about when Emma says 'you've made that very clear' —",
        ),
      ).toBe(true);
      expect(isIncompleteScenarioAContemptProbeLeadSentence(SCENARIO_A_CONTEMPT_PROBE)).toBe(false);
    });

    it('stripScenarioAContemptProbeStreamingEcho drops duplicate contempt after probe already spoken', () => {
      expect(stripScenarioAContemptProbeStreamingEcho(SCENARIO_A_CONTEMPT_PROBE, true)).toBeNull();
      expect(
        stripScenarioAContemptProbeStreamingEcho(
          "What do you make of Emma's statement when she says 'you've made that very clear'?",
          true,
        ),
      ).toBeNull();
      expect(
        stripScenarioAContemptProbeStreamingEcho(
          'What did you think when Emma said you made that very clear?',
          true,
        ),
      ).toBeNull();
    });

    it('stripScenarioAContemptProbeStreamingEcho leaves text unchanged when probe was not yet spoken', () => {
      expect(stripScenarioAContemptProbeStreamingEcho(SCENARIO_A_CONTEMPT_PROBE, false)).toBe(
        SCENARIO_A_CONTEMPT_PROBE,
      );
    });

    it('SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY matches canonical framework probe', () => {
      expect(SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY).toBe(SCENARIO_A_CONTEMPT_PROBE);
      expect(looksLikeScenarioAContemptProbeQuestion(SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY)).toBe(
        true,
      );
    });

    it('scenarioAContemptProbeTtsSpokenText omits quoted Emma line for contempt-probe TTS', () => {
      expect(scenarioAContemptProbeTtsSpokenText(SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY)).toBe(
        SCENARIO_A_CONTEMPT_PROBE_TTS_SPOKEN_COPY,
      );
      expect(SCENARIO_A_CONTEMPT_PROBE_TTS_SPOKEN_COPY).not.toContain("you've made that very clear");
      expect(scenarioAContemptProbeResumeRepeatTtsText(SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY)).toBe(
        SCENARIO_A_CONTEMPT_PROBE_TTS_SPOKEN_COPY,
      );
      expect(
        scenarioAContemptProbeTtsSpokenText('How would you repair this if you were Ryan?'),
      ).toBe('How would you repair this if you were Ryan?');
    });

    it('looksLikeScenarioAContemptProbeQuestion matches deictic paraphrase from prior fix', () => {
      expect(looksLikeScenarioAContemptProbeQuestion("What do you make of Emma's response there?")).toBe(
        true,
      );
    });

    it('stripEmbeddedScenarioAContemptProbeAsk removes glued contempt from a longer paragraph', () => {
      const draft = `That makes sense. ${SCENARIO_A_CONTEMPT_PROBE} How would you repair this if you were Ryan?`;
      expect(stripEmbeddedScenarioAContemptProbeAsk(draft)).toBe(
        'That makes sense. How would you repair this if you were Ryan?',
      );
    });

    it('stripEmbeddedScenarioAContemptProbeAsk removes paraphrase contempt re-ask', () => {
      const draft =
        'What did you think when Emma said you made that very clear? That makes sense — how would you repair this if you were Ryan?';
      expect(stripEmbeddedScenarioAContemptProbeAsk(draft)).toBe(
        'That makes sense — how would you repair this if you were Ryan?',
      );
    });

    it('stripScenarioAContemptProbeQuestion removes duplicate contempt paragraphs', () => {
      const draft = `${SCENARIO_A_CONTEMPT_PROBE}\n\n${SCENARIO_A_CONTEMPT_PROBE}`;
      expect(stripScenarioAContemptProbeQuestion(draft)).toBe('');
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

    it('accepts named family + "had a conflict" + other-party behavior (sister regression)', () => {
      expect(
        moment5PersonalNarrativeHasConcreteAnchor(
          'I had a conflict with my sister. She was being completely unreasonable and eventually I had to stop engaging with her. She needed to change her behavior.',
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

    it('accepts "a co-worker" + we disagreed (hyphenated role; post-M5 redirect regression)', () => {
      expect(
        moment5PersonalNarrativeHasConcreteAnchor(
          'There was a time with a co-worker where we disagreed about how to handle a project. We just discussed it and found a solution.',
        ),
      ).toBe(true);
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

    it('detects low conflict validity for smooth boundary/logistics examples', () => {
      const answer =
        'Last week my roommate and I had a conversation about the chore schedule. We just talked it out, agreed on who would do what, and it resolved pretty smoothly.';
      expect(moment5PersonalNarrativeHasConcreteAnchor(answer)).toBe(true);
      expect(moment5ConflictValidityIsLow(answer)).toBe(true);
    });

    it('does not mark genuine rupture and repair examples as low conflict validity', () => {
      const answer =
        'Last month my partner and I had a fight about money. She was hurt, I got defensive, and we apologized later after we talked through why it had gotten so tense.';
      expect(moment5ConflictValidityIsLow(answer)).toBe(false);
      expect(moment5ResponseAddsTensionDetail(answer)).toBe(true);
    });

    it('detects the scripted conflict-validity clarification prompt', () => {
      expect(looksLikeMoment5ConflictValidityClarificationPrompt(MOMENT_5_CONFLICT_VALIDITY_CLARIFICATION_TEXT)).toBe(
        true,
      );
      expect(looksLikeMoment5ConflictValidityClarificationPrompt(MOMENT_5_SPECIFICITY_REDIRECT_TEXT)).toBe(false);
    });

    it('detects common model paraphrases of the conflict-validity clarification (no "actually" / "pretty")', () => {
      expect(
        looksLikeMoment5ConflictValidityClarificationPrompt(
          'Was there a point it got tense between you two? or did it resolve smoothly',
        ),
      ).toBe(true);
      expect(
        looksLikeMoment5ConflictValidityClarificationPrompt(
          "Thanks for sharing that.\n\nWas there a point it got tense between you two? or did it resolve smoothly\n\nI'd like to hear more about your part.",
        ),
      ).toBe(true);
    });

    it('classifies conflict validity clarification responses (three-state)', () => {
      expect(
        classifyConflictValidity('Honestly it was pretty smooth — no real tension.', ''),
      ).toBe('no_conflict');
      expect(
        classifyConflictValidity(
          'It resolved pretty smoothly after we talked.',
          'My partner was upset and I apologized for how I spoke to her.',
        ),
      ).toBe('resolved_well');
      expect(
        classifyConflictValidity(
          'Honestly it was pretty smooth — we talked it through.',
          'We had verbal altercations but eventually apologized to each other.',
        ),
      ).toBe('resolved_well');
      expect(classifyConflictValidity('Yeah it did get tense for a bit before we talked.', '')).toBe(
        'resolved_well',
      );
      expect(classifyConflictValidity('We had a hard conversation but worked through it.', '')).toBe(
        'genuine_conflict',
      );
      expect(
        classifyConflictValidity('Honestly it was pretty smooth.', 'We had verbal altercations with my sister.'),
      ).toBe('resolved_well');
      expect(classifyConflictValidity('Honestly it was pretty smooth.', '')).toBe('no_conflict');
      expect(
        classifyConflictValidity('It resolved fine after we talked.', 'We had an argument about money.'),
      ).toBe('resolved_well');
      expect(classifyConflictValidity('It was tense between us for a while.', '')).toBe('resolved_well');
    });
  });

  describe('moment5 transcript-combined anchor (M5 friend/partner redirect regression)', () => {
    const friendTurn =
      'I had a conflict with a close friend over something they did that I felt was being considered. I was upset about it for a while before I said anything.';
    const plansTurn =
      'They canceled plans last minute multiple times and I never said anything until it built up and I snapped. It came out harsher than I intended.';
    const buildupTurn =
      "I let it build up instead of saying something earlier. If I had said something the first or second time, it wouldn't have escalated.";

    it('combines interviewMoment 5 user turns only', () => {
      const tx = [
        { role: 'user', content: friendTurn, interviewMoment: 5 },
        { role: 'user', content: plansTurn, interviewMoment: 5 },
        { role: 'user', content: 'M4 grudge answer', interviewMoment: 4 },
        { role: 'assistant', content: 'prompt', interviewMoment: 5 },
      ];
      expect(combineMoment5UserTurnText(tx)).toContain('close friend');
      expect(combineMoment5UserTurnText(tx)).not.toContain('M4 grudge');
    });

    it('combineMoment5UserTextIncludingCurrent preserves prior ownership across follow-up turns', () => {
      const firstTurn =
        "He called me a bad coach and I did raise my voice at him, but it was facilitated. I listened to him, he listened to me without interruption. We're cool now.";
      const recapTurn = "I listened to him, he listened to me, and we're good now.";
      const tx = [{ role: 'user', content: firstTurn, interviewMoment: 5 }];
      const combined = combineMoment5UserTextIncludingCurrent(tx, recapTurn);
      expect(moment5AnswerHasExplicitSelfAccountability(recapTurn)).toBe(false);
      expect(moment5AnswerHasExplicitSelfAccountability(combined)).toBe(true);
      expect(evaluateMoment5AccountabilityProbe(recapTurn).shouldProbe).toBe(true);
      expect(evaluateMoment5AccountabilityProbe(combined).shouldProbe).toBe(false);
    });

    it('detects concrete anchor from earlier friend turn when latest turn is buildup-only', () => {
      const tx = [
        { role: 'user', content: friendTurn, interviewMoment: 5 },
        { role: 'user', content: plansTurn, interviewMoment: 5 },
        { role: 'user', content: buildupTurn, interviewMoment: 5 },
      ];
      expect(moment5PersonalNarrativeHasConcreteAnchor(buildupTurn)).toBe(false);
      expect(moment5TranscriptHasConcreteAnchor(tx)).toBe(true);
    });

    it('treats "I just told you" as decline and skips accountability probe eval', () => {
      expect(moment5UserDeclinesConcreteReask('I just told you.')).toBe(true);
      expect(evaluateMoment5AccountabilityProbe('I just told you.').reason).toBe('decline_or_vague_evade');
      expect(evaluateMoment5AccountabilityProbe('I just told you.').shouldProbe).toBe(false);
    });

    it('treats pushback that a specific person was already named as decline', () => {
      expect(
        moment5UserDeclinesConcreteReask('That was not a general approach, I named a specific person.'),
      ).toBe(true);
    });

    it('moment5UserOrTranscriptHasConcreteAnchor uses the current reply before transcript rows exist', () => {
      const devanshuTurn =
        'Devanshu called me a bad coach and I got upset; we resolved it with a facilitator helping us share perspectives.';
      expect(
        moment5UserOrTranscriptHasConcreteAnchor(devanshuTurn, [{ role: 'user', content: 'short', interviewMoment: 5 }]),
      ).toBe(true);
    });
  });

  describe('buildMoment5ConfusionRepeatReplayAfterPriorAnswer', () => {
    it('replays the last question sentence from the immediate interviewer line', () => {
      const replay = buildMoment5ConfusionRepeatReplayAfterPriorAnswer({
        lastInterviewerText: 'I hear you. How did it get resolved between you two?',
      });
      expect(replay).toBe('Got it — How did it get resolved between you two?');
      expect(replay).not.toContain('Think of a time when you had a conflict');
    });

    it('falls back to canonical M5 anchor when last line has no question mark', () => {
      const replay = buildMoment5ConfusionRepeatReplayAfterPriorAnswer({
        lastInterviewerText: 'Thanks for sharing that with me.',
      });
      expect(replay).toContain(MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT);
    });
  });

  describe('moment5ResponseIsAbstract (post–specificity-redirect gate)', () => {
    it('treats generic communication advice as abstract', () => {
      expect(
        moment5ResponseIsAbstract(
          'I think it is really important to listen and repeat back what you heard so the other person feels understood. Communication is the foundation of resolving any disagreement calmly.',
        ),
      ).toBe(true);
    });

    it('treats named person plus described tension as not abstract', () => {
      expect(
        moment5ResponseIsAbstract(
          'With Angel it got tense sometimes when she would say I never listen, and we had to talk it through repeatedly before we cooled off.',
        ),
      ).toBe(false);
    });

    it('treats first-person concrete behavior in conflict as not abstract', () => {
      expect(
        moment5ResponseIsAbstract(
          'During the breakup I shut down for a week and avoided her calls until she showed up at my door and we finally argued it out.',
        ),
      ).toBe(false);
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
