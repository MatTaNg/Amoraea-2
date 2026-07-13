import { runHandleWebTabGestureRestoreTap } from '../runHandleWebTabGestureRestoreTap';
import type { InterviewWebTabRestoreSessionDeps } from '../webTabRestoreSessionDeps';

jest.mock('@utilities/remoteLog', () => ({
  remoteLog: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@utilities/sessionLogging', () => ({
  getSessionLogRuntime: () => ({ attemptId: null, platform: 'web' }),
  writeSessionLog: jest.fn(),
}));

jest.mock('@features/aria/utils/webInterviewPlaybackSurface', () => ({
  isWebInterviewPlaybackAudiblyActive: jest.fn(() => false),
}));

jest.mock('@features/aria/utils/webInterviewHtmlAudioTabResume', () => ({
  hasWebInterviewHtmlAudioTabResumePending: jest.fn(() => false),
}));

jest.mock('@features/aria/utils/webInterviewTtsDocumentLifecycle', () => ({
  unlockWebAudioForAutoplay: jest.fn(),
}));

jest.mock('@features/aria/utils/webInterviewGestureContext', () => ({
  getMsSinceWebTabBecameVisible: jest.fn(() => 100),
  hasRecentWebInterviewUserGesture: jest.fn(() => true),
  markWebInterviewUserGestureNow: jest.fn(),
}));

jest.mock('@features/aria/utils/webPreAuthorizedTtsAudio', () => ({
  preAuthorizeAudioElementOnMicTapGesture: jest.fn(),
}));

jest.mock('@features/aria/webTabRestoreReplayHelpers', () => ({
  createWebTabRestoreReplayContext: jest.fn(() => ({})),
  runWebTabRestoreReplayOrchestration: jest.fn().mockResolvedValue(undefined),
}));

import { isWebInterviewPlaybackAudiblyActive } from '@features/aria/utils/webInterviewPlaybackSurface';
import { runWebTabRestoreReplayOrchestration } from '@features/aria/webTabRestoreReplayHelpers';
import { remoteLog } from '@utilities/remoteLog';

function makeDeps(
  overrides: Partial<InterviewWebTabRestoreSessionDeps> = {},
): InterviewWebTabRestoreSessionDeps {
  const pending = {
    text: 'Good to meet you, Matt.',
    restoreMode: 'replay' as const,
    queuedAtMs: Date.now(),
    options: {},
    resolve: jest.fn(),
    reject: jest.fn(),
  };
  return {
    pendingGestureRestoreSpeakRef: { current: pending },
    webTabRestoreDeliveredNormRef: { current: null },
    needsGestureRestoreRef: { current: true },
    webTabRestoreReplayInFlightRef: { current: false },
    webTabRestoreTapSessionRef: { current: 0 },
    lastSuccessfulTtsTextNormalizedRef: { current: null },
    dismissTabRestoreOverlay: jest.fn(),
    setVoiceState: jest.fn(),
    setWebTabRestoreOverlayVisible: jest.fn(),
    ensureWebGestureFlushListener: jest.fn(),
    detachWebGestureFlushListener: jest.fn(),
    interruptAllWebInterviewTtsOutput: jest.fn(),
    setMobileWebTapToBeginDone: jest.fn(),
    emotionModalPendingTransitionRef: { current: false },
    pendingEmotionModalTransitionRef: { current: null },
    emotionModalShownForScenarioRef: { current: new Set() },
    setEmotionModalVisible: jest.fn(),
    userIdRef: { current: 'user-1' },
    parallelStreamingTtsRef: {
      current: { accumulatedFullText: '', spokenCompleteText: '', active: false, cancelRequested: false },
    },
    webTtsUtteranceInFlightRef: { current: null },
    lastQuestionTextRef: { current: '' },
    ...overrides,
  } as unknown as InterviewWebTabRestoreSessionDeps;
}

describe('runHandleWebTabGestureRestoreTap', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (isWebInterviewPlaybackAudiblyActive as jest.Mock).mockReturnValue(false);
  });

  it('ignores a second tap while restore is in flight (no restart)', async () => {
    const deps = makeDeps({
      webTabRestoreReplayInFlightRef: { current: true },
    });
    await runHandleWebTabGestureRestoreTap(deps);
    expect(remoteLog).toHaveBeenCalledWith('[tab_restore] replay_tap_ignored_duplicate');
    expect(runWebTabRestoreReplayOrchestration).not.toHaveBeenCalled();
    expect(deps.interruptAllWebInterviewTtsOutput).not.toHaveBeenCalled();
  });

  it('dismisses overlay on second tap when restore audio is already audible', async () => {
    (isWebInterviewPlaybackAudiblyActive as jest.Mock).mockReturnValue(true);
    const deps = makeDeps({
      webTabRestoreReplayInFlightRef: { current: true },
    });
    await runHandleWebTabGestureRestoreTap(deps);
    expect(remoteLog).toHaveBeenCalledWith('[tab_restore] replay_tap_dismiss_overlay_while_in_flight');
    expect(deps.setWebTabRestoreOverlayVisible).toHaveBeenCalledWith(false);
    expect(runWebTabRestoreReplayOrchestration).not.toHaveBeenCalled();
  });

  it('starts restore orchestration on first tap', async () => {
    const deps = makeDeps();
    await runHandleWebTabGestureRestoreTap(deps);
    expect(deps.webTabRestoreReplayInFlightRef.current).toBe(true);
    expect(runWebTabRestoreReplayOrchestration).toHaveBeenCalled();
  });
});
