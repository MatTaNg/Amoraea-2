import { speechLevelAtPosition } from '@features/aria/utils/speechLevelEnvelope';

describe('speechLevelAtPosition', () => {
  const envelope = new Float32Array([0.1, 0.4, 0.9, 0.2]);

  it('reads the bucket for the current playback position', () => {
    expect(speechLevelAtPosition(envelope, 0, 1000)).toBeCloseTo(0.1);
    expect(speechLevelAtPosition(envelope, 500, 1000)).toBeCloseTo(0.9);
    expect(speechLevelAtPosition(envelope, 1000, 1000)).toBeCloseTo(0.2);
  });

  it('returns 0 when duration is missing', () => {
    expect(speechLevelAtPosition(envelope, 100, 0)).toBe(0);
  });
});
