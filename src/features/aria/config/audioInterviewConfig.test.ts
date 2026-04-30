import {
  getAudioWhisperTranscriptionTimeoutMs,
  getAudioWhisperTimeoutMs,
} from './audioInterviewConfig';

describe('getAudioWhisperTranscriptionTimeoutMs', () => {
  it('uses at least the env floor for short clips', () => {
    const floor = getAudioWhisperTimeoutMs();
    expect(getAudioWhisperTranscriptionTimeoutMs(2000)).toBeGreaterThanOrEqual(floor);
  });

  it('scales up for long clips (session log ~46s case)', () => {
    expect(getAudioWhisperTranscriptionTimeoutMs(46_380)).toBe(120_000);
  });

  it('returns a generous default when duration is unknown', () => {
    expect(getAudioWhisperTranscriptionTimeoutMs(null)).toBeGreaterThanOrEqual(45_000);
    expect(getAudioWhisperTranscriptionTimeoutMs(undefined)).toBeGreaterThanOrEqual(45_000);
  });

  it('caps at 120s', () => {
    expect(getAudioWhisperTranscriptionTimeoutMs(300_000)).toBe(120_000);
  });
});
