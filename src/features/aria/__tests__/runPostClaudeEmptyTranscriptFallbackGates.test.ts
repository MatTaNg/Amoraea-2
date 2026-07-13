import { describe, expect, it, jest } from '@jest/globals';

import { runPostClaudeEmptyTranscriptFallbackGates } from '@features/aria/runPostClaudeEmptyTranscriptFallbackGates';
import type { PostClaudeEmptyTranscriptFallbackContext } from '@features/aria/runPostClaudeEmptyTranscriptFallbackGates';
import { computeMoment5InterviewCloseGate } from '@features/aria/interviewProgressSync';
import { parallelStreamDeliveredMoment5ClosingAttempt } from '@features/aria/elongatingProbe';
import { createInitialParallelStreamingTtsState } from '@features/aria/interviewParallelTtsBatch';
import { MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT } from '@features/aria/probeAndScoringUtils';
import {
  createMockPostClaudeDeps,
  createMockPostClaudeParams,
  createMockSpeakAssistantTurn,
} from './postClaudeGateTestHelpers';

const emptyCtx = (
  overrides: Partial<PostClaudeEmptyTranscriptFallbackContext> = {},
): PostClaudeEmptyTranscriptFallbackContext => ({
  assistantTurnIsElongatingProbeOnly: false,
  shouldInjectScenarioARepairAfterContemptAnswer: false,
  assistantIssuedScenarioAContemptProbe: false,
  assistantIssuedScenarioBFullProbe: false,
  needsScenarioBJamesDifferentlyInsert: false,
  parallelStreamingPlaybackUsed: false,
  streamFullTrimmed: '',
  ...overrides,
});

describe('runPostClaudeEmptyTranscriptFallbackGates', () => {
  it('returns handled:false with passthrough when displayText has persistable content', async () => {
    const deps = createMockPostClaudeDeps();
    const params = createMockPostClaudeParams();
    const speak = createMockSpeakAssistantTurn();

    const result = await runPostClaudeEmptyTranscriptFallbackGates(
      deps,
      params,
      emptyCtx(),
      'model raw',
      'Thanks Alex, that makes sense.',
      speak,
    );

    expect(result).toEqual({
      handled: false,
      text: 'model raw',
      displayText: 'Thanks Alex, that makes sense.',
    });
    expect(speak).not.toHaveBeenCalled();
  });

  it('idles and returns handled:true when transcript is empty with no fallback path', async () => {
    const deps = createMockPostClaudeDeps();
    const params = createMockPostClaudeParams({
      elongatingSuppressedForUserTurn: false,
    });
    const speak = createMockSpeakAssistantTurn();

    const result = await runPostClaudeEmptyTranscriptFallbackGates(
      deps,
      params,
      emptyCtx(),
      '   ',
      '',
      speak,
    );

    expect(result).toEqual({ handled: true });
    expect(deps.setVoiceState).toHaveBeenCalledWith('idle');
    expect(speak).not.toHaveBeenCalled();
  });

  it('uses M4 threshold fallback instead of neutral ack when commitment follow-up is due', async () => {
    const deps = createMockPostClaudeDeps({
      currentInterviewMomentRef: { current: 4 },
      moment4ThresholdProbeAskedRef: { current: false },
    });
    const params = createMockPostClaudeParams({
      elongatingSuppressedForUserTurn: true,
      shouldForceMoment4ThresholdProbe: true,
      participantFirstNameForSpoken: 'Matt',
    });
    const speak = createMockSpeakAssistantTurn();

    const result = await runPostClaudeEmptyTranscriptFallbackGates(
      deps,
      params,
      emptyCtx({
        streamFullTrimmed:
          'How do you decide when something like that is worth working through versus just walking away from?',
      }),
      'How do you decide when something like that is worth working through versus just walking away from?',
      '',
      speak,
    );

    expect(result.handled).toBe(false);
    if (!result.handled) {
      expect(result.displayText).toMatch(/work through versus.*walk away/i);
      expect(result.displayText.toLowerCase()).not.toMatch(/^thank you for sharing that, matt\.$/);
    }
  });

  it('uses neutral ack fallback after suppressed elongating in personal moment', async () => {
    const deps = createMockPostClaudeDeps({
      currentInterviewMomentRef: { current: 4 },
    });
    const params = createMockPostClaudeParams({
      elongatingSuppressedForUserTurn: true,
      participantFirstNameForSpoken: 'Alex',
    });
    const speak = createMockSpeakAssistantTurn();

    const result = await runPostClaudeEmptyTranscriptFallbackGates(
      deps,
      params,
      emptyCtx(),
      '...',
      '',
      speak,
    );

    expect(result.handled).toBe(false);
    if (!result.handled) {
      expect(result.displayText.length).toBeGreaterThan(0);
      expect(result.displayText.toLowerCase()).toMatch(/alex|thank|hear/);
    }
  });

  it('injects S1→S2 bundle when elongating suppressed and repair satisfied past modal follow-up', async () => {
    const deps = createMockPostClaudeDeps({
      scenarioAContemptProbeAskedRef: { current: true },
      scenarioARepairQuestionAskedRef: { current: true },
      currentInterviewMomentRef: { current: 1 },
      currentScenarioRef: { current: 1 },
    });
    const params = createMockPostClaudeParams({
      elongatingSuppressedForUserTurn: true,
      participantFirstNameForSpoken: 'Matt',
      messagesToUse: [
        { role: 'assistant', content: 'If you were Ryan, how would you repair this?' },
        { role: 'assistant', content: 'Just say whatever comes to mind.' },
        {
          role: 'user',
          content:
            'I said I would make sure all calls go to voicemail during dates with my mom and commit to it.',
        },
      ],
    });
    const speak = createMockSpeakAssistantTurn();

    const result = await runPostClaudeEmptyTranscriptFallbackGates(
      deps,
      params,
      emptyCtx(),
      'Got it. What do you make of Emma saying "you\'ve made that very clear"',
      '',
      speak,
    );

    expect(result.handled).toBe(false);
    if (!result.handled) {
      expect(result.text).toMatch(/\[SCENARIO_COMPLETE:1\]/i);
      expect(result.displayText).toMatch(/Sarah has been job hunting/i);
    }
  });

  it('does not inject S1→S2 bundle when elongating suppressed during Scenario 3', async () => {
    const deps = createMockPostClaudeDeps({
      scenarioAContemptProbeAskedRef: { current: true },
      scenarioARepairQuestionAskedRef: { current: true },
      s3RepairProbeDeliveredRef: { current: false },
      currentInterviewMomentRef: { current: 3 },
      currentScenarioRef: { current: 3 },
    });
    const params = createMockPostClaudeParams({
      elongatingSuppressedForUserTurn: true,
      participantFirstNameForSpoken: 'Matt',
      messagesToUse: [
        { role: 'assistant', content: 'If you were Ryan, how would you repair this?' },
        {
          role: 'user',
          content:
            'I said I would make sure all calls go to voicemail during dates with my mom and commit to it.',
          scenarioNumber: 1,
          interviewMoment: 1,
        },
        {
          role: 'assistant',
          content: 'Sophie and Daniel have had the same argument for the third time.',
          scenarioNumber: 3,
          interviewMoment: 3,
        },
        {
          role: 'user',
          content:
            'Yeah, if I were James, I would say I am sorry — he needs help with emotional intelligence.',
          scenarioNumber: 3,
          interviewMoment: 3,
        },
      ],
    });
    const speak = createMockSpeakAssistantTurn();

    const result = await runPostClaudeEmptyTranscriptFallbackGates(
      deps,
      params,
      emptyCtx(),
      'Got it. And with Sophie still upset when Daniel comes back — what do you think she needs?',
      '',
      speak,
    );

    if (!result.handled) {
      expect(result.displayText).not.toMatch(/Sarah has been job hunting/i);
      expect(result.text).not.toMatch(/\[SCENARIO_COMPLETE:1\]/i);
    }
  });

  it('hands off to preparing_results when stream spoke incomplete M5 closing and model draft is empty', async () => {
    const resolutionAnswer =
      'I raised my voice and should have listened first. We talked it through after.';
    const incompleteStreamClosing =
      'Good work getting through all of this, Alex. What stood out to me was that you';
    const messagesToUse = [
      { role: 'assistant', content: MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT },
      { role: 'user', content: 'My coach called me out during practice.', interviewMoment: 5 },
      {
        role: 'assistant',
        content: 'What do you think you did or said that contributed to the conflict?',
      },
      { role: 'user', content: resolutionAnswer, interviewMoment: 5 },
    ];
    const transcriptSlice = messagesToUse.map((m) => ({
      role: m.role,
      content: (m as { content?: string }).content ?? '',
      interviewMoment: (m as { interviewMoment?: number }).interviewMoment,
    }));
    const closeGate = computeMoment5InterviewCloseGate(transcriptSlice, {
      moment5QuestionDelivered: true,
      moment5PrimaryAnchorSession: true,
      postM5UserTurnsRef: 2,
      accountabilityProbeFired: true,
      currentInterviewMoment: 5,
    });
    expect(closeGate.moment5CloseAllowed).toBe(true);
    expect(
      parallelStreamDeliveredMoment5ClosingAttempt({
        spokenCompleteText: incompleteStreamClosing,
        streamFullText: incompleteStreamClosing,
        closingSpokenInStream: false,
      }),
    ).toBe(true);

    const setInterviewStatus = jest.fn();
    const setPendingCompletion = jest.fn();
    const kickCompletionScoring = jest.fn().mockReturnValue(true);
    const deps = createMockPostClaudeDeps({
      currentInterviewMomentRef: { current: 5 },
      moment5QuestionDeliveredRef: { current: true },
      moment5PrimaryAnchorDeliveredSessionRef: { current: true },
      moment5PostPromptUserTurnCountRef: { current: 2 },
      moment5AccountabilityProbeFiredRef: { current: true },
      setInterviewStatus,
      setPendingCompletion,
      kickCompletionScoring,
      parallelStreamingTtsRef: {
        current: {
          ...createInitialParallelStreamingTtsState(),
          spokenCompleteText: incompleteStreamClosing,
        },
      },
    });
    const params = createMockPostClaudeParams({
      participantFirstNameForSpoken: 'Alex',
      messagesToUse,
      textToParallelStream: { full: incompleteStreamClosing, spokenStarted: true, closingSpoken: false },
    });
    const speak = createMockSpeakAssistantTurn();

    const result = await runPostClaudeEmptyTranscriptFallbackGates(
      deps,
      params,
      emptyCtx({ parallelStreamingPlaybackUsed: true, streamFullTrimmed: incompleteStreamClosing }),
      '',
      '',
      speak,
    );

    expect(result).toEqual({ handled: true });
    expect(setInterviewStatus).toHaveBeenCalledWith('preparing_results');
    expect(setPendingCompletion).toHaveBeenCalledWith(true);
    expect(kickCompletionScoring).toHaveBeenCalled();
  });

  it('injects S3→M4 advance when repair Q2 was answered and Sophie-receive misparaphrase stripped to empty', async () => {
    const userAnswer =
      "Daniel needs to own the pattern across all the times this has happened, not just tonight. He needs to say explicitly when I asked for 10 minutes, I'm coming back, not leaving. Sophie needs to be able to trust that before his pauses stop feeling like abandonment.";
    const deps = createMockPostClaudeDeps({
      currentInterviewMomentRef: { current: 3 },
      currentScenarioRef: { current: 3 },
    });
    const params = createMockPostClaudeParams({
      elongatingSuppressedForUserTurn: true,
      participantFirstNameForSpoken: 'Matt',
      messagesToUse: [
        { role: 'assistant', content: 'How do you think this situation could be repaired?' },
        { role: 'user', content: userAnswer },
      ],
    });
    const speak = createMockSpeakAssistantTurn();

    const result = await runPostClaudeEmptyTranscriptFallbackGates(
      deps,
      params,
      emptyCtx({
        streamFullTrimmed:
          'Got it. How would you want Sophie to respond when Daniel comes back and says "I didn\'t know what to say"?',
      }),
      'Got it. How would you want Sophie to respond when Daniel comes back and says "I didn\'t know what to say"?',
      '',
      speak,
    );

    expect(result).toEqual({
      handled: false,
      text: expect.stringMatching(/\[SCENARIO_COMPLETE:3\]/i),
      displayText: expect.stringMatching(/held a grudge|really hard time with/i),
    });
    expect(speak).not.toHaveBeenCalled();
  });
});
