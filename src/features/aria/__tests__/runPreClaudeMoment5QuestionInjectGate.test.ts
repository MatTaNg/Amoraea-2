import { describe, expect, it, jest } from '@jest/globals';

import { MOMENT_4_GRUDGE_QUESTION_TEXT } from '@features/aria/moment4ProbeLogic';
import { MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT } from '@features/aria/probeAndScoringUtils';
import { runPreClaudeMoment5QuestionInjectGate } from '@features/aria/runPreClaudeMoment5QuestionInjectGate';
import { createMockPreClaudeDeps } from './preClaudeGateTestHelpers';

const mockTriggerLiveMoment4ScoringOnM5Entry = jest.fn();

jest.mock('@features/aria/liveMoment4ScoringOnM5Entry', () => ({
  triggerLiveMoment4ScoringOnM5Entry: (...args: unknown[]) =>
    mockTriggerLiveMoment4ScoringOnM5Entry(...args),
}));

jest.mock('@utilities/storage/InterviewStorage', () => ({
  getCurrentScenario: jest.fn().mockReturnValue(3),
  loadInterviewFromStorage: jest.fn().mockResolvedValue(null),
  mergeInterviewStoragePayload: jest.fn((prior: unknown, patch: Record<string, unknown>) => ({
    ...(prior as object),
    ...patch,
  })),
  saveInterviewToStorage: jest.fn().mockResolvedValue(undefined),
}));

const M4_THRESHOLD_QUESTION =
  'Thanks for sharing that. At what point do you decide when a relationship is something to work through versus something you need to walk away from?';

describe('runPreClaudeMoment5QuestionInjectGate', () => {
  it('returns handled:false when not answering first turn after M4 threshold', async () => {
    mockTriggerLiveMoment4ScoringOnM5Entry.mockClear();
    const deps = createMockPreClaudeDeps({
      currentInterviewMomentRef: { current: 4 },
    });
    const messagesToUse = [
      { role: 'assistant', content: M4_THRESHOLD_QUESTION },
      { role: 'user', content: 'First answer about trust.' },
      { role: 'assistant', content: 'Can you say more?' },
      { role: 'user', content: 'Second answer.' },
    ];

    const result = await runPreClaudeMoment5QuestionInjectGate(deps, messagesToUse, 'Alex');

    expect(result).toEqual({ handled: false });
    expect(mockTriggerLiveMoment4ScoringOnM5Entry).not.toHaveBeenCalled();
  });

  it('injects Moment 5 anchor after first user answer to M4 threshold probe', async () => {
    mockTriggerLiveMoment4ScoringOnM5Entry.mockClear();
    const speakTextSafe = jest.fn().mockResolvedValue(undefined);
    const setMessages = jest.fn();
    const deps = createMockPreClaudeDeps({
      currentInterviewMomentRef: { current: 4 },
      moment4ThresholdProbeAskedRef: { current: true },
      moment5QuestionDeliveredRef: { current: false },
      moment5QuestionDeliveryInFlightRef: { current: false },
      interviewSessionAttemptIdRef: { current: 'attempt-live-m4' },
      speakTextSafe,
      setMessages,
    });
    const userAnswer = 'I would walk away when trust is broken and repair feels impossible.';
    const messagesToUse = [
      { role: 'assistant', content: M4_THRESHOLD_QUESTION },
      { role: 'user', content: userAnswer },
    ];

    const result = await runPreClaudeMoment5QuestionInjectGate(deps, messagesToUse, 'Alex');

    expect(result).toEqual({ handled: true });
    expect(deps.moment5QuestionDeliveredRef.current).toBe(true);
    expect(deps.currentInterviewMomentRef.current).toBe(5);
    expect(deps.moment5PrimaryAnchorDeliveredSessionRef.current).toBe(true);
    expect(deps.lastQuestionTextRef.current).toBe(MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT);
    expect(speakTextSafe).toHaveBeenCalledWith(
      expect.stringMatching(/conflict with someone important/i),
      expect.any(Object),
    );
    expect(setMessages).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          role: 'assistant',
          content: expect.stringMatching(/Alex|conflict/i),
        }),
      ]),
    );
    expect(MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT.length).toBeGreaterThan(20);
    expect(mockTriggerLiveMoment4ScoringOnM5Entry).toHaveBeenCalledWith(
      expect.objectContaining({
        trigger: 'm5_client_inject_after_m4_threshold',
        attemptId: 'attempt-live-m4',
      }),
    );
  });

  it('does not inject Moment 5 while resume welcome flow owns playback', async () => {
    const speakTextSafe = jest.fn().mockResolvedValue(undefined);
    const deps = createMockPreClaudeDeps({
      currentInterviewMomentRef: { current: 4 },
      moment4ThresholdProbeAskedRef: { current: true },
      moment5QuestionDeliveredRef: { current: false },
      moment5QuestionDeliveryInFlightRef: { current: false },
      resumeLoadingFlowActiveRef: { current: true },
      speakTextSafe,
    });
    const messagesToUse = [
      { role: 'assistant', content: M4_THRESHOLD_QUESTION },
      { role: 'user', content: 'I would walk away when trust is broken.' },
    ];

    const result = await runPreClaudeMoment5QuestionInjectGate(deps, messagesToUse, 'Alex');

    expect(result).toEqual({ handled: false });
    expect(speakTextSafe).not.toHaveBeenCalled();
  });

  it('does not inject Moment 5 when threshold answer is an incomplete cut-off', async () => {
    mockTriggerLiveMoment4ScoringOnM5Entry.mockClear();
    const speakTextSafe = jest.fn().mockResolvedValue(undefined);
    const deps = createMockPreClaudeDeps({
      currentInterviewMomentRef: { current: 4 },
      moment4ThresholdProbeAskedRef: { current: true },
      moment5QuestionDeliveredRef: { current: false },
      moment5QuestionDeliveryInFlightRef: { current: false },
      speakTextSafe,
    });
    const messagesToUse = [
      { role: 'assistant', content: M4_THRESHOLD_QUESTION },
      { role: 'user', content: 'It depends on' },
    ];

    const result = await runPreClaudeMoment5QuestionInjectGate(deps, messagesToUse, 'Alex');

    expect(result).toEqual({ handled: false });
    expect(speakTextSafe).not.toHaveBeenCalled();
    expect(mockTriggerLiveMoment4ScoringOnM5Entry).not.toHaveBeenCalled();
  });

  it('does not inject Moment 5 when threshold answer is "If someone is willing" cut-off', async () => {
    mockTriggerLiveMoment4ScoringOnM5Entry.mockClear();
    const speakTextSafe = jest.fn().mockResolvedValue(undefined);
    const deps = createMockPreClaudeDeps({
      currentInterviewMomentRef: { current: 4 },
      moment4ThresholdProbeAskedRef: { current: true },
      moment5QuestionDeliveredRef: { current: false },
      moment5QuestionDeliveryInFlightRef: { current: false },
      speakTextSafe,
    });
    const messagesToUse = [
      { role: 'assistant', content: M4_THRESHOLD_QUESTION },
      { role: 'user', content: 'If someone is willing' },
    ];

    const result = await runPreClaudeMoment5QuestionInjectGate(deps, messagesToUse, 'Alex');

    expect(result).toEqual({ handled: false });
    expect(speakTextSafe).not.toHaveBeenCalled();
  });

  it('does not inject Moment 5 when threshold answer mentions partner but not stay vs leave', async () => {
    mockTriggerLiveMoment4ScoringOnM5Entry.mockClear();
    const speakTextSafe = jest.fn().mockResolvedValue(undefined);
    const deps = createMockPreClaudeDeps({
      currentInterviewMomentRef: { current: 4 },
      moment4ThresholdProbeAskedRef: { current: true },
      moment5QuestionDeliveredRef: { current: false },
      moment5QuestionDeliveryInFlightRef: { current: false },
      speakTextSafe,
    });
    const garbledThresholdAnswer =
      "If my partner is with me, I can't do anything about it. If my partner is with me, I can't do anything about it.";
    const messagesToUse = [
      { role: 'assistant', content: M4_THRESHOLD_QUESTION },
      { role: 'user', content: garbledThresholdAnswer },
    ];

    const result = await runPreClaudeMoment5QuestionInjectGate(deps, messagesToUse, 'Alex');

    expect(result).toEqual({ handled: false });
    expect(speakTextSafe).not.toHaveBeenCalled();
  });

  it('injects Moment 5 after unassessable threshold answer retry then first assessable answer', async () => {
    mockTriggerLiveMoment4ScoringOnM5Entry.mockClear();
    const speakTextSafe = jest.fn().mockResolvedValue(undefined);
    const setMessages = jest.fn();
    const deps = createMockPreClaudeDeps({
      currentInterviewMomentRef: { current: 4 },
      moment4ThresholdProbeAskedRef: { current: true },
      moment5QuestionDeliveredRef: { current: false },
      moment5QuestionDeliveryInFlightRef: { current: false },
      interviewSessionAttemptIdRef: { current: 'attempt-retry-m4' },
      speakTextSafe,
      setMessages,
    });
    const messagesToUse = [
      { role: 'assistant', content: M4_THRESHOLD_QUESTION },
      {
        role: 'user',
        content: 'I think it depends. If you really love each other, then you should try your best to make it work.',
      },
      {
        role: 'assistant',
        content: "I wasn't able to understand that — you may have gotten cut off. Can you try again?",
      },
      {
        role: 'user',
        content:
          'I think you should try your best to make it work, but if you cannot then you should go your separate ways.',
      },
    ];

    const result = await runPreClaudeMoment5QuestionInjectGate(deps, messagesToUse, 'Matt');

    expect(result).toEqual({ handled: true });
    expect(deps.moment5QuestionDeliveredRef.current).toBe(true);
    expect(deps.currentInterviewMomentRef.current).toBe(5);
    expect(speakTextSafe).toHaveBeenCalledWith(
      expect.stringMatching(/conflict with someone important/i),
      expect.any(Object),
    );
    expect(mockTriggerLiveMoment4ScoringOnM5Entry).toHaveBeenCalled();
  });

  it('injects Moment 5 after explicit pass on the grudge question (threshold skipped)', async () => {
    const speakTextSafe = jest.fn().mockResolvedValue(undefined);
    const setMessages = jest.fn();
    const deps = createMockPreClaudeDeps({
      currentInterviewMomentRef: { current: 4 },
      moment4ThresholdProbeAskedRef: { current: false },
      moment5QuestionDeliveredRef: { current: false },
      moment5QuestionDeliveryInFlightRef: { current: false },
      speakTextSafe,
      setMessages,
    });
    const messagesToUse = [
      { role: 'assistant', content: MOMENT_4_GRUDGE_QUESTION_TEXT },
      { role: 'user', content: 'not really' },
    ];

    const result = await runPreClaudeMoment5QuestionInjectGate(deps, messagesToUse, 'Alex');

    expect(result).toEqual({ handled: true });
    expect(deps.moment4ThresholdProbeAskedRef.current).toBe(false);
    expect(deps.moment5QuestionDeliveredRef.current).toBe(true);
    expect(deps.currentInterviewMomentRef.current).toBe(5);
    expect(speakTextSafe).toHaveBeenCalledWith(
      expect.stringContaining(MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT),
      expect.any(Object),
    );
  });
});
