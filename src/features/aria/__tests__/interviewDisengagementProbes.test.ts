import {
  CLIENT_MENTALIZING_SURFACE_PROBE,
  CLIENT_REPAIR_REFUSAL_PROBE,
  CLIENT_SHORT_ELABORATION_PROBE,
  SCENARIO_C_SOPHIE_PERSPECTIVE_PROBE,
  evaluateRepairRefusalDetection,
  findLastRepeatableInterviewQuestionText,
  isClientOrElongatingInterviewProbeAssistant,
  isInterviewHardStopUserTurn,
  isRepairRefusalProbeAssistantLine,
  isScenarioCRepairPessimismRefusalSignal,
  looksLikeRepairInterviewQuestion,
  looksLikeScenarioARepairQuestion,
  looksLikeScenarioARepairReAskQuestion,
  looksLikeScenarioBRepairAsJamesQuestion,
  shouldAdvanceScenarioAAfterSatisfiedRepair,
  findLastUserWithPriorScenarioARepairContext,
  streamMissedScenarioARepairSatisfiedHandoffDelivery,
  stripScenarioARepairQuestion,
  stripEmbeddedScenarioARepairQuestionAsk,
  cleanupScenarioWrapAfterRepairStrip,
  stripScenarioARepairQuestionStreamingEcho,
  isIncompleteScenarioARepairLeadSentence,
  looksLikeScenarioARepairStreamFragment,
  clearParallelTtsBatchIfScenarioARepairLeakBeforeContempt,
  resolveInterviewQuestionRepeatTtsText,
  shouldSuppressScenarioARepairBeforeContemptAnswer,
  userAnswerSatisfiesScenarioARepairPrompt,
  looksLikeSurfaceOnlyEmotionalLabelAnswer,
  pickClientDisengagementProbe,
  repairAnswerHasConcreteSuggestionActionOrStep,
  repairAnswerShowsRefusalOrCharacterDeflection,
  scenarioALastAssistantIsRepairProbeOrFollowUp,
  userAnswerHasSophiePerspectiveLanguage,
} from '../interviewDisengagementProbes';
import { applyPostClaudeScenarioAdvanceBundleOverride } from '../interviewScenarioAdvanceAfterRepair';
import { SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY, SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY } from '../probeAndScoringUtils';
import {
  SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL,
  SCENARIO_B_JAMES_REPAIR_CANONICAL,
  SCENARIO_B_Q1_CANONICAL,
} from '../scenarioBProbeLogic';
import { SCENARIO_C_REPAIR_QUESTION_CANONICAL } from '../scenarioCPromptDetection';
import { SCENARIO_3_TEXT } from '../interviewScenarioVignetteCopy';
import { isScenarioBRepairAsJamesQuestion } from '../scenarioBTranscriptGates';

describe('interviewDisengagementProbes', () => {
  it('Scenario B repair-as-James: matches canonical probe but not James-attunement characterization', () => {
    expect(looksLikeScenarioBRepairAsJamesQuestion('If you were James, how would you repair?')).toBe(true);
    expect(
      looksLikeScenarioBRepairAsJamesQuestion('And if you were James, how would you repair?'),
    ).toBe(true);
    expect(
      looksLikeScenarioBRepairAsJamesQuestion(
        'How would you characterize James’s approach to the conflict before things blew up?',
      ),
    ).toBe(false);
    expect(
      looksLikeScenarioBRepairAsJamesQuestion(
        "How would you describe James's approach when Sarah got upset?",
      ),
    ).toBe(false);
    expect(
      isScenarioBRepairAsJamesQuestion(
        "How would you describe James's approach when Sarah got upset?",
      ),
    ).toBe(false);
  });

  it('detects repair question prompts', () => {
    expect(
      looksLikeRepairInterviewQuestion('How would you repair this relationship if you were Ryan?'),
    ).toBe(true);
    expect(
      looksLikeScenarioARepairQuestion('What if you were Ryan? How would you repair this situation?'),
    ).toBe(true);
    expect(
      stripScenarioARepairQuestion(
        "Nice read.\n\nWhat if you were Ryan? How would you repair this situation?\n\n",
      ).trim(),
    ).toBe('Nice read.');
    expect(
      looksLikeRepairInterviewQuestion(
        'That makes a lot of sense. What if you were Ryan? How would you repair this situation',
      ),
    ).toBe(true);
    expect(looksLikeRepairInterviewQuestion('If you were James, how would you repair?')).toBe(true);
    expect(
      looksLikeRepairInterviewQuestion('How do you think this situation could be repaired?'),
    ).toBe(true);
    expect(looksLikeRepairInterviewQuestion('What do you think is going on here?')).toBe(false);
  });

  it('cleanupScenarioWrapAfterRepairStrip removes dangling and after glued repair strip', () => {
    const glued =
      "That's a wrap on Situation 1 — thanks for working through that one. Nice work, Matt — you read Emma's closing line as condescending and How would you repair this situation if you were Ryan?";
    const stripped = cleanupScenarioWrapAfterRepairStrip(stripScenarioARepairQuestion(glued));
    expect(stripped).toContain('condescending');
    expect(stripped).not.toMatch(/\band\s*$/i);
    expect(stripped).not.toContain('How would you repair');
  });

  it('isIncompleteScenarioARepairLeadSentence detects Ryan lead split by streaming', () => {
    expect(isIncompleteScenarioARepairLeadSentence('What if you were Ryan?')).toBe(true);
    expect(isIncompleteScenarioARepairLeadSentence('And if you were Ryan?')).toBe(true);
    expect(
      isIncompleteScenarioARepairLeadSentence(
        'What if you were Ryan? How would you repair this situation?',
      ),
    ).toBe(false);
    expect(
      looksLikeScenarioARepairQuestion(
        "So if you were Ryan, and you could sense something was off — how would you go about repairing this situation?",
      ),
    ).toBe(true);
    expect(
      isIncompleteScenarioARepairLeadSentence(
        "So if you were Ryan, and you could sense something was off — how would you go about repairing this situation?",
      ),
    ).toBe(false);
  });

  it('looksLikeScenarioARepairStreamFragment detects truncated Emma repair tail from session logs', () => {
    expect(looksLikeScenarioARepairStreamFragment('Makes sense. things with Emma after this?')).toBe(
      true,
    );
    expect(looksLikeScenarioARepairStreamFragment('Makes sense. this with Emma?')).toBe(true);
    expect(
      looksLikeScenarioARepairStreamFragment(
        'Makes sense. If you were Ryan, how would you repair things with Emma after this?',
      ),
    ).toBe(true);
  });

  it('clearParallelTtsBatchIfScenarioARepairLeakBeforeContempt discards armed-stream repair batch', () => {
    expect(
      clearParallelTtsBatchIfScenarioARepairLeakBeforeContempt({
        batchText: 'Makes sense. this with Emma?',
        suppressRepairBeforeContempt: true,
        streamContemptProbeMuteArmedFromStart: true,
      }),
    ).toEqual({ discarded: true, remaining: '' });
    expect(
      clearParallelTtsBatchIfScenarioARepairLeakBeforeContempt({
        batchText: 'Thanks for sharing that.',
        suppressRepairBeforeContempt: true,
        streamContemptProbeMuteArmedFromStart: true,
      }),
    ).toEqual({ discarded: true, remaining: '' });
    expect(
      clearParallelTtsBatchIfScenarioARepairLeakBeforeContempt({
        batchText: 'Thanks for sharing that.',
        suppressRepairBeforeContempt: false,
        streamContemptProbeMuteArmedFromStart: false,
      }),
    ).toEqual({ discarded: false, remaining: 'Thanks for sharing that.' });
  });

  it('shouldSuppressScenarioARepairBeforeContemptAnswer blocks repair on contempt-forcing turn', () => {
    expect(
      shouldSuppressScenarioARepairBeforeContemptAnswer({
        currentScenario: 1,
        currentMoment: 1,
        shouldForceScenarioAContemptProbe: true,
        scenarioAContemptProbeSpokenThisStream: false,
        scenarioAContemptProbeAsked: false,
        specificEmmaLineAlreadyAddressed: false,
        scenarioARepairQuestionAsked: false,
      }),
    ).toBe(true);
    expect(
      shouldSuppressScenarioARepairBeforeContemptAnswer({
        currentScenario: 1,
        currentMoment: 1,
        shouldForceScenarioAContemptProbe: false,
        scenarioAContemptProbeSpokenThisStream: true,
        scenarioAContemptProbeAsked: true,
        specificEmmaLineAlreadyAddressed: false,
        scenarioARepairQuestionAsked: false,
      }),
    ).toBe(true);
    expect(
      shouldSuppressScenarioARepairBeforeContemptAnswer({
        currentScenario: 1,
        currentMoment: 1,
        shouldForceScenarioAContemptProbe: false,
        scenarioAContemptProbeSpokenThisStream: false,
        scenarioAContemptProbeAsked: true,
        specificEmmaLineAlreadyAddressed: true,
        scenarioARepairQuestionAsked: false,
      }),
    ).toBe(false);
  });

  it('shouldSuppressScenarioARepairBeforeContemptAnswer allows repair after contempt user answer', () => {
    expect(
      shouldSuppressScenarioARepairBeforeContemptAnswer({
        currentScenario: 1,
        currentMoment: 1,
        shouldForceScenarioAContemptProbe: false,
        scenarioAContemptProbeSpokenThisStream: false,
        scenarioAContemptProbeAsked: true,
        specificEmmaLineAlreadyAddressed: false,
        scenarioARepairQuestionAsked: false,
        allowScenarioARepairAfterContemptAnswer: true,
      }),
    ).toBe(false);
  });

  it('resolveInterviewQuestionRepeatTtsText expands truncated Ryan repair lead', () => {
    expect(resolveInterviewQuestionRepeatTtsText('And if you were Ryan?')).toBe(
      SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY,
    );
    expect(
      resolveInterviewQuestionRepeatTtsText(
        'How would you repair this relationship if you were Ryan?',
      ),
    ).toBe(SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY);
  });

  it('resolveInterviewQuestionRepeatTtsText expands truncated mid-clause Ryan repair for repeat', () => {
    const truncated =
      'Got it. If you were Ryan, how would you actually repair things with Emma in';
    expect(resolveInterviewQuestionRepeatTtsText(truncated)).toBe(
      SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY,
    );
  });

  it('resolveInterviewQuestionRepeatTtsText maps Scenario A repair bleed to James repair during Scenario 2', () => {
    const truncated =
      'Got it. If you were Ryan, how would you actually repair things with Emma in';
    expect(
      resolveInterviewQuestionRepeatTtsText(truncated, { activeScenario: 2 }),
    ).toBe('Got it. And if you were James, how would you repair?');
  });

  it('resolveInterviewQuestionRepeatTtsText maps Scenario A contempt bleed to S2 Q1 during Scenario 2', () => {
    expect(
      resolveInterviewQuestionRepeatTtsText(
        "What about when Emma says 'you've made that very clear' — what do you make of that?",
        { activeScenario: 2 },
      ),
    ).toBe(SCENARIO_B_Q1_CANONICAL);
  });

  it('resolveInterviewQuestionRepeatTtsText coerces Scenario 2 James repair bleed during Scenario 3', () => {
    expect(
      resolveInterviewQuestionRepeatTtsText(SCENARIO_B_JAMES_REPAIR_CANONICAL, { activeScenario: 3 }),
    ).toBe(SCENARIO_C_REPAIR_QUESTION_CANONICAL);
  });

  it('resolveInterviewQuestionRepeatTtsText expands truncated S3→M4 boundary for repeat', () => {
    const truncated =
      'That wraps up the third situation — nice work getting through all three. [SCENARIO';
    const out = resolveInterviewQuestionRepeatTtsText(truncated, { firstName: 'Matt' });
    expect(out).toMatch(/held a grudge|really hard time with/i);
    expect(out).not.toContain('[SCENARIO');
  });

  it('resolveInterviewQuestionRepeatTtsText expands truncated M4 commitment threshold for repeat', () => {
    const truncated = 'When you think about what it takes to fully work through something';
    const out = resolveInterviewQuestionRepeatTtsText(truncated);
    expect(out).toMatch(/work through versus something you need to walk away from/i);
  });

  it('stripScenarioARepairQuestionStreamingEcho drops duplicate repair after first stream chunk', () => {
    const repair =
      'That makes a lot of sense. What if you were Ryan? How would you repair this situation?';
    expect(stripScenarioARepairQuestionStreamingEcho(repair, true)).toBeNull();
    expect(stripScenarioARepairQuestionStreamingEcho('How would you repair this situation?', true)).toBeNull();
    expect(stripScenarioARepairQuestionStreamingEcho(repair, false)).toBe(repair);
  });

  it('stripScenarioARepairQuestionStreamingEcho keeps Scenario B James repair during Scenario A echo pass', () => {
    const jamesRepair = 'And if you were James, how would you repair this?';
    expect(stripScenarioARepairQuestionStreamingEcho(jamesRepair, true)).toBe(jamesRepair);
  });

  it('stripEmbeddedScenarioARepairQuestionAsk removes glued repair from ack paragraph', () => {
    expect(
      stripEmbeddedScenarioARepairQuestionAsk(
        "That makes a lot of sense. What if you were Ryan? How would you repair this situation?",
      ),
    ).toBe('That makes a lot of sense.');
  });

  it('detects refusal / character-deflection repair answers', () => {
    expect(repairAnswerShowsRefusalOrCharacterDeflection("Not sure I could. He's not a good communicator.")).toBe(
      true,
    );
    expect(repairAnswerShowsRefusalOrCharacterDeflection("I'd apologize and listen.")).toBe(false);
  });

  it('does not pick repair refusal for long pessimism unless there is explicit refusal language', () => {
    const pick = pickClientDisengagementProbe({
      userAnswer:
        "Not sure this can be fixed — he's just not able to communicate and it's probably too far gone.",
      lastAssistantContent: 'How do you think this situation could be repaired?',
      wordCount: 22,
      answeringAfterProbe: false,
      exemptMetaTurn: false,
      isGreetingNameTurn: false,
      isAssistantRecoveryOrMetaLine: false,
      isFirstUserTurnInScenario: true,
    });
    expect(pick?.kind).not.toBe('repair_refusal');
  });

  it('isScenarioCRepairPessimismRefusalSignal matches product examples', () => {
    expect(isScenarioCRepairPessimismRefusalSignal("not sure this can be fixed")).toBe(true);
    expect(isScenarioCRepairPessimismRefusalSignal("can't be fixed at this point")).toBe(true);
    expect(isScenarioCRepairPessimismRefusalSignal("he's just not able to open up")).toBe(true);
    expect(isScenarioCRepairPessimismRefusalSignal("she doesn't know how to repair it")).toBe(true);
    expect(isScenarioCRepairPessimismRefusalSignal("probably won't work between them")).toBe(true);
    expect(isScenarioCRepairPessimismRefusalSignal('too far gone for therapy')).toBe(true);
  });

  it('isRepairRefusalProbeAssistantLine normalizes whitespace', () => {
    expect(isRepairRefusalProbeAssistantLine(`  ${CLIENT_REPAIR_REFUSAL_PROBE}  `)).toBe(true);
  });

  it('Rule 1 does not pick repair refusal for short answers with concrete repair content', () => {
    const pick = pickClientDisengagementProbe({
      userAnswer: 'I would apologize briefly.',
      lastAssistantContent: 'If you were Ryan, how would you repair this relationship?',
      wordCount: 4,
      answeringAfterProbe: false,
      exemptMetaTurn: false,
      isGreetingNameTurn: false,
      isAssistantRecoveryOrMetaLine: false,
      isFirstUserTurnInScenario: true,
    });
    expect(pick?.kind).not.toBe('repair_refusal');
  });

  it('picks repair refusal for explicit no-repair language', () => {
    const detail = evaluateRepairRefusalDetection("There's nothing to repair. That's not Daniel's responsibility.", 9);
    expect(detail).toMatchObject({
      repair_refusal_detected: true,
      trigger_condition: 'explicit_refusal',
      trigger_reason: 'explicit_refusal',
      response_word_count: 9,
      repair_refusal_anomaly: false,
    });
    const pick = pickClientDisengagementProbe({
      userAnswer: "There's nothing to repair. That's not Daniel's responsibility.",
      lastAssistantContent: 'How do you think this situation could be repaired?',
      wordCount: 9,
      answeringAfterProbe: false,
      exemptMetaTurn: false,
      isGreetingNameTurn: false,
      isAssistantRecoveryOrMetaLine: false,
      isFirstUserTurnInScenario: true,
    });
    expect(pick?.kind).toBe('repair_refusal');
    expect(pick?.probe).toBe(CLIENT_REPAIR_REFUSAL_PROBE);
  });

  it('picks repair refusal for fewer than 8 words with no repair content', () => {
    const pick = pickClientDisengagementProbe({
      userAnswer: 'They are both bad at this.',
      lastAssistantContent: 'How do you think this situation could be repaired?',
      wordCount: 6,
      answeringAfterProbe: false,
      exemptMetaTurn: false,
      isGreetingNameTurn: false,
      isAssistantRecoveryOrMetaLine: false,
      isFirstUserTurnInScenario: true,
    });
    expect(pick?.kind).toBe('repair_refusal');
    expect(pick?.kind === 'repair_refusal' ? pick.repairRefusal.trigger_condition : null).toBe('response_too_short');
  });

  it('does not pick repair refusal for short communication action', () => {
    const userAnswer = "They just talk about what's going on and go from there";
    const detail = evaluateRepairRefusalDetection(
      userAnswer,
      userAnswer.split(/\s+/).length,
      'How do you think this situation could be repaired?',
    );
    expect(detail).toMatchObject({
      repair_refusal_detected: false,
      trigger_condition: null,
      repair_refusal_anomaly: false,
      has_concrete_repair_content: true,
    });
    const pick = pickClientDisengagementProbe({
      userAnswer,
      lastAssistantContent: 'How do you think this situation could be repaired?',
      wordCount: userAnswer.split(/\s+/).length,
      answeringAfterProbe: false,
      exemptMetaTurn: false,
      isGreetingNameTurn: false,
      isAssistantRecoveryOrMetaLine: false,
      isFirstUserTurnInScenario: true,
    });
    expect(pick?.kind).not.toBe('repair_refusal');
  });

  it('picks repair refusal for pure redirect to the other party only', () => {
    const detail = evaluateRepairRefusalDetection(
      'Sophie just needs to calm down and accept that he needs time.',
      11,
      'If you were Daniel, how would you repair this?',
    );
    expect(detail).toMatchObject({
      repair_refusal_detected: true,
      trigger_condition: 'redirect_to_other_party_only',
      response_word_count: 11,
    });
  });

  it('treats Ryan voicemail/commit repair answers as concrete repair content', () => {
    const userAnswer =
      'I would make sure all calls go to voicemail during dates and commit to it.';
    expect(repairAnswerHasConcreteSuggestionActionOrStep(userAnswer)).toBe(true);
    expect(
      evaluateRepairRefusalDetection(userAnswer, userAnswer.split(/\s+/).length).has_concrete_repair_content,
    ).toBe(true);
    expect(userAnswerSatisfiesScenarioARepairPrompt(userAnswer, 'How would you repair this if you were Ryan?')).toBe(
      true,
    );
  });

  it('treats first-person Ryan sit-down / setting-boundaries answers as concrete repair content', () => {
    const userAnswer =
      "If I were Ryan, which I'm not, I would have a sit down with both my mother and with Emma. For my mother, I would be setting boundaries, letting her know that she doesn't have instant constant access to me. As for Emma, I would truly assert in how she feels, not only what's happening right in the now, I would go deeper into her emotional state and her triggering in her past to find out why this is so triggering for her.";
    expect(repairAnswerHasConcreteSuggestionActionOrStep(userAnswer)).toBe(true);
    expect(
      evaluateRepairRefusalDetection(userAnswer, userAnswer.split(/\s+/).length).has_concrete_repair_content,
    ).toBe(true);
    expect(
      userAnswerSatisfiesScenarioARepairPrompt(
        userAnswer,
        'Got it. If you were Ryan, how would you repair this?',
      ),
    ).toBe(true);
  });

  it('treats "If I\'m Ryan… I assure her…" as a satisfied Scenario A repair answer', () => {
    const userAnswer =
      "If I'm Ryan and I really liked Emma, I assure her that this would not happen again and actually follow through.";
    expect(repairAnswerHasConcreteSuggestionActionOrStep(userAnswer)).toBe(true);
    expect(
      userAnswerSatisfiesScenarioARepairPrompt(
        userAnswer,
        'Got it. If you were Ryan, how would you repair this?',
      ),
    ).toBe(true);
  });

  it('does not pick repair refusal for third-person or bilateral repair plans', () => {
    const thirdPerson =
      'Daniel could share with Sophie that he gets overwhelmed and ask for a pause instead of leaving without explanation.';
    const bilateral =
      'Both of them need to agree on a process: Daniel could name when he is flooded, Sophie could give him space, and then they should come back to finish the conversation.';

    expect(repairAnswerHasConcreteSuggestionActionOrStep(thirdPerson)).toBe(true);
    expect(repairAnswerHasConcreteSuggestionActionOrStep(bilateral)).toBe(true);
    for (const userAnswer of [thirdPerson, bilateral]) {
      const pick = pickClientDisengagementProbe({
        userAnswer,
        lastAssistantContent: 'How do you think this situation could be repaired?',
        wordCount: userAnswer.split(/\s+/).length,
        answeringAfterProbe: false,
        exemptMetaTurn: false,
        isGreetingNameTurn: false,
        isExplicitDecline: false,
        isAssistantRecoveryOrMetaLine: false,
        isFirstUserTurnInScenario: true,
      });
      expect(pick).toBeNull();
      expect(evaluateRepairRefusalDetection(userAnswer).repair_refusal_detected).toBe(false);
    }
  });

  it('does not pick repair refusal for long multi-step repair with external support', () => {
    const userAnswer =
      'I think maybe they could start by naming the pattern, then each person could explain what happens for them during the fight. If they keep getting stuck, counseling or a trusted friend could help them slow down and make an agreement for how to pause and come back.';
    expect(userAnswer.split(/\s+/).length).toBeGreaterThan(40);
    const detail = evaluateRepairRefusalDetection(userAnswer);
    expect(detail).toMatchObject({
      repair_refusal_detected: false,
      trigger_reason: null,
      repair_refusal_anomaly: false,
      has_concrete_repair_content: true,
    });
  });

  it('Rule 1 does not pick repair refusal when user hard-stops the repair answer', () => {
    const pick = pickClientDisengagementProbe({
      userAnswer: "I don't know.",
      lastAssistantContent: 'If you were Ryan, how would you repair this relationship?',
      wordCount: 3,
      answeringAfterProbe: false,
      exemptMetaTurn: false,
      isGreetingNameTurn: false,
      isAssistantRecoveryOrMetaLine: false,
      isFirstUserTurnInScenario: true,
    });
    expect(pick).toBeNull();
  });

  it('isInterviewHardStopUserTurn covers common refusals', () => {
    expect(isInterviewHardStopUserTurn('No')).toBe(true);
    expect(isInterviewHardStopUserTurn('nope')).toBe(true);
    expect(isInterviewHardStopUserTurn('nothing to add')).toBe(true);
    expect(isInterviewHardStopUserTurn('I already said what I think')).toBe(true);
    expect(isInterviewHardStopUserTurn('I would apologize and listen')).toBe(false);
  });

  it('detects Scenario A repair re-ask phrasing', () => {
    expect(
      looksLikeScenarioARepairReAskQuestion(
        'Got it — how would you make that repair actually happen as Ryan?',
      ),
    ).toBe(true);
    expect(
      looksLikeScenarioARepairReAskQuestion(
        'What would that repair look like if you were Ryan?',
      ),
    ).toBe(true);
  });

  it('treats first-person apology + commitment as satisfying Scenario A repair', () => {
    const answer =
      "I would apologize to Emma and Tyler. I shouldn't have taken that call. I commit to not doing it again unless it's an emergency.";
    expect(
      userAnswerSatisfiesScenarioARepairPrompt(
        answer,
        'What if you were Ryan? How would you repair this situation?',
      ),
    ).toBe(true);
  });

  it('advances Scenario A when model returns only Got it after a concrete repair answer', () => {
    const messages = [
      { role: 'assistant', content: 'If you were Ryan, how would you repair this?' },
      {
        role: 'user',
        content:
          "I'd start by not trying to explain the call. I say something like, I know tonight felt like another version of the same thing and I get why you were exhausted by it.",
      },
    ];
    expect(shouldAdvanceScenarioAAfterSatisfiedRepair(messages, 'Got it.', 1)).toBe(true);
  });

  it('advances Scenario A when model emits premature interview closing after satisfied repair', () => {
    const messages = [
      { role: 'assistant', content: 'If you were Ryan, how would you repair this?' },
      {
        role: 'user',
        content:
          "I'd apologize and commit to being fully present, not just apologize for the call.",
      },
    ];
    expect(
      shouldAdvanceScenarioAAfterSatisfiedRepair(
        messages,
        'Good work getting through all of this, Match. Thank you for being so open with me, Match.',
        1,
      ),
    ).toBe(true);
    expect(
      shouldAdvanceScenarioAAfterSatisfiedRepair(
        messages,
        'Got it. Good work getting through all of this, Match. Thank you for being so open with me, Match.',
        1,
      ),
    ).toBe(true);
  });

  it('advances Scenario A when sanitize leaves truncated Got it. That handoff fragment', () => {
    const messages = [
      { role: 'assistant', content: 'If you were Ryan, how would you repair this?' },
      {
        role: 'user',
        content:
          "I'd start by not trying to explain the call. She doesn't need my reasons right now. She needs to know I understand what it cost her.",
      },
    ];
    expect(shouldAdvanceScenarioAAfterSatisfiedRepair(messages, 'Got it. That', 1)).toBe(true);
    expect(shouldAdvanceScenarioAAfterSatisfiedRepair(messages, 'Got it.\n\nThat', 1)).toBe(true);
    expect(shouldAdvanceScenarioAAfterSatisfiedRepair(messages, "Got it. That situation's", 1)).toBe(
      true,
    );
    const out = applyPostClaudeScenarioAdvanceBundleOverride('Got it. That', 'Matt', messages, 1, 1);
    expect(out).toMatch(/\[SCENARIO_COMPLETE:1\]/i);
    expect(out).toMatch(/Sarah has been job hunting/i);
    const outSituation = applyPostClaudeScenarioAdvanceBundleOverride(
      "Got it. That situation's",
      'Matt',
      messages,
      1,
      1,
    );
    expect(outSituation).toMatch(/\[SCENARIO_COMPLETE:1\]/i);
    expect(outSituation).toMatch(/Sarah has been job hunting/i);
  });

  it('advances Scenario A for wraps up this situation handoff variant', () => {
    const messages = [
      { role: 'assistant', content: 'If you were Ryan, how would you repair this?' },
      {
        role: 'user',
        content:
          'From Ryan, I really liked Emma. I would assure her that this would not happen again and actually follow through.',
      },
    ];
    const handoff = 'Got it. That wraps up this situation.';
    expect(shouldAdvanceScenarioAAfterSatisfiedRepair(messages, handoff, 1)).toBe(true);
    const out = applyPostClaudeScenarioAdvanceBundleOverride(handoff, 'Matt', messages, 1, 1);
    expect(out).toMatch(/\[SCENARIO_COMPLETE:1\]/i);
    expect(out).toMatch(/Sarah has been job hunting/i);
  });

  it('advances Scenario A for wraps up the first situation handoff and should-assure repair answers', () => {
    const messages = [
      { role: 'assistant', content: 'If you were Ryan, how would you repair this?' },
      {
        role: 'user',
        content:
          "If I'm right and I really liked Emma, I should assure her that this would not happen again and actually follow through.",
      },
    ];
    const handoff = 'Got it. That wraps up the first situation.';
    expect(
      repairAnswerHasConcreteSuggestionActionOrStep(
        "If I'm right and I really liked Emma, I should assure her that this would not happen again and actually follow through.",
      ),
    ).toBe(true);
    expect(
      userAnswerSatisfiesScenarioARepairPrompt(
        "If I'm right and I really liked Emma, I should assure her that this would not happen again and actually follow through.",
        'If you were Ryan, how would you repair this?',
      ),
    ).toBe(true);
    expect(shouldAdvanceScenarioAAfterSatisfiedRepair(messages, handoff, 1)).toBe(true);
    const out = applyPostClaudeScenarioAdvanceBundleOverride(handoff, 'Matt', messages, 1, 1);
    expect(out).toMatch(/\[SCENARIO_COMPLETE:1\]/i);
    expect(out).toMatch(/Sarah has been job hunting/i);
  });

  it('advances Scenario A when model emits truncated S1 handoff without Scenario B vignette', () => {
    const messages = [
      { role: 'assistant', content: 'If you were Ryan, how would you repair this?' },
      {
        role: 'user',
        content:
          "I'd start by acknowledging what Emma lost and commit to being fully present, not just apologizing for the call.",
      },
    ];
    const draft = "Got it. That's all for that situation. On to the next one. [";
    expect(shouldAdvanceScenarioAAfterSatisfiedRepair(messages, draft, 1)).toBe(true);
    const out = applyPostClaudeScenarioAdvanceBundleOverride(draft, 'Matt', messages, 1, 1);
    expect(out).toMatch(/\[SCENARIO_COMPLETE:1\]/i);
    expect(out).toMatch(/Sarah has been job hunting/i);
    expect(out).toMatch(/What (?:I (?:got|heard)|came through) was that/i);
  });

  it('advances Scenario A when model re-asks repair after a concrete repair answer', () => {
    const messages = [
      { role: 'assistant', content: 'What if you were Ryan? How would you repair this situation?' },
      {
        role: 'user',
        content:
          "I would apologize to Emma and Tyler. I shouldn't have taken that call. I commit to not doing it again unless it's an emergency.",
      },
    ];
    expect(
      shouldAdvanceScenarioAAfterSatisfiedRepair(
        messages,
        'Got it — how would you make that repair actually happen as Ryan?',
        1,
      ),
    ).toBe(true);
    expect(
      shouldAdvanceScenarioAAfterSatisfiedRepair(
        messages,
        "She's tired of it happening.",
        1,
      ),
    ).toBe(false);
  });

  it('advances Scenario A when modal follow-up sits between repair ask and concrete repair answer', () => {
    const messages = [
      { role: 'assistant', content: 'If you were Ryan, how would you repair this?' },
      {
        role: 'assistant',
        content: "What about when Emma says 'you've made that very clear' — what do you make of that?",
      },
      { role: 'assistant', content: 'Just say whatever comes to mind.' },
      {
        role: 'user',
        content:
          'I said I would make sure all calls go to voicemail during dates with my mom and commit to it.',
      },
    ];
    expect(shouldAdvanceScenarioAAfterSatisfiedRepair(messages, '', 1)).toBe(true);
    expect(
      shouldAdvanceScenarioAAfterSatisfiedRepair(
        messages,
        'Got it. What do you make of Emma saying "you\'ve made that very clear" — is there',
        1,
      ),
    ).toBe(true);
  });

  it('advances Scenario A when contempt answer already includes concrete repair substance', () => {
    const messages = [
      { role: 'assistant', content: SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY },
      {
        role: 'user',
        content:
          "I would talk it through with her together and set a clear agreement about what is okay on dates instead of snide comments.",
      },
    ];
    expect(shouldAdvanceScenarioAAfterSatisfiedRepair(messages, 'Got it.', 1)).toBe(true);
  });

  it('advances Scenario A when model asks unauthorized Ryan preventive follow-up after satisfied repair', () => {
    const messages = [
      { role: 'assistant', content: 'If you were Ryan, how would you repair this with Emma?' },
      {
        role: 'user',
        content:
          "If I'm Ryan and I really liked Emma, I would assure her that this would not happen again and actually follow through.",
      },
    ];
    expect(
      shouldAdvanceScenarioAAfterSatisfiedRepair(
        messages,
        'Makes sense. What could Ryan have done differently in that moment — before Emma ever said anything — to avoid this getting to that point?',
        1,
      ),
    ).toBe(true);
  });

  it('findLastUserWithPriorScenarioARepairContext skips brief ack and premature closing before repair prompt', () => {
    const messages = [
      { role: 'assistant', content: 'If you were Ryan, how would you repair this?' },
      {
        role: 'assistant',
        content: 'Good work getting through all of this. Thank you for being so open with me, Matt.',
      },
      { role: 'assistant', content: 'Got it.' },
      {
        role: 'user',
        content:
          'If I were Ryan, and if I really liked Emma, I would assure her that this would not happen again and actually follow through.',
      },
    ];
    const ctx = findLastUserWithPriorScenarioARepairContext(messages);
    expect(ctx.priorRepairAssistantContent).toMatch(/how would you repair this/i);
    expect(
      shouldAdvanceScenarioAAfterSatisfiedRepair(
        messages,
        'Makes sense. What could Ryan have done differently in that moment — not the apology after, but during the dinner itself?',
        1,
      ),
    ).toBe(true);
  });

  it('findLastUserWithPriorScenarioARepairContext treats truncated Emma repair tail as repair context', () => {
    const messages = [
      { role: 'assistant', content: 'Got it. this with Emma?' },
      {
        role: 'user',
        content:
          "If I'm right and I really liked Emma, then I would assure her that this would not happen again and actually follow through.",
      },
    ];
    const ctx = findLastUserWithPriorScenarioARepairContext(messages);
    expect(ctx.priorRepairAssistantContent).toMatch(/this with Emma/i);
    expect(shouldAdvanceScenarioAAfterSatisfiedRepair(messages, '', 1)).toBe(true);
    expect(
      shouldAdvanceScenarioAAfterSatisfiedRepair(
        messages,
        'Makes sense. What could Ryan have done differently to avoid the situation getting to this point?',
        1,
      ),
    ).toBe(true);
  });

  it('streamMissedScenarioARepairSatisfiedHandoffDelivery when stream spoke only Makes sense.', () => {
    const messages = [
      { role: 'assistant', content: 'If you were Ryan, how would you repair this?' },
      { role: 'assistant', content: 'Got it.' },
      {
        role: 'user',
        content:
          'If I were Ryan, and if I really liked Emma, I would assure her that this would not happen again and actually follow through.',
      },
    ];
    const bundle =
      '[SCENARIO_COMPLETE:1]\n\nReflection. Sarah has been job hunting for six months.';
    expect(
      streamMissedScenarioARepairSatisfiedHandoffDelivery('Makes sense.', bundle, messages, 1),
    ).toBe(true);
    expect(
      streamMissedScenarioARepairSatisfiedHandoffDelivery(bundle, bundle, messages, 1),
    ).toBe(false);
  });

  it('advances Scenario A when model re-asks contempt probe after a concrete repair answer', () => {
    const messages = [
      { role: 'assistant', content: 'What would you do to repair this if you were Ryan?' },
      {
        role: 'user',
        content:
          'I would apologize and make sure all my calls go to voicemail during dates and I\'ll commit to it.',
      },
    ];
    expect(
      shouldAdvanceScenarioAAfterSatisfiedRepair(
        messages,
        'What do you think Emma meant when she said "you\'ve made that very clear"?',
        1,
      ),
    ).toBe(true);
    expect(
      shouldAdvanceScenarioAAfterSatisfiedRepair(
        messages,
        'What did you make of Emma\'s closing line — "I know, you\'ve made that very clear"?',
        1,
      ),
    ).toBe(true);
    expect(
      shouldAdvanceScenarioAAfterSatisfiedRepair(
        messages,
        'How do you read Emma\'s closing line — "I know, you\'ve made that very clear"?',
        1,
      ),
    ).toBe(true);
    expect(
      shouldAdvanceScenarioAAfterSatisfiedRepair(
        messages,
        'What\'s going on for Emma when she says "you\'ve made that very clear"?',
        1,
      ),
    ).toBe(true);
    expect(
      shouldAdvanceScenarioAAfterSatisfiedRepair(
        messages,
        'Reading that last line Emma says — "I know, you\'ve made that very clear" — how does that land for you?',
        1,
      ),
    ).toBe(true);
    expect(
      shouldAdvanceScenarioAAfterSatisfiedRepair(messages, '', 1),
    ).toBe(true);
  });

  it('advances Scenario A when model emits truncated situation-done reflection without Scenario B vignette', () => {
    const messages = [
      { role: 'assistant', content: 'If you were Ryan, how would you repair this?' },
      {
        role: 'user',
        content:
          "I'd start by not trying to explain the call. She needs to know I understand what it cost her and commit to being fully present.",
      },
    ];
    const draft = "That situation's done — good work. What I heard";
    expect(shouldAdvanceScenarioAAfterSatisfiedRepair(messages, draft, 1)).toBe(true);
    const out = applyPostClaudeScenarioAdvanceBundleOverride(draft, 'Matt', messages, 1, 1);
    expect(out).toMatch(/\[SCENARIO_COMPLETE:1\]/i);
    expect(out).toMatch(/Sarah has been job hunting/i);
  });

  it('advances Scenario A when model returns incomplete wrap without Scenario B vignette after repair', () => {
    const messages = [
      { role: 'assistant', content: 'How would you repair this if you were Ryan?' },
      {
        role: 'user',
        content:
          'I want to apologize and commit that all calls go to voicemail during dates, set proper boundaries with my mom, and commit to that.',
      },
    ];
    expect(
      shouldAdvanceScenarioAAfterSatisfiedRepair(
        messages,
        "That's a wrap on this scenario. Nice work, Matt — you read Emma",
        1,
      ),
    ).toBe(true);
    expect(
      shouldAdvanceScenarioAAfterSatisfiedRepair(
        messages,
        "That's a wrap on this scenario. Nice work, Matt — you read Emma well.\n\nSarah has been job hunting for six months.",
        1,
      ),
    ).toBe(false);
  });

  it('scenarioALastAssistantIsRepairProbeOrFollowUp matches repair re-asks and thin repeat offers (not elongating-only)', () => {
    expect(scenarioALastAssistantIsRepairProbeOrFollowUp('Can you say more about that?')).toBe(false);
    expect(
      scenarioALastAssistantIsRepairProbeOrFollowUp(
        'Got it — how would you make that repair actually happen as Ryan?',
      ),
    ).toBe(true);
    expect(
      scenarioALastAssistantIsRepairProbeOrFollowUp('Would it help to hear the scenario again?'),
    ).toBe(true);
    expect(scenarioALastAssistantIsRepairProbeOrFollowUp("What's going on between these two?")).toBe(false);
    expect(scenarioALastAssistantIsRepairProbeOrFollowUp(CLIENT_MENTALIZING_SURFACE_PROBE)).toBe(false);
  });

  it('Rule 2 picks mentalizing probe for surface emotional labels (under 15 words)', () => {
    const pick = pickClientDisengagementProbe({
      userAnswer: "She's angry and he's upset.",
      lastAssistantContent: "What's going on between these two?",
      wordCount: 6,
      answeringAfterProbe: false,
      exemptMetaTurn: false,
      isGreetingNameTurn: false,
      isAssistantRecoveryOrMetaLine: false,
      isFirstUserTurnInScenario: true,
    });
    expect(pick?.kind).toBe('mentalizing_surface');
    expect(pick?.probe).toBe(CLIENT_MENTALIZING_SURFACE_PROBE);
  });

  it('Rule 2 picks mentalizing for standalone labels (clueless, frustrated) on first scenario turn', () => {
    const pick = pickClientDisengagementProbe({
      userAnswer: 'Clueless and frustrated.',
      lastAssistantContent: 'What do you think is going on here?',
      wordCount: 3,
      answeringAfterProbe: false,
      exemptMetaTurn: false,
      isGreetingNameTurn: false,
      isAssistantRecoveryOrMetaLine: false,
      isFirstUserTurnInScenario: true,
    });
    expect(pick?.kind).toBe('mentalizing_surface');
    expect(pick?.probe).toBe(CLIENT_MENTALIZING_SURFACE_PROBE);
  });

  it('Rule 2 does not pick mentalizing on second+ user turn', () => {
    const pick = pickClientDisengagementProbe({
      userAnswer: "She's angry.",
      lastAssistantContent: "What's going on between these two?",
      wordCount: 2,
      answeringAfterProbe: false,
      exemptMetaTurn: false,
      isGreetingNameTurn: false,
      isAssistantRecoveryOrMetaLine: false,
      isFirstUserTurnInScenario: false,
    });
    expect(pick).toBeNull();
  });

  it('does not fire short elaboration when user asks to repeat the question', () => {
    const pick = pickClientDisengagementProbe({
      userAnswer: 'Can you repeat what you said?',
      lastAssistantContent: 'Just say whatever comes to mind.',
      wordCount: 6,
      answeringAfterProbe: false,
      exemptMetaTurn: false,
      isGreetingNameTurn: false,
      isAssistantRecoveryOrMetaLine: false,
      isFirstUserTurnInScenario: false,
    });
    expect(pick).toBeNull();
  });

  it('surface label helper rejects causal reasoning (because)', () => {
    expect(looksLikeSurfaceOnlyEmotionalLabelAnswer("She's angry because he lied.")).toBe(false);
  });

  it('Rule 2 does not pick mentalizing when word count is 15+ even if emotional labels are thin', () => {
    const pick = pickClientDisengagementProbe({
      userAnswer:
        "She's angry and he's upset and they're both frustrated with each other and it's tense.",
      lastAssistantContent: "What's going on between these two?",
      wordCount: 18,
      answeringAfterProbe: false,
      exemptMetaTurn: false,
      isGreetingNameTurn: false,
      isAssistantRecoveryOrMetaLine: false,
      isFirstUserTurnInScenario: true,
    });
    expect(pick).toBeNull();
  });

  it('Rule 3 does not use generic elongation on Moment 4 grudge prompt (client injects specificity first)', () => {
    const pick = pickClientDisengagementProbe({
      userAnswer: 'Not really.',
      lastAssistantContent:
        "Have you ever held a grudge against someone, or had someone in your life you really didn't like? How did that happen, and where are you with it now?",
      wordCount: 2,
      answeringAfterProbe: false,
      exemptMetaTurn: false,
      isGreetingNameTurn: false,
      isAssistantRecoveryOrMetaLine: false,
      isFirstUserTurnInScenario: true,
    });
    expect(pick).toBeNull();
  });

  it('Rule 3 does not fire short elaboration on thin personal-moment answers', () => {
    const pick = pickClientDisengagementProbe({
      userAnswer: 'Hard to explain.',
      lastAssistantContent: 'Thanks for sharing that. At what point do you decide… work through versus walk away?',
      wordCount: 3,
      answeringAfterProbe: false,
      exemptMetaTurn: false,
      isGreetingNameTurn: false,
      isAssistantRecoveryOrMetaLine: false,
      isFirstUserTurnInScenario: true,
    });
    expect(pick).toBeNull();
  });

  it('does not chain after client repair probe', () => {
    const pick = pickClientDisengagementProbe({
      userAnswer: 'Still no.',
      lastAssistantContent: CLIENT_REPAIR_REFUSAL_PROBE,
      wordCount: 2,
      answeringAfterProbe: true,
      exemptMetaTurn: false,
      isGreetingNameTurn: false,
      isAssistantRecoveryOrMetaLine: false,
      isFirstUserTurnInScenario: true,
    });
    expect(pick).toBeNull();
  });

  it('recognizes client probe assistants for chaining guard', () => {
    expect(isClientOrElongatingInterviewProbeAssistant(CLIENT_REPAIR_REFUSAL_PROBE)).toBe(true);
    expect(isClientOrElongatingInterviewProbeAssistant(CLIENT_MENTALIZING_SURFACE_PROBE)).toBe(true);
    expect(isClientOrElongatingInterviewProbeAssistant(SCENARIO_C_SOPHIE_PERSPECTIVE_PROBE)).toBe(true);
    expect(isClientOrElongatingInterviewProbeAssistant(CLIENT_SHORT_ELABORATION_PROBE)).toBe(true);
    expect(isClientOrElongatingInterviewProbeAssistant('Can you say more about that?')).toBe(true);
  });

  const SCENARIO_C_Q1_PROMPT =
    "When Daniel comes back and says 'I didn't know what to say' — what do you make of that?";

  it('Scenario C Q1 Sophie perspective probe fires for Daniel-focused Q1 answer without Sophie inference', () => {
    const answer =
      "He feels put on the spot and he's buying time to figure out what to say — Daniel probably needs a moment before he can face her.";
    const pick = pickClientDisengagementProbe({
      userAnswer: answer,
      lastAssistantContent: SCENARIO_C_Q1_PROMPT,
      wordCount: answer.trim().split(/\s+/).length,
      answeringAfterProbe: false,
      exemptMetaTurn: false,
      isGreetingNameTurn: false,
      isAssistantRecoveryOrMetaLine: false,
      isFirstUserTurnInScenario: true,
      scenarioCSophiePerspectiveProbeAlreadyFired: false,
      mentalizingSurfaceProbeAlreadyFired: false,
    });
    expect(pick?.kind).toBe('scenario_c_sophie_perspective');
    expect(pick?.probe).toBe(SCENARIO_C_SOPHIE_PERSPECTIVE_PROBE);
  });

  it('Scenario C Q1 Sophie perspective probe does not fire when user already mentions Sophie experience', () => {
    const answer =
      "Daniel feels overwhelmed when he comes back, and Sophie has probably felt abandoned each time he leaves — waiting for him to finally stay.";
    const pick = pickClientDisengagementProbe({
      userAnswer: answer,
      lastAssistantContent: SCENARIO_C_Q1_PROMPT,
      wordCount: answer.trim().split(/\s+/).length,
      answeringAfterProbe: false,
      exemptMetaTurn: false,
      isGreetingNameTurn: false,
      isAssistantRecoveryOrMetaLine: false,
      isFirstUserTurnInScenario: true,
      scenarioCSophiePerspectiveProbeAlreadyFired: false,
      mentalizingSurfaceProbeAlreadyFired: false,
    });
    expect(pick).toBeNull();
    expect(userAnswerHasSophiePerspectiveLanguage(answer)).toBe(true);
  });

  it('Scenario C Q1 Sophie perspective probe does not fire for misplaced repair answer', () => {
    const answer =
      'They should sit down and make a plan — maybe couples therapy and ground rules for timeouts so both feel heard and can repair this pattern over time together.';
    const pick = pickClientDisengagementProbe({
      userAnswer: answer,
      lastAssistantContent: SCENARIO_C_Q1_PROMPT,
      wordCount: answer.trim().split(/\s+/).length,
      answeringAfterProbe: false,
      exemptMetaTurn: false,
      isGreetingNameTurn: false,
      isAssistantRecoveryOrMetaLine: false,
      isFirstUserTurnInScenario: true,
      scenarioCSophiePerspectiveProbeAlreadyFired: false,
      mentalizingSurfaceProbeAlreadyFired: false,
    });
    expect(pick).toBeNull();
  });

  it('Scenario C Q1 Sophie perspective probe fires on resume when answering Q1 after prior S3 user turns', () => {
    const answer =
      "Daniel felt genuinely at a loss about what to say next. He had some unresolved things that he wanted to say out loud, but he doesn't know how to say them.";
    const pick = pickClientDisengagementProbe({
      userAnswer: answer,
      lastAssistantContent: SCENARIO_C_Q1_PROMPT,
      wordCount: answer.trim().split(/\s+/).length,
      answeringAfterProbe: false,
      exemptMetaTurn: false,
      isGreetingNameTurn: false,
      isAssistantRecoveryOrMetaLine: false,
      isFirstUserTurnInScenario: false,
      scenarioCSophiePerspectiveProbeAlreadyFired: false,
      mentalizingSurfaceProbeAlreadyFired: false,
    });
    expect(pick?.kind).toBe('scenario_c_sophie_perspective');
    expect(pick?.probe).toBe(SCENARIO_C_SOPHIE_PERSPECTIVE_PROBE);
  });

  it('Scenario C Q1 Sophie perspective probe does not fire when mentalizing surface probe already fired', () => {
    const answer =
      "He feels put on the spot and he's buying time to figure out what to say — Daniel probably needs a moment before he can face her.";
    const pick = pickClientDisengagementProbe({
      userAnswer: answer,
      lastAssistantContent: SCENARIO_C_Q1_PROMPT,
      wordCount: answer.trim().split(/\s+/).length,
      answeringAfterProbe: false,
      exemptMetaTurn: false,
      isGreetingNameTurn: false,
      isAssistantRecoveryOrMetaLine: false,
      isFirstUserTurnInScenario: true,
      scenarioCSophiePerspectiveProbeAlreadyFired: false,
      mentalizingSurfaceProbeAlreadyFired: true,
    });
    expect(pick).toBeNull();
  });
});

describe('findLastRepeatableInterviewQuestionText', () => {
  it('skips elongating and meta-comment probes and returns prior scenario question', () => {
    const scenarioQuestion =
      "Here's the first situation:\n\nEmma and Ryan have dinner plans. What's going on between these two?";
    const messages = [
      { role: 'assistant', content: scenarioQuestion },
      { role: 'assistant', content: 'Just say whatever comes to mind.' },
      { role: 'user', content: 'Hello?' },
      { role: 'assistant', content: 'Can you say more about that?' },
    ];
    expect(findLastRepeatableInterviewQuestionText(messages, 'Can you say more about that?')).toBe(
      scenarioQuestion,
    );
  });

  it('skips standalone personal disclosure ack and returns prior substantive question', () => {
    const grudgeQuestion =
      "Think of someone you've had a really hard time with — maybe a falling out, a grudge, or just someone who got under your skin. Tell me what happened there, and where things stand now.";
    const messages = [
      { role: 'assistant', content: grudgeQuestion },
      { role: 'user', content: 'I had a fight with my friend Devonciu about coaching.' },
      { role: 'assistant', content: 'Thank you for sharing that, Matt.' },
    ];
    expect(findLastRepeatableInterviewQuestionText(messages, 'Thank you for sharing that, Matt.')).toBe(
      grudgeQuestion,
    );
  });

  it('skips full Scenario B vignette intro and returns the latest probe question', () => {
    const sarahIntro =
      'Sarah has been job hunting for four months. She gets an offer and calls James from the street, too excited to wait. James is on a deadline, says that is amazing, let us celebrate tonight. What do you think is going on here?';
    const followUp = 'What could James have done differently before the fight started?';
    const messages = [
      { role: 'assistant', content: sarahIntro },
      { role: 'user', content: 'James led with logistics.' },
      { role: 'assistant', content: followUp },
    ];
    expect(findLastRepeatableInterviewQuestionText(messages, sarahIntro)).toBe(followUp);
  });

  it('coerces truncated Scenario B James Q2 on resume replay', () => {
    const sarahIntro =
      'Sarah has been job hunting for four months. She gets an offer and calls James from the street, too excited to wait. James is on a deadline. What do you think is going on here?';
    const truncated = "That's a real read on it. What could James";
    const messages = [
      { role: 'assistant', content: sarahIntro },
      { role: 'user', content: 'Sarah wanted to feel celebrated.' },
      { role: 'assistant', content: truncated },
    ];
    expect(findLastRepeatableInterviewQuestionText(messages, truncated)).toBe(
      `That's a real read on it. ${SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL}`,
    );
  });

  it('after Sophie impact is answered, resume replay offers Scenario C repair Q2 not the premature wrap', () => {
    const sophieProbe =
      'What do you think this pattern of leaving has been like for Sophie over time?';
    const prematureWrap = "That's a wrap on this one — thanks for going deep there.";
    const messages = [
      { role: 'assistant', content: sophieProbe },
      { role: 'user', content: 'It has been frustrating for her over time.' },
      { role: 'assistant', content: prematureWrap },
    ];
    expect(findLastRepeatableInterviewQuestionText(messages, prematureWrap)).toBe(
      SCENARIO_C_REPAIR_QUESTION_CANONICAL,
    );
  });

  it('skips Scenario 2 James repair in transcript when Scenario 3 is active', () => {
    const repairQ2 = 'Got it. How do you think this situation can be repaired?';
    const messages = [
      { role: 'assistant', content: SCENARIO_B_JAMES_REPAIR_CANONICAL },
      { role: 'assistant', content: SCENARIO_3_TEXT },
      { role: 'user', content: 'Daniel avoids conflict.' },
      { role: 'assistant', content: repairQ2 },
      { role: 'user', content: 'Repeat what you said.' },
      { role: 'assistant', content: SCENARIO_B_JAMES_REPAIR_CANONICAL },
    ];
    expect(
      findLastRepeatableInterviewQuestionText(messages, SCENARIO_B_JAMES_REPAIR_CANONICAL, {
        activeScenario: 3,
      }),
    ).toBe(SCENARIO_C_REPAIR_QUESTION_CANONICAL);
  });

  it('skips S1 contempt bleed and falls back to S2 Q1 when Scenario 2 is active', () => {
    const emmaContempt = SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY;
    const messages = [
      { role: 'assistant', content: 'If you were Ryan, how would you repair this?', scenarioNumber: 1 },
      { role: 'user', content: 'I would apologize and put the phone away.', scenarioNumber: 1 },
      { role: 'assistant', content: emmaContempt, scenarioNumber: 2 },
      { role: 'user', content: 'Can you repeat?', scenarioNumber: 2 },
    ];
    expect(
      findLastRepeatableInterviewQuestionText(messages, emmaContempt, {
        activeScenario: 2,
      }),
    ).toBe(SCENARIO_B_Q1_CANONICAL);
  });
});
