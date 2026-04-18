import { Platform } from 'react-native';
import {
  getInterviewSessionAmbientNoiseFloorDb,
  getInterviewSessionVadFirstSpeechThresholdDb,
} from '@features/aria/utils/interviewVadSession';

/** Legacy silence gate for peak / native short-circuit — 6 dB more permissive than -60. */
const SILENCE_PEAK_DB = -66;

function linearToDbfs(peakLinear: number): number {
  const x = Math.max(peakLinear, 1e-12);
  return 20 * (Math.log(x) / Math.LN10);
}

export type RecordingBufferAnalysisOptions = {
  /** Override first-sample VAD (dBFS). Defaults to session adaptive or {@link getDefaultFirstSpeechThresholdDb}. */
  firstSpeechThresholdDb?: number;
};

export type RecordingBufferAnalysis = {
  audio_duration_ms: number;
  buffer_size_bytes: number;
  has_non_zero_audio: boolean;
  peak_amplitude_db: number;
  firstSpeechOffsetMs: number | null;
  /** Session adaptive threshold used for first-speech scan (auditable). */
  vad_threshold_db: number | null;
  ambient_noise_floor_db: number | null;
  /** dBFS of the first decoded sample that exceeded the VAD threshold (debug). */
  vad_first_frame_accepted_db: number | null;
};

/**
 * Decode blob (web) and measure duration, peak dBFS, silence flag, rough first-speech offset.
 * Native peak from metering can short-circuit silence without decode.
 */
export async function analyzeRecordingBuffer(
  blob: Blob | null,
  nativePeakMeteringDb: number | null,
  options?: RecordingBufferAnalysisOptions
): Promise<RecordingBufferAnalysis> {
  const vadThresholdDb =
    options?.firstSpeechThresholdDb ?? getInterviewSessionVadFirstSpeechThresholdDb();
  const ambientForLog = getInterviewSessionAmbientNoiseFloorDb();

  const empty = (): RecordingBufferAnalysis => ({
    audio_duration_ms: 0,
    buffer_size_bytes: blob?.size ?? 0,
    has_non_zero_audio: false,
    peak_amplitude_db: -120,
    firstSpeechOffsetMs: null,
    vad_threshold_db: vadThresholdDb,
    ambient_noise_floor_db: ambientForLog,
    vad_first_frame_accepted_db: null,
  });

  const buffer_size_bytes = blob?.size ?? 0;
  if (!blob || blob.size < 32) {
    return empty();
  }

  if (nativePeakMeteringDb != null && Number.isFinite(nativePeakMeteringDb) && nativePeakMeteringDb > SILENCE_PEAK_DB) {
    return {
      audio_duration_ms: 0,
      buffer_size_bytes,
      has_non_zero_audio: true,
      peak_amplitude_db: nativePeakMeteringDb,
      firstSpeechOffsetMs: 0,
      vad_threshold_db: vadThresholdDb,
      ambient_noise_floor_db: ambientForLog,
      vad_first_frame_accepted_db: nativePeakMeteringDb,
    };
  }

  if (Platform.OS !== 'web' || typeof AudioContext === 'undefined' || typeof blob.arrayBuffer !== 'function') {
    return {
      audio_duration_ms: 0,
      buffer_size_bytes,
      has_non_zero_audio: buffer_size_bytes > 2000,
      peak_amplitude_db: nativePeakMeteringDb ?? -120,
      firstSpeechOffsetMs: null,
      vad_threshold_db: vadThresholdDb,
      ambient_noise_floor_db: ambientForLog,
      vad_first_frame_accepted_db: null,
    };
  }

  try {
    const ctx = new AudioContext();
    const buf = await blob.arrayBuffer();
    const audioBuf = await ctx.decodeAudioData(buf.slice(0));
    await ctx.close().catch(() => {});
    const ch0 = audioBuf.getChannelData(0);
    const sr = audioBuf.sampleRate || 48000;
    const audio_duration_ms = Math.round((ch0.length / sr) * 1000);
    let peakLinearMax = 0;
    for (let i = 0; i < ch0.length; i++) {
      const a = Math.abs(ch0[i] ?? 0);
      if (a > peakLinearMax) peakLinearMax = a;
    }
    const peak_amplitude_db = linearToDbfs(peakLinearMax);
    const has_non_zero_audio = peak_amplitude_db > SILENCE_PEAK_DB;

    const threshLinear = Math.pow(10, vadThresholdDb / 20);

    let firstSpeechOffsetMs: number | null = null;
    let vad_first_frame_accepted_db: number | null = null;
    if (has_non_zero_audio && ch0.length > 0) {
      const scanStep = Math.max(1, Math.floor(sr / 800));
      for (let i = 0; i < ch0.length; i += scanStep) {
        const sample = Math.abs(ch0[i] ?? 0);
        if (sample > threshLinear) {
          firstSpeechOffsetMs = Math.round((i / sr) * 1000);
          vad_first_frame_accepted_db = Math.round(linearToDbfs(sample) * 1000) / 1000;
          break;
        }
      }
      /** Coarse scan can miss narrow peaks; if global max exceeds threshold, find first crossing sample-accurately. */
      if (firstSpeechOffsetMs === null && peakLinearMax > threshLinear) {
        for (let i = 0; i < ch0.length; i++) {
          const sample = Math.abs(ch0[i] ?? 0);
          if (sample > threshLinear) {
            firstSpeechOffsetMs = Math.round((i / sr) * 1000);
            vad_first_frame_accepted_db = Math.round(linearToDbfs(sample) * 1000) / 1000;
            break;
          }
        }
      }
    }

    return {
      audio_duration_ms,
      buffer_size_bytes,
      has_non_zero_audio,
      peak_amplitude_db: Math.round(peak_amplitude_db * 1000) / 1000,
      firstSpeechOffsetMs,
      vad_threshold_db: vadThresholdDb,
      ambient_noise_floor_db: ambientForLog,
      vad_first_frame_accepted_db,
    };
  } catch {
    return {
      audio_duration_ms: 0,
      buffer_size_bytes,
      has_non_zero_audio: buffer_size_bytes > 4000,
      peak_amplitude_db: -120,
      firstSpeechOffsetMs: null,
      vad_threshold_db: vadThresholdDb,
      ambient_noise_floor_db: ambientForLog,
      vad_first_frame_accepted_db: null,
    };
  }
}
