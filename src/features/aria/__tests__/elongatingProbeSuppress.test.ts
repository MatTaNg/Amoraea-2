import {
  userTurnHasMultipleDistinctIdeasOrHypotheses,
  userTurnLooksLikeSingleSurfaceLabelOnly,
  userTurnSuppressesElongatingProbe,
} from '../elongatingProbe';

describe('userTurnSuppressesElongatingProbe', () => {
  it('suppresses for 25+ words (session log regression: 127-word hypotheses)', () => {
    const t =
      'What I said was either she is not communicating her wants and needs. Those are the three main readings I see.';
    expect(userTurnSuppressesElongatingProbe(t)).toBe(true);
  });

  it('suppresses when multiple hypotheses are enumerated in fewer than 25 words', () => {
    const t =
      'First hypothesis is poor communication. Second is gaslighting. Third is he never shows up. Those are the three.';
    expect(userTurnHasMultipleDistinctIdeasOrHypotheses(t)).toBe(true);
    expect(userTurnSuppressesElongatingProbe(t)).toBe(true);
  });

  it('suppresses for 15–24 words even without explicit enumeration', () => {
    const t = Array(18).fill('word').join(' ');
    expect(userTurnSuppressesElongatingProbe(t)).toBe(true);
  });

  it('does not suppress short single-surface label', () => {
    expect(userTurnLooksLikeSingleSurfaceLabelOnly("They're fighting")).toBe(true);
    expect(userTurnSuppressesElongatingProbe("They're fighting")).toBe(false);
  });

  it('does not suppress thin vague under 15 words that is not a single-label pattern', () => {
    expect(userTurnSuppressesElongatingProbe('I dont know')).toBe(false);
  });
});
