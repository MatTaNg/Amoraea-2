import { runTabRestoreWatchdogTick } from '../runTabRestoreWatchdogTick';
import type { TabRestoreWatchdogDeps } from '../tabRestoreWatchdogTypes';

jest.mock('@utilities/remoteLog', () => ({
  remoteLog: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@utilities/sessionLogging', () => ({
  getSessionLogRuntime: () => ({
    attemptId: null,
    platform: 'web',
    ttsPlaybackActive: false,
  }),
}));

function makeDeps(overrides: Partial<TabRestoreWatchdogDeps> = {}): TabRestoreWatchdogDeps {
  return {
    voiceStateRef: { current: 'idle' },
    webTabGestureRestoreOverlayRef: { current: false },
    isWebInterviewPlaybackSurfaceActive: () => false,
    isWebInterviewPlaybackAudiblyActive: () => false,
    mobileTabHideLetPlaybackContinueRef: { current: false },
    hasWebInterviewHtmlAudioTabResumePending: () => false,
    dismissAfterAndroidBackgroundPlaybackEnd: jest.fn(),
    setVoiceState: jest.fn(),
    isInterviewerOutputActiveForMicGate: () => false,
    setWebInterviewerOutputActive: jest.fn(),
    pendingGestureRestoreSpeakRef: { current: null },
    webTtsTabInterruptPendingReplayRef: { current: false },
    ttsLineInFlightRef: { current: false },
    webTabRestoreReplayInFlightRef: { current: false },
    queueMobileWebHtmlResumeAfterScreenReturn: jest.fn(() => false),
    ensureWebGestureFlushListener: jest.fn(),
    isWebInterviewMidUtteranceTabResumeActive: () => false,
    parallelStreamingTtsRef: { current: { active: false } },
    resolveStaleWebTtsRuntimeLockThresholdMs: () => 5000,
    staleWebTtsRuntimeLockSinceMsRef: { current: null },
    clearStaleWebInterviewTtsRuntimeLocks: jest.fn(),
    webTtsUtteranceInFlightRef: { current: null },
    interviewStatusRef: { current: 'in_progress' },
    needsGestureRestoreRef: { current: false },
    setWebTabRestoreOverlayVisible: jest.fn(),
    tabRestoreInFlightWithoutPlaybackSinceMsRef: { current: null },
    tabRestoreHtmlPlayStartTimeoutMs: 4500,
    speakingWithoutPlaybackSinceMsRef: { current: null },
    tabHiddenDuringActiveTtsLineRef: { current: false },
    interruptAllWebInterviewTtsOutput: jest.fn(),
    ...overrides,
  } as unknown as TabRestoreWatchdogDeps;
}

describe('runTabRestoreWatchdogTick overlay re-show', () => {
  it('does not re-show overlay from leftover HTML stash alone', () => {
    const deps = makeDeps({
      hasWebInterviewHtmlAudioTabResumePending: () => true,
      pendingGestureRestoreSpeakRef: { current: null },
      webTtsTabInterruptPendingReplayRef: { current: false },
    });
    runTabRestoreWatchdogTick(deps);
    expect(deps.setWebTabRestoreOverlayVisible).not.toHaveBeenCalledWith(true);
  });

  it('re-shows overlay when pending speak is still set', () => {
    const deps = makeDeps({
      pendingGestureRestoreSpeakRef: {
        current: {
          text: 'hello',
          restoreMode: 'replay',
          queuedAtMs: Date.now(),
          options: {},
          resolve: () => {},
          reject: () => {},
        },
      },
    });
    runTabRestoreWatchdogTick(deps);
    expect(deps.setWebTabRestoreOverlayVisible).toHaveBeenCalledWith(true);
  });

  it('does not stuck-recover speaking while tab was hidden during active line', () => {
    const deps = makeDeps({
      voiceStateRef: { current: 'speaking' },
      tabHiddenDuringActiveTtsLineRef: { current: true },
      speakingWithoutPlaybackSinceMsRef: { current: Date.now() - 10_000 },
    });
    runTabRestoreWatchdogTick(deps);
    expect(deps.interruptAllWebInterviewTtsOutput).not.toHaveBeenCalled();
  });
});
