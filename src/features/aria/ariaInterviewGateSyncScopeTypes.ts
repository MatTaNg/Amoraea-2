import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsRefs';
import type { ResetInterviewProgressRefsDeps } from '@features/aria/interviewProgressResetTypes';

type SyncExtraParams = AriaInterviewDepsSyncContext;

export type AriaInterviewGateWebTtsSyncScope = Pick<
  SyncExtraParams,
  | 'whisperRatioReaskAttemptsForCurrentQuestionRef'
  | 'ttsSessionHardFailureCountRef'
  | 'lastSuccessfulTtsTextNormalizedRef'
  | 'lastSuccessfulTtsDeliveredPreviewRef'
  | 'webTtsUtteranceInFlightRef'
  | 'webTtsUtteranceInFlightOptionsRef'
  | 'webTtsTabInterruptPendingReplayRef'
  | 'webTtsSpeakGenerationRef'
  | 'webTabRestoreReplayInFlightRef'
  | 'parallelStreamingTtsRef'
  | 'webTabRestoreTapSessionRef'
  | 'webTabRestoreDeliveredNormRef'
  | 'tabRestoreInFlightWithoutPlaybackSinceMsRef'
  | 'lastHeadphoneProbeRef'
  | 'lastAudioRouteFingerprintRef'
> & {
  gestureContextLostAtRef: ResetInterviewProgressRefsDeps['gestureContextLostAtRef'];
};

export type AriaInterviewGateSyncScope = {
  identity: SyncExtraParams;
  closing: SyncExtraParams;
  metaSkip: SyncExtraParams;
  moments: SyncExtraParams;
  webTts: AriaInterviewGateWebTtsSyncScope;
  resumeEmotion: SyncExtraParams;
  progressReset: SyncExtraParams;
};
