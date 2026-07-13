import { runInterruptInterviewTtsForDocumentHidden } from '../runInterruptInterviewTtsForDocumentHidden';
import type { InterruptInterviewTtsForDocumentHiddenDeps } from '../interruptDocumentHiddenTtsTypes';

jest.mock('react-native', () => ({
  Platform: { OS: 'web' },
}));

jest.mock('@utilities/sessionLogging', () => ({
  getSessionLogRuntime: () => ({ attemptId: null, platform: 'web' }),
  writeSessionLog: jest.fn(),
}));

jest.mock('@features/aria/telemetry/tsAutoplayTelemetry', () => ({
  getWebAutoplayContext: () => ({ isMobileWeb: false }),
}));

jest.mock('@features/aria/utils/webInterviewHtmlAudioTabResume', () => ({
  hasWebInterviewHtmlAudioTabResumePending: jest.fn(() => false),
  getTabStashedHtmlAudioElement: jest.fn(() => null),
}));

jest.mock('@features/aria/utils/webInterviewPlaybackSurface', () => ({
  isWebInterviewPlaybackAudiblyActive: jest.fn(() => false),
}));

jest.mock('@features/aria/utils/webInterviewTtsDocumentLifecycle', () => ({
  interruptWebInterviewTtsForTabHide: jest.fn(),
}));

jest.mock('@features/aria/utils/webInterviewMicPreInit', () => ({
  shouldSuppressTabSwitchDeactivationAfterLateStartRefresh: jest.fn(() => true),
}));

jest.mock('@features/aria/utils/webSpeechSynthTabResume', () => ({
  captureWebSpeechSynthTabRestoreText: jest.fn(() => null),
}));

jest.mock('@features/aria/substituteCanonicalInterviewScenarioBodiesForTts', () => ({
  substituteCanonicalInterviewScenarioBodiesForTts: (t: string) => t,
}));

jest.mock('@features/aria/tabRestoreEmotionModalReplayGate', () => ({
  gateTabRestoreReplayTextForEmotionModal: (text: string) => text,
}));

import { interruptWebInterviewTtsForTabHide } from '@features/aria/utils/webInterviewTtsDocumentLifecycle';

function buildDeps(): InterruptInterviewTtsForDocumentHiddenDeps {
  return {
    interviewStatusRef: { current: 'in_progress' },
    userIdRef: { current: 'user-1' },
    ttsLineInFlightRef: { current: true },
    parallelStreamingTtsRef: {
      current: {
        active: true,
        accumulatedFullText: 'Got it — are you ready to get started?',
        spokenCompleteText: '',
        cancelRequested: false,
      },
    },
    isWebInterviewPlaybackSurfaceActive: () => true,
    gestureContextLostAtRef: { current: null },
    isMobileWebInterviewTtsSessionActive: () => false,
    armMobileWebBackgroundTtsContinue: () => false,
    tabHiddenDuringActiveTtsLineRef: { current: false },
    webTtsUtteranceInFlightRef: { current: 'Got it — are you ready to get started?' },
    lastQuestionTextRef: { current: null },
    webTtsTabInterruptPendingReplayRef: { current: false },
    webTabRestoreDeliveredNormRef: { current: null },
    webTabRestoreReplayInFlightRef: { current: false },
    mobileTabHideLetPlaybackContinueRef: { current: false },
    mobileTabHideBackgroundUtteranceRef: { current: null },
    pendingGestureRestoreSpeakRef: { current: null },
    needsGestureRestoreRef: { current: false },
    tabVisibilityGestureLossPendingRef: { current: false },
    webTtsSpeakGenerationRef: { current: 0 },
    setWebTabRestoreOverlayVisible: jest.fn(),
    setTtsPlaybackActive: jest.fn(),
    setVoiceState: jest.fn(),
    pendingEmotionModalTransitionRef: { current: null },
    emotionModalShownForScenarioRef: { current: new Set() },
  };
}

describe('runInterruptInterviewTtsForDocumentHidden', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('still interrupts TTS during post-late-start mic refresh suppression window', () => {
    const deps = buildDeps();

    runInterruptInterviewTtsForDocumentHidden(deps);

    expect(interruptWebInterviewTtsForTabHide).toHaveBeenCalledTimes(1);
    expect(deps.webTtsTabInterruptPendingReplayRef.current).toBe(true);
    expect(deps.pendingGestureRestoreSpeakRef.current?.text).toContain('ready to get started');
    expect(deps.setWebTabRestoreOverlayVisible).toHaveBeenCalledWith(true);
  });

  it('queues restore from in-flight utterance when playback surface already torn down', () => {
    const briefing =
      'Good to meet you, Matt. The way this works is I will first give you three situations, and you just tell me what you would do in each situation. Are you ready?';
    const deps = buildDeps();
    deps.ttsLineInFlightRef.current = false;
    deps.parallelStreamingTtsRef.current.active = false;
    deps.isWebInterviewPlaybackSurfaceActive = () => false;
    deps.webTtsUtteranceInFlightRef.current = briefing;
    deps.lastQuestionTextRef.current = briefing;

    runInterruptInterviewTtsForDocumentHidden(deps);

    expect(interruptWebInterviewTtsForTabHide).toHaveBeenCalledTimes(1);
    expect(deps.pendingGestureRestoreSpeakRef.current?.text).toContain('Good to meet you, Matt');
    expect(deps.setWebTabRestoreOverlayVisible).toHaveBeenCalledWith(true);
  });

  it('re-queues restore on second tab hide during same utterance replay', () => {
    const contemptProbe =
      "What about when Emma says 'you've made that very clear' — what do you make of that?";
    const deps = buildDeps();
    deps.webTabRestoreDeliveredNormRef.current = contemptProbe;
    deps.ttsLineInFlightRef.current = true;
    deps.webTtsUtteranceInFlightRef.current = contemptProbe;
    deps.isWebInterviewPlaybackSurfaceActive = () => true;

    runInterruptInterviewTtsForDocumentHidden(deps);

    expect(deps.pendingGestureRestoreSpeakRef.current?.text).toContain('Emma');
    expect(deps.webTtsTabInterruptPendingReplayRef.current).toBe(true);
    expect(deps.setWebTabRestoreOverlayVisible).toHaveBeenCalledWith(true);
  });

  it('queues restore during S1→S2 scenario-card HTML handoff when line lock was cleared', () => {
    const handoff =
      "That's a wrap on that one. Nice work, Matt. We've got two more situations to get through. Sarah has been job hunting for four months.";
    const deps = buildDeps();
    deps.ttsLineInFlightRef.current = false;
    deps.parallelStreamingTtsRef.current.active = true;
    deps.parallelStreamingTtsRef.current.accumulatedFullText = handoff;
    deps.isWebInterviewPlaybackSurfaceActive = () => false;
    deps.webTtsUtteranceInFlightRef.current = handoff;

    runInterruptInterviewTtsForDocumentHidden(deps);

    expect(interruptWebInterviewTtsForTabHide).toHaveBeenCalledTimes(1);
    expect(deps.pendingGestureRestoreSpeakRef.current?.text).toContain('Sarah has been job hunting');
    expect(deps.setWebTabRestoreOverlayVisible).toHaveBeenCalledWith(true);
  });
});
