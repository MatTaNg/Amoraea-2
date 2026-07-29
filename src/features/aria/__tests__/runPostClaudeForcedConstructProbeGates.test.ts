import { describe, expect, it } from '@jest/globals';

import { runPostClaudeForcedConstructProbeGates } from '@features/aria/runPostClaudeForcedConstructProbeGates';
import { SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY } from '@features/aria/probeAndScoringUtils';
import { SCENARIO_C_REPAIR_QUESTION_CANONICAL } from '@features/aria/scenarioCPromptDetection';
import {
  createMockPostClaudeDeps,
  createMockPostClaudeParams,
  createMockSanitizeDraftResult,
  createMockSpeakAssistantTurn,
} from './postClaudeGateTestHelpers';

describe('runPostClaudeForcedConstructProbeGates', () => {
  it('returns handled:false when no forced probe flags are set', async () => {
    const deps = createMockPostClaudeDeps();
    const params = createMockPostClaudeParams();
    const speak = createMockSpeakAssistantTurn();
    const draft = createMockSanitizeDraftResult();

    const result = await runPostClaudeForcedConstructProbeGates(
      deps,
      params,
      'Thanks Alex.',
      draft,
      false,
      speak,
    );

    expect(result).toEqual({
      handled: false,
      strippedText: draft.strippedText,
      scenarioBSkippedJamesIntermediate: false,
      needsScenarioBJamesDifferentlyInsert: false,
    });
    expect(deps.speakTextSafe).not.toHaveBeenCalled();
    expect(speak).not.toHaveBeenCalled();
  });

  it('forces S1 contempt probe when shouldForceScenarioAContemptProbe is true', async () => {
    const deps = createMockPostClaudeDeps({
      scenarioAContemptProbeAskedRef: { current: false },
      scenarioAContemptProbeTtsDeliveredSessionRef: { current: false },
    });
    const params = createMockPostClaudeParams({
      shouldForceScenarioAContemptProbe: true,
      trimmed: 'I think Ryan was wrong.',
      messagesToUse: [{ role: 'user', content: 'I think Ryan was wrong.' }],
    });
    const speak = createMockSpeakAssistantTurn();
    const draft = createMockSanitizeDraftResult({
      strippedText: 'I hear you.',
    });

    const result = await runPostClaudeForcedConstructProbeGates(
      deps,
      params,
      'I hear you.',
      draft,
      false,
      speak,
    );

    expect(result.handled).toBe(true);
    expect(deps.scenarioAContemptProbeAskedRef.current).toBe(true);
    expect(deps.setMessages).toHaveBeenCalled();
    expect(deps.speakTextSafe).toHaveBeenCalledWith(
      expect.stringContaining(SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY.slice(0, 30)),
      expect.any(Object),
    );
    expect(deps.setVoiceState).toHaveBeenCalledWith('idle');
  });

  it('forces S2 appreciation probe when shouldForceScenarioBFullAppreciationProbe is true', async () => {
    const deps = createMockPostClaudeDeps();
    const params = createMockPostClaudeParams({
      shouldForceScenarioBFullAppreciationProbe: true,
      trimmed: 'James should have listened more.',
      messagesToUse: [{ role: 'user', content: 'James should have listened more.' }],
    });
    const speak = createMockSpeakAssistantTurn();
    const draft = createMockSanitizeDraftResult({ strippedText: 'I hear you.' });

    const result = await runPostClaudeForcedConstructProbeGates(
      deps,
      params,
      'I hear you.',
      draft,
      false,
      speak,
    );

    expect(result.handled).toBe(true);
    expect(deps.speakTextSafe).toHaveBeenCalledWith(
      expect.stringMatching(/James could'?ve done differently/i),
      expect.any(Object),
    );
    expect(deps.setVoiceState).toHaveBeenCalledWith('idle');
  });

  it('forces M4 threshold probe when model paraphrase was stripped for forced inject', async () => {
    const deps = createMockPostClaudeDeps({
      currentInterviewMomentRef: { current: 4 },
      moment4ThresholdProbeAskedRef: { current: false },
    });
    const params = createMockPostClaudeParams({
      shouldForceMoment4ThresholdProbe: true,
      elongatingSuppressedForUserTurn: true,
      trimmed:
        'I had a fight with my friend Devonciu. We talked it through and see eye to eye.',
    });
    const speak = createMockSpeakAssistantTurn();
    const modelParaphrase =
      'How do you decide when something like that is worth working through versus just walking away from?';
    const draft = createMockSanitizeDraftResult({
      strippedText: '',
      assistantIssuedMoment4AnyQuestion: false,
      assistantIssuedMoment4ThresholdProbe: false,
    });

    const result = await runPostClaudeForcedConstructProbeGates(
      deps,
      params,
      modelParaphrase,
      draft,
      false,
      speak,
    );

    expect(result.handled).toBe(true);
    expect(deps.moment4ThresholdProbeAskedRef.current).toBe(true);
    expect(speak).toHaveBeenCalledWith(
      expect.stringMatching(/work through versus.*walk away/i),
      expect.objectContaining({ forceSpeakDespiteParallelStream: true }),
    );
  });

  it('forces M4 threshold probe when shouldForceMoment4ThresholdProbe is true', async () => {
    const deps = createMockPostClaudeDeps({
      moment4ThresholdProbeAskedRef: { current: false },
    });
    const params = createMockPostClaudeParams({
      shouldForceMoment4ThresholdProbe: true,
      trimmed: 'I would walk away when trust is gone.',
    });
    const speak = createMockSpeakAssistantTurn();
    const draft = createMockSanitizeDraftResult({ strippedText: '' });

    const result = await runPostClaudeForcedConstructProbeGates(
      deps,
      params,
      'Some model text',
      draft,
      false,
      speak,
    );

    expect(result.handled).toBe(true);
    expect(deps.moment4ThresholdProbeAskedRef.current).toBe(true);
    expect(speak).toHaveBeenCalledWith(
      expect.stringMatching(/work through versus.*walk away/i),
      expect.objectContaining({ forceSpeakDespiteParallelStream: true }),
    );
    expect(deps.setVoiceState).toHaveBeenCalledWith('idle');
  });

  it('forces M4 threshold probe after specificity inject when user answers specificity follow-up', async () => {
    const deps = createMockPostClaudeDeps({
      currentInterviewMomentRef: { current: 4 },
      moment4ThresholdProbeAskedRef: { current: false },
      moment4ClientSpecificityProbeInjectedRef: { current: true },
    });
    const grudgeAnswer =
      'Yeah, I had a close friend who betrayed me by sharing something in confidence. We talked it out but it changed the friendship.';
    const params = createMockPostClaudeParams({
      shouldForceMoment4ThresholdProbe: true,
      trimmed: 'I just gave you one',
      messagesToUse: [
        { role: 'assistant', content: 'Think of someone you had a hard time with…' },
        { role: 'user', content: grudgeAnswer },
        {
          role: 'assistant',
          content:
            "Can you think of a specific person — even if it's just someone from a while back — and tell me a bit more about what happened?",
        },
        { role: 'user', content: 'I just gave you one' },
      ],
    });
    const speak = createMockSpeakAssistantTurn();
    const draft = createMockSanitizeDraftResult({
      strippedText: "You're right, my mistake. You gave me the friend who shared",
      assistantIssuedMoment4AnyQuestion: false,
      assistantIssuedMoment4ThresholdProbe: false,
    });

    const result = await runPostClaudeForcedConstructProbeGates(
      deps,
      params,
      draft.strippedText,
      draft,
      false,
      speak,
    );

    expect(result?.handled).toBe(true);
    expect(deps.moment4ThresholdProbeAskedRef.current).toBe(true);
    expect(speak).toHaveBeenCalledWith(
      expect.stringMatching(/work through versus.*walk away/i),
      expect.objectContaining({ forceSpeakDespiteParallelStream: true }),
    );
    expect(speak).not.toHaveBeenCalledWith(
      expect.stringMatching(/my mistake/i),
      expect.anything(),
    );
  });

  it('defers M4 threshold probe when the model asked a grudge elaboration follow-up', async () => {
    const deps = createMockPostClaudeDeps({
      currentInterviewMomentRef: { current: 4 },
      moment4ThresholdProbeAskedRef: { current: false },
    });
    const params = createMockPostClaudeParams({
      shouldForceMoment4ThresholdProbe: true,
      trimmed:
        "my ex complete narcissist manipulative and selfish I have nothing to say to him ever again",
    });
    const speak = createMockSpeakAssistantTurn();
    const elaborationFollowUp =
      'Got it. Can you tell me a bit more about what actually happened between you two — like a';
    const draft = createMockSanitizeDraftResult({
      strippedText: elaborationFollowUp,
      assistantIssuedMoment4AnyQuestion: true,
      assistantIssuedMoment4ThresholdProbe: false,
    });

    const result = await runPostClaudeForcedConstructProbeGates(
      deps,
      params,
      elaborationFollowUp,
      draft,
      false,
      speak,
    );

    expect(result?.handled).toBe(false);
    expect(deps.moment4ThresholdProbeAskedRef.current).toBe(false);
    expect(speak).not.toHaveBeenCalled();
  });

  it('forces S3 repair Q2 even when sanitize already injected repair copy and parallel stream spoke M4', async () => {
    const deps = createMockPostClaudeDeps({
      currentInterviewMomentRef: { current: 3 },
      currentScenarioRef: { current: 3 },
    });
    const sophieProbe =
      "I'm with you. What do you think this pattern of leaving has been like for Sophie over time?";
    const params = createMockPostClaudeParams({
      shouldForceScenarioCRepairProbe: true,
      trimmed:
        "She must have felt dismissed and left hanging and didn't know what Daniel was feeling.",
      messagesToUse: [
        { role: 'assistant', content: sophieProbe },
        {
          role: 'user',
          content:
            "She must have felt dismissed and left hanging and didn't know what Daniel was feeling.",
        },
      ],
      textToParallelStream: {
        full: "That's the end of the three described situations. There are only two questions left.",
        spokenStarted: true,
        closingSpoken: false,
      },
    });
    const speak = createMockSpeakAssistantTurn();
    const draft = createMockSanitizeDraftResult({
      strippedText: SCENARIO_C_REPAIR_QUESTION_CANONICAL,
    });

    const result = await runPostClaudeForcedConstructProbeGates(
      deps,
      params,
      "That's the end of the three described situations.",
      draft,
      true,
      speak,
    );

    expect(result?.handled).toBe(true);
    expect(speak).toHaveBeenCalledWith(
      SCENARIO_C_REPAIR_QUESTION_CANONICAL,
      expect.objectContaining({ forceSpeakDespiteParallelStream: true }),
    );
    expect(deps.setMessages).toHaveBeenCalled();
  });

  it('skips S3 Sophie forced probe when parallel stream already spoke the Sophie probe', async () => {
    const sophieProbe =
      'Got it. What do you think this pattern of leaving has been like for Sophie over time?';
    const deps = createMockPostClaudeDeps({
      currentInterviewMomentRef: { current: 3 },
      currentScenarioRef: { current: 3 },
      parallelStreamingTtsRef: {
        current: {
          active: false,
          cancelRequested: false,
          accumulatedFullText: sophieProbe,
          spokenCompleteText: sophieProbe,
          s3SophiePerspectiveProbeDeliveredThisStream: false,
        },
      },
    });
    const params = createMockPostClaudeParams({
      shouldForceScenarioCSophiePerspectiveProbe: true,
      trimmed: 'He probably left because he had to regulate himself.',
      messagesToUse: [
        {
          role: 'assistant',
          content: "When Daniel comes back and says 'I didn't know what to say' — what do you make of that?",
        },
        {
          role: 'user',
          content: 'He probably left because he had to regulate himself.',
        },
      ],
    });
    const speak = createMockSpeakAssistantTurn();
    const draft = createMockSanitizeDraftResult({
      strippedText: sophieProbe,
    });

    const result = await runPostClaudeForcedConstructProbeGates(
      deps,
      params,
      'Got it. What would you say to Sophie at that point?',
      draft,
      true,
      speak,
    );

    expect(result?.handled).toBe(true);
    expect(deps.scenarioCSophiePerspectiveProbeFiredRef.current).toBe(true);
    expect(speak).not.toHaveBeenCalled();
  });

  it('skips S3 Sophie forced probe when parallel stream marked Sophie delivered before spokenCompleteText updates', async () => {
    const sophieProbe =
      'What do you think this pattern of leaving has been like for Sophie over time?';
    const deps = createMockPostClaudeDeps({
      currentInterviewMomentRef: { current: 3 },
      currentScenarioRef: { current: 3 },
      parallelStreamingTtsRef: {
        current: {
          active: true,
          cancelRequested: false,
          accumulatedFullText: 'Makes sense. What would you say to Sophie in that moment?',
          spokenCompleteText: '',
          s3SophiePerspectiveProbeDeliveredThisStream: true,
        },
      },
    });
    const params = createMockPostClaudeParams({
      shouldForceScenarioCSophiePerspectiveProbe: true,
      trimmed: 'He probably left because he had to regulate himself.',
      messagesToUse: [
        {
          role: 'assistant',
          content: "When Daniel comes back and says 'I didn't know what to say' — what do you make of that?",
        },
        {
          role: 'user',
          content: 'He probably left because he had to regulate himself.',
        },
      ],
    });
    const speak = createMockSpeakAssistantTurn();
    const draft = createMockSanitizeDraftResult({
      strippedText: sophieProbe,
    });

    const result = await runPostClaudeForcedConstructProbeGates(
      deps,
      params,
      'Got it. What would you say to Sophie at that point?',
      draft,
      true,
      speak,
    );

    expect(result?.handled).toBe(true);
    expect(deps.scenarioCSophiePerspectiveProbeFiredRef.current).toBe(true);
    expect(speak).not.toHaveBeenCalled();
  });

  it('skips S3 repair forced probe when parallel stream already delivered repair TTS', async () => {
    const deps = createMockPostClaudeDeps({
      currentInterviewMomentRef: { current: 3 },
      currentScenarioRef: { current: 3 },
      s3RepairProbeDeliveredRef: { current: true },
    });
    const sophieProbe =
      "I'm with you. What do you think this pattern of leaving has been like for Sophie over time?";
    const params = createMockPostClaudeParams({
      shouldForceScenarioCRepairProbe: true,
      trimmed:
        'I would apologize and commit to coming back after the ten minutes.',
      messagesToUse: [
        { role: 'assistant', content: sophieProbe },
        {
          role: 'user',
          content:
            "She must have felt dismissed and left hanging and didn't know what Daniel was feeling.",
        },
        { role: 'assistant', content: SCENARIO_C_REPAIR_QUESTION_CANONICAL },
        {
          role: 'user',
          content: 'I would apologize and commit to coming back after the ten minutes.',
        },
      ],
    });
    const speak = createMockSpeakAssistantTurn();
    const draft = createMockSanitizeDraftResult({
      strippedText: "That's the end of the three described situations.",
    });

    const result = await runPostClaudeForcedConstructProbeGates(
      deps,
      params,
      "That's the end of the three described situations.",
      draft,
      true,
      speak,
    );

    expect(result?.handled).toBe(false);
    expect(speak).not.toHaveBeenCalled();
  });

  it('speaks S3 repair when delivered ref is false positive after Sophie answer', async () => {
    const sophieProbe =
      "That makes a lot of sense. What do you think this pattern of leaving has been like for Sophie over time?";
    const deps = createMockPostClaudeDeps({
      currentInterviewMomentRef: { current: 3 },
      currentScenarioRef: { current: 3 },
      s3RepairProbeDeliveredRef: { current: true },
      parallelStreamingTtsRef: {
        current: {
          active: false,
          cancelRequested: false,
          accumulatedFullText: '',
          spokenCompleteText: '',
          s3SophiePerspectiveProbeDeliveredThisStream: false,
        },
      },
    });
    const params = createMockPostClaudeParams({
      shouldForceScenarioCRepairProbe: true,
      trimmed:
        "There's really a lot of hurt and rejection and abandonment.",
      messagesToUse: [
        { role: 'assistant', content: sophieProbe },
        {
          role: 'user',
          content:
            "There's really a lot of hurt and rejection and abandonment.",
        },
      ],
    });
    const speak = createMockSpeakAssistantTurn();
    const draft = createMockSanitizeDraftResult({
      strippedText: SCENARIO_C_REPAIR_QUESTION_CANONICAL,
    });

    const result = await runPostClaudeForcedConstructProbeGates(
      deps,
      params,
      "That's the end of the three described situations.",
      draft,
      true,
      speak,
    );

    expect(result?.handled).toBe(true);
    expect(speak).toHaveBeenCalledWith(
      SCENARIO_C_REPAIR_QUESTION_CANONICAL,
      expect.objectContaining({ forceSpeakDespiteParallelStream: true }),
    );
  });

  it('skips re-speaking S3 repair when stream already spoke it but transcript still lags', async () => {
    const repairSpoken = `Got it. ${SCENARIO_C_REPAIR_QUESTION_CANONICAL}`;
    const deps = createMockPostClaudeDeps({
      currentInterviewMomentRef: { current: 3 },
      currentScenarioRef: { current: 3 },
      s3RepairProbeDeliveredRef: { current: true },
      parallelStreamingTtsRef: {
        current: {
          active: false,
          cancelRequested: false,
          accumulatedFullText: repairSpoken,
          spokenCompleteText: repairSpoken,
        },
      },
    });
    const sophieProbe =
      "I'm with you. What do you think this pattern of leaving has been like for Sophie over time?";
    const params = createMockPostClaudeParams({
      shouldForceScenarioCRepairProbe: true,
      trimmed:
        "She must have felt dismissed and left hanging and didn't know what Daniel was feeling.",
      messagesToUse: [
        { role: 'assistant', content: sophieProbe },
        {
          role: 'user',
          content:
            "She must have felt dismissed and left hanging and didn't know what Daniel was feeling.",
        },
      ],
    });
    const speak = createMockSpeakAssistantTurn();
    const draft = createMockSanitizeDraftResult({
      strippedText: SCENARIO_C_REPAIR_QUESTION_CANONICAL,
    });

    const result = await runPostClaudeForcedConstructProbeGates(
      deps,
      params,
      SCENARIO_C_REPAIR_QUESTION_CANONICAL,
      draft,
      true,
      speak,
    );

    expect(result?.handled).toBe(true);
    expect(speak).not.toHaveBeenCalled();
    expect(deps.setMessages).toHaveBeenCalled();
  });
});
