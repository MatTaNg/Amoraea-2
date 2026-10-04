/** 0–1 loudness buckets across a decoded clip, for the speaking glow. */
export async function buildSpeechLevelEnvelope(
  arrayBuffer: ArrayBuffer,
  buckets = 96,
): Promise<Float32Array | null> {
  if (typeof AudioContext === 'undefined' || arrayBuffer.byteLength === 0) return null;
  let ctx: AudioContext | null = null;
  try {
    ctx = new AudioContext();
    const audio = await ctx.decodeAudioData(arrayBuffer.slice(0));
    const data = audio.getChannelData(0);
    if (!data?.length) return null;

    const envelope = new Float32Array(buckets);
    const size = Math.max(1, Math.floor(data.length / buckets));
    let peak = 0.0001;
    for (let bucket = 0; bucket < buckets; bucket += 1) {
      const start = bucket * size;
      const end = bucket === buckets - 1 ? data.length : Math.min(data.length, start + size);
      let sum = 0;
      let count = 0;
      for (let i = start; i < end; i += 8) {
        const sample = data[i] ?? 0;
        sum += sample * sample;
        count += 1;
      }
      const rms = Math.sqrt(sum / Math.max(1, count));
      envelope[bucket] = rms;
      if (rms > peak) peak = rms;
    }
    for (let bucket = 0; bucket < buckets; bucket += 1) {
      const normalized = envelope[bucket]! / peak;
      envelope[bucket] = Math.min(1, normalized ** 0.65);
    }
    return envelope;
  } catch {
    return null;
  } finally {
    await ctx?.close().catch(() => {});
  }
}

export function speechLevelAtPosition(
  envelope: Float32Array,
  positionMillis: number,
  durationMillis: number,
): number {
  if (!envelope.length || !Number.isFinite(durationMillis) || durationMillis <= 0) return 0;
  const ratio = Math.min(1, Math.max(0, positionMillis / durationMillis));
  const index = Math.min(envelope.length - 1, Math.floor(ratio * envelope.length));
  return envelope[index] ?? 0;
}
