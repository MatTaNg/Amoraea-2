import { afterEach, describe, expect, it } from '@jest/globals';
import { Platform } from 'react-native';

import { analyzeRecordingBuffer } from '@features/aria/utils/recordingBufferAnalysis';

describe('analyzeRecordingBuffer (native)', () => {
  const origOS = Platform.OS;

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: origOS });
  });

  it('does not invent firstSpeechOffsetMs when metering short-circuits without duration', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
    const blob = { size: 28000 } as Blob;
    const analysis = await analyzeRecordingBuffer(blob, -20);
    expect(analysis.has_non_zero_audio).toBe(true);
    expect(analysis.audio_duration_ms).toBe(0);
    expect(analysis.firstSpeechOffsetMs).toBeNull();
  });

  it('treats native metering at or below silence threshold as silent even with a large buffer', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
    // Session log: peak -79 dB, ~19KB AAC → Whisper hallucinated "You"
    const blob = { size: 19218 } as Blob;
    const analysis = await analyzeRecordingBuffer(blob, -79);
    expect(analysis.has_non_zero_audio).toBe(false);
    expect(analysis.peak_amplitude_db).toBe(-79);
    expect(analysis.vad_first_frame_accepted_db).toBeNull();
  });

  it('keeps buffer-size heuristic when native metering is missing', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
    const blob = { size: 19218 } as Blob;
    const analysis = await analyzeRecordingBuffer(blob, null);
    expect(analysis.has_non_zero_audio).toBe(true);
  });
});
