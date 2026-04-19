/**
 * Web interview: acquire mic + inactive MediaRecorder during TTS playback, reuse at recording tap,
 * re-arm after recording stops. Ambient level sampled every 100ms during TTS for adaptive VAD.
 */
import { Platform } from 'react-native';
import { getLateStartThresholdMs } from '@features/aria/config/audioInterviewConfig';
import {
  setInterviewSessionAmbientNoiseFloorDb,
  setInterviewSessionAmbientNoiseFallback,
  resetInterviewVadAmbientSamplingState,
} from '@features/aria/utils/interviewVadSession';
import {
  buildWebMicGetUserMediaConstraints,
  buildWebMicDefaultIdealFallbackConstraints,
} from '@features/aria/utils/webMicDeviceConstraints';

const PREFERRED_MR_MIME = 'audio/webm;codecs=opus';

/** Auditing: what window last (re)built the inactive MediaRecorder before a recording tap. */
export type PreInitTriggerDuring =
  | 'greeting'
  | 'response_processing'
  | 'tts_playback'
  | 'late_start_refresh';

let lastRecorderRefreshedOnLateStartFlag = false;

export function takeRecorderRefreshedOnLateStartForTelemetry(): boolean {
  const v = lastRecorderRefreshedOnLateStartFlag;
  lastRecorderRefreshedOnLateStartFlag = false;
  return v;
}

let lateStartPreInitTimer: ReturnType<typeof setTimeout> | null = null;

export function scheduleWebMicPreInitRefreshAfterTtsCompletes(): void {
  if (Platform.OS !== 'web') return;
  if (lateStartPreInitTimer != null) {
    clearTimeout(lateStartPreInitTimer);
    lateStartPreInitTimer = null;
  }
  const delay = getLateStartThresholdMs();
  lateStartPreInitTimer = setTimeout(() => {
    lateStartPreInitTimer = null;
    void (async () => {
      const { refreshed } = await refreshWebMicPreInitIfStaleAfterLateStartWindow();
      if (refreshed) {
        lastRecorderRefreshedOnLateStartFlag = true;
      }
    })();
  }, delay);
}

export function cancelScheduledLateStartPreInitRefresh(): void {
  if (lateStartPreInitTimer != null) {
    clearTimeout(lateStartPreInitTimer);
    lateStartPreInitTimer = null;
  }
}

/**
 * After TTS, if the user waits past the late-start threshold, rebuild pre-init so a long-delay tap still gets a warm recorder.
 */
export async function refreshWebMicPreInitIfStaleAfterLateStartWindow(): Promise<{ refreshed: boolean }> {
  if (Platform.OS !== 'web') return { refreshed: false };
  const streamOk = preInitStream && isStreamLive(preInitStream);
  const recOk = preInitRecorder && preInitRecorder.state === 'inactive';
  if (streamOk && recOk) {
    return { refreshed: false };
  }
  lastPreInitTriggerDuring = 'late_start_refresh';
  await beginInterviewMicPreInitDuringTts('late_start_refresh');
  const rebuilt =
    preInitStream != null &&
    isStreamLive(preInitStream) &&
    preInitRecorder != null &&
    preInitRecorder.state === 'inactive';
  if (rebuilt) {
    lastRecorderRefreshedOnLateStartFlag = true;
  }
  return { refreshed: rebuilt };
}

let lastPreInitTriggerDuring: PreInitTriggerDuring | null = null;

export function getLastPreInitTriggerDuring(): PreInitTriggerDuring | null {
  return lastPreInitTriggerDuring;
}

let preInitStream: MediaStream | null = null;
let preInitRecorder: MediaRecorder | null = null;
let micAnalyser: AnalyserNode | null = null;
let micAnalyserCtx: AudioContext | null = null;
let ambientSampleIntervalId: ReturnType<typeof setInterval> | null = null;
const ambientSamplesDb: number[] = [];

function isStreamLive(stream: MediaStream | null): boolean {
  if (!stream?.active) return false;
  const t = stream.getAudioTracks()[0];
  return !!t && t.readyState === 'live';
}

function pickMediaRecorderMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return 'audio/webm';
  if (MediaRecorder.isTypeSupported(PREFERRED_MR_MIME)) return PREFERRED_MR_MIME;
  if (MediaRecorder.isTypeSupported('audio/webm')) return 'audio/webm';
  return 'audio/webm';
}

function disconnectMicAnalyser(): void {
  try {
    micAnalyser?.disconnect();
  } catch {
    /* ignore */
  }
  micAnalyser = null;
  try {
    void micAnalyserCtx?.close();
  } catch {
    /* ignore */
  }
  micAnalyserCtx = null;
}

function stopAmbientSampling(): void {
  if (ambientSampleIntervalId != null) {
    clearInterval(ambientSampleIntervalId);
    ambientSampleIntervalId = null;
  }
}

function setupAnalyserForStream(stream: MediaStream): void {
  disconnectMicAnalyser();
  if (typeof window === 'undefined' || !window.AudioContext) return;
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return;
  const ctx = new Ctx();
  micAnalyserCtx = ctx;
  const source = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 512;
  analyser.smoothingTimeConstant = 0.5;
  source.connect(analyser);
  micAnalyser = analyser;
  void ctx.resume().catch(() => {});
}

function samplePeakDbOnce(): number | null {
  if (!micAnalyser) return null;
  const data = new Uint8Array(micAnalyser.fftSize);
  micAnalyser.getByteTimeDomainData(data);
  let peak = 0;
  for (let i = 0; i < data.length; i++) {
    const v = (data[i] - 128) / 128;
    const a = Math.abs(v);
    if (a > peak) peak = a;
  }
  return 20 * (Math.log(Math.max(peak, 1e-12)) / Math.LN10);
}

/**
 * Fire after TTS playback actually starts (same moment as onPlaybackStarted), or from session start
 * (greeting) / user gesture to warm the recorder before the first tap.
 */
export async function beginInterviewMicPreInitDuringTts(
  trigger: PreInitTriggerDuring = 'tts_playback'
): Promise<void> {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) return;
  if (typeof MediaRecorder === 'undefined') return;

  lastPreInitTriggerDuring = trigger;

  try {
    if (preInitStream && !isStreamLive(preInitStream)) {
      releaseWebInterviewMicPreInitHard();
    }

    if (!preInitStream || !preInitRecorder) {
      const constraints = await buildWebMicGetUserMediaConstraints();
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      preInitStream = stream;
      const mime = pickMediaRecorderMimeType();
      try {
        preInitRecorder = new MediaRecorder(stream, { mimeType: mime });
      } catch {
        preInitRecorder = new MediaRecorder(stream);
      }
      setupAnalyserForStream(stream);
    }

    resetInterviewVadAmbientSamplingState();
    ambientSamplesDb.length = 0;
    stopAmbientSampling();
    if (micAnalyser) {
      ambientSampleIntervalId = setInterval(() => {
        const db = samplePeakDbOnce();
        if (db != null && Number.isFinite(db)) ambientSamplesDb.push(db);
      }, 100);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (typeof fetch !== 'undefined') {
      void fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: 'webInterviewMicPreInit.ts:beginInterviewMicPreInitDuringTts',
          message: 'pre_init_getUserMedia_failed',
          data: { error: msg.slice(0, 200) },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
    }
    if (__DEV__) console.warn('[webInterviewMicPreInit] pre_init_getUserMedia_failed', msg);
    preInitStream = null;
    preInitRecorder = null;
  }
}

/**
 * Fire when TTS playback ends (onended).
 */
export function finalizeInterviewMicAmbientOnTtsEnd(): void {
  if (Platform.OS !== 'web') return;
  stopAmbientSampling();
  if (ambientSamplesDb.length === 0) {
    setInterviewSessionAmbientNoiseFloorDb(null);
    setInterviewSessionAmbientNoiseFallback(true);
    return;
  }
  const sorted = [...ambientSamplesDb].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] ?? null;
  if (median != null && Number.isFinite(median)) {
    setInterviewSessionAmbientNoiseFloorDb(median);
    setInterviewSessionAmbientNoiseFallback(false);
  } else {
    setInterviewSessionAmbientNoiseFloorDb(null);
    setInterviewSessionAmbientNoiseFallback(true);
  }
  ambientSamplesDb.length = 0;
}

export type ConsumedWebPreInit = {
  stream: MediaStream;
  recorder: MediaRecorder;
};

/**
 * If pre-built inactive recorder matches live stream, hand off to recording pipeline.
 */
export function tryConsumeWebPreInitRecorder(): ConsumedWebPreInit | null {
  if (Platform.OS !== 'web') return null;
  const stream = preInitStream;
  const rec = preInitRecorder;
  if (!stream || !rec) return null;
  if (!isStreamLive(stream)) return null;
  const t = stream.getAudioTracks()[0];
  if (!t || t.readyState !== 'live') return null;
  if (rec.state !== 'inactive') return null;
  preInitStream = null;
  preInitRecorder = null;
  stopAmbientSampling();
  disconnectMicAnalyser();
  return { stream, recorder: rec };
}

function releaseWebInterviewMicPreInitHard(): void {
  stopAmbientSampling();
  disconnectMicAnalyser();
  try {
    preInitStream?.getTracks().forEach((tr) => tr.stop());
  } catch {
    /* ignore */
  }
  preInitStream = null;
  preInitRecorder = null;
}

/**
 * After recording stops: release mic, then immediately re-acquire for next turn (inactive MR).
 */
/**
 * Replace pre-init mic with an arbitrary constraint set (e.g. default-device fallback after digital silence).
 */
export async function replaceWebInterviewMicPreInitWithConstraints(
  constraints: MediaStreamConstraints
): Promise<boolean> {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    return false;
  }
  if (typeof MediaRecorder === 'undefined') return false;
  releaseWebInterviewMicPreInitHard();
  lastPreInitTriggerDuring = 'response_processing';
  try {
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    preInitStream = stream;
    const mime = pickMediaRecorderMimeType();
    try {
      preInitRecorder = new MediaRecorder(stream, { mimeType: mime });
    } catch {
      preInitRecorder = new MediaRecorder(stream);
    }
    setupAnalyserForStream(stream);
    return true;
  } catch (err) {
    if (__DEV__) console.warn('[webInterviewMicPreInit] replaceWithConstraints failed', err);
    return false;
  }
}

/** Silent-buffer recovery: force `ideal: 'default'` input. */
export async function replaceWebInterviewMicPreInitWithDefaultIdealDevice(): Promise<boolean> {
  return replaceWebInterviewMicPreInitWithConstraints(buildWebMicDefaultIdealFallbackConstraints());
}

export async function rearmWebMicPreInitAfterRecordingStop(): Promise<void> {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) return;
  if (typeof MediaRecorder === 'undefined') return;
  releaseWebInterviewMicPreInitHard();
  lastPreInitTriggerDuring = 'response_processing';
  try {
    const constraints = await buildWebMicGetUserMediaConstraints();
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    preInitStream = stream;
    const mime = pickMediaRecorderMimeType();
    try {
      preInitRecorder = new MediaRecorder(stream, { mimeType: mime });
    } catch {
      preInitRecorder = new MediaRecorder(stream);
    }
    setupAnalyserForStream(stream);
  } catch (err) {
    if (__DEV__) console.warn('[webInterviewMicPreInit] rearm failed', err);
  }
}

/** Screen unmount or interview end */
export function releaseWebInterviewMicPreInit(): void {
  releaseWebInterviewMicPreInitHard();
}

/** Debug / telemetry: active input deviceId from the pre-init stream (after getUserMedia). */
export function getPreInitAudioInputDeviceId(): string | undefined {
  if (!preInitStream) return undefined;
  const t = preInitStream.getAudioTracks()[0];
  const id = t?.getSettings?.()?.deviceId;
  return typeof id === 'string' && id.length > 0 ? id : undefined;
}
