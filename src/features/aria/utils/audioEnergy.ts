import {
  getEffectiveAmbientNoiseCeilingDb,
  getAudioWebRmsEnergyFloor,
} from '@features/aria/config/audioInterviewConfig';

/**
 * Best-effort audio energy for web blobs (Web Audio decode). Returns null when unavailable.
 */
export async function estimateBlobEnergyRms(blob: Blob): Promise<number | null> {
  if (typeof AudioContext === 'undefined' || typeof blob.arrayBuffer !== 'function') {
    return null;
  }
  try {
    const ctx = new AudioContext({ sampleRate: 44100 });
    const buf = await blob.arrayBuffer();
    const audioBuf = await ctx.decodeAudioData(buf.slice(0));
    const data = audioBuf.getChannelData(0);
    if (!data?.length) {
      await ctx.close().catch(() => {});
      return null;
    }
    let sum = 0;
    const step = Math.max(1, Math.floor(data.length / 8000));
    for (let i = 0; i < data.length; i += step) {
      const v = data[i];
      sum += v * v;
    }
    const n = Math.ceil(data.length / step);
    const rms = Math.sqrt(sum / n);
    await ctx.close().catch(() => {});
    return rms;
  } catch {
    return null;
  }
}

/** If true, prefer re-running Whisper before telling the user we missed them (metering or RMS suggests real audio). */
export async function hasLikelySpeechAfterRecording(opts: {
  peakMeteringDb: number | null;
  audioBlob: Blob | null;
}): Promise<boolean> {
  const { peakMeteringDb, audioBlob } = opts;
  if (peakMeteringDb != null && Number.isFinite(peakMeteringDb)) {
    if (peakMeteringDb > getEffectiveAmbientNoiseCeilingDb()) return true;
  }
  if (audioBlob && audioBlob.size > 400) {
    const rms = await estimateBlobEnergyRms(audioBlob);
    if (rms != null && rms >= getAudioWebRmsEnergyFloor()) return true;
  }
  return false;
}
