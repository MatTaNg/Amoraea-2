import { describe, expect, it, afterEach } from '@jest/globals';

import { createInitialParallelStreamingTtsState } from '@features/aria/interviewParallelTtsBatch';
import { evaluatePostClaudeNaturalLanguageClosingHandoff } from '@features/aria/evaluatePostClaudeNaturalLanguageClosingHandoff';
import {
  resetInterviewClosingTtsSession,
  tryAcquireInterviewClosingSpeak,
} from '@features/aria/interviewClosingTtsSession';
import { MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT } from '@features/aria/probeAndScoringUtils';
import {
  createMockPostClaudeDeps,
  createMockPostClaudeParams,
  mockRef,
} from './postClaudeGateTestHelpers';

const baseEmotionDiag = {
  priorScenarioNum: 3 as const,
  detectedScenario: null,
  emotionNaturalForward: false,
  emotionCompletedScenario: null,
  scenarioHandoffTransition: false,
  emotionNaturalS3ToM4: false,
  deferEmotionModal: false,
  deferBlocked: false,
  hasAfterModal: false,
};

describe('evaluatePostClaudeNaturalLanguageClosingHandoff', () => {
  afterEach(() => {
    resetInterviewClosingTtsSession();
  });

  it('returns shouldFailsafeComplete when closing text is final and M5 gate allows close', () => {
    const resolutionAnswer =
      'I raised my voice and should have listened first. We talked it through after.';
    const deps = createMockPostClaudeDeps({
      currentInterviewMomentRef: mockRef(5),
      moment5QuestionDeliveredRef: mockRef(true),
      moment5PrimaryAnchorDeliveredSessionRef: mockRef(true),
      moment5PostPromptUserTurnCountRef: mockRef(2),
      moment5AccountabilityProbeFiredRef: mockRef(true),
      isInterviewCompleteRef: mockRef(false),
    });
    const params = createMockPostClaudeParams({
      messagesToUse: [
        { role: 'assistant', content: MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT },
        {
          role: 'user',
          content: 'My coach called me out during practice.',
          interviewMoment: 5,
        },
        {
          role: 'assistant',
          content: 'What do you think you did or said that contributed to the conflict?',
        },
        {
          role: 'user',
          content: resolutionAnswer,
          interviewMoment: 5,
        },
      ],
      textToParallelStream: { full: '', spokenStarted: false, closingSpoken: false },
    });
    const closingDisplay =
      'Thank you for being so open with me, Alex. I really appreciate you sharing all of that.';

    const result = evaluatePostClaudeNaturalLanguageClosingHandoff(
      deps,
      params,
      {
        strippedText: closingDisplay,
        parallelStreamingPlaybackUsed: false,
        rawApiHadInterviewComplete: false,
      },
      closingDisplay,
      [
        ...params.messagesToUse,
        { role: 'assistant', content: closingDisplay, scenarioNumber: 3 },
      ],
      baseEmotionDiag,
    );

    expect(result.closingLooksFinal).toBe(true);
    expect(result.closeGateForFailsafe.moment5CloseAllowed).toBe(true);
    expect(result.shouldFailsafeComplete).toBe(true);
    expect(result.mustRunEmotionTransitionPath).toBe(false);
  });

  it('skips closing speak when thank-you was already spoken in parallel stream', () => {
    const deps = createMockPostClaudeDeps({
      parallelStreamingTtsRef: mockRef({
        ...createInitialParallelStreamingTtsState(),
        spokenCompleteText: 'Thank you for being so open with me, Alex.',
      }),
    });
    const params = createMockPostClaudeParams({
      textToParallelStream: { full: '', spokenStarted: true, closingSpoken: false },
    });
    const closingDisplay =
      'Thank you for being so open with me, Alex. I really appreciate you sharing all of that.';

    const result = evaluatePostClaudeNaturalLanguageClosingHandoff(
      deps,
      params,
      {
        strippedText: closingDisplay,
        parallelStreamingPlaybackUsed: true,
        rawApiHadInterviewComplete: false,
      },
      closingDisplay,
      [{ role: 'assistant', content: closingDisplay }],
      baseEmotionDiag,
    );

    expect(result.streamSpokeClosingThankYou).toBe(true);
    expect(result.effectiveSkipClosingSpeak).toBe(true);
  });

  it('does not failsafe-complete when interview is already marked complete', () => {
    const deps = createMockPostClaudeDeps({
      isInterviewCompleteRef: mockRef(true),
    });
    const params = createMockPostClaudeParams();
    const closingDisplay = 'Thank you for being so open with me, Alex.';

    const result = evaluatePostClaudeNaturalLanguageClosingHandoff(
      deps,
      params,
      {
        strippedText: closingDisplay,
        parallelStreamingPlaybackUsed: false,
        rawApiHadInterviewComplete: true,
      },
      closingDisplay,
      [{ role: 'assistant', content: closingDisplay }],
      baseEmotionDiag,
    );

    expect(result.closingLooksFinal).toBe(true);
    expect(result.shouldFailsafeComplete).toBe(false);
  });

  it('does not skip closing speak when transcript has closing text but TTS never played', () => {
    const partialClosing =
      'Good work getting through all of this. What stuck with me was how you stayed with it.';
    const deps = createMockPostClaudeDeps({
      currentInterviewMomentRef: mockRef(5),
      moment5QuestionDeliveredRef: mockRef(true),
      moment5PrimaryAnchorDeliveredSessionRef: mockRef(true),
      moment5PostPromptUserTurnCountRef: mockRef(2),
      moment5AccountabilityProbeFiredRef: mockRef(true),
      isInterviewCompleteRef: mockRef(false),
    });
    const params = createMockPostClaudeParams({
      messagesToUse: [
        { role: 'assistant', content: partialClosing },
        { role: 'user', content: 'We talked it through afterward.', interviewMoment: 5 },
      ],
      textToParallelStream: { full: '', spokenStarted: false, closingSpoken: false },
    });
    const closingDisplay =
      'Good work getting through all of this, Alex. Thank you for being so open with me.';

    const result = evaluatePostClaudeNaturalLanguageClosingHandoff(
      deps,
      params,
      {
        strippedText: closingDisplay,
        parallelStreamingPlaybackUsed: true,
        rawApiHadInterviewComplete: false,
      },
      closingDisplay,
      [...params.messagesToUse, { role: 'assistant', content: closingDisplay, scenarioNumber: 3 }],
      baseEmotionDiag,
    );

    expect(result.closingAlreadySpokenInTranscript).toBe(false);
    expect(result.streamSpokeClosingThankYou).toBe(false);
    expect(result.shouldFailsafeComplete).toBe(true);
    expect(result.effectiveSkipClosingSpeak).toBe(false);
  });

  it('failsafe-completes when stream spoke incomplete reflective closing and M5 gate allows close', () => {
    const resolutionAnswer =
      'I raised my voice and should have listened first. We talked it through after.';
    const deps = createMockPostClaudeDeps({
      currentInterviewMomentRef: mockRef(5),
      moment5QuestionDeliveredRef: mockRef(true),
      moment5PrimaryAnchorDeliveredSessionRef: mockRef(true),
      moment5PostPromptUserTurnCountRef: mockRef(2),
      moment5AccountabilityProbeFiredRef: mockRef(true),
      isInterviewCompleteRef: mockRef(false),
      parallelStreamingTtsRef: mockRef({
        ...createInitialParallelStreamingTtsState(),
        spokenCompleteText:
          'Good work getting through all of this, Alex. What stood out to me was that you',
      }),
    });
    const params = createMockPostClaudeParams({
      messagesToUse: [
        { role: 'assistant', content: MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT },
        { role: 'user', content: 'My coach called me out during practice.', interviewMoment: 5 },
        {
          role: 'assistant',
          content: 'What do you think you did or said that contributed to the conflict?',
        },
        { role: 'user', content: resolutionAnswer, interviewMoment: 5 },
      ],
      textToParallelStream: { full: '', spokenStarted: true, closingSpoken: false },
      participantFirstNameForSpoken: 'Alex',
    });
    const closingDisplay =
      'Good work getting through all of this, Alex. Thank you for being so open with me, Alex.';

    const result = evaluatePostClaudeNaturalLanguageClosingHandoff(
      deps,
      params,
      {
        strippedText: closingDisplay,
        parallelStreamingPlaybackUsed: true,
        rawApiHadInterviewComplete: false,
      },
      closingDisplay,
      [
        ...params.messagesToUse,
        { role: 'assistant', content: closingDisplay, scenarioNumber: 3 },
      ],
      baseEmotionDiag,
    );

    expect(result.streamSpokeIncompleteClosingOnly).toBe(true);
    expect(result.shouldFailsafeComplete).toBe(true);
  });

  it('does not skip closing speak when closing speak is in-flight but not yet delivered', () => {
    const resolutionAnswer =
      'I raised my voice and should have listened first. We talked it through after.';
    const sessionKey = 'session-in-flight-not-delivered';
    tryAcquireInterviewClosingSpeak(sessionKey);
    const deps = createMockPostClaudeDeps({
      interviewSessionAttemptIdRef: mockRef(sessionKey),
      currentInterviewMomentRef: mockRef(5),
      moment5QuestionDeliveredRef: mockRef(true),
      moment5PrimaryAnchorDeliveredSessionRef: mockRef(true),
      moment5PostPromptUserTurnCountRef: mockRef(2),
      moment5AccountabilityProbeFiredRef: mockRef(true),
      isInterviewCompleteRef: mockRef(false),
      parallelStreamingTtsRef: mockRef({
        ...createInitialParallelStreamingTtsState(),
        spokenCompleteText: '',
      }),
    });
    const params = createMockPostClaudeParams({
      messagesToUse: [
        { role: 'assistant', content: MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT },
        { role: 'user', content: 'My coach called me out during practice.', interviewMoment: 5 },
        {
          role: 'assistant',
          content: 'What do you think you did or said that contributed to the conflict?',
        },
        { role: 'user', content: resolutionAnswer, interviewMoment: 5 },
      ],
      textToParallelStream: { full: '', spokenStarted: true, closingSpoken: false },
    });
    const closingDisplay =
      'Good work getting through all of this, Alex. Thank you for being so open with me, Alex.';

    const result = evaluatePostClaudeNaturalLanguageClosingHandoff(
      deps,
      params,
      {
        strippedText: closingDisplay,
        parallelStreamingPlaybackUsed: true,
        rawApiHadInterviewComplete: true,
      },
      closingDisplay,
      [
        ...params.messagesToUse,
        { role: 'assistant', content: closingDisplay, scenarioNumber: 3 },
      ],
      baseEmotionDiag,
    );

    expect(result.closingSpeakInFlight).toBe(true);
    expect(result.skipClosingSpeak).toBe(false);
    expect(result.effectiveSkipClosingSpeak).toBe(false);
  });

  it('does not skip closing speak when closingSpoken flag is set but stream TTS never played', () => {
    const resolutionAnswer =
      'I raised my voice and should have listened first. We talked it through after.';
    const deps = createMockPostClaudeDeps({
      currentInterviewMomentRef: mockRef(5),
      moment5QuestionDeliveredRef: mockRef(true),
      moment5PrimaryAnchorDeliveredSessionRef: mockRef(true),
      moment5PostPromptUserTurnCountRef: mockRef(2),
      moment5AccountabilityProbeFiredRef: mockRef(true),
      isInterviewCompleteRef: mockRef(false),
      parallelStreamingTtsRef: mockRef({
        ...createInitialParallelStreamingTtsState(),
        spokenCompleteText: '',
      }),
    });
    const params = createMockPostClaudeParams({
      messagesToUse: [
        { role: 'assistant', content: MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT },
        { role: 'user', content: 'My coach called me out during practice.', interviewMoment: 5 },
        {
          role: 'assistant',
          content: 'What do you think you did or said that contributed to the conflict?',
        },
        { role: 'user', content: resolutionAnswer, interviewMoment: 5 },
      ],
      textToParallelStream: { full: '', spokenStarted: true, closingSpoken: true },
    });
    const closingDisplay =
      'Good work getting through all of this, Alex. Thank you for being so open with me, Alex.';

    const result = evaluatePostClaudeNaturalLanguageClosingHandoff(
      deps,
      params,
      {
        strippedText: closingDisplay,
        parallelStreamingPlaybackUsed: true,
        rawApiHadInterviewComplete: true,
      },
      closingDisplay,
      [
        ...params.messagesToUse,
        { role: 'assistant', content: closingDisplay, scenarioNumber: 3 },
      ],
      baseEmotionDiag,
    );

    expect(result.streamSpokeClosingThankYou).toBe(false);
    expect(result.shouldFailsafeComplete).toBe(true);
    expect(result.skipClosingSpeak).toBe(false);
    expect(result.effectiveSkipClosingSpeak).toBe(false);
  });

  it('does not skip closing speak when closingSpoken flag is set but stream only spoke accountability probe', () => {
    const accountabilityProbe =
      'Looking back — do you think there was anything you could have owned or done differently on your side?';
    const deps = createMockPostClaudeDeps({
      currentInterviewMomentRef: mockRef(5),
      moment5QuestionDeliveredRef: mockRef(true),
      moment5PrimaryAnchorDeliveredSessionRef: mockRef(true),
      moment5PostPromptUserTurnCountRef: mockRef(2),
      moment5AccountabilityProbeFiredRef: mockRef(true),
      isInterviewCompleteRef: mockRef(false),
      personalHandoffInjectedRef: mockRef(true),
      parallelStreamingTtsRef: mockRef({
        ...createInitialParallelStreamingTtsState(),
        spokenCompleteText: accountabilityProbe,
      }),
    });
    const params = createMockPostClaudeParams({
      messagesToUse: [
        { role: 'assistant', content: MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT },
        { role: 'user', content: 'My coach called me out during practice.', interviewMoment: 5 },
        { role: 'assistant', content: accountabilityProbe },
        {
          role: 'user',
          content: 'I raised my voice and should have listened first.',
          interviewMoment: 5,
        },
      ],
      textToParallelStream: { full: '', spokenStarted: true, closingSpoken: true },
    });
    const closingDisplay =
      'Good work getting through all of this, Alex. Thank you for being so open with me, Alex.';

    const result = evaluatePostClaudeNaturalLanguageClosingHandoff(
      deps,
      params,
      {
        strippedText: closingDisplay,
        parallelStreamingPlaybackUsed: true,
        rawApiHadInterviewComplete: true,
      },
      closingDisplay,
      [
        ...params.messagesToUse,
        { role: 'assistant', content: closingDisplay, scenarioNumber: 3 },
      ],
      baseEmotionDiag,
    );

    expect(result.streamSpokeClosingThankYou).toBe(false);
    expect(result.skipClosingSpeak).toBe(false);
    expect(result.effectiveSkipClosingSpeak).toBe(false);
  });

  it('does not skip closing speak when only the closingSpoken flag is set while TTS is in-flight', () => {
    const closingDisplay =
      'Good work getting through all of this, Alex. Thank you for being so open with me, Alex.';
    const sessionKey = 'attempt-in-flight';
    const deps = createMockPostClaudeDeps({
      currentInterviewMomentRef: mockRef(5),
      moment5QuestionDeliveredRef: mockRef(true),
      moment5PrimaryAnchorDeliveredSessionRef: mockRef(true),
      moment5PostPromptUserTurnCountRef: mockRef(2),
      moment5AccountabilityProbeFiredRef: mockRef(true),
      isInterviewCompleteRef: mockRef(false),
      interviewSessionAttemptIdRef: mockRef(sessionKey),
      parallelStreamingTtsRef: mockRef({
        ...createInitialParallelStreamingTtsState(),
        spokenCompleteText: '',
      }),
    });
    const params = createMockPostClaudeParams({
      textToParallelStream: { full: closingDisplay, spokenStarted: true, closingSpoken: true },
    });
    tryAcquireInterviewClosingSpeak(sessionKey);

    const result = evaluatePostClaudeNaturalLanguageClosingHandoff(
      deps,
      params,
      {
        strippedText: closingDisplay,
        parallelStreamingPlaybackUsed: true,
        rawApiHadInterviewComplete: true,
      },
      closingDisplay,
      [...params.messagesToUse, { role: 'assistant', content: closingDisplay }],
      baseEmotionDiag,
    );

    expect(result.closingSpeakInFlight).toBe(true);
    expect(result.skipClosingSpeak).toBe(false);
    expect(result.effectiveSkipClosingSpeak).toBe(false);
  });

  it('sets mustRunEmotionTransitionPath when natural emotion forward is active', () => {
    const deps = createMockPostClaudeDeps();
    const params = createMockPostClaudeParams();
    const displayText = 'Great — let us move on to the next scenario.';

    const result = evaluatePostClaudeNaturalLanguageClosingHandoff(
      deps,
      params,
      {
        strippedText: displayText,
        parallelStreamingPlaybackUsed: false,
        rawApiHadInterviewComplete: false,
      },
      displayText,
      [{ role: 'assistant', content: displayText }],
      {
        ...baseEmotionDiag,
        emotionNaturalForward: true,
        emotionCompletedScenario: 1,
      },
    );

    expect(result.mustRunEmotionTransitionPath).toBe(true);
    expect(result.shouldFailsafeComplete).toBe(false);
  });
});
