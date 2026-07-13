import { describe, expect, it, jest, beforeEach } from '@jest/globals';

import { createInitialParallelStreamingTtsState } from '@features/aria/interviewParallelTtsBatch';
import { deliverScenario1VignetteAfterReadinessAssent } from '@features/aria/deliverScenario1AfterReadinessAssent';
import type { Scenario1ReadinessDeliveryDeps } from '@features/aria/deliverScenario1AfterReadinessAssent';

jest.mock('@utilities/remoteLog', () => ({
  remoteLog: jest.fn(),
}));

jest.mock('@features/aria/utils/speakLongFormInterviewHtmlMp3', () => ({
  speakLongFormInterviewHtmlMp3: jest.fn(async () => {
    await new Promise((r) => setTimeout(r, 30));
    return true;
  }),
}));

describe('deliverScenario1VignetteAfterReadinessAssent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('arms tts in-flight refs before HTML speak so tab-hide can queue restore', async () => {
    const ttsLineInFlightRef = { current: false };
    const webTtsUtteranceInFlightRef = { current: null as string | null };
    const parallelStreamingTtsRef = { current: createInitialParallelStreamingTtsState() };
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
      webTtsUtteranceInFlightRef,
      commitInterviewMessages: jest.fn(),
      speakTextSafe: jest.fn().mockResolvedValue(undefined),
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
    expect((webTtsUtteranceInFlightRef.current ?? '').length).toBeGreaterThan(40);
    expect(parallelStreamingTtsRef.current.accumulatedFullText.length).toBeGreaterThan(40);

    const delivered = await deliveryPromise;
    expect(delivered).toBe(true);
    expect(ttsLineInFlightRef.current).toBe(false);
    expect(webTtsUtteranceInFlightRef.current).toBeNull();
    expect(parallelStreamingTtsRef.current.spokenCompleteText.length).toBeGreaterThan(40);
  });
});
