import {
  isTtsDurationMatchWithinOverrunTolerance,
  isTtsPlaybackPrematureCutoff,
} from '../interviewTtsDurationMatch';

describe('isTtsDurationMatchWithinOverrunTolerance (10% overrun cap)', () => {
  it('allows actual within 110% of expected', () => {
    expect(isTtsDurationMatchWithinOverrunTolerance(52_800, 48_000)).toBe(true);
  });

  it('flags ~55s vs ~48s as mismatch (over 10% overrun)', () => {
    expect(isTtsDurationMatchWithinOverrunTolerance(55_000, 48_000)).toBe(false);
  });

  it('allows exact match', () => {
    expect(isTtsDurationMatchWithinOverrunTolerance(10_000, 10_000)).toBe(true);
  });

  it('allows shorter actual', () => {
    expect(isTtsDurationMatchWithinOverrunTolerance(1000, 5000)).toBe(true);
  });
});

describe('isTtsPlaybackPrematureCutoff', () => {
  it('flags ~40% of long-line estimate as cutoff', () => {
    expect(isTtsPlaybackPrematureCutoff(32_208, 79_560)).toBe(true);
  });

  it('does not flag short expected durations', () => {
    expect(isTtsPlaybackPrematureCutoff(1000, 3000)).toBe(false);
  });

  it('does not flag adequate playback', () => {
    expect(isTtsPlaybackPrematureCutoff(72_000, 79_560)).toBe(false);
  });
});
