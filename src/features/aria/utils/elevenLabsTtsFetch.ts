import { Platform } from 'react-native';

import { runWithThreeAttemptsFixedBackoff } from '@utilities/networkRetry';
import { classifyError } from '@utilities/withRetry';

import { takePreviousTextForElevenLabsRequest } from './elevenLabsSpokenContext';
import {
  isElevenLabsEnabledForEnvironment,
  isElevenLabsMp3FetchAllowedOnPlatform,
} from './elevenLabsTtsAvailability';
import {
  buildSupabaseEdgeFunctionAuthHeaders,
  getElevenLabsApiKey,
  getTtsProxyUrl,
} from './elevenLabsTtsCredentials';
import {
  applyAmoraeaPronunciation,
  ELEVENLABS_VOICE_SETTINGS,
  resolveElevenLabsVoiceId,
} from './elevenLabsTtsVoice';
import { playElevenLabsPcmStreamFromResponse } from './playElevenLabsPcmStreamPlayback';
import type { PreInitTriggerDuring } from './webInterviewMicPreInit';
import { isWebInterviewAudioUnlocked } from './webInterviewWebAudioContext';
import type { TtsTelemetrySource } from '@features/aria/telemetry/tsAutoplayTelemetry';

const ELEVENLABS_TTS_FETCH_TIMEOUT_MS = 45000;
const ELEVENLABS_TTS_ARRAY_BUFFER_READ_TIMEOUT_MS = 90000;

function ttsFetchShouldRetry(err: unknown): boolean {
  return classifyError(err) !== 'unrecoverable';
}

function getFetchErrorStatus(err: unknown): number | undefined {
  if (typeof err !== 'object' || err === null || !('status' in err)) return undefined;
  const status = (err as { status?: unknown }).status;
  return typeof status === 'number' ? status : undefined;
}

function ttsFetchRetryDelayMs(err: unknown, failedAttemptNumber: 1 | 2): number {
  if (getFetchErrorStatus(err) === 429) {
    return failedAttemptNumber === 1 ? 5000 : 12000;
  }
  return failedAttemptNumber === 1 ? 1000 : 2000;
}

async function runElevenLabsTtsFetchWithRetry(
  doFetch: () => Promise<Response>,
): Promise<Response> {
  let lastErr: unknown;
  for (const attempt of [1, 2, 3] as const) {
    try {
      return await doFetch();
    } catch (err) {
      lastErr = err;
      const status = getFetchErrorStatus(err);
      if (attempt === 3 || !ttsFetchShouldRetry(err)) {
        throw err;
      }
      const delayMs = ttsFetchRetryDelayMs(err, attempt);
      if (__DEV__) {
        console.warn('[TTS] ElevenLabs fetch retry', { nextAttempt: attempt + 1, delayMs, status, err });
      }
      await new Promise<void>((r) => setTimeout(r, delayMs));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

function isAbortError(e: unknown): boolean {
  const name = typeof e === 'object' && e !== null && 'name' in e ? String((e as { name: string }).name) : '';
  return name === 'AbortError';
}

async function resolveElevenLabsTtsAuth(useProxy: boolean): Promise<Record<string, string>> {
  return useProxy ? buildSupabaseEdgeFunctionAuthHeaders() : {};
}

function buildElevenLabsMpegRequestBody(spokenText: string): {
  text: string;
  model_id: string;
  voice_settings: typeof ELEVENLABS_VOICE_SETTINGS;
  previous_text?: string;
} {
  const previousText = takePreviousTextForElevenLabsRequest();
  return {
    text: spokenText.trim(),
    model_id: 'eleven_multilingual_v2',
    voice_settings: { ...ELEVENLABS_VOICE_SETTINGS },
    ...(previousText ? { previous_text: previousText } : {}),
  };
}

/**
 * Fetch ElevenLabs MP3 bytes without playing. Same availability matrix as {@link speakWithElevenLabs}.
 * Used to prefetch multiple segments before sequential playback (no gap between downloads).
 */
export async function fetchElevenLabsMpegArrayBuffer(
  text: string,
  opts?: { allowBeforeWebUnlock?: boolean }
): Promise<ArrayBuffer | null> {
  const spokenText = applyAmoraeaPronunciation(text ?? '');
  if (!spokenText.trim()) return null;
  if (!isElevenLabsEnabledForEnvironment()) return null;
  if (!isElevenLabsMp3FetchAllowedOnPlatform()) return null;
  const proxyUrl = getTtsProxyUrl();
  const apiKey = getElevenLabsApiKey();
  const useProxy = !apiKey && !!proxyUrl;
  const voiceId = resolveElevenLabsVoiceId();
  if (!apiKey && !useProxy) return null;
  if (Platform.OS === 'web' && !isWebInterviewAudioUnlocked() && !opts?.allowBeforeWebUnlock) return null;

  try {
    const bodyPayload = buildElevenLabsMpegRequestBody(spokenText);
    const proxyAuth = await resolveElevenLabsTtsAuth(useProxy);

    const doOneTtsFetch = async (): Promise<Response> => {
      const ac = new AbortController();
      const fetchTimer = setTimeout(() => ac.abort(), ELEVENLABS_TTS_FETCH_TIMEOUT_MS);
      try {
        const r = await fetch(
          useProxy ? proxyUrl : `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
          useProxy
            ? {
                signal: ac.signal,
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Accept: 'audio/mpeg',
                  ...proxyAuth,
                },
                body: JSON.stringify({
                  text: bodyPayload.text,
                  voiceId,
                  modelId: bodyPayload.model_id,
                  voiceSettings: bodyPayload.voice_settings,
                  ...(bodyPayload.previous_text ? { previousText: bodyPayload.previous_text } : {}),
                }),
              }
            : {
                signal: ac.signal,
                method: 'POST',
                headers: {
                  'xi-api-key': apiKey,
                  'Content-Type': 'application/json',
                  Accept: 'audio/mpeg',
                },
                body: JSON.stringify(bodyPayload),
              }
        );
        if (!r.ok) {
          const errText = await r.text();
          const err = new Error(errText.slice(0, 200));
          Object.assign(err, { status: r.status });
          throw err;
        }
        return r;
      } catch (e) {
        if (isAbortError(e)) {
          console.warn('ElevenLabs TTS fetch timed out');
          const err = new Error('tts_fetch_timeout');
          Object.assign(err, { status: 504 });
          throw err;
        }
        throw e;
      } finally {
        clearTimeout(fetchTimer);
      }
    };

    let res: Response;
    try {
      res = await runElevenLabsTtsFetchWithRetry(async () => doOneTtsFetch());
    } catch (e) {
      if (isAbortError(e)) return null;
      console.warn('ElevenLabs TTS fetch failed after retries:', e);
      return null;
    }

    try {
      return await Promise.race([
        res.arrayBuffer(),
        new Promise<ArrayBuffer>((_, reject) => {
          setTimeout(() => reject(new Error('arraybuffer-timeout')), ELEVENLABS_TTS_ARRAY_BUFFER_READ_TIMEOUT_MS);
        }),
      ]);
    } catch {
      console.warn('ElevenLabs TTS response body read timed out');
      return null;
    }
  } catch {
    return null;
  }
}

/**
 * Web: opens ElevenLabs **streaming** PCM (raw s16le mono) for low time-to-first-sample vs full MP3 buffer.
 * Returns the Response or null on failure. Caller must read the body; do not use with non-stream proxy.
 */
export async function openElevenLabsPcmStreamRequest(spokenText: string): Promise<Response | null> {
  if (!isElevenLabsEnabledForEnvironment()) return null;
  if (Platform.OS === 'web' && !isWebInterviewAudioUnlocked()) return null;
  if (!spokenText.trim()) return null;
  const proxyUrl = getTtsProxyUrl();
  const apiKey = getElevenLabsApiKey();
  const useProxy = !apiKey && !!proxyUrl;
  const voiceId = resolveElevenLabsVoiceId();
  if (!apiKey && !useProxy) return null;

  const bodyPayload = buildElevenLabsMpegRequestBody(spokenText);
  const q = new URLSearchParams({
    output_format: 'pcm_24000',
    optimize_streaming_latency: '2',
  });
  const proxyAuth = await resolveElevenLabsTtsAuth(useProxy);

  const doOnePcmStreamFetch = async (): Promise<Response> => {
    const ac = new AbortController();
    const fetchTimer = setTimeout(() => ac.abort(), ELEVENLABS_TTS_FETCH_TIMEOUT_MS);
    try {
      const r = await fetch(
        useProxy
          ? proxyUrl
          : `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream?${q.toString()}`,
        useProxy
          ? {
              signal: ac.signal,
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Accept: 'audio/pcm, audio/*, */*',
                ...proxyAuth,
              },
              body: JSON.stringify({
                text: bodyPayload.text,
                voiceId,
                modelId: bodyPayload.model_id,
                voiceSettings: bodyPayload.voice_settings,
                stream: true,
                outputFormat: 'pcm_24000',
                ...(bodyPayload.previous_text ? { previousText: bodyPayload.previous_text } : {}),
              }),
            }
          : {
              signal: ac.signal,
              method: 'POST',
              headers: {
                'xi-api-key': apiKey!,
                'Content-Type': 'application/json',
                Accept: 'audio/pcm, audio/*, */*',
              },
              body: JSON.stringify(bodyPayload),
            }
      );
      if (!r.ok) {
        const errText = await r.text();
        const err = new Error(errText.slice(0, 200));
        Object.assign(err, { status: r.status });
        throw err;
      }
      if (!r.body) {
        throw new Error('pcm_stream_no_body');
      }
      return r;
    } catch (e) {
      if (isAbortError(e)) {
        const err = new Error('tts_fetch_timeout');
        Object.assign(err, { status: 504 });
        throw err;
      }
      throw e;
    } finally {
      clearTimeout(fetchTimer);
    }
  };

  try {
    if (!useProxy) {
      return await runWithThreeAttemptsFixedBackoff({
        delaysMs: [1000, 2000],
        shouldRetry: (err) => ttsFetchShouldRetry(err),
        onRetry: ({ nextAttempt, delayMs, error }) => {
          if (__DEV__) {
            console.warn('[TTS] ElevenLabs PCM stream fetch retry', { nextAttempt, delayMs, error });
          }
        },
        run: async () => doOnePcmStreamFetch(),
      });
    }
    return await doOnePcmStreamFetch();
  } catch (e) {
    if (__DEV__) {
      console.warn('[TTS] ElevenLabs PCM stream open failed', e);
    }
    return null;
  }
}

export async function tryPlayElevenLabsPcmStream(
  spokenText: string,
  onPlaybackStarted: (() => void) | undefined,
  telemetrySource: TtsTelemetrySource,
  preInitTriggerDuring: PreInitTriggerDuring,
  playbackRateMultiplier: number = 1
): Promise<boolean> {
  if (Platform.OS !== 'web') return false;
  const res = await openElevenLabsPcmStreamRequest(spokenText);
  if (!res) return false;
  return playElevenLabsPcmStreamFromResponse(
    res,
    onPlaybackStarted,
    telemetrySource,
    preInitTriggerDuring,
    playbackRateMultiplier
  );
}
