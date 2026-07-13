import { describe, expect, it, jest } from '@jest/globals';

import { runEmotionModalAfterScenarioTransition } from '@features/aria/runEmotionModalOrchestration';
import type { EmotionModalOrchestrationDeps } from '@features/aria/emotionModalOrchestrationTypes';

function buildDeps(
  overrides: Partial<EmotionModalOrchestrationDeps> = {},
): EmotionModalOrchestrationDeps {
  return {
    userId: 'user-1',
    isAdmin: false,
    isInterviewAppRoute: true,
    emotionItemsComplete: false,
    status: 'active',
    voiceState: 'idle',
    emotionModalVisible: false,
    emotionModalItemIndex: 0,
    statusRef: { current: 'active' },
    interviewSessionAttemptIdRef: { current: 'attempt-1' },
    emotionItemResponsesRef: { current: ['', '', ''] },
    emotionModalResolveRef: { current: null },
    emotionModalPendingTransitionRef: { current: false },
    emotionModalOpenForIndexRef: { current: -1 },
    emotionModalTimeoutRef: { current: null },
    emotionModalShownForScenarioRef: { current: new Set() },
    pendingEmotionModalTransitionRef: { current: null },
    maybeAwaitEmotionAfterScenarioTransitionRef: { current: async () => {} },
    runEmotionModalAfterScenarioTransitionRef: { current: async () => {} },
    tryRunEmotionModalFromScenarioTransitionRef: { current: async () => {} },
    setEmotionItemResponses: jest.fn(),
    setEmotionItemsComplete: jest.fn(),
    setEmotionModalVisible: jest.fn(),
    setEmotionModalItemIndex: jest.fn(),
    waitForWebInterviewTtsQuiescentBeforeEmotionModal: jest.fn(async () => {}),
    waitForWebInterviewTtsAudiblePlaybackBeforeEmotionModal: jest.fn(async () => {}),
    ...overrides,
  };
}

describe('runEmotionModalAfterScenarioTransition', () => {
  it('uses audible-only wait when beforeModal playback already finished', async () => {
    const waitForWebInterviewTtsQuiescentBeforeEmotionModal = jest.fn(async () => {});
    const waitForWebInterviewTtsAudiblePlaybackBeforeEmotionModal = jest.fn(async () => {});
    const emotionModalResolveRef = { current: null as (() => void) | null };
    const setEmotionModalVisible = jest.fn(() => {
      emotionModalResolveRef.current?.();
    });
    const deps = buildDeps({
      waitForWebInterviewTtsQuiescentBeforeEmotionModal,
      waitForWebInterviewTtsAudiblePlaybackBeforeEmotionModal,
      emotionModalResolveRef,
      setEmotionModalVisible,
    });

    await runEmotionModalAfterScenarioTransition(deps, 1, {
      transitionText: "That's a wrap on this situation.",
      priorScenario: 1,
      afterBeforeModalPlayback: true,
    });

    expect(waitForWebInterviewTtsAudiblePlaybackBeforeEmotionModal).toHaveBeenCalledTimes(1);
    expect(waitForWebInterviewTtsQuiescentBeforeEmotionModal).not.toHaveBeenCalled();
    expect(setEmotionModalVisible).toHaveBeenCalledWith(true);
  });

  it('uses full quiescence wait when beforeModal playback is not yet complete', async () => {
    const waitForWebInterviewTtsQuiescentBeforeEmotionModal = jest.fn(async () => {});
    const waitForWebInterviewTtsAudiblePlaybackBeforeEmotionModal = jest.fn(async () => {});
    const emotionModalResolveRef = { current: null as (() => void) | null };
    const deps = buildDeps({
      waitForWebInterviewTtsQuiescentBeforeEmotionModal,
      waitForWebInterviewTtsAudiblePlaybackBeforeEmotionModal,
      emotionModalResolveRef,
      setEmotionModalVisible: jest.fn(() => {
        emotionModalResolveRef.current?.();
      }),
    });

    await runEmotionModalAfterScenarioTransition(deps, 2, {
      transitionText: 'Scenario two transition body',
      priorScenario: 2,
    });

    expect(waitForWebInterviewTtsQuiescentBeforeEmotionModal).toHaveBeenCalledTimes(1);
    expect(waitForWebInterviewTtsAudiblePlaybackBeforeEmotionModal).not.toHaveBeenCalled();
  });
});
