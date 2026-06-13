import {
  getDefaultFirstSpeechThresholdDb,
  getInterviewSessionAmbientNoiseFallback,
  getInterviewSessionVadFirstSpeechThresholdDb,
  getInterviewSessionVadThresholdUnusuallyHigh,
  resetInterviewVadSession,
  setInterviewSessionAmbientNoiseFallback,
  setInterviewSessionAmbientNoiseFloorDb,
  TTS_BLEED_AMBIENT_CEILING_DB,
} from '../interviewVadSession';

describe('interviewVadSession adaptive VAD', () => {
  beforeEach(() => {
    resetInterviewVadSession();
  });

  it('uses default -66 dB when ambient was never measured', () => {
    expect(getInterviewSessionVadFirstSpeechThresholdDb()).toBe(getDefaultFirstSpeechThresholdDb());
  });

  it('uses ambient + 15 for a quiet room (floored at -40)', () => {
    setInterviewSessionAmbientNoiseFloorDb(-58);
    setInterviewSessionAmbientNoiseFallback(false);
    expect(getInterviewSessionVadFirstSpeechThresholdDb()).toBe(-40);
  });

  it('rejects TTS-bleed ambient and falls back to default threshold', () => {
    setInterviewSessionAmbientNoiseFloorDb(-22);
    setInterviewSessionAmbientNoiseFallback(false);
    expect(getInterviewSessionVadFirstSpeechThresholdDb()).toBe(-35);
    expect(getInterviewSessionVadThresholdUnusuallyHigh()).toBe(true);
  });

  it('documents TTS bleed ceiling above typical quiet-room ambient', () => {
    expect(TTS_BLEED_AMBIENT_CEILING_DB).toBeGreaterThan(-50);
  });

  it('marks unusually high when ambient + 15 exceeds -35', () => {
    setInterviewSessionAmbientNoiseFloorDb(-40);
    setInterviewSessionAmbientNoiseFallback(false);
    getInterviewSessionVadFirstSpeechThresholdDb();
    expect(getInterviewSessionVadThresholdUnusuallyHigh()).toBe(true);
  });

  it('uses fallback default when ambient fallback flag is set without floor', () => {
    setInterviewSessionAmbientNoiseFloorDb(null);
    setInterviewSessionAmbientNoiseFallback(true);
    expect(getInterviewSessionAmbientNoiseFallback()).toBe(true);
    expect(getInterviewSessionVadFirstSpeechThresholdDb()).toBe(-66);
  });
});
