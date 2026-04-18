/**
 * Per-interview-session adaptive VAD for first-speech offset (web decoded buffers).
 * Ambient floor updated from TTS-time mic sampling (median dBFS during playback).
 * Reset when the interview progress refs reset (new session / retake).
 */

let ambientNoiseFloorDb: number | null = null;
/** True when ambient could not be measured — use fixed -66 dB threshold. */
let ambientNoiseFallback = false;
let ambientSampleCaptured = false;
/** Legacy: 500ms prepare path (kept for compatibility). */
let ambientSampleScheduled = false;

export function resetInterviewVadSession(): void {
  ambientNoiseFloorDb = null;
  ambientNoiseFallback = false;
  ambientSampleCaptured = false;
  ambientSampleScheduled = false;
  lastAdaptiveRawDb = null;
  lastThresholdFloored = false;
  lastThresholdUnusuallyHigh = false;
}

/** Called at the start of each TTS-driven ambient window. */
export function resetInterviewVadAmbientSamplingState(): void {
  ambientSampleScheduled = false;
}

/** Returns true once per session until reset — caller runs the 500ms ambient probe. */
export function shouldScheduleAmbientSample(): boolean {
  if (ambientSampleCaptured || ambientSampleScheduled) return false;
  ambientSampleScheduled = true;
  return true;
}

/**
 * Median peak dBFS from the mic analyser while TTS plays (room should be quiet).
 * Fire-and-forget from web mic prepare.
 */
export async function sampleAmbientNoiseFloor500ms(analyser: AnalyserNode): Promise<number | null> {
  const data = new Uint8Array(analyser.fftSize);
  const samples: number[] = [];
  const end = Date.now() + 500;
  while (Date.now() < end) {
    analyser.getByteTimeDomainData(data);
    let peak = 0;
    for (let i = 0; i < data.length; i++) {
      const v = (data[i] - 128) / 128;
      const a = Math.abs(v);
      if (a > peak) peak = a;
    }
    const db = 20 * (Math.log(Math.max(peak, 1e-12)) / Math.LN10);
    samples.push(db);
    await new Promise<void>((r) => setTimeout(r, 50));
  }
  if (samples.length === 0) return null;
  samples.sort((a, b) => a - b);
  return samples[Math.floor(samples.length / 2)] ?? null;
}

/** Median dB from TTS sampling or legacy prepare — updates each successful measure. */
export function setInterviewSessionAmbientNoiseFloorDb(db: number | null): void {
  if (db == null || !Number.isFinite(db)) {
    ambientNoiseFloorDb = null;
    return;
  }
  ambientNoiseFloorDb = db;
  ambientSampleCaptured = true;
}

export function setInterviewSessionAmbientNoiseFallback(on: boolean): void {
  ambientNoiseFallback = on;
}

export function getInterviewSessionAmbientNoiseFallback(): boolean {
  return ambientNoiseFallback;
}

export function getInterviewSessionAmbientNoiseFloorDb(): number | null {
  return ambientNoiseFloorDb;
}

/** Default first-speech gate: 6 dB more sensitive than legacy -60 dBFS scan (~ -66). */
export function getDefaultFirstSpeechThresholdDb(): number {
  return -66;
}

/** Last adaptive computation: raw ambient + 15 before floor / hard ceiling. */
let lastAdaptiveRawDb: number | null = null;
let lastThresholdFloored = false;
let lastThresholdUnusuallyHigh = false;

/**
 * First-sample "speech" threshold in dBFS: ambient + 15 dB (wider window vs ambient),
 * lower-bounded at -40 dB (very quiet rooms), hard-capped at -5 dB when ambient+15 would exceed it.
 */
export function getInterviewSessionVadFirstSpeechThresholdDb(): number {
  const defaultFloor = getDefaultFirstSpeechThresholdDb();
  lastAdaptiveRawDb = null;
  lastThresholdFloored = false;
  lastThresholdUnusuallyHigh = false;
  if (ambientNoiseFallback && ambientNoiseFloorDb == null) {
    return defaultFloor;
  }
  if (ambientNoiseFloorDb != null && Number.isFinite(ambientNoiseFloorDb)) {
    const raw = ambientNoiseFloorDb + 15;
    lastAdaptiveRawDb = raw;
    let adaptive = raw;
    if (raw < -40) {
      adaptive = -40;
      lastThresholdFloored = true;
    }
    if (raw > -5) {
      adaptive = -5;
      lastThresholdUnusuallyHigh = true;
    }
    return Math.max(-72, adaptive);
  }
  return defaultFloor;
}

/** True when the threshold was clamped to -40 dB because ambient + 15 was lower. */
export function getInterviewSessionVadThresholdFloored(): boolean {
  return lastThresholdFloored;
}

/** True when ambient + 15 would have exceeded -5 dB; threshold clamped to -5 dB. */
export function getInterviewSessionVadThresholdUnusuallyHigh(): boolean {
  return lastThresholdUnusuallyHigh;
}
