import { Platform } from 'react-native';
import * as FileSystemLegacy from 'expo-file-system/legacy';

import { supabase } from '@data/supabase/client';
import {
  OPENAI_API_KEY,
  OPENAI_WHISPER_PROXY_URL,
  SUPABASE_ANON_KEY,
} from '@features/aria/scoreInterviewModuleConstants';
import { whisperUploadFilePart } from '@features/aria/interviewUserFacingErrors';
import { raceTranscribeWithTimeout } from '@features/aria/interviewMicAndRecordingHelpers';
import { getAudioWhisperTranscriptionTimeoutMs } from '@features/aria/config/audioInterviewConfig';
import { WHISPER_LANGUAGE, WHISPER_MODEL, WHISPER_TEMPERATURE } from '@features/aria/config/whisperApiConstants';
import {
  countSpokenWords,
  isShortAnswerOkForWhisperRatioGate,
  parseWhisperTranscriptionPayload,
  parseWhisperVerboseStats,
  whisperLanguageIsEnglish,
} from '@features/aria/interviewLanguageGate';
import type { TranscribeSafeDeps, TranscribeSafeParams, TranscribeSafeResult } from '@features/aria/transcribeSafeTypes';
import { hasLikelySpeechAfterRecording } from '@features/aria/utils/audioEnergy';
import { runWithThreeAttemptsFixedBackoff } from '@utilities/networkRetry';
import { remoteLog } from '@utilities/remoteLog';
import { getSessionLogRuntime } from '@utilities/sessionLogging';
import {
  markLastAudioSessionEventType,
  writeAudioSessionLog,
} from '@utilities/sessionLogging/audioSessionLogEnvelope';

export async function performWhisperTranscriptionWithRetries(
  deps: TranscribeSafeDeps,
  params: TranscribeSafeParams,
): Promise<Exclude<TranscribeSafeResult, null>> {
  const {
    userId,
    classifyError,
    transcribeBufferMetaRef,
    currentInterviewMomentRef,
    recordingPeakMeteringRef,
    lastRecordingVadSpeechDetectedRef,
    lastQuestionTextRef,
  } = deps;
  const { audioBlob, nativeUri } = params;

  const transcriptUrl = OPENAI_WHISPER_PROXY_URL || 'https://api.openai.com/v1/audio/transcriptions';
  if (Platform.OS === 'web' && !OPENAI_WHISPER_PROXY_URL) {
    void remoteLog('[TRANSCRIBE] web_missing_whisper_proxy', {
      resolvedSupabaseUrl: transcriptUrl.slice(0, 80),
    });
    throw new Error('Whisper proxy URL is not configured for web transcription.');
  }
  const authHeaders: Record<string, string> = OPENAI_WHISPER_PROXY_URL
    ? SUPABASE_ANON_KEY
      ? { Authorization: `Bearer ${SUPABASE_ANON_KEY}`, apikey: SUPABASE_ANON_KEY }
      : {}
    : { Authorization: `Bearer ${OPENAI_API_KEY}` };

  let webTranscribeHeaders = authHeaders;
  if (Platform.OS === 'web' && OPENAI_WHISPER_PROXY_URL && !webTranscribeHeaders.Authorization) {
    const sessionResult = await supabase.auth.getSession().catch(() => null);
    const accessToken = sessionResult?.data?.session?.access_token?.trim();
    if (accessToken) {
      webTranscribeHeaders = { Authorization: `Bearer ${accessToken}` };
    }
  }

  const transcribeStarted = Date.now();
  const bm = transcribeBufferMetaRef.current;
  const whisperTimeoutMs = getAudioWhisperTranscriptionTimeoutMs(bm?.audio_duration_ms);

  const whisperFailureReason = (err: unknown): string => {
    if (err instanceof Error && err.message === 'empty_transcription_retryable') {
      return 'empty_transcription_retryable';
    }
    const st = (err as { status?: number }).status;
    if (typeof st === 'number') return `http_${st}`;
    const msg = err instanceof Error ? err.message : String(err);
    return msg.slice(0, 200);
  };

  const whisperShouldRetry = (err: unknown): boolean => {
    if (err instanceof Error && err.message === 'empty_transcription_retryable') return true;
    if (err instanceof Error && err.message === 'Empty transcription result') return false;
    if (err instanceof Error && err.message === 'No audio data') return false;
    return classifyError(err) !== 'unrecoverable';
  };

  try {
    const transcript = await runWithThreeAttemptsFixedBackoff({
      delaysMs: [1000, 2000],
      shouldRetry: (err) => whisperShouldRetry(err),
      onRetry: ({ nextAttempt, delayMs, error }) => {
        if (userId) {
          const r = getSessionLogRuntime();
          markLastAudioSessionEventType('whisper_retry');
          writeAudioSessionLog({
            userId,
            attemptId: r.attemptId,
            eventType: 'whisper_retry',
            eventData: {
              attempt_number: nextAttempt,
              failure_reason: whisperFailureReason(error),
              moment_number: currentInterviewMomentRef.current,
              delay_ms_before_retry: delayMs,
            },
            platform: r.platform,
          });
        }
      },
      run: async (attemptNumber) => {
        const lastWhisperRequestCtx = { ts: Date.now() };
        const performWhisperOnce = async (): Promise<{
          text: string;
          language: string | null;
          confidence: number | null;
          raw: unknown;
        }> => {
          const requestTs = Date.now();
          lastWhisperRequestCtx.ts = requestTs;
          if (userId) {
            const r = getSessionLogRuntime();
            markLastAudioSessionEventType('whisper_request');
            writeAudioSessionLog({
              userId,
              attemptId: r.attemptId,
              eventType: 'whisper_request',
              eventData: {
                audio_duration_ms: bm?.audio_duration_ms ?? null,
                buffer_size_bytes: bm?.buffer_size_bytes ?? audioBlob?.size ?? 0,
                language_parameter: WHISPER_LANGUAGE,
                temperature_parameter: WHISPER_TEMPERATURE,
                moment_number: currentInterviewMomentRef.current,
                request_timestamp: requestTs,
              },
              platform: r.platform,
            });
          }
          if (Platform.OS !== 'web' && nativeUri) {
            let nativeAuthHeaders = authHeaders;
            if (OPENAI_WHISPER_PROXY_URL && !nativeAuthHeaders.Authorization) {
              const sessionResult = await supabase.auth.getSession().catch(() => null);
              const accessToken = sessionResult?.data?.session?.access_token?.trim();
              if (accessToken) {
                nativeAuthHeaders = { Authorization: `Bearer ${accessToken}` };
              }
              void remoteLog('[TRANSCRIBE] proxy_auth_fallback', {
                hasSessionToken: !!accessToken,
                usedFallbackToken: !!accessToken,
              });
            }
            const legacyUploadType = (
              FileSystemLegacy as unknown as { FileSystemUploadType?: { MULTIPART?: number } }
            ).FileSystemUploadType?.MULTIPART;
            const uploadResult = await raceTranscribeWithTimeout(
              FileSystemLegacy.uploadAsync(transcriptUrl, nativeUri, {
                httpMethod: 'POST',
                uploadType: (legacyUploadType ?? 1) as unknown as never,
                fieldName: 'file',
                mimeType: 'audio/mp4',
                parameters: {
                  model: 'whisper-1',
                  response_format: 'verbose_json',
                  language: WHISPER_LANGUAGE,
                  temperature: String(WHISPER_TEMPERATURE),
                },
                headers: nativeAuthHeaders,
              }),
              whisperTimeoutMs,
              'whisper_upload',
            );
            if (uploadResult.status < 200 || uploadResult.status >= 300) {
              void remoteLog('[TRANSCRIBE] non_ok_response', {
                endpointUsed: OPENAI_WHISPER_PROXY_URL ? 'proxy' : 'openai',
                status: uploadResult.status,
                bodyPreview: (uploadResult.body ?? '').slice(0, 160),
              });
              const err = new Error(uploadResult.body?.slice(0, 200) || `HTTP ${uploadResult.status}`);
              Object.assign(err, { status: uploadResult.status });
              throw err;
            }
            const parsed = JSON.parse(uploadResult.body) as unknown;
            const p = parseWhisperTranscriptionPayload(parsed);
            return {
              text: p.text,
              language: p.language ?? WHISPER_LANGUAGE,
              confidence: p.confidence,
              raw: parsed,
            };
          }

          if (!audioBlob || audioBlob.size === 0) throw new Error('No audio data');
          const form = new FormData();
          form.append('file', whisperUploadFilePart(audioBlob));
          form.append('model', 'whisper-1');
          form.append('response_format', 'verbose_json');
          form.append('language', WHISPER_LANGUAGE);
          form.append('temperature', String(WHISPER_TEMPERATURE));
          const res = await raceTranscribeWithTimeout(
            fetch(transcriptUrl, { method: 'POST', headers: webTranscribeHeaders, body: form }),
            whisperTimeoutMs,
            'whisper_fetch',
          );
          if (!res.ok) {
            const errText = await res.text();
            void remoteLog('[TRANSCRIBE] non_ok_response', {
              endpointUsed: OPENAI_WHISPER_PROXY_URL ? 'proxy' : 'openai',
              status: res.status,
              bodyPreview: errText.slice(0, 160),
            });
            const httpErr = new Error(errText);
            Object.assign(httpErr, { status: res.status });
            throw httpErr;
          }
          const rawJson = await res.json();
          const p = parseWhisperTranscriptionPayload(rawJson);
          return {
            text: p.text,
            language: p.language ?? WHISPER_LANGUAGE,
            confidence: p.confidence,
            raw: rawJson,
          };
        };

        const { text, language, confidence, raw } = await performWhisperOnce();
        const verbose = parseWhisperVerboseStats(raw);
        const latencyMs = Date.now() - lastWhisperRequestCtx.ts;
        if (userId) {
          const r = getSessionLogRuntime();
          markLastAudioSessionEventType('whisper_response');
          writeAudioSessionLog({
            userId,
            attemptId: r.attemptId,
            eventType: 'whisper_response',
            eventData: {
              response_latency_ms: latencyMs,
              transcript_text: text,
              word_count: countSpokenWords(text),
              detected_language: language ?? null,
              overall_confidence: verbose.overall_confidence,
              segment_count: verbose.segment_count,
              min_segment_confidence: verbose.min_segment_confidence,
              max_segment_confidence: verbose.max_segment_confidence,
              avg_segment_confidence: verbose.avg_segment_confidence,
              moment_number: currentInterviewMomentRef.current,
            },
            durationMs: latencyMs,
            platform: r.platform,
          });
        }
        if (language && !whisperLanguageIsEnglish(language) && userId) {
          const r = getSessionLogRuntime();
          markLastAudioSessionEventType('whisper_language_mismatch');
          writeAudioSessionLog({
            userId,
            attemptId: r.attemptId,
            eventType: 'whisper_language_mismatch',
            eventData: {
              detected_language: language,
              transcript_text: text,
              moment_number: currentInterviewMomentRef.current,
            },
            platform: r.platform,
          });
        }
        if (text.length < 2) {
          void remoteLog('[TRANSCRIBE] whisper_empty_text', {
            blobType: audioBlob?.type || '(none)',
            blobSize: audioBlob?.size ?? 0,
            rawTextLen: text.length,
          });
          const likelySpeech = await hasLikelySpeechAfterRecording({
            peakMeteringDb: recordingPeakMeteringRef.current,
            audioBlob,
            vadSpeechDetected: lastRecordingVadSpeechDetectedRef.current,
          });
          if (likelySpeech) {
            throw new Error('empty_transcription_retryable');
          }
          throw new Error('Empty transcription result');
        }
        void remoteLog('[TRANSCRIBE] success', {
          endpointUsed: OPENAI_WHISPER_PROXY_URL ? 'proxy' : 'openai',
          transcriptLength: text.length,
          whisperLanguage: language,
        });
        const wcDone = countSpokenWords(text);
        if (wcDone < 3 && !isShortAnswerOkForWhisperRatioGate(lastQuestionTextRef.current) && userId) {
          const r = getSessionLogRuntime();
          markLastAudioSessionEventType('whisper_empty_transcript');
          writeAudioSessionLog({
            userId,
            attemptId: r.attemptId,
            eventType: 'whisper_empty_transcript',
            eventData: {
              audio_duration_ms: bm?.audio_duration_ms ?? null,
              raw_transcript: text,
              word_count: wcDone,
              moment_number: currentInterviewMomentRef.current,
              retry_count: attemptNumber,
            },
            platform: r.platform,
          });
        }
        return { text, language, confidence };
      },
    });

    if (userId) {
      const r = getSessionLogRuntime();
      markLastAudioSessionEventType('transcription_complete');
      writeAudioSessionLog({
        userId,
        attemptId: r.attemptId,
        eventType: 'transcription_complete',
        eventData: {
          detected_language: transcript.language ?? null,
        },
        durationMs: Date.now() - transcribeStarted,
        platform: r.platform,
      });
    }
    return transcript;
  } catch (e) {
    const lastHttpStatus =
      typeof (e as { status?: number }).status === 'number' ? (e as { status: number }).status : null;
    const whisperInfraFailure =
      lastHttpStatus === 401 ||
      lastHttpStatus === 403 ||
      lastHttpStatus === 404 ||
      lastHttpStatus === 500 ||
      whisperShouldRetry(e);
    if (!whisperInfraFailure) {
      throw e;
    }
    if (userId) {
      const r = getSessionLogRuntime();
      markLastAudioSessionEventType('whisper_total_failure');
      writeAudioSessionLog({
        userId,
        attemptId: r.attemptId,
        eventType: 'whisper_total_failure',
        eventData: {
          moment_number: currentInterviewMomentRef.current,
          failure_reason: whisperFailureReason(e),
          http_status: lastHttpStatus,
          whisper_proxy_auth_failure: lastHttpStatus === 401 || lastHttpStatus === 403,
        },
        platform: r.platform,
      });
    }
    if (lastHttpStatus === 401 || lastHttpStatus === 403) {
      void remoteLog('[TRANSCRIBE] proxy_auth_failure', {
        status: lastHttpStatus,
        endpointUsed: OPENAI_WHISPER_PROXY_URL ? 'proxy' : 'openai',
      });
    }
    return {
      kind: 'whisper_infra_exhausted' as const,
      lastHttpStatus,
      failureReason: whisperFailureReason(e),
    };
  }
}
