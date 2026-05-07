import {
  CLIENT_MENTALIZING_SURFACE_PROBE,
  CLIENT_REPAIR_REFUSAL_PROBE,
  CLIENT_SHORT_ELABORATION_PROBE,
  isClientOrElongatingInterviewProbeAssistant,
  isInterviewHardStopUserTurn,
  isRepairRefusalProbeAssistantLine,
  isScenarioCRepairPessimismRefusalSignal,
  looksLikeRepairInterviewQuestion,
  looksLikeScenarioBRepairAsJamesQuestion,
  looksLikeSurfaceOnlyEmotionalLabelAnswer,
  pickClientDisengagementProbe,
  repairAnswerShowsRefusalOrCharacterDeflection,
  scenarioALastAssistantIsRepairProbeOrFollowUp,
} from '../interviewDisengagementProbes';
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

  it('detects refusal / character-deflection repair answers', () => {
    expect(repairAnswerShowsRefusalOrCharacterDeflection("Not sure I could. He's not a good communicator.")).toBe(
      true,
    );
    expect(repairAnswerShowsRefusalOrCharacterDeflection("I'd apologize and listen.")).toBe(false);
  });

  it('Scenario C repair pessimism (long answer) picks repair refusal before threshold would apply', () => {
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
    expect(pick?.kind).toBe('repair_refusal');
    expect(pick?.probe).toBe(CLIENT_REPAIR_REFUSAL_PROBE);
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

  it('Rule 1 picks repair probe for short repair answers without extra signals', () => {
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
    expect(pick?.kind).toBe('repair_refusal');
    expect(pick?.probe).toBe(CLIENT_REPAIR_REFUSAL_PROBE);
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
    expect(isClientOrElongatingInterviewProbeAssistant(CLIENT_SHORT_ELABORATION_PROBE)).toBe(true);
    expect(isClientOrElongatingInterviewProbeAssistant('Can you say more about that?')).toBe(true);
  });
});
