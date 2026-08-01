import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import {
  fetchAttemptScoringBaseline,
  persistMoment5ScoresImmediate,
} from '@utilities/persistPersonalMomentScoresIncremental';
import { runPreClaudeFrustrationSkipAcceptanceGate } from '@features/aria/runPreClaudeFrustrationSkipAcceptanceGate';
import { runPreClaudeFrustrationSkipDeclineGate } from '@features/aria/runPreClaudeFrustrationSkipDeclineGate';
import { SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY } from '@features/aria/probeAndScoringUtils';
import { createMockPreClaudeDeps } from './preClaudeGateTestHelpers';

jest.mock('@utilities/sessionLogging', () => ({
  getSessionLogRuntime: jest.fn(() => ({ attemptId: 'attempt-test', platform: 'web' })),
  writeSessionLog: jest.fn(),
  markQuestionDelivered: jest.fn(),
}));

jest.mock('@utilities/interviewAttemptLifecycle', () => ({
  persistInterviewAttemptSessionLifecycle: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@features/aria/interviewLocalPersistence', () => ({
  saveInterviewProgress: jest.fn().mockResolvedValue(undefined),
  markPreparingResultsSession: jest.fn(),
}));

jest.mock('@utilities/persistPersonalMomentScoresIncremental', () => ({
  fetchAttemptScoringBaseline: jest.fn().mockResolvedValue({}),
  persistMoment5ScoresImmediate: jest.fn().mockResolvedValue({}),
}));

jest.mock('@data/supabase/client', () => ({
  supabase: {
    from: jest.fn(() => ({
      update: jest.fn(() => ({
        eq: jest.fn(() => ({
          eq: jest.fn().mockResolvedValue({ data: null, error: null }),
        })),
      })),
    })),
  },
}));

const baseMessages = [
  { role: 'assistant', content: 'What is going on between these two?', scenarioNumber: 1 },
  { role: 'user', content: 'skip it', scenarioNumber: 1 },
];

describe('runPreClaudeFrustrationSkipAcceptanceGate', () => {
  it('returns null when skip injection route is inactive', async () => {
    const deps = createMockPreClaudeDeps({ isAdmin: true });

    const result = await runPreClaudeFrustrationSkipAcceptanceGate(deps, baseMessages);

    expect(result).toBeNull();
  });

  it('clears skip flags, keeps moment when more scripted questions remain, and client-delivers the next question', async () => {
    const deps = createMockPreClaudeDeps({
      currentInterviewMomentRef: { current: 1 },
      currentScenarioRef: { current: 1 },
      scenarioSkipOfferSourceRef: { current: 'frustration_first_signal' },
      frustrationSkipOfferPendingRef: { current: true },
      frustrationSkipAwaitingConfirmationRef: { current: true },
      frustrationSkipHadPriorAnswerRef: { current: true },
      scenarioSkipConfirmedCountRef: { current: 0 },
      scenarioSkipPenaltySumRef: { current: 0 },
      interviewSessionAttemptIdRef: { current: 'attempt-1' },
    });

    const result = await runPreClaudeFrustrationSkipAcceptanceGate(deps, baseMessages);

    expect(result).toEqual({ haltTurn: true });
    expect(deps.frustrationSkipOfferPendingRef.current).toBe(false);
    expect(deps.frustrationSkipAwaitingConfirmationRef.current).toBe(false);
    expect(deps.frustrationSkipHadPriorAnswerRef.current).toBeNull();
    expect(deps.scenarioSkipOfferSourceRef.current).toBeNull();
    expect(deps.currentInterviewMomentRef.current).toBe(1);
    expect(deps.interviewMomentsCompleteRef.current[1]).toBeFalsy();
    expect(deps.scenarioFrustrationSkipNullMarkersRef.current[1]).toBeFalsy();
    expect(deps.scenarioSkipConfirmedCountRef.current).toBe(1);
    expect(deps.skipContinuationSystemSuffixRef.current).toBe('');
  });

  it('completes interview and hands off to preparing_results when M5 skip is confirmed', async () => {
    const speakTextSafe = jest.fn().mockResolvedValue(undefined);
    const setInterviewStatus = jest.fn();
    const setPendingCompletion = jest.fn();
    const kickCompletionScoring = jest.fn().mockReturnValue(true);
    const deps = createMockPreClaudeDeps({
      currentInterviewMomentRef: { current: 5 },
      currentScenarioRef: { current: 3 },
      scenarioSkipOfferSourceRef: { current: 'skip_request_meta' },
      frustrationSkipOfferPendingRef: { current: true },
      frustrationSkipAwaitingConfirmationRef: { current: true },
      scenarioSkipConfirmedCountRef: { current: 0 },
      scenarioSkipPenaltySumRef: { current: 0 },
      interviewNameRef: { current: 'Matt' },
      interviewSessionAttemptIdRef: { current: 'attempt-1' },
      isInterviewCompleteRef: { current: false },
      interviewStatusRef: { current: 'in_progress' },
      speakTextSafe,
      setInterviewStatus,
      setPendingCompletion,
      kickCompletionScoring,
    });
    const m5Messages = [
      {
        role: 'assistant',
        content: 'Think of a time when you had a conflict with someone important to you.',
        scenarioNumber: 3,
        interviewMoment: 5,
      },
      { role: 'user', content: 'Can we skip this one?', scenarioNumber: 3, interviewMoment: 5 },
    ];

    const result = await runPreClaudeFrustrationSkipAcceptanceGate(deps, m5Messages);

    expect(result).toEqual({ haltTurn: true });
    expect(deps.scenarioSkipConfirmedCountRef.current).toBe(1);
    expect(deps.scenarioSkipPenaltySumRef.current).toBe(-0.3);
    expect(deps.isInterviewCompleteRef.current).toBe(true);
    expect(deps.interviewMomentsCompleteRef.current[5]).toBe(true);
    expect(setInterviewStatus).toHaveBeenCalledWith('preparing_results');
    expect(setPendingCompletion).toHaveBeenCalledWith(true);
    expect(kickCompletionScoring).toHaveBeenCalledWith('m5_skip_accepted', expect.any(Array));
    const spoken = String(speakTextSafe.mock.calls[0]?.[0] ?? '');
    expect(spoken).toMatch(/your interview is complete/i);
    expect(spoken).not.toMatch(/may affect your score/i);
    expect(fetchAttemptScoringBaseline).toHaveBeenCalledWith(expect.anything(), 'attempt-1', 'user-test');
    expect(persistMoment5ScoresImmediate).toHaveBeenCalledWith(
      expect.anything(),
      'attempt-1',
      'user-test',
      expect.objectContaining({
        pillarScores: expect.objectContaining({ accountability: null }),
      }),
      expect.anything(),
      expect.objectContaining({ skipped_by_user: true }),
    );
  });
});

describe('runPreClaudeFrustrationSkipDeclineGate', () => {
  it('returns null when skip injection route is inactive', async () => {
    const deps = createMockPreClaudeDeps({ status: 'results' });

    const result = await runPreClaudeFrustrationSkipDeclineGate(deps, baseMessages);

    expect(result).toBeNull();
  });

  it('delivers encouragement and halts the turn', async () => {
    const speakTextSafe = jest.fn().mockResolvedValue(undefined);
    const setMessages = jest.fn();
    const deps = createMockPreClaudeDeps({
      currentInterviewMomentRef: { current: 2 },
      currentScenarioRef: { current: 1 },
      frustrationSkipOfferPendingRef: { current: true },
      scenarioSkipOfferSourceRef: { current: 'inability_escalation' },
      inabilityCountByMomentRef: { current: { 2: 2 } },
      speakTextSafe,
      setMessages,
    });

    const result = await runPreClaudeFrustrationSkipDeclineGate(deps, baseMessages);

    expect(result).toEqual({ haltTurn: true });
    expect(deps.frustrationSkipOfferPendingRef.current).toBe(false);
    expect(deps.inabilityCountByMomentRef.current[2]).toBe(0);
    expect(speakTextSafe).toHaveBeenCalledTimes(2);
    expect(speakTextSafe).toHaveBeenNthCalledWith(
      1,
      expect.stringMatching(/stay on this one/i),
      expect.objectContaining({
        skipLastQuestionRef: true,
        skipQuestionDeliveredTelemetry: true,
        allowDuplicateConsecutiveTts: true,
      }),
    );
    expect(speakTextSafe).toHaveBeenNthCalledWith(
      2,
      expect.stringMatching(/What is going on between these two/i),
      expect.objectContaining({ allowDuplicateConsecutiveTts: true }),
    );
    expect(setMessages).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          role: 'assistant',
          scenarioNumber: 1,
        }),
      ]),
    );
  });

  it('re-asks the pending scenario question after skip decline encouragement', async () => {
    const speakTextSafe = jest.fn().mockResolvedValue(undefined);
    const setMessages = jest.fn();
    const repairQ = SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY;
    const messages = [
      { role: 'assistant', content: repairQ, scenarioNumber: 1 },
      { role: 'user', content: "I don't know", scenarioNumber: 1 },
      { role: 'user', content: 'No.', scenarioNumber: 1 },
    ];
    const deps = createMockPreClaudeDeps({
      currentInterviewMomentRef: { current: 1 },
      currentScenarioRef: { current: 1 },
      lastQuestionTextRef: { current: repairQ },
      frustrationSkipOfferPendingRef: { current: true },
      scenarioSkipOfferSourceRef: { current: 'inability_escalation' },
      inabilityCountByMomentRef: { current: { 1: 1 } },
      speakTextSafe,
      setMessages,
    });

    const result = await runPreClaudeFrustrationSkipDeclineGate(deps, messages);

    expect(result).toEqual({ haltTurn: true });
    expect(speakTextSafe).toHaveBeenCalledTimes(2);
    expect(speakTextSafe).toHaveBeenNthCalledWith(
      1,
      expect.stringMatching(/stay on this one/i),
      expect.objectContaining({
        skipLastQuestionRef: true,
        skipQuestionDeliveredTelemetry: true,
        allowDuplicateConsecutiveTts: true,
      }),
    );
    expect(speakTextSafe).toHaveBeenNthCalledWith(
      2,
      expect.stringMatching(/If you were Ryan, how would you repair this/i),
      expect.objectContaining({ allowDuplicateConsecutiveTts: true }),
    );
    expect(deps.lastQuestionTextRef.current).toBe(repairQ);
  });
});
