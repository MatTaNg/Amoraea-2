import { describe, expect, it, jest, beforeEach } from '@jest/globals';

import { createInitialParallelStreamingTtsState } from '@features/aria/interviewParallelTtsBatch';
import { deliverScenario1VignetteAfterReadinessAssent } from '@features/aria/deliverScenario1AfterReadinessAssent';
import type { Scenario1ReadinessDeliveryDeps } from '@features/aria/deliverScenario1AfterReadinessAssent';

jest.mock('@utilities/remoteLog', () => ({
  remoteLog: jest.fn(),
}));

describe('deliverScenario1VignetteAfterReadinessAssent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('arms tts in-flight refs before speakTextSafe so tab-hide can queue restore', async () => {
    const ttsLineInFlightRef = { current: false };
    const ttsUtteranceInFlightRef = { current: null as string | null };
    const parallelStreamingTtsRef = { current: createInitialParallelStreamingTtsState() };
    let resolveSpeak: (() => void) | undefined;
    const speakTextSafe = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveSpeak = resolve;
        }),
    );
    const briefing =
      "Good to meet you, Matt. The way this works is I'll first give you three situations. Are you ready?";
    const deps: Scenario1ReadinessDeliveryDeps = {
      isInterviewAppRoute: true,
      isAdmin: false,
      status: 'active',
      currentInterviewMomentRef: { current: 1 },
      currentScenarioRef: { current: 1 },
      scenarioAContemptProbeAskedRef: { current: false },
      interviewNameRef: { current: 'Matt' },
      interviewSessionIdRef: { current: 'session-test' },
      lastQuestionTextRef: { current: briefing },
      parallelStreamingTtsRef,
      ttsLineInFlightRef,
      ttsUtteranceInFlightRef,
      commitInterviewMessages: jest.fn(),
      speakTextSafe,
      setVoiceState: jest.fn(),
      setIsWaiting: jest.fn(),
    };
    const messages = [
      { role: 'assistant' as const, content: briefing, scenarioNumber: 1, interviewMoment: 1 },
      { role: 'user' as const, content: 'Yes.', scenarioNumber: 1, interviewMoment: 1 },
    ];

    const deliveryPromise = deliverScenario1VignetteAfterReadinessAssent(
      deps,
      'Yes.',
      messages,
      'Matt',
      'pre_claude_intro_gate',
    );

    await Promise.resolve();
    expect(ttsLineInFlightRef.current).toBe(true);
    expect((ttsUtteranceInFlightRef.current ?? '').length).toBeGreaterThan(40);
    expect(parallelStreamingTtsRef.current.accumulatedFullText.length).toBeGreaterThan(40);

    resolveSpeak?.();
    const delivered = await deliveryPromise;
    expect(delivered).toBe(true);
    expect(deps.speakTextSafe).toHaveBeenCalled();
    expect(ttsLineInFlightRef.current).toBe(false);
    expect(ttsUtteranceInFlightRef.current).toBeNull();
    expect(parallelStreamingTtsRef.current.spokenCompleteText.length).toBeGreaterThan(40);
  });
});
