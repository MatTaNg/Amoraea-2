import { describe, expect, it, jest } from '@jest/globals';

import { buildPostClaudeScenarioScoresPayload } from '@features/aria/buildPostClaudeScenarioScoresPayload';
import {
  finalizePostClaudePendingInterviewCompletion,
  markPostClaudeInterviewCompletionState,
} from '@features/aria/finalizePostClaudePendingInterviewCompletion';
import { sanitizePostClaudeClosingDisplayText } from '@features/aria/sanitizePostClaudeClosingDisplayText';
import {
  createMockPostClaudeDeps,
  createMockPostClaudeParams,
  mockRef,
} from './postClaudeGateTestHelpers';

describe('buildPostClaudeScenarioScoresPayload', () => {
  it('maps stored scenario scores for scenarios 1-3', () => {
    const deps = createMockPostClaudeDeps({
      scenarioScoresRef: mockRef({
        1: {
          pillarScores: { mentalizing: 5 },
          pillarConfidence: { mentalizing: 'high' },
          keyEvidence: { mentalizing: 'quote' },
          scenarioName: 'Scenario A',
        },
      }),
    });

    expect(buildPostClaudeScenarioScoresPayload(deps)).toEqual({
      1: {
        pillarScores: { mentalizing: 5 },
        pillarConfidence: { mentalizing: 'high' },
        keyEvidence: { mentalizing: 'quote' },
        scenarioName: 'Scenario A',
      },
    });
  });
});

describe('sanitizePostClaudeClosingDisplayText', () => {
  it('strips control tokens and preserves participant name', () => {
    const deps = createMockPostClaudeDeps({
      interviewNameRef: mockRef('Alex'),
    });
    const params = createMockPostClaudeParams({
      trimmed: 'we talked it through',
      messagesToUse: [{ role: 'user', content: 'we talked it through' }],
    });

    const result = sanitizePostClaudeClosingDisplayText(
      deps,
      params.messagesToUse,
      params.trimmed,
      'Thank you Alex. [INTERVIEW_COMPLETE]',
    );

    expect(result).not.toMatch(/\[INTERVIEW_COMPLETE\]/i);
    expect(result.toLowerCase()).toMatch(/alex|thank/);
  });
});

describe('finalizePostClaudePendingInterviewCompletion', () => {
  it('marks completion state, persists progress, and kicks scoring', async () => {
    const kickCompletionScoring = jest.fn().mockReturnValue(true);
    const setPendingCompletion = jest.fn();
    const setPendingScoringSyncAttemptId = jest.fn();
    const saveInterviewProgress = jest.fn().mockResolvedValue(undefined);
    const deps = createMockPostClaudeDeps({
      kickCompletionScoring,
      setPendingCompletion,
      setPendingScoringSyncAttemptId,
      saveInterviewProgress,
      interviewSessionAttemptIdRef: mockRef('attempt-xyz'),
      scoredScenariosRef: mockRef(new Set([1, 2, 3])),
    });
    const transcript = [
      { role: 'user', content: 'answer' },
      { role: 'assistant', content: 'Thanks Alex.' },
    ];

    const kicked = await finalizePostClaudePendingInterviewCompletion(deps, {
      source: 'interview_complete_token',
      transcriptForScoring: transcript,
      persistSessionLifecycle: true,
      markCompletionState: true,
    });

    expect(kicked).toBe(true);
    expect(deps.isInterviewCompleteRef.current).toBe(true);
    expect(deps.currentInterviewMomentRef.current).toBe(5);
    expect(deps.pendingCompletionTranscriptRef.current).toEqual(transcript);
    expect(saveInterviewProgress).toHaveBeenCalledWith(
      'user-test',
      expect.objectContaining({ pendingCompletion: true }),
    );
    expect(kickCompletionScoring).toHaveBeenCalledWith('interview_complete_token', transcript);
    expect(setPendingCompletion).toHaveBeenCalledWith(true);
    expect(setPendingScoringSyncAttemptId).toHaveBeenCalledWith('attempt-xyz');
    expect(deps.interviewStatusRef.current).toBe('preparing_results');
  });

  it('does not catch up emotion modals at interview completion by default', async () => {
    const kickCompletionScoring = jest.fn().mockReturnValue(true);
    const awaitEmotionModalForIndex = jest.fn().mockResolvedValue(undefined);
    const deps = createMockPostClaudeDeps({
      kickCompletionScoring,
      awaitEmotionModalForIndex,
      listUnansweredEmotionModalIndices: jest.fn().mockReturnValue([0, 1]),
    });

    await finalizePostClaudePendingInterviewCompletion(deps, {
      source: 'closing_failsafe',
      transcriptForScoring: [{ role: 'assistant', content: 'Thank you.' }],
    });

    expect(awaitEmotionModalForIndex).not.toHaveBeenCalled();
  });

  it('skips emotion catch-up for stream-only handoff but tracks score attempt', async () => {
    const kickCompletionScoring = jest.fn().mockReturnValue(true);
    const awaitEmotionModalForIndex = jest.fn().mockResolvedValue(undefined);
    const deps = createMockPostClaudeDeps({
      kickCompletionScoring,
      awaitEmotionModalForIndex,
      listUnansweredEmotionModalIndices: jest.fn().mockReturnValue([0, 1]),
    });

    await finalizePostClaudePendingInterviewCompletion(deps, {
      source: 'closing_stream_only_handoff',
      transcriptForScoring: [{ role: 'assistant', content: 'Thank you.' }],
    });

    expect(awaitEmotionModalForIndex).not.toHaveBeenCalled();
    expect(deps.scoreInterviewAttemptedRef.current).toBe(true);
  });
});

describe('markPostClaudeInterviewCompletionState', () => {
  it('sets moment 5 complete flags', () => {
    const deps = createMockPostClaudeDeps({
      interviewMomentsCompleteRef: mockRef({}),
      isInterviewCompleteRef: mockRef(false),
      currentInterviewMomentRef: mockRef(4),
    });

    markPostClaudeInterviewCompletionState(deps);

    expect(deps.interviewMomentsCompleteRef.current[4]).toBe(true);
    expect(deps.interviewMomentsCompleteRef.current[5]).toBe(true);
    expect(deps.currentInterviewMomentRef.current).toBe(5);
    expect(deps.isInterviewCompleteRef.current).toBe(true);
  });
});
