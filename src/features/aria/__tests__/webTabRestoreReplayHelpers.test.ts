import { createWebTabRestoreReplayContext } from '../webTabRestoreReplayHelpers';
import type { InterviewWebTabRestoreSessionDeps } from '../webTabRestoreSessionDeps';
import type { PendingGestureRestoreSpeakEntry } from '../hooks/useAriaInterviewSession';

jest.mock('react-native', () => ({
  Platform: { OS: 'web' },
}));

jest.mock('@utilities/remoteLog', () => ({
  remoteLog: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@utilities/sessionLogging', () => ({
  getSessionLogRuntime: () => ({ attemptId: null, platform: 'web' }),
  writeSessionLog: jest.fn(),
}));

jest.mock('@features/aria/utils/webInterviewHtmlAudioTabRestoreOrchestration', () => ({
  clearWebInterviewHtmlTabRestoreState: jest.fn(),
  pauseActiveWebInterviewHtmlAudioWithoutRevoke: jest.fn(),
  trySyncStartTabRestoreHtmlPlaybackInUserGesture: jest.fn(),
}));

jest.mock('@features/aria/utils/webInterviewPlaybackSurface', () => ({
  isWebInterviewPlaybackAudiblyActive: jest.fn(() => false),
  isWebInterviewPlaybackSurfaceActive: jest.fn(() => false),
}));

jest.mock('@features/aria/utils/webInterviewHtmlAudioTabResume', () => ({
  hasWebInterviewHtmlAudioTabResumePending: jest.fn(() => true),
}));

jest.mock('@features/aria/utils/webInterviewPendingGestureBlob', () => ({
  hasPendingWebGestureBlobUrl: jest.fn(() => false),
}));

jest.mock('@features/aria/utils/webInterviewPendingGestureBlobPlayback', () => ({
  tryPlayPendingWebTtsAudioInUserGesture: jest.fn(),
}));

jest.mock('@features/aria/utils/speakLongFormInterviewHtmlMp3', () => ({
  speakLongFormInterviewHtmlMp3: jest.fn().mockResolvedValue(false),
}));

jest.mock('@features/aria/utils/webPreAuthorizedTtsAudio', () => ({
  takePreAuthorizedAudioElementForTts: jest.fn(() => null),
}));

jest.mock('@features/aria/telemetry/tsAutoplayTelemetry', () => ({
  getWebAutoplayContext: () => ({ isMobileWeb: false }),
}));

jest.mock('@features/aria/substituteCanonicalInterviewScenarioBodiesForTts', () => ({
  substituteCanonicalInterviewScenarioBodiesForTts: (t: string) => t,
}));

jest.mock('@features/aria/scenarioCPromptDetection', () => ({
  coerceInterviewReplayTtsText: (t: string) => t,
}));

import { trySyncStartTabRestoreHtmlPlaybackInUserGesture } from '@features/aria/utils/webInterviewHtmlAudioTabRestoreOrchestration';
import { isWebInterviewPlaybackAudiblyActive } from '@features/aria/utils/webInterviewPlaybackSurface';
import { runWebTabRestoreReplayOrchestration } from '../webTabRestoreReplayHelpers';

describe('runWebTabRestoreReplayOrchestration html resume finish', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (isWebInterviewPlaybackAudiblyActive as jest.Mock).mockReturnValue(false);
  });

  it('finishes restore after HTML resume ends even when audio is no longer audible', async () => {
    let onPlayStarted: (() => void) | undefined;
    (trySyncStartTabRestoreHtmlPlaybackInUserGesture as jest.Mock).mockImplementation((opts) => {
      onPlayStarted = opts?.onPlayStarted;
      return {
        started: true,
        done: Promise.resolve().then(() => {
          onPlayStarted?.();
        }),
      };
    });

    const pending: PendingGestureRestoreSpeakEntry = {
      text: 'Good to meet you, Matt.',
      restoreMode: 'replay',
      queuedAtMs: Date.now(),
      options: {},
      resolve: jest.fn(),
      reject: jest.fn(),
    };

    const deps = {
      userIdRef: { current: 'user-1' },
      pendingGestureRestoreSpeakRef: { current: pending },
      webTabRestoreTapSessionRef: { current: 1 },
      webTabRestoreReplayInFlightRef: { current: true },
      webTtsTabInterruptPendingReplayRef: { current: true },
      needsGestureRestoreRef: { current: true },
      setWebTabRestoreOverlayVisible: jest.fn(),
      setVoiceState: jest.fn(),
      webTtsSpeakGenerationRef: { current: 0 },
      webTtsUtteranceInFlightRef: { current: 'Good to meet you, Matt.' },
      webTtsUtteranceInFlightOptionsRef: { current: null },
      lastQuestionTextRef: { current: '' },
      lastSuccessfulTtsTextNormalizedRef: { current: null },
      webTabRestoreDeliveredNormRef: { current: null },
      tabHiddenDuringActiveTtsLineRef: { current: true },
      parallelStreamingTtsRef: {
        current: {
          accumulatedFullText: '',
          spokenCompleteText: '',
          active: false,
          cancelRequested: false,
        },
      },
      applyInterviewSpeechComplete: jest.fn(),
      resumeRepeatPrefetchMpegRef: { current: null },
      speakTextSafe: jest.fn(),
      gestureContextLostAtRef: { current: null },
      tabRestoreInFlightWithoutPlaybackSinceMsRef: { current: null },
    } as unknown as InterviewWebTabRestoreSessionDeps;

    const ctx = createWebTabRestoreReplayContext(deps, pending, 1);
    await runWebTabRestoreReplayOrchestration(deps, pending, 1, ctx);

    expect(deps.pendingGestureRestoreSpeakRef.current).toBeNull();
    expect(deps.webTtsTabInterruptPendingReplayRef.current).toBe(false);
    expect(deps.needsGestureRestoreRef.current).toBe(false);
    expect(deps.setWebTabRestoreOverlayVisible).toHaveBeenCalledWith(false);
    expect(pending.resolve).toHaveBeenCalled();
    expect(deps.webTabRestoreReplayInFlightRef.current).toBe(false);
  });

  it('finishes restore when sync play completes without onPlayStarted (ended-before-callback race)', async () => {
    (trySyncStartTabRestoreHtmlPlaybackInUserGesture as jest.Mock).mockImplementation(() => ({
      started: true,
      // ended resolved; play().then(onPlayStarted) never ran
      done: Promise.resolve(),
    }));

    const pending: PendingGestureRestoreSpeakEntry = {
      text: 'Good to meet you, Matt.',
      restoreMode: 'replay',
      queuedAtMs: Date.now(),
      options: {},
      resolve: jest.fn(),
      reject: jest.fn(),
    };

    const deps = {
      userIdRef: { current: 'user-1' },
      pendingGestureRestoreSpeakRef: { current: pending },
      webTabRestoreTapSessionRef: { current: 1 },
      webTabRestoreReplayInFlightRef: { current: true },
      webTtsTabInterruptPendingReplayRef: { current: true },
      needsGestureRestoreRef: { current: true },
      setWebTabRestoreOverlayVisible: jest.fn(),
      setVoiceState: jest.fn(),
      webTtsSpeakGenerationRef: { current: 0 },
      webTtsUtteranceInFlightRef: { current: 'Good to meet you, Matt.' },
      webTtsUtteranceInFlightOptionsRef: { current: null },
      lastQuestionTextRef: { current: '' },
      lastSuccessfulTtsTextNormalizedRef: { current: null },
      webTabRestoreDeliveredNormRef: { current: null },
      tabHiddenDuringActiveTtsLineRef: { current: true },
      parallelStreamingTtsRef: {
        current: {
          accumulatedFullText: '',
          spokenCompleteText: '',
          active: false,
          cancelRequested: false,
        },
      },
      applyInterviewSpeechComplete: jest.fn(),
      resumeRepeatPrefetchMpegRef: { current: null },
      speakTextSafe: jest.fn(),
      gestureContextLostAtRef: { current: null },
      tabRestoreInFlightWithoutPlaybackSinceMsRef: { current: null },
    } as unknown as InterviewWebTabRestoreSessionDeps;

    const ctx = createWebTabRestoreReplayContext(deps, pending, 1);
    await runWebTabRestoreReplayOrchestration(deps, pending, 1, ctx);

    expect(deps.pendingGestureRestoreSpeakRef.current).toBeNull();
    expect(deps.webTtsTabInterruptPendingReplayRef.current).toBe(false);
    expect(deps.setWebTabRestoreOverlayVisible).not.toHaveBeenCalledWith(true);
    expect(pending.resolve).toHaveBeenCalled();
  });

  it('does not re-queue overlay when replay mutates the same pending object', async () => {
    let onPlayStarted: (() => void) | undefined;
    (trySyncStartTabRestoreHtmlPlaybackInUserGesture as jest.Mock).mockImplementation((opts) => {
      onPlayStarted = opts?.onPlayStarted;
      return {
        started: true,
        done: Promise.resolve().then(() => {
          onPlayStarted?.();
        }),
      };
    });

    const pending: PendingGestureRestoreSpeakEntry = {
      text: 'Same pending line.',
      restoreMode: 'replay',
      queuedAtMs: 1000,
      options: {},
      resolve: jest.fn(),
      reject: jest.fn(),
    };

    const pendingRef = { current: pending as PendingGestureRestoreSpeakEntry | null };
    const deps = {
      userIdRef: { current: 'user-1' },
      pendingGestureRestoreSpeakRef: pendingRef,
      webTabRestoreTapSessionRef: { current: 1 },
      webTabRestoreReplayInFlightRef: { current: true },
      webTtsTabInterruptPendingReplayRef: { current: true },
      needsGestureRestoreRef: { current: true },
      setWebTabRestoreOverlayVisible: jest.fn(),
      setVoiceState: jest.fn(),
      webTtsSpeakGenerationRef: { current: 0 },
      webTtsUtteranceInFlightRef: { current: 'Same pending line.' },
      webTtsUtteranceInFlightOptionsRef: { current: null },
      lastQuestionTextRef: { current: '' },
      lastSuccessfulTtsTextNormalizedRef: { current: null },
      webTabRestoreDeliveredNormRef: { current: null },
      tabHiddenDuringActiveTtsLineRef: { current: true },
      parallelStreamingTtsRef: {
        current: {
          accumulatedFullText: '',
          spokenCompleteText: '',
          active: false,
          cancelRequested: false,
        },
      },
      applyInterviewSpeechComplete: jest.fn(),
      resumeRepeatPrefetchMpegRef: { current: null },
      speakTextSafe: jest.fn(),
      gestureContextLostAtRef: { current: null },
      tabRestoreInFlightWithoutPlaybackSinceMsRef: { current: null },
    } as unknown as InterviewWebTabRestoreSessionDeps;

    const ctx = createWebTabRestoreReplayContext(deps, pending, 1);
    // Simulate old bug: replay assigned a new object with the same queuedAtMs.
    pendingRef.current = { ...pending, restoreMode: 'replay' };
    await runWebTabRestoreReplayOrchestration(deps, pending, 1, ctx);

    expect(deps.pendingGestureRestoreSpeakRef.current).toBeNull();
    expect(deps.webTtsTabInterruptPendingReplayRef.current).toBe(false);
    expect(deps.needsGestureRestoreRef.current).toBe(false);
    expect(deps.setWebTabRestoreOverlayVisible).toHaveBeenCalledWith(false);
  });

  it('preserves a newer tab-hide pending instead of clearing it when finish races', async () => {
    let onPlayStarted: (() => void) | undefined;
    (trySyncStartTabRestoreHtmlPlaybackInUserGesture as jest.Mock).mockImplementation((opts) => {
      onPlayStarted = opts?.onPlayStarted;
      return {
        started: true,
        done: Promise.resolve().then(() => {
          onPlayStarted?.();
        }),
      };
    });

    const pending: PendingGestureRestoreSpeakEntry = {
      text: 'First restore line.',
      restoreMode: 'replay',
      queuedAtMs: 1000,
      options: {},
      resolve: jest.fn(),
      reject: jest.fn(),
    };
    const newerPending: PendingGestureRestoreSpeakEntry = {
      text: 'Second tab-hide line.',
      restoreMode: 'replay',
      queuedAtMs: 2000,
      options: {},
      resolve: jest.fn(),
      reject: jest.fn(),
    };

    const pendingRef = { current: pending as PendingGestureRestoreSpeakEntry | null };
    const deps = {
      userIdRef: { current: 'user-1' },
      pendingGestureRestoreSpeakRef: pendingRef,
      webTabRestoreTapSessionRef: { current: 1 },
      webTabRestoreReplayInFlightRef: { current: true },
      webTtsTabInterruptPendingReplayRef: { current: true },
      needsGestureRestoreRef: { current: true },
      setWebTabRestoreOverlayVisible: jest.fn(),
      setVoiceState: jest.fn(),
      webTtsSpeakGenerationRef: { current: 0 },
      webTtsUtteranceInFlightRef: { current: 'First restore line.' },
      webTtsUtteranceInFlightOptionsRef: { current: null },
      lastQuestionTextRef: { current: '' },
      lastSuccessfulTtsTextNormalizedRef: { current: null },
      webTabRestoreDeliveredNormRef: { current: null },
      tabHiddenDuringActiveTtsLineRef: { current: true },
      parallelStreamingTtsRef: {
        current: {
          accumulatedFullText: '',
          spokenCompleteText: '',
          active: false,
          cancelRequested: false,
        },
      },
      applyInterviewSpeechComplete: jest.fn(),
      resumeRepeatPrefetchMpegRef: { current: null },
      speakTextSafe: jest.fn(),
      gestureContextLostAtRef: { current: null },
      tabRestoreInFlightWithoutPlaybackSinceMsRef: { current: null },
    } as unknown as InterviewWebTabRestoreSessionDeps;

    const ctx = createWebTabRestoreReplayContext(deps, pending, 1);
    pendingRef.current = newerPending;
    await runWebTabRestoreReplayOrchestration(deps, pending, 1, ctx);

    expect(deps.pendingGestureRestoreSpeakRef.current).toBe(newerPending);
    expect(deps.webTtsTabInterruptPendingReplayRef.current).toBe(true);
    expect(deps.needsGestureRestoreRef.current).toBe(true);
    expect(deps.setWebTabRestoreOverlayVisible).toHaveBeenCalledWith(true);
    expect(pending.resolve).toHaveBeenCalled();
    expect(deps.webTabRestoreReplayInFlightRef.current).toBe(false);
  });
});
