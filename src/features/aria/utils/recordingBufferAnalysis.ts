import { Platform } from 'react-native';

const SILENCE_PEAK_DB = -60;

function linearToDbfs(peakLinear: number): number {
  const x = Math.max(peakLinear, 1e-12);
  return 20 * (Math.log(x) / Math.LN10);
}

export type RecordingBufferAnalysis = {
  audio_duration_ms: number;
  buffer_size_bytes: number;
  has_non_zero_audio: boolean;
  peak_amplitude_db: number;
  firstSpeechOffsetMs: number | null;
};

/**
 * Decode blob (web) and measure duration, peak dBFS, silence flag, rough first-speech offset.
 * Native peak from metering can short-circuit silence without decode.
 */
export async function analyzeRecordingBuffer(
  blob: Blob | null,
  nativePeakMeteringDb: number | null
): Promise<RecordingBufferAnalysis> {
  const buffer_size_bytes = blob?.size ?? 0;
  if (!blob || blob.size < 32) {
    return {
      audio_duration_ms: 0,
      buffer_size_bytes,
      has_non_zero_audio: false,
      peak_amplitude_db: -120,
      firstSpeechOffsetMs: null,
    };
  }

  if (nativePeakMeteringDb != null && Number.isFinite(nativePeakMeteringDb) && nativePeakMeteringDb > SILENCE_PEAK_DB) {
    return {
      audio_duration_ms: 0,
      buffer_size_bytes,
      has_non_zero_audio: true,
      peak_amplitude_db: nativePeakMeteringDb,
      firstSpeechOffsetMs: 0,
    };
  }

  if (Platform.OS !== 'web' || typeof AudioContext === 'undefined' || typeof blob.arrayBuffer !== 'function') {
    return {
      audio_duration_ms: 0,
      buffer_size_bytes,
      has_non_zero_audio: buffer_size_bytes > 2000,
      peak_amplitude_db: nativePeakMeteringDb ?? -120,
      firstSpeechOffsetMs: null,
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
    let peak = 0;
    const step = Math.max(1, Math.floor(ch0.length / 50_000));
    for (let i = 0; i < ch0.length; i += step) {
      const a = Math.abs(ch0[i] ?? 0);
      if (a > peak) peak = a;
    }
    const peak_amplitude_db = linearToDbfs(peak);
    const has_non_zero_audio = peak_amplitude_db > SILENCE_PEAK_DB;

    let firstSpeechOffsetMs: number | null = null;
    if (has_non_zero_audio && ch0.length > 0) {
      const thresh = Math.pow(10, SILENCE_PEAK_DB / 20);
      const scanStep = Math.max(1, Math.floor(sr / 200));
      for (let i = 0; i < ch0.length; i += scanStep) {
        if (Math.abs(ch0[i] ?? 0) > thresh) {
          firstSpeechOffsetMs = Math.round((i / sr) * 1000);
          break;
        }
      }
    }

    return {
      audio_duration_ms,
      buffer_size_bytes,
      has_non_zero_audio,
      peak_amplitude_db: Math.round(peak_amplitude_db * 1000) / 1000,
      firstSpeechOffsetMs,
    };
  } catch {
    return {
      audio_duration_ms: 0,
      buffer_size_bytes,
      has_non_zero_audio: buffer_size_bytes > 4000,
      peak_amplitude_db: -120,
      firstSpeechOffsetMs: null,
    };
  }
}
