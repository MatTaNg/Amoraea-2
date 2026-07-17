import { Platform } from 'react-native';

import {
  INTERVIEW_NAME_AMBIENT_REASK_LINE,
  INTERVIEW_NAME_EARLY_MIC_REASK_LINE,
} from '@features/aria/interviewNameValidation';
import { isNamePromptInterviewMoment } from '@features/aria/interviewLanguageGate';
import type { RecordingCompleteBufferContext } from '@features/aria/computeRecordingCompleteBufferContext';
import {
  MIN_SPEECH_AFTER_VAD_FOR_WHISPER_MS,
  SILENT_BUFFER_RETAKE_PROMPT,
  VAD_CLIP_NEAR_MISS_MIN_SPEECH_MS,
  VAD_CLIP_NEAR_MISS_MIN_PEAK_DB,
} from '@features/aria/onRecordingCompleteConstants';
import type { OnRecordingCompleteDeps, OnRecordingCompleteParams } from '@features/aria/onRecordingCompleteTypes';
import { getAudioMinRecordingDurationMs } from '@features/aria/config/audioInterviewConfig';
import { getSessionLogRuntime } from '@utilities/sessionLogging';
import {
  getLastTtsCompletionCallbackMs,
  incrementReAskCountThisSession,
  markLastAudioSessionEventType,
  writeAudioSessionLog,
} from '@utilities/sessionLogging/audioSessionLogEnvelope';
import { remoteLog } from '@utilities/remoteLog';

export type RecordingCompletePreTranscribeGateResult =
  | { proceed: false }
  | {
      proceed: true;
      speechAfterVadMs: number | null;
      nameTurnPending: boolean;
    };

export async function applyRecordingCompletePreTranscribeGates(
  deps: OnRecordingCompleteDeps,
  params: OnRecordingCompleteParams,
  ctx: RecordingCompleteBufferContext,
): Promise<RecordingCompletePreTranscribeGateResult> {
  const { nativeUri } = params;
  const { analysis, webTiming, blockWhisperForVadBypassNoSpeech, vadGateDelayMs } = ctx;

  const nameTurnPendingEarlyMic =
    !deps.interviewNameRef.current &&
    (deps.interviewNameReaskPendingRef.current ||
      isNamePromptInterviewMoment(deps.lastQuestionTextRef.current));
  const tapIntentMs = webTiming?.tapIntentAtMs;
  const ttsDoneForEarlyMic = getLastTtsCompletionCallbackMs();
  const sinceTtsAtTap =
    tapIntentMs != null && ttsDoneForEarlyMic != null ? tapIntentMs - ttsDoneForEarlyMic : null;
  const tappedBeforeTtsFinished = sinceTtsAtTap != null && sinceTtsAtTap < 0;
  const tappedDuringTtsPlayback = deps.micTapWhileTtsActiveRef.current;
  deps.micTapWhileTtsActiveRef.current = false;
  if (nameTurnPendingEarlyMic && (tappedDuringTtsPlayback || tappedBeforeTtsFinished)) {
    void remoteLog('[NAME_ENTRY_EARLY_MIC_BLOCKED]', {
      sinceTtsAtTap,
      tappedDuringTtsPlayback,
      tappedBeforeTtsFinished,
      lastQuestionPreview: (deps.lastQuestionTextRef.current ?? '').slice(0, 80),
    });
    await deps.deleteTurnAudioFile(nativeUri);
    await deps.deliverRecordingRetryLine(INTERVIEW_NAME_EARLY_MIC_REASK_LINE);
    return { proceed: false };
  }

  const peakDbForMicFallback = analysis.peak_amplitude_db;
  const isDigitalSilenceForMicFallback =
    Platform.OS === 'web' &&
    true &&
    !analysis.has_non_zero_audio &&
    typeof peakDbForMicFallback === 'number' &&
    Number.isFinite(peakDbForMicFallback) &&
    peakDbForMicFallback <= -200;

  if (isDigitalSilenceForMicFallback) {
    deps.consecutiveDigitalSilenceForMicFallbackRef.current += 1;
  } else {
    deps.consecutiveDigitalSilenceForMicFallbackRef.current = 0;
  }

  if (
    deps.userId &&
    Platform.OS === 'web' &&
    true &&
    deps.micFallbackSuccessPendingRef.current &&
    analysis.has_non_zero_audio
  ) {
    deps.micFallbackSuccessPendingRef.current = false;
    const rOk = getSessionLogRuntime();
    writeAudioSessionLog({
      userId: deps.userId,
      attemptId: rOk.attemptId,
      eventType: 'microphone_device_fallback_succeeded',
      eventData: { microphone_device_fallback_succeeded: true },
      platform: rOk.platform,
    });
  }

  if (!analysis.has_non_zero_audio || blockWhisperForVadBypassNoSpeech) {
    if (
      Platform.OS === 'web' &&
      true &&
      isDigitalSilenceForMicFallback &&
      deps.consecutiveDigitalSilenceForMicFallbackRef.current >= 2
    ) {
      const n = deps.consecutiveDigitalSilenceForMicFallbackRef.current;
      const previousDeviceId = deps.audioRecorder.getLastWebMicCaptureDeviceId() ?? null;
      const switched = await deps.audioRecorder.switchWebInputToDefaultDevice();
      deps.consecutiveDigitalSilenceForMicFallbackRef.current = 0;
      if (deps.userId && switched) {
        const rFb = getSessionLogRuntime();
        writeAudioSessionLog({
          userId: deps.userId,
          attemptId: rFb.attemptId,
          eventType: 'microphone_device_fallback_attempted',
          eventData: {
            previous_device_id: previousDeviceId,
            fallback_device_id: 'default',
            consecutive_silent_buffers: n,
          },
          platform: rFb.platform,
        });
        deps.micFallbackSuccessPendingRef.current = true;
      }
    }
    if (blockWhisperForVadBypassNoSpeech) {
      deps.pendingRecordingRestartAfterVadBypassRef.current = true;
    }
    if (deps.userId) {
      const r = getSessionLogRuntime();
      markLastAudioSessionEventType('silent_buffer_detected');
      writeAudioSessionLog({
        userId: deps.userId,
        attemptId: r.attemptId,
        eventType: 'silent_buffer_detected',
        eventData: {
          moment_number: deps.currentInterviewMomentRef.current,
          buffer_size_bytes: analysis.buffer_size_bytes,
          ...(blockWhisperForVadBypassNoSpeech ? { treated_as_silent_due_to_vad_bypass: true } : {}),
        },
        platform: r.platform,
      });
      const n = incrementReAskCountThisSession();
      writeAudioSessionLog({
        userId: deps.userId,
        attemptId: r.attemptId,
        eventType: 're_ask_fired',
        eventData: {
          trigger_reason: 'silent_buffer',
          confidence_score: null,
          moment_number: deps.currentInterviewMomentRef.current,
          re_ask_count_this_session: n,
        },
        platform: r.platform,
      });
    }
    await deps.deleteTurnAudioFile(nativeUri);
    await deps.deliverRecordingRetryLine(SILENT_BUFFER_RETAKE_PROMPT);
    return { proceed: false };
  }

  deps.lastRecordingVadSpeechDetectedRef.current = analysis.firstSpeechOffsetMs != null;
  const speechAfterVadMs =
    analysis.firstSpeechOffsetMs != null && analysis.firstSpeechOffsetMs >= 0
      ? Math.max(0, analysis.audio_duration_ms - analysis.firstSpeechOffsetMs)
      : null;
  const nameTurnPending =
    !deps.interviewNameRef.current &&
    (deps.interviewNameReaskPendingRef.current ||
      isNamePromptInterviewMoment(deps.lastQuestionTextRef.current));
  const vadClipTooShortForWhisper =
    !nameTurnPending &&
    !blockWhisperForVadBypassNoSpeech &&
    analysis.has_non_zero_audio &&
    analysis.firstSpeechOffsetMs != null &&
    speechAfterVadMs != null &&
    speechAfterVadMs < MIN_SPEECH_AFTER_VAD_FOR_WHISPER_MS &&
    !(
      speechAfterVadMs >= VAD_CLIP_NEAR_MISS_MIN_SPEECH_MS &&
      analysis.peak_amplitude_db >= VAD_CLIP_NEAR_MISS_MIN_PEAK_DB &&
      analysis.audio_duration_ms >= getAudioMinRecordingDurationMs()
    );
  if (vadClipTooShortForWhisper) {
    if (deps.userId) {
      const r = getSessionLogRuntime();
      markLastAudioSessionEventType('vad_clip_too_short_for_whisper');
      writeAudioSessionLog({
        userId: deps.userId,
        attemptId: r.attemptId,
        eventType: 'vad_clip_too_short_for_whisper',
        eventData: {
          audio_duration_ms: analysis.audio_duration_ms,
          speech_after_vad_ms: speechAfterVadMs,
          vad_gate_delay_ms: vadGateDelayMs,
          moment_number: deps.currentInterviewMomentRef.current,
        },
        platform: r.platform,
      });
    }
    await deps.deleteTurnAudioFile(nativeUri);
    await deps.deliverRecordingRetryLine(
      nameTurnPending ? INTERVIEW_NAME_AMBIENT_REASK_LINE : SILENT_BUFFER_RETAKE_PROMPT,
    );
    return { proceed: false };
  }

  return { proceed: true, speechAfterVadMs, nameTurnPending };
}
