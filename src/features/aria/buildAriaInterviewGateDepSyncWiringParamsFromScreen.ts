import type { MutableRefObject } from 'react';

import * as preamble from '@features/aria/ariaInterviewScreenPreambleBindings';
import * as wiring from '@features/aria/ariaInterviewScreenWiringImports';
import type { AriaInterviewScreenSessionState } from '@features/aria/hooks/useAriaInterviewScreenSessionState';
import type { AriaInterviewGateDepSyncWiringParams } from '@features/aria/hooks/useAriaInterviewGateDepSyncWiring';
import type { GestureContextLostReason } from '@features/aria/utils/webInterviewGestureContext';

export type BuildAriaInterviewGateDepSyncWiringParamsFromScreenInput = {
  userId: string;
  session: AriaInterviewScreenSessionState;
  micSession: {
    lastHeadphoneProbeRef: MutableRefObject<unknown>;
    lastAudioRouteFingerprintRef: MutableRefObject<unknown>;
    routeChangedDuringRecordingRef: MutableRefObject<boolean>;
    gestureContextLostAtRef: MutableRefObject<{ atMs: number; reason: GestureContextLostReason } | null>;
  };
};

/** Assemble gate dep-sync params from grouped session state + mic-session refs. */
export function buildAriaInterviewGateDepSyncWiringParamsFromScreen(
  input: BuildAriaInterviewGateDepSyncWiringParamsFromScreenInput,
): AriaInterviewGateDepSyncWiringParams {
  const { userId, session, micSession } = input;
  const { closingQuestion, gate, routing, shell } = session;

  return {
    resetScenarioCClientGates: gate.resetScenarioCClientGates,
    identity: {
      userId,
      newInterviewSessionId: preamble.newInterviewSessionId,
      createInitialMomentCompletion: wiring.createInitialMomentCompletion,
      countsAsSubstantiveInterviewQuestionDelivery: wiring.countsAsSubstantiveInterviewQuestionDelivery,
      stripControlTokens: wiring.stripControlTokens,
      clearResumeWelcomePlaybackLock: wiring.clearResumeWelcomePlaybackLock,
      setClosingQuestionState: closingQuestion.setClosingQuestionState,
      setTtsPlaybackReliabilityNotice: session.shell.setTtsPlaybackReliabilityNotice,
      setConversationErrorNotice: session.shell.setConversationErrorNotice,
    },
    closingQuestion,
    metaSkip: gate.metaSkip,
    moments: {
      ...gate.moments,
      routeChangedDuringRecordingRef: micSession.routeChangedDuringRecordingRef,
    },
    webTts: {
      ...gate.webTts,
      lastHeadphoneProbeRef: micSession.lastHeadphoneProbeRef,
      lastAudioRouteFingerprintRef: micSession.lastAudioRouteFingerprintRef,
      gestureContextLostAtRef: micSession.gestureContextLostAtRef,
    },
    resumeEmotion: {
      ...gate.resumeEmotion,
      resumeLoadingFlowActiveRef: routing.resumeLoadingFlowActiveRef,
      interviewUserTurnEpochRef: shell.interviewUserTurnEpochRef,
    },
    progressReset: {
      ...gate.progressReset,
      resetCompletionScoringSession: wiring.resetCompletionScoringSession,
      resetAudioInterviewTurnCounters: wiring.resetAudioInterviewTurnCounters,
      resetTtsDurationCalibration: wiring.resetTtsDurationCalibration,
      hasCachedWebMicTrackSettings: wiring.hasCachedWebMicTrackSettings,
      resetWebAudioRouteSessionFingerprint: wiring.resetWebAudioRouteSessionFingerprint,
      resetInterviewVadSession: wiring.resetInterviewVadSession,
      resetWebInterviewGestureContext: wiring.resetWebInterviewGestureContext,
      resetInterviewClosingTtsSession: wiring.resetInterviewClosingTtsSession,
    },
  };
}
