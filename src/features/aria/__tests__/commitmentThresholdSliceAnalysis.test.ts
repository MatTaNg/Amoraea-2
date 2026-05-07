import { sampleStdDev } from '../commitmentThresholdSliceAnalysis';

describe('commitmentThresholdSliceAnalysis', () => {
  it('sampleStdDev returns null for fewer than 2 values', () => {
    expect(sampleStdDev([7])).toBeNull();
    expect(sampleStdDev([])).toBeNull();
  });

  it('sampleStdDev computes spread for two values', () => {
    expect(sampleStdDev([2, 7])).toBeCloseTo(3.536, 2);
  });
});
