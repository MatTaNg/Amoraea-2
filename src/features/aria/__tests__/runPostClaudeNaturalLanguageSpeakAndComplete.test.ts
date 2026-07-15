import { describe, expect, it, jest } from '@jest/globals';

import { detectConstructs, formatScoreMessage } from '@features/aria/interviewConstructAndScoreDisplay';
import type { ScenarioScoreResult } from '@features/aria/scoreInterviewScoringHelpers';
import { SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL } from '@features/aria/scenarioBProbeLogic';
import { SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY } from '@features/aria/probeAndScoringUtils';
import { SCENARIO_1_TO_2_TRANSITION } from '@features/aria/interviewTransitionBundles';
import { SHOW_SCENARIO_2_VIGNETTE_EXACT } from '@features/aria/interviewShowScenarioExactCopy';
import { runPostClaudeNaturalLanguageSpeakAndComplete } from '@features/aria/runPostClaudeNaturalLanguageSpeakAndComplete';
import { createPostClaudeSpeakAssistantTurn } from '@features/aria/createPostClaudeSpeakAssistantTurn';
import type { PostClaudeNaturalLanguageClosingHandoffEval } from '@features/aria/evaluatePostClaudeNaturalLanguageClosingHandoff';
import type { PostClaudeNaturalLanguageTranscriptPersistResult } from '@features/aria/persistPostClaudeNaturalLanguageTranscriptTurn';
import {
  createMockPostClaudeDeps,
  createMockPostClaudeParams,
  createMockSpeakAssistantTurn,
} from './postClaudeGateTestHelpers';

jest.mock('@features/aria/utils/speakLongFormInterviewHtmlMp3', () => ({
  speakLongFormInterviewHtmlMp3: jest.fn(async () => false),
}));

describe('interviewConstructAndScoreDisplay', () => {
  it('detectConstructs maps repair and accountability cues', () => {
    const hits = detectConstructs('I was wrong and I should apologize to repair things.');
    expect(hits).toEqual(expect.arrayContaining([2, 4]));
  });

  it('formatScoreMessage renders scenario scorecard lines', () => {
    const result: ScenarioScoreResult = {
      scenarioNumber: 1,
      scenarioName: 'Situation 1',
      pillarScores: { mentalizing: 7 },
      pillarConfidence: { mentalizing: 'high' },
      keyEvidence: { mentalizing: 'Named Emma perspective' },
      specificity: 'high',
    };
    const text = formatScoreMessage(result);
    expect(text).toMatch(/Scenario 1/);
    expect(text).toMatch(/Mentalizing: 7\/10/);
    expect(text).toMatch(/Named Emma perspective/);
  });
});

function baseTranscript(
  overrides: Partial<PostClaudeNaturalLanguageTranscriptPersistResult> = {},
): PostClaudeNaturalLanguageTranscriptPersistResult {
  return {
    priorScenarioNum: 1,
    pendingBundledHandoff: false,
    assistantContentToPersist: 'Thanks Alex.',
    scenarioNum: 1,
    aiMsg: { role: 'assistant', content: 'Thanks Alex.', scenarioNumber: 1 },
    s3ToM4HandoffSignals: false,
    skipDuplicatePreambleAppend: false,
    updatedMessages: [{ role: 'assistant', content: 'Thanks Alex.', scenarioNumber: 1 }],
    detectedScenario: null,
    emotionSplit: { beforeModal: 'Thanks Alex.', afterModal: '' },
    deferEmotionModal: false,
    scenarioHandoffTransition: false,
    emotionCompletedScenario: null,
    emotionNaturalForward: false,
    emotionNaturalS3ToM4: false,
    deferBlocked: false,
    ...overrides,
  };
}

function baseClosingHandoff(
  overrides: Partial<PostClaudeNaturalLanguageClosingHandoffEval> = {},
): PostClaudeNaturalLanguageClosingHandoffEval {
  return {
    closeGateForFailsafe: {
      postM5UserTurns: 0,
      hasMoment5PrimaryAnchorInTranscript: false,
      accountabilityProbeStillRequired: false,
      resolutionFollowUpStillRequired: false,
      moment5CloseAllowed: false,
      moment5CombinedForCloseGate: '',
    },
    closingCandidate: '',
    closingLooksFinal: false,
    streamClosingAlreadyDelivered: false,
    closingSpeakInFlight: false,
    lenientCloseReady: false,
    shouldFailsafeComplete: false,
    closingAlreadySpokenInTranscript: false,
    streamSpokeClosingThankYou: false,
    streamSpokeIncompleteClosingOnly: false,
    streamThankYouSpeakCount: 0,
    skipClosingSpeak: false,
    effectiveSkipClosingSpeak: false,
    mustRunEmotionTransitionPath: false,
    ...overrides,
  };
}

describe('runPostClaudeNaturalLanguageSpeakAndComplete', () => {
  it('speaks display text on a normal non-emotion turn', async () => {
    const speak = createMockSpeakAssistantTurn();
    const deps = createMockPostClaudeDeps();
    const params = createMockPostClaudeParams();

    await runPostClaudeNaturalLanguageSpeakAndComplete({
      deps,
      params,
      parallelStreamingPlaybackUsed: false,
      displayText: 'Thanks Alex, that makes sense.',
      transcript: baseTranscript(),
      closingHandoff: baseClosingHandoff(),
      speakAssistantTurn: speak,
    });

    expect(speak).toHaveBeenCalledWith(
      'Thanks Alex, that makes sense.',
      expect.any(Object),
    );
  });

  it('runs emotion transition path when emotionNaturalForward is true', async () => {
    const runEmotionModalAfterScenarioTransition = jest.fn().mockResolvedValue(undefined);
    const speak = createMockSpeakAssistantTurn();
    const deps = createMockPostClaudeDeps({ runEmotionModalAfterScenarioTransition });
    const params = createMockPostClaudeParams();

    await runPostClaudeNaturalLanguageSpeakAndComplete({
      deps,
      params,
      parallelStreamingPlaybackUsed: false,
      displayText: 'Nice work, Alex.\n\nScenario two opening.',
      transcript: baseTranscript({
        emotionNaturalForward: true,
        emotionCompletedScenario: 1,
        emotionSplit: {
          beforeModal: 'Nice work, Alex.',
          afterModal: 'Scenario two opening.',
        },
        aiMsg: {
          role: 'assistant',
          content: 'Nice work, Alex.\n\nScenario two opening.',
          scenarioNumber: 2,
        },
      }),
      closingHandoff: baseClosingHandoff({ mustRunEmotionTransitionPath: true }),
      speakAssistantTurn: speak,
    });

    expect(runEmotionModalAfterScenarioTransition).toHaveBeenCalled();
    expect(speak).toHaveBeenCalled();
  });

  it('returns early on pending bundled handoff without speaking display text', async () => {
    const speak = createMockSpeakAssistantTurn();
    const setVoiceState = jest.fn();
    const deps = createMockPostClaudeDeps({ setVoiceState });
    const params = createMockPostClaudeParams();

    await runPostClaudeNaturalLanguageSpeakAndComplete({
      deps,
      params,
      parallelStreamingPlaybackUsed: false,
      displayText: 'Nice work, Alex.\n\nScenario two opening.',
      transcript: baseTranscript({
        pendingBundledHandoff: true,
        assistantContentToPersist: 'Nice work, Alex.',
      }),
      closingHandoff: baseClosingHandoff(),
      speakAssistantTurn: speak,
    });

    expect(speak).toHaveBeenCalledWith('Nice work, Alex.', expect.any(Object));
    expect(setVoiceState).toHaveBeenCalledWith('idle');
  });

  it('runs emotion modal after bundled handoff when canonical situation_2 already played', async () => {
    const runEmotionModalAfterScenarioTransition = jest.fn().mockResolvedValue(undefined);
    const speak = createMockSpeakAssistantTurn();
    const setVoiceState = jest.fn();
    const deps = createMockPostClaudeDeps({
      runEmotionModalAfterScenarioTransition,
      setVoiceState,
      showScenarioCardCanonicalPlaybackConfirmedKindsRef: {
        current: { situation_2: true },
      },
      parallelStreamingTtsRef: {
        current: {
          active: false,
          cancelRequested: false,
          accumulatedFullText: '',
          spokenCompleteText:
            "That's a wrap on that one. Nice work, Matt.\n\nSarah has been job hunting for four months.",
        },
      },
    });
    const params = createMockPostClaudeParams();
    const displayText =
      "That's a wrap on that one. Nice work, Matt.\n\nSarah has been job hunting for four months. She gets an offer.";

    await runPostClaudeNaturalLanguageSpeakAndComplete({
      deps,
      params,
      parallelStreamingPlaybackUsed: true,
      displayText,
      transcript: baseTranscript({
        pendingBundledHandoff: true,
        deferEmotionModal: true,
        assistantContentToPersist: "That's a wrap on that one. Nice work, Matt.",
        emotionSplit: {
          beforeModal: "That's a wrap on that one. Nice work, Matt.",
          afterModal: 'Sarah has been job hunting for four months. She gets an offer.',
        },
        emotionNaturalForward: false,
        emotionCompletedScenario: 1,
      }),
      closingHandoff: baseClosingHandoff(),
      speakAssistantTurn: speak,
    });

    expect(runEmotionModalAfterScenarioTransition).toHaveBeenCalledWith(1, expect.any(Object));
    expect(deps.pendingEmotionModalTransitionRef.current).toBeNull();
    expect(setVoiceState).toHaveBeenCalledWith('idle');
  });

  it('forces S1 emotion modal when Situation 2 card already played but premature coerce cleared emotion flags', async () => {
    const runEmotionModalAfterScenarioTransition = jest.fn().mockResolvedValue(undefined);
    const speak = createMockSpeakAssistantTurn();
    const setVoiceState = jest.fn();
    const spokenS2 =
      "That's a wrap on that one. Nice work, Matt.\n\nSarah has been job hunting for four months. She gets an offer and calls James.";
    const deps = createMockPostClaudeDeps({
      runEmotionModalAfterScenarioTransition,
      setVoiceState,
      showScenarioCardCanonicalPlaybackConfirmedKindsRef: {
        current: { situation_2: true },
      },
      emotionItemResponsesRef: { current: [] },
      parallelStreamingTtsRef: {
        current: {
          active: false,
          cancelRequested: false,
          accumulatedFullText: '',
          spokenCompleteText: spokenS2,
        },
      },
    });
    const params = createMockPostClaudeParams();

    await runPostClaudeNaturalLanguageSpeakAndComplete({
      deps,
      params,
      parallelStreamingPlaybackUsed: true,
      // Mirrors session: premature block rewrote handoff to Ryan repair after S2 already played.
      displayText: SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY,
      transcript: baseTranscript({
        priorScenarioNum: 1,
        pendingBundledHandoff: false,
        emotionNaturalForward: false,
        emotionCompletedScenario: null,
        deferEmotionModal: false,
        emotionSplit: {
          beforeModal: SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY,
          afterModal: '',
        },
        assistantContentToPersist: SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY,
      }),
      closingHandoff: baseClosingHandoff(),
      speakAssistantTurn: speak,
    });

    expect(runEmotionModalAfterScenarioTransition).toHaveBeenCalledWith(1, expect.any(Object));
    expect(speak).not.toHaveBeenCalledWith(
      expect.stringMatching(/if you were ryan/i),
      expect.any(Object),
    );
  });

  it('runs M5 failsafe completion when shouldFailsafeComplete is true', async () => {
    const setVoiceState = jest.fn();
    const persistInterviewAttemptSessionLifecycle = jest.fn().mockResolvedValue(undefined);
    const speak = createMockSpeakAssistantTurn();
    const deps = createMockPostClaudeDeps({ setVoiceState, persistInterviewAttemptSessionLifecycle });
    const params = createMockPostClaudeParams();

    await runPostClaudeNaturalLanguageSpeakAndComplete({
      deps,
      params,
      parallelStreamingPlaybackUsed: false,
      displayText: 'Thank you for sharing all of that, Alex.',
      transcript: baseTranscript({
        updatedMessages: [
          { role: 'user', content: 'We talked it through.' },
          { role: 'assistant', content: 'Thank you for sharing all of that, Alex.' },
        ],
      }),
      closingHandoff: baseClosingHandoff({ shouldFailsafeComplete: true }),
      speakAssistantTurn: speak,
    });

    expect(setVoiceState).toHaveBeenCalledWith('idle');
    expect(persistInterviewAttemptSessionLifecycle).toHaveBeenCalled();
  });

  it('delivers Scenario 1 after duplicate preamble skip when user affirmed readiness', async () => {
    const speakTextSafe = jest.fn().mockResolvedValue(undefined);
    const commitInterviewMessages = jest.fn();
    const setVoiceState = jest.fn();
    const speak = createMockSpeakAssistantTurn();
    const briefing =
      "Good to meet you, Matt. The way this works is I'll give you three situations. Are you ready?";
    const deps = createMockPostClaudeDeps({
      speakTextSafe,
      commitInterviewMessages,
      setVoiceState,
      interviewNameRef: { current: 'Matt' },
      currentInterviewMomentRef: { current: 1 },
      currentScenarioRef: { current: 1 },
      lastQuestionTextRef: { current: briefing },
    });
    const params = createMockPostClaudeParams({
      trimmed: 'Yes.',
      participantFirstNameForSpoken: '',
    });

    await runPostClaudeNaturalLanguageSpeakAndComplete({
      deps,
      params,
      parallelStreamingPlaybackUsed: false,
      displayText: briefing,
      transcript: baseTranscript({
        skipDuplicatePreambleAppend: true,
        updatedMessages: [
          { role: 'assistant', content: briefing, scenarioNumber: 1 },
          { role: 'user', content: 'Matt', scenarioNumber: 1 },
          { role: 'user', content: 'Yes.', scenarioNumber: 1 },
        ],
      }),
      closingHandoff: baseClosingHandoff(),
      speakAssistantTurn: speak,
    });

    expect(speakTextSafe).toHaveBeenCalledWith(
      expect.stringContaining('Emma and Ryan'),
      expect.any(Object),
    );
    expect(speak).not.toHaveBeenCalled();
    expect(setVoiceState).toHaveBeenCalledWith('idle');
  });

  it('delivers Scenario 1 after duplicate preamble skip when moment ref is stale at 2', async () => {
    const speakTextSafe = jest.fn().mockResolvedValue(undefined);
    const commitInterviewMessages = jest.fn();
    const setVoiceState = jest.fn();
    const speak = createMockSpeakAssistantTurn();
    const briefing =
      "Good to meet you, Matt. The way this works is I'll give you three situations. Are you ready?";
    const deps = createMockPostClaudeDeps({
      speakTextSafe,
      commitInterviewMessages,
      setVoiceState,
      interviewNameRef: { current: 'Matt' },
      currentInterviewMomentRef: { current: 2 },
      currentScenarioRef: { current: 1 },
      lastQuestionTextRef: { current: briefing },
    });
    const params = createMockPostClaudeParams({
      trimmed: 'Yes.',
      participantFirstNameForSpoken: '',
    });

    await runPostClaudeNaturalLanguageSpeakAndComplete({
      deps,
      params,
      parallelStreamingPlaybackUsed: false,
      displayText: briefing,
      transcript: baseTranscript({
        skipDuplicatePreambleAppend: true,
        updatedMessages: [
          { role: 'assistant', content: briefing, scenarioNumber: 1 },
          { role: 'user', content: 'Matt', scenarioNumber: 1 },
          { role: 'user', content: 'Yes.', scenarioNumber: 1 },
        ],
      }),
      closingHandoff: baseClosingHandoff(),
      speakAssistantTurn: speak,
    });

    expect(speakTextSafe).toHaveBeenCalledWith(
      expect.stringContaining('Emma and Ryan'),
      expect.any(Object),
    );
    expect(speak).not.toHaveBeenCalled();
    expect(deps.currentInterviewMomentRef.current).toBe(1);
  });

  it('skips TTS for duplicate preamble briefing moments without readiness assent', async () => {
    const speak = createMockSpeakAssistantTurn();
    const deps = createMockPostClaudeDeps({ setVoiceState: jest.fn() });
    const params = createMockPostClaudeParams({ trimmed: 'Maybe later.' });
    const briefing =
      "Good to meet you, Alex. The way this works is I'll give you three situations. Are you ready?";

    await runPostClaudeNaturalLanguageSpeakAndComplete({
      deps,
      params,
      parallelStreamingPlaybackUsed: false,
      displayText: briefing,
      transcript: baseTranscript({ skipDuplicatePreambleAppend: true }),
      closingHandoff: baseClosingHandoff(),
      speakAssistantTurn: speak,
    });

    expect(speak).not.toHaveBeenCalled();
    expect(deps.speakTextSafe).not.toHaveBeenCalled();
    expect(deps.setVoiceState).toHaveBeenCalledWith('idle');
  });

  it('speaks deduped closing via speakTextSafe when parallel stream missed closing TTS', async () => {
    const speakTextSafe = jest.fn().mockResolvedValue(undefined);
    const speak = createMockSpeakAssistantTurn();
    const deps = createMockPostClaudeDeps({ speakTextSafe });
    const params = createMockPostClaudeParams({
      textToParallelStream: { full: '', spokenStarted: false, closingSpoken: false },
    });

    await runPostClaudeNaturalLanguageSpeakAndComplete({
      deps,
      params,
      parallelStreamingPlaybackUsed: true,
      displayText: 'Thank you, Alex.',
      transcript: baseTranscript(),
      closingHandoff: baseClosingHandoff({
        shouldFailsafeComplete: true,
        closingLooksFinal: true,
        closingCandidate: 'Thank you for sharing all of that. We really appreciate your time.',
        effectiveSkipClosingSpeak: false,
      }),
      speakAssistantTurn: speak,
    });

    expect(speak).toHaveBeenCalledWith(
      expect.stringContaining('Thank you for sharing'),
      expect.objectContaining({ forceSpeakDespiteParallelStream: true }),
    );
    expect(params.textToParallelStream.closingSpoken).toBe(true);
  });

  it('does not force-respeak truncated S1 repair after contempt streamed on parallel path', async () => {
    const deps = createMockPostClaudeDeps();
    deps.scenarioAContemptProbeAskedRef.current = true;
    deps.parallelStreamingTtsRef.current.spokenCompleteText = '';
    const speak = createPostClaudeSpeakAssistantTurn(deps, true);
    const params = createMockPostClaudeParams({
      shouldForceScenarioAContemptProbe: true,
      textToParallelStream: { full: '', spokenStarted: true, closingSpoken: false },
    });
    const repairFragment = 'Makes sense. things with Emma after this?';

    await runPostClaudeNaturalLanguageSpeakAndComplete({
      deps,
      params,
      parallelStreamingPlaybackUsed: true,
      displayText: repairFragment,
      transcript: baseTranscript(),
      closingHandoff: baseClosingHandoff({ effectiveSkipClosingSpeak: false }),
      speakAssistantTurn: speak,
    });

    expect(deps.speakTextSafe).not.toHaveBeenCalled();
  });

  it('does not force-respeak canonical S1 repair when stream already spoke a repair paraphrase', async () => {
    const deps = createMockPostClaudeDeps();
    deps.scenarioAContemptProbeAskedRef.current = true;
    deps.parallelStreamingTtsRef.current.spokenCompleteText =
      'Got it. And how would you repair this as Ryan?';
    const speak = createPostClaudeSpeakAssistantTurn(deps, true);
    const params = createMockPostClaudeParams({
      allowScenarioARepairAfterContemptAnswer: true,
      textToParallelStream: { full: '', spokenStarted: true, closingSpoken: false },
    });

    await runPostClaudeNaturalLanguageSpeakAndComplete({
      deps,
      params,
      parallelStreamingPlaybackUsed: true,
      displayText: SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY,
      transcript: baseTranscript(),
      closingHandoff: baseClosingHandoff({ effectiveSkipClosingSpeak: false }),
      speakAssistantTurn: speak,
    });

    expect(deps.speakTextSafe).not.toHaveBeenCalled();
  });

  it('force-speaks Scenario B James-differently Q2 when parallel stream skipped it but prior handoff is in spokenCompleteText', async () => {
    const speakTextSafe = jest.fn().mockResolvedValue(undefined);
    const deps = createMockPostClaudeDeps({
      speakTextSafe,
      currentInterviewMomentRef: { current: 2 },
      currentScenarioRef: { current: 2 },
    });
    deps.parallelStreamingTtsRef.current.spokenCompleteText =
      "That's a wrap on this situation. Here's the next situation.\n\nSarah has been job hunting for four months.";
    const speak = createPostClaudeSpeakAssistantTurn(deps, true);
    const params = createMockPostClaudeParams({
      textToParallelStream: { full: '', spokenStarted: true, closingSpoken: false },
    });

    await runPostClaudeNaturalLanguageSpeakAndComplete({
      deps,
      params,
      parallelStreamingPlaybackUsed: true,
      displayText: SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL,
      transcript: baseTranscript(),
      closingHandoff: baseClosingHandoff({ effectiveSkipClosingSpeak: false }),
      speakAssistantTurn: speak,
    });

    expect(deps.speakTextSafe).toHaveBeenCalledWith(
      SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL,
      expect.objectContaining({ forceSpeakDespiteParallelStream: true }),
    );
  });

  it('suppresses premature James Q2 speak on S1→S2 transition when canonical S2 opening already played', async () => {
    const speakTextSafe = jest.fn().mockResolvedValue(undefined);
    const setVoiceState = jest.fn();
    const deps = createMockPostClaudeDeps({
      speakTextSafe,
      setVoiceState,
      currentInterviewMomentRef: { current: 2 },
      currentScenarioRef: { current: 2 },
      showScenarioCardCanonicalPlaybackConfirmedKindsRef: {
        current: { situation_2: true },
      },
    });
    deps.parallelStreamingTtsRef.current.spokenCompleteText =
      "Sarah has been job hunting for four months. What do you think is going on here?";
    const speak = createPostClaudeSpeakAssistantTurn(deps, true);
    const params = createMockPostClaudeParams({
      textToParallelStream: { full: '', spokenStarted: true, closingSpoken: false },
    });
    const messages = [
      { role: 'assistant', content: 'If you were Ryan, how would you repair this?' },
      {
        role: 'user',
        content:
          'If I were Ryan, I would assure her that this would not happen again and actually follow through.',
      },
    ];

    await runPostClaudeNaturalLanguageSpeakAndComplete({
      deps,
      params,
      parallelStreamingPlaybackUsed: true,
      displayText: SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL,
      transcript: baseTranscript({ updatedMessages: messages }),
      closingHandoff: baseClosingHandoff({ effectiveSkipClosingSpeak: false }),
      speakAssistantTurn: speak,
    });

    expect(deps.speakTextSafe).not.toHaveBeenCalled();
    expect(setVoiceState).toHaveBeenCalledWith('idle');
  });

  it('suppresses James Q2 afterModal on emotion transition when stream already delivered S2 Q1', async () => {
    const speakTextSafe = jest.fn().mockResolvedValue(undefined);
    const runEmotionModalAfterScenarioTransition = jest.fn().mockResolvedValue(undefined);
    const speak = createMockSpeakAssistantTurn();
    const s2Opening =
      `${SHOW_SCENARIO_2_VIGNETTE_EXACT}\n\nWhat do you think is going on here?`;
    const messages = [
      { role: 'assistant', content: 'If you were Ryan, how would you repair this?' },
      {
        role: 'user',
        content:
          'If I were Ryan, I would assure her that this would not happen again and actually follow through.',
      },
    ];
    const deps = createMockPostClaudeDeps({
      speakTextSafe,
      runEmotionModalAfterScenarioTransition,
      currentInterviewMomentRef: { current: 1 },
      showScenarioCardCanonicalPlaybackConfirmedKindsRef: {
        current: { situation_2: true },
      },
      parallelStreamingTtsRef: {
        current: {
          active: false,
          spokenCompleteText: `${SCENARIO_1_TO_2_TRANSITION}\n\n${s2Opening}`,
          accumulatedFullText: '',
          cancelRequested: false,
        },
      },
    });
    const params = createMockPostClaudeParams({ messagesToUse: messages });

    await runPostClaudeNaturalLanguageSpeakAndComplete({
      deps,
      params,
      parallelStreamingPlaybackUsed: true,
      displayText: SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL,
      transcript: baseTranscript({
        updatedMessages: messages,
        emotionNaturalForward: true,
        emotionCompletedScenario: 1,
        emotionSplit: {
          beforeModal: SCENARIO_1_TO_2_TRANSITION,
          afterModal: SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL,
        },
        aiMsg: {
          role: 'assistant',
          content: SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL,
          scenarioNumber: 2,
        },
      }),
      closingHandoff: baseClosingHandoff({ mustRunEmotionTransitionPath: true }),
      speakAssistantTurn: speak,
    });

    expect(runEmotionModalAfterScenarioTransition).toHaveBeenCalled();
    expect(speakTextSafe).not.toHaveBeenCalled();
    expect(speak).not.toHaveBeenCalled();
  });

  it('speaks closing before preparing results when failsafe fires but thank-you was never heard', async () => {
    const speak = createMockSpeakAssistantTurn();
    const deps = createMockPostClaudeDeps();
    const params = createMockPostClaudeParams({
      textToParallelStream: { full: '', spokenStarted: true, closingSpoken: true },
    });
    deps.parallelStreamingTtsRef.current.spokenCompleteText =
      'Looking back — do you think there was anything you could have owned?';
    const closingCandidate =
      'Good work getting through all of this, Alex. Thank you for being so open with me, Alex.';

    await runPostClaudeNaturalLanguageSpeakAndComplete({
      deps,
      params,
      parallelStreamingPlaybackUsed: true,
      displayText: closingCandidate,
      transcript: baseTranscript(),
      closingHandoff: baseClosingHandoff({
        shouldFailsafeComplete: true,
        closingLooksFinal: true,
        closingCandidate,
        effectiveSkipClosingSpeak: true,
        streamSpokeClosingThankYou: false,
      }),
      speakAssistantTurn: speak,
    });

    expect(speak).toHaveBeenCalledWith(
      expect.stringContaining('Thank you for being so open with me'),
      expect.objectContaining({ forceSpeakDespiteParallelStream: true }),
    );
  });

  it('does not speak display text when effectiveSkipClosingSpeak is true', async () => {
    const speak = createMockSpeakAssistantTurn();
    const deps = createMockPostClaudeDeps();
    const params = createMockPostClaudeParams();

    await runPostClaudeNaturalLanguageSpeakAndComplete({
      deps,
      params,
      parallelStreamingPlaybackUsed: false,
      displayText: 'Thanks Alex, that makes sense.',
      transcript: baseTranscript(),
      closingHandoff: baseClosingHandoff({ effectiveSkipClosingSpeak: true }),
      speakAssistantTurn: speak,
    });

    expect(speak).not.toHaveBeenCalled();
    expect(deps.speakTextSafe).not.toHaveBeenCalled();
  });
});
