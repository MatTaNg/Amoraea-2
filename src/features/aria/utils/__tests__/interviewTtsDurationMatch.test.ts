import { isTtsDurationMatchWithinOverrunTolerance } from '../interviewTtsDurationMatch';

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
