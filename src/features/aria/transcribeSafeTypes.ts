import type { MutableRefObject } from 'react';

import type { ErrorClassification } from '@utilities/withRetry';

export type TranscribeSafeParams = {
  audioBlob: Blob | null;
  nativeUri: string | null;
};

export type TranscribeSafeResult =
  | { text: string; language: string | null; confidence: number | null }
  | { kind: 'whisper_infra_exhausted'; lastHttpStatus: number | null; failureReason: string }
  | null;

export type TranscribeSafeDeps = {
  userId: string | undefined;
  classifyError: (err: unknown) => ErrorClassification;
  transcribeBufferMetaRef: MutableRefObject<{
    audio_duration_ms: number;
    buffer_size_bytes: number;
  } | null>;
  currentInterviewMomentRef: MutableRefObject<number>;
  recordingPeakMeteringRef: MutableRefObject<number | null>;
  lastRecordingVadSpeechDetectedRef: MutableRefObject<boolean | null>;
  lastQuestionTextRef: MutableRefObject<string | null>;
  transcriptionFailureStreakRef: MutableRefObject<number>;
  lastRecordingRetryDeliveredNormRef: MutableRefObject<string | null>;
  recordingJustFinishedBeforeNextTtsRef: MutableRefObject<boolean>;
  postRecordingParallelStreamSettleRef: MutableRefObject<boolean>;
  deleteTurnAudioFile: (nativeUri: string | null) => Promise<void>;
  deliverRecordingRetryLine: (
    message: string,
    speakOpts?: { telemetrySource?: 'turn' | 'other'; skipLastQuestionRef?: boolean },
  ) => Promise<void>;
};
