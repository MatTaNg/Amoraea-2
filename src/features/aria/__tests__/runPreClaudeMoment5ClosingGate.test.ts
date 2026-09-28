import { describe, expect, it, jest } from '@jest/globals';

import { runPreClaudeMoment5ClosingGate } from '@features/aria/runPreClaudeMoment5ClosingGate';
import { MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT } from '@features/aria/moment5ProbeCopy';
import type { PreClaudeTurnGateDeps } from '@features/aria/preClaudeTurnGateTypes';
import type { MessageWithScenario } from '@features/aria/interviewScenarioScoringSlice';
import type { InterviewTurnOrchestratorDecision } from '@features/aria/interviewTurnOrchestratorTypes';

const DEVANSHU_ANSWER =
  'I had a conflict with my friend Devanshu, he said I was a bad coach and I was just starting out coaching and so I got a little triggered and I raised my voice at him. This ended up being facilitated by someone else and we were able to see each other and we\'re good now.';

function buildDeps(overrides: Partial<PreClaudeTurnGateDeps> = {}): PreClaudeTurnGateDeps {
  return {
    currentInterviewMomentRef: { current: 5 },
    moment5QuestionDeliveredRef: { current: true },
    moment5PrimaryAnchorDeliveredSessionRef: { current: true },
    moment5PostPromptUserTurnCountRef: { current: 1 },
    moment5AccountabilityProbeFiredRef: { current: false },
    moment5ResolutionDeliveredRef: { current: false },
    interviewNameRef: { current: 'Matt' },
    scenarioScoresRef: { current: {} },
    scoredScenariosRef: { current: new Set<number>() },
    emotionItemResponsesRef: { current: [] },
    resumeActiveScenarioRef: { current: 3 },
    interviewSessionAttemptIdRef: { current: 'attempt-1' },
    interviewSessionIdRef: { current: 'session-1' },
    interviewStatusRef: { current: 'active' },
    currentMessagesRef: { current: [] },
    pendingCompletionTranscriptRef: { current: null },
    interviewMomentsCompleteRef: { current: { 1: true, 2: true, 3: true, 4: false, 5: false } },
    isInterviewCompleteRef: { current: false },
    skipContinuationSystemSuffixRef: { current: '' },
    setMessages: jest.fn(),
    speakTextSafe: jest.fn(async () => undefined),
    kickCompletionScoring: jest.fn(),
    setInterviewStatus: jest.fn(),
    setPendingCompletion: jest.fn(),
    setVoiceState: jest.fn(),
    setIsWaiting: jest.fn(),
    userId: 'user-1',
    ...overrides,
  } as unknown as PreClaudeTurnGateDeps;
}

describe('runPreClaudeMoment5ClosingGate', () => {
  it('delivers client closing instead of Claude when M5 answer satisfies close gate', async () => {
    const messages: MessageWithScenario[] = [
      { role: 'assistant', content: MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT, interviewMoment: 5 },
      { role: 'user', content: DEVANSHU_ANSWER, interviewMoment: 5 },
    ];
    const decision: InterviewTurnOrchestratorDecision = {
      source: 'heuristic_v1',
      userIntent: 'substantive_answer',
      activeQuestionPreview: MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT.slice(0, 160),
      satisfiedProbeIds: ['m5_conflict'],
      pendingProbeId: null,
      activeConstructEngaged: true,
      action: { kind: 'delegate_claude', hint: 'check_before_ask' },
      reason: 'test',
    };

    const deps = buildDeps();
    const result = await runPreClaudeMoment5ClosingGate({
      deps,
      messagesToUse: messages,
      moment5CombinedUserText: DEVANSHU_ANSWER,
      decision,
    });

    expect(result.handled).toBe(true);
    expect(deps.speakTextSafe).toHaveBeenCalled();
    expect(deps.kickCompletionScoring).toHaveBeenCalledWith('m5_substantive_close', expect.any(Array));
    expect(deps.isInterviewCompleteRef.current).toBe(true);
  });
});
