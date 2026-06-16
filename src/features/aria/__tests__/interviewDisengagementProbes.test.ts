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
  stripScenarioARepairQuestion,
  stripEmbeddedScenarioARepairQuestionAsk,
  stripScenarioARepairQuestionStreamingEcho,
  isIncompleteScenarioARepairLeadSentence,
  resolveInterviewQuestionRepeatTtsText,
  userAnswerSatisfiesScenarioARepairPrompt,
  looksLikeSurfaceOnlyEmotionalLabelAnswer,
  pickClientDisengagementProbe,
  repairAnswerHasConcreteSuggestionActionOrStep,
  repairAnswerShowsRefusalOrCharacterDeflection,
  scenarioALastAssistantIsRepairProbeOrFollowUp,
  userAnswerHasSophiePerspectiveLanguage,
} from '../interviewDisengagementProbes';
import { SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY } from '../probeAndScoringUtils';
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

  it('isIncompleteScenarioARepairLeadSentence detects Ryan lead split by streaming', () => {
    expect(isIncompleteScenarioARepairLeadSentence('What if you were Ryan?')).toBe(true);
    expect(isIncompleteScenarioARepairLeadSentence('And if you were Ryan?')).toBe(true);
    expect(
      isIncompleteScenarioARepairLeadSentence(
        'What if you were Ryan? How would you repair this situation?',
      ),
    ).toBe(false);
  });

  it('resolveInterviewQuestionRepeatTtsText expands truncated Ryan repair lead', () => {
    expect(resolveInterviewQuestionRepeatTtsText('And if you were Ryan?')).toBe(
      SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY,
    );
    expect(
      resolveInterviewQuestionRepeatTtsText(
        'And if you were Ryan? How would you repair this situation?',
      ),
    ).toBe('And if you were Ryan? How would you repair this situation?');
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
      isExplicitDecline: false,
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
      isExplicitDecline: false,
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
      isExplicitDecline: false,
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
      isExplicitDecline: false,
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
      isExplicitDecline: false,
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
      isExplicitDecline: false,
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
      isExplicitDecline: false,
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
      isExplicitDecline: false,
      isAssistantRecoveryOrMetaLine: false,
      isFirstUserTurnInScenario: true,
    });
    expect(pick?.kind).toBe('mentalizing_surface');
    expect(pick?.probe).toBe(CLIENT_MENTALIZING_SURFACE_PROBE);
  });

  it('Rule 2 does not pick mentalizing on second+ user turn (generic short probe may apply instead)', () => {
    const pick = pickClientDisengagementProbe({
      userAnswer: "She's angry.",
      lastAssistantContent: "What's going on between these two?",
      wordCount: 2,
      answeringAfterProbe: false,
      exemptMetaTurn: false,
      isGreetingNameTurn: false,
      isExplicitDecline: false,
      isAssistantRecoveryOrMetaLine: false,
      isFirstUserTurnInScenario: false,
    });
    expect(pick?.kind).toBe('short_elaboration');
    expect(pick?.probe).toBe(CLIENT_SHORT_ELABORATION_PROBE);
  });

  it('does not fire short_elaboration when user asks to repeat the question', () => {
    const pick = pickClientDisengagementProbe({
      userAnswer: 'Can you repeat what you said?',
      lastAssistantContent: 'Just say whatever comes to mind.',
      wordCount: 6,
      answeringAfterProbe: false,
      exemptMetaTurn: false,
      isGreetingNameTurn: false,
      isExplicitDecline: false,
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
      isExplicitDecline: false,
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
      isExplicitDecline: false,
      isAssistantRecoveryOrMetaLine: false,
      isFirstUserTurnInScenario: true,
    });
    expect(pick).toBeNull();
  });

  it('Rule 3 does not pick short elaboration when skip_request was classified earlier in this moment', () => {
    const pick = pickClientDisengagementProbe({
      userAnswer: 'Hard to explain.',
      lastAssistantContent: 'Thanks for sharing that. At what point do you decide… work through versus walk away?',
      wordCount: 3,
      answeringAfterProbe: false,
      exemptMetaTurn: false,
      isGreetingNameTurn: false,
      isExplicitDecline: false,
      isAssistantRecoveryOrMetaLine: false,
      isFirstUserTurnInScenario: true,
      hadSkipRequestInThisMoment: true,
    });
    expect(pick).toBeNull();
  });

  it('Rule 3 picks short elaboration when other rules do not apply', () => {
    const pick = pickClientDisengagementProbe({
      userAnswer: 'Hard to explain.',
      lastAssistantContent: 'Thanks for sharing that. At what point do you decide… work through versus walk away?',
      wordCount: 3,
      answeringAfterProbe: false,
      exemptMetaTurn: false,
      isGreetingNameTurn: false,
      isExplicitDecline: false,
      isAssistantRecoveryOrMetaLine: false,
      isFirstUserTurnInScenario: true,
    });
    expect(pick?.kind).toBe('short_elaboration');
    expect(pick?.probe).toBe(CLIENT_SHORT_ELABORATION_PROBE);
  });

  it('does not chain after client repair probe', () => {
    const pick = pickClientDisengagementProbe({
      userAnswer: 'Still no.',
      lastAssistantContent: CLIENT_REPAIR_REFUSAL_PROBE,
      wordCount: 2,
      answeringAfterProbe: true,
      exemptMetaTurn: false,
      isGreetingNameTurn: false,
      isExplicitDecline: false,
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
      isExplicitDecline: false,
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
      isExplicitDecline: false,
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
      isExplicitDecline: false,
      isAssistantRecoveryOrMetaLine: false,
      isFirstUserTurnInScenario: true,
      scenarioCSophiePerspectiveProbeAlreadyFired: false,
      mentalizingSurfaceProbeAlreadyFired: false,
    });
    expect(pick).toBeNull();
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
      isExplicitDecline: false,
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
});
