import type { PreInitTriggerDuring } from '@features/aria/utils/interviewMicPreInitTypes';

export type AudioRecorderPermissionStatus = 'granted' | 'denied' | null;

export type WebRecordingTiming = {
  tapIntentAtMs: number;
  mediaRecorderStartAtMs: number;
  recorderPreInitialized: boolean;
  recorderStartCalledMs: number;
  recorderStopCalledMs?: number;
  firstChunkReceivedMs: number | null;
  chunkLatencyMs: number | null;
  preInitFallbackReason: string | null;
  streamReactivated: boolean;
  preInitTriggeredDuring: PreInitTriggerDuring | null;
};

export type AudioRecordingCompleteMeta = {
  peakMeteringDb: number | null;
  recordingCapped?: boolean;
  webRecordingTiming?: WebRecordingTiming;
};

export type UseAudioRecorderParams = {
  onRecordingComplete?: (
    blob: Blob,
    nativeUri: string | null,
    meta?: AudioRecordingCompleteMeta,
  ) => void | Promise<void>;
  onError?: (err: Error) => void;
  /** Web: run synchronously in the same user-gesture stack as `MediaRecorder.stop()`. */
  onBeforeWebRecorderStop?: () => void;
  /** iOS: media services reset (e.g. route change) — caller should prompt reconnect. */
  onMediaServicesReset?: () => void;
  onRecordingEnginePrimed?: (info: {
    modeCompleteAtMs: number;
    recordingInitializedAtMs: number;
  }) => void;
  onRecordingTapIntent?: () => void;
};

export type RecordingStatusLike = {
  isRecording?: boolean;
  metering?: number;
  mediaServicesDidReset?: boolean;
};

/** Web: wall-clock offset for min/max timers so warm-up audio is included. */
export const WEB_RECORDING_PREROLL_MS = 100;

export type AudioRecorderSharedControls = {
  setIsRecording: React.Dispatch<React.SetStateAction<boolean>>;
  setInputMeterLevel: React.Dispatch<React.SetStateAction<number>>;
  maxMeteringDbRef: React.MutableRefObject<number | null>;
  recordingCappedThisTurnRef: React.MutableRefObject<boolean>;
  maxDurationTimerRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
  clearMaxDurationTimer: () => void;
  sleep: (ms: number) => Promise<void>;
};
