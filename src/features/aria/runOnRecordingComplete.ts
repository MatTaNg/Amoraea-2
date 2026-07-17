import { applyRecordingCompletePostTranscribeGates } from '@features/aria/applyRecordingCompletePostTranscribeGates';
import { applyRecordingCompletePreTranscribeGates } from '@features/aria/applyRecordingCompletePreTranscribeGates';
import { computeRecordingCompleteBufferContext } from '@features/aria/computeRecordingCompleteBufferContext';
import type {
  OnRecordingCompleteDeps,
  OnRecordingCompleteParams,
} from '@features/aria/onRecordingCompleteTypes';
import { remoteLog } from '@utilities/remoteLog';
import { getSessionLogRuntime } from '@utilities/sessionLogging';
import { writeAudioSessionLog } from '@utilities/sessionLogging/audioSessionLogEnvelope';

export async function runOnRecordingComplete(
  deps: OnRecordingCompleteDeps,
  params: OnRecordingCompleteParams,
): Promise<void> {
  const { blob, nativeUri } = params;

  if (deps.recordingCompleteInFlightRef.current) {
    void remoteLog('[RECORDING] duplicate onRecordingComplete ignored', {
      blobBytes: blob?.size ?? 0,
    });
    await deps.deleteTurnAudioFile(nativeUri);
    return;
  }
  deps.recordingCompleteInFlightRef.current = true;
  try {
    deps.recordingPeakMeteringRef.current = params.meta?.peakMeteringDb ?? null;
    deps.lastRecordingVadSpeechDetectedRef.current = null;
    deps.recordingJustFinishedBeforeNextTtsRef.current = true;
    deps.postRecordingParallelStreamSettleRef.current = true;
    deps.setMicEnginePrimed(false);
    deps.setVoiceState('processing');

    const bufferCtx = await computeRecordingCompleteBufferContext(deps, params);
    const preTranscribe = await applyRecordingCompletePreTranscribeGates(deps, params, bufferCtx);
    if (!preTranscribe.proceed) {
      return;
    }

    deps.transcribeBufferMetaRef.current = {
      audio_duration_ms: bufferCtx.analysis.audio_duration_ms,
      buffer_size_bytes: bufferCtx.analysis.buffer_size_bytes,
    };
    const transcribed = await deps.transcribeSafe(blob, nativeUri);
    deps.transcribeBufferMetaRef.current = null;
    await applyRecordingCompletePostTranscribeGates(deps, params, bufferCtx, transcribed);
  } finally {
    await deps.releaseRecordingFnRef.current?.({
      momentNumber: deps.currentInterviewMomentRef.current,
      logCleanupFailed: (p) => {
        if (!deps.userId) return;
        const r = getSessionLogRuntime();
        writeAudioSessionLog({
          userId: deps.userId,
          attemptId: r.attemptId,
          eventType: 'recording_cleanup_failed',
          eventData: { ...p, moment_number: p.moment_number ?? deps.currentInterviewMomentRef.current },
          platform: r.platform,
        });
      },
    });
    deps.recordingCompleteInFlightRef.current = false;
  }
}
