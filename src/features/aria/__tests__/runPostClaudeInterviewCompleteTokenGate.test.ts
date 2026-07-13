import { describe, expect, it, jest } from '@jest/globals';

import { runPostClaudeInterviewCompleteTokenGate } from '@features/aria/runPostClaudeInterviewCompleteTokenGate';
import {
  createMockPostClaudeDeps,
  createMockPostClaudeParams,
  createMockSpeakAssistantTurn,
  mockRef,
} from './postClaudeGateTestHelpers';

describe('runPostClaudeInterviewCompleteTokenGate', () => {
  it('returns handled:false when token is absent', async () => {
    const deps = createMockPostClaudeDeps();
    const params = createMockPostClaudeParams();
    const speak = createMockSpeakAssistantTurn();

    const result = await runPostClaudeInterviewCompleteTokenGate(
      deps,
      params,
      'Thank you for sharing.',
      speak,
    );

    expect(result).toEqual({ handled: false });
  });

  it('skips duplicate complete and idles voice when interview already complete', async () => {
    const kickCompletionScoring = jest.fn();
    const deps = createMockPostClaudeDeps({
      isInterviewCompleteRef: mockRef(true),
      kickCompletionScoring,
    });
    const params = createMockPostClaudeParams();
    const speak = createMockSpeakAssistantTurn();

    const result = await runPostClaudeInterviewCompleteTokenGate(
      deps,
      params,
      'Thanks Alex. [INTERVIEW_COMPLETE]',
      speak,
    );

    expect(result).toEqual({ handled: true });
    expect(deps.setVoiceState).toHaveBeenCalledWith('idle');
    expect(kickCompletionScoring).not.toHaveBeenCalled();
    expect(speak).not.toHaveBeenCalled();
  });

  it('completes interview on first [INTERVIEW_COMPLETE] token', async () => {
    const kickCompletionScoring = jest.fn();
    const setPendingCompletion = jest.fn();
    const setPendingScoringSyncAttemptId = jest.fn();
    const saveInterviewProgress = jest.fn().mockResolvedValue(undefined);
    const deps = createMockPostClaudeDeps({
      kickCompletionScoring,
      setPendingCompletion,
      setPendingScoringSyncAttemptId,
      saveInterviewProgress,
      interviewSessionAttemptIdRef: mockRef('attempt-abc'),
      scoredScenariosRef: mockRef(new Set([1, 2, 3])),
    });
    const params = createMockPostClaudeParams({
      trimmed: 'we talked it through',
      messagesToUse: [{ role: 'user', content: 'we talked it through' }],
    });
    const speak = createMockSpeakAssistantTurn();

    const result = await runPostClaudeInterviewCompleteTokenGate(
      deps,
      params,
      'Thank you Alex for being so open. [INTERVIEW_COMPLETE]',
      speak,
    );

    expect(result).toEqual({ handled: true });
    expect(deps.isInterviewCompleteRef.current).toBe(true);
    expect(deps.currentInterviewMomentRef.current).toBe(5);
    expect(deps.interviewMomentsCompleteRef.current[4]).toBe(true);
    expect(deps.interviewMomentsCompleteRef.current[5]).toBe(true);
    expect(speak).toHaveBeenCalled();
    expect(kickCompletionScoring).toHaveBeenCalledWith(
      'interview_complete_token',
      expect.arrayContaining([expect.objectContaining({ role: 'assistant' })]),
    );
    expect(saveInterviewProgress).toHaveBeenCalledWith(
      'user-test',
      expect.objectContaining({ pendingCompletion: true }),
    );
    expect(setPendingCompletion).toHaveBeenCalledWith(true);
    expect(setPendingScoringSyncAttemptId).toHaveBeenCalledWith('attempt-abc');
    expect(deps.persistInterviewAttemptSessionLifecycle).toHaveBeenCalledWith('attempt-abc', 'completed');
  });
});
