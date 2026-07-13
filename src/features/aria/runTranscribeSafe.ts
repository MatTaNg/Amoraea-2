import { Platform } from 'react-native';

import {
  OPENAI_API_KEY,
  OPENAI_WHISPER_PROXY_URL,
  SUPABASE_ANON_KEY,
} from '@features/aria/scoreInterviewModuleConstants';
import { assistantMessageForRecordingOrTranscriptionFailure } from '@features/aria/interviewUserFacingErrors';
import { performWhisperTranscriptionWithRetries } from '@features/aria/performWhisperTranscriptionWithRetries';
import type { TranscribeSafeDeps, TranscribeSafeParams, TranscribeSafeResult } from '@features/aria/transcribeSafeTypes';
import { remoteLog } from '@utilities/remoteLog';

export async function runTranscribeSafe(
  deps: TranscribeSafeDeps,
  params: TranscribeSafeParams,
): Promise<TranscribeSafeResult> {
  const {
    transcriptionFailureStreakRef,
    lastRecordingRetryDeliveredNormRef,
    recordingJustFinishedBeforeNextTtsRef,
    postRecordingParallelStreamSettleRef,
    deleteTurnAudioFile,
    deliverRecordingRetryLine,
  } = deps;
  const { audioBlob, nativeUri } = params;

  void remoteLog('[TRANSCRIBE] entry', {
    platform: Platform.OS,
    blobSize: audioBlob?.size ?? 0,
    hasNativeUri: !!nativeUri,
    hasOpenAIKey: !!OPENAI_API_KEY,
    hasWhisperProxy: !!OPENAI_WHISPER_PROXY_URL,
    hasSupabaseAnonKey: !!SUPABASE_ANON_KEY,
  });
  try {
    const transcript = await performWhisperTranscriptionWithRetries(deps, params);
    transcriptionFailureStreakRef.current = 0;
    lastRecordingRetryDeliveredNormRef.current = null;
    return transcript;
  } catch (err) {
    void remoteLog('[TRANSCRIBE] catch', {
      errorName: err instanceof Error ? err.name : 'unknown',
      errorMessage: err instanceof Error ? err.message : String(err),
      hasOpenAIKey: !!OPENAI_API_KEY,
      hasWhisperProxy: !!OPENAI_WHISPER_PROXY_URL,
      hasNativeUri: !!nativeUri,
      blobSize: audioBlob?.size ?? 0,
    });
    if (__DEV__) console.error('Transcription failed:', err instanceof Error ? err.message : err);
    recordingJustFinishedBeforeNextTtsRef.current = false;
    postRecordingParallelStreamSettleRef.current = false;
    await deleteTurnAudioFile(nativeUri);
    transcriptionFailureStreakRef.current += 1;
    const msg = assistantMessageForRecordingOrTranscriptionFailure(
      transcriptionFailureStreakRef.current,
      Platform.OS === 'web',
    );
    await deliverRecordingRetryLine(msg);
    return null;
  }
}
