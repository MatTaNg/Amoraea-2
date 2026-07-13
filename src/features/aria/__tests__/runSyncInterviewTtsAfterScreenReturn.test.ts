import { runSyncInterviewTtsAfterScreenReturn } from '../runSyncInterviewTtsAfterScreenReturn';
import type { InterviewWebTabRestoreSessionDeps } from '../webTabRestoreSessionDeps';

jest.mock('react-native', () => ({
  Platform: { OS: 'web' },
}));

jest.mock('@features/aria/elongatingProbe', () => ({
  transcriptHasInterviewClosingAssistantMessage: () => false,
}));

jest.mock('@features/aria/runAttemptMobileWebHtmlTabResumeAfterScreenReturn', () => ({
  runAttemptMobileWebHtmlTabResumeAfterScreenReturn: jest.fn(() => false),
}));

jest.mock('@features/aria/telemetry/tsAutoplayTelemetry', () => ({
  getWebAutoplayContext: () => ({ isMobileWeb: false }),
}));

jest.mock('@features/aria/utils/webInterviewHtmlAudioTabRestoreOrchestration', () => ({
  attachTabStashHtmlAudioPlaybackHandoff: jest.fn(),
  holdTabStashedHtmlAudioForGestureResume: jest.fn(),
  restoreWebInterviewTabStashedPlaybackVolume: jest.fn(),
  syncTabStashHtmlAudioPositionForResumeReturn: jest.fn(),
}));

jest.mock('@features/aria/utils/webInterviewHtmlAudioTabResume', () => ({
  hasWebInterviewHtmlAudioTabResumePending: jest.fn(() => false),
}));

jest.mock('@features/aria/utils/webInterviewPlaybackSurface', () => ({
  isWebInterviewPlaybackAudiblyActive: jest.fn(() => false),
}));

jest.mock('@features/aria/utils/webInterviewGestureContext', () => ({
  markWebInterviewUserGestureNow: jest.fn(),
}));

jest.mock('@utilities/sessionLogging', () => ({
  getSessionLogRuntime: () => ({ attemptId: null, platform: 'web', ttsPlaybackActive: false }),
}));

import { isWebInterviewPlaybackAudiblyActive } from '@features/aria/utils/webInterviewPlaybackSurface';

function buildDeps(
  overrides: Partial<InterviewWebTabRestoreSessionDeps> = {},
): InterviewWebTabRestoreSessionDeps {
  return {
    userIdRef: { current: 'user-1' },
    voiceStateRef: { current: 'idle' },
    setVoiceState: jest.fn(),
    setWebTabRestoreOverlayVisible: jest.fn(),
    setMobileWebTapToBeginDone: jest.fn(),
    setEmotionModalVisible: jest.fn(),
    pendingGestureRestoreSpeakRef: {
      current: {
        text: 'Got it — are you ready to get started?',
        restoreMode: 'replay',
        queuedAtMs: Date.now(),
        options: {},
        resolve: jest.fn(),
        reject: jest.fn(),
      },
    },
    webTabRestoreReplayInFlightRef: { current: false },
    webTabRestoreTapSessionRef: { current: 0 },
    webTabRestoreDeliveredNormRef: { current: null },
    webTtsTabInterruptPendingReplayRef: { current: true },
    webTtsSpeakGenerationRef: { current: 0 },
    webTtsUtteranceInFlightRef: { current: null },
    webTtsUtteranceInFlightOptionsRef: { current: null },
    parallelStreamingTtsRef: {
      current: { active: false, accumulatedFullText: '', spokenCompleteText: '', cancelRequested: false },
    },
    ttsLineInFlightRef: { current: false },
    tabHiddenDuringActiveTtsLineRef: { current: true },
    tabRestoreInFlightWithoutPlaybackSinceMsRef: { current: null },
    needsGestureRestoreRef: { current: true },
    mobileTabHideLetPlaybackContinueRef: { current: false },
    mobileTabHideBackgroundUtteranceRef: { current: null },
    lastQuestionTextRef: { current: '' },
    lastSuccessfulTtsTextNormalizedRef: { current: null },
    emotionModalPendingTransitionRef: { current: false },
    pendingEmotionModalTransitionRef: { current: null },
    emotionModalShownForScenarioRef: { current: new Set() },
    gestureContextLostAtRef: { current: null },
    interviewStatusRef: { current: 'in_progress' },
    isInterviewCompleteRef: { current: false },
    currentMessagesRef: { current: [] },
    resumeRepeatPrefetchMpegRef: { current: null },
    speakTextSafe: jest.fn(),
    dismissTabRestoreOverlay: jest.fn(),
    dismissAfterAndroidBackgroundPlaybackEnd: jest.fn(),
    ensureWebGestureFlushListener: jest.fn(),
    detachWebGestureFlushListener: jest.fn(),
    interruptAllWebInterviewTtsOutput: jest.fn(),
    clearStaleWebInterviewTtsRuntimeLocks: jest.fn(),
    queueMobileWebHtmlResumeAfterScreenReturn: jest.fn(() => false),
    applyInterviewSpeechComplete: jest.fn(),
    ...overrides,
  };
}

describe('runSyncInterviewTtsAfterScreenReturn', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (isWebInterviewPlaybackAudiblyActive as jest.Mock).mockReturnValue(false);
  });

  it('preserves tab-restore pending when playback still looks audibly active', () => {
    (isWebInterviewPlaybackAudiblyActive as jest.Mock).mockReturnValue(true);
    const deps = buildDeps();

    runSyncInterviewTtsAfterScreenReturn(deps);

    expect(deps.pendingGestureRestoreSpeakRef.current).not.toBeNull();
    expect(deps.webTtsTabInterruptPendingReplayRef.current).toBe(true);
    expect(deps.tabHiddenDuringActiveTtsLineRef.current).toBe(true);
    expect(deps.setWebTabRestoreOverlayVisible).not.toHaveBeenCalledWith(false);
  });

  it('clears stale restore when playback is audible and no tab interrupt was queued', () => {
    (isWebInterviewPlaybackAudiblyActive as jest.Mock).mockReturnValue(true);
    const deps = buildDeps({
      pendingGestureRestoreSpeakRef: { current: null },
      webTtsTabInterruptPendingReplayRef: { current: false },
      tabHiddenDuringActiveTtsLineRef: { current: false },
    });

    runSyncInterviewTtsAfterScreenReturn(deps);

    expect(deps.setWebTabRestoreOverlayVisible).toHaveBeenCalledWith(false);
  });
});
