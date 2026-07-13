import {
  attemptRowMissingInterviewModifiers,
  defaultModifierFieldsFromWeightedScore,
  interviewModifierFieldsFromGateResult,
} from '@features/aria/interviewModifierPersist';

describe('interviewModifierPersist', () => {
  it('derives modified_weighted_score from weighted + modifier when gate omits modified', () => {
    const fields = interviewModifierFieldsFromGateResult({
      weightedScore: 5.4,
      scoreModifier: 0.3,
      depthSignalModifier: 0.3,
      modifiedWeightedScore: null,
    });
    expect(fields.depth_signal_modifier).toBe(0.3);
    expect(fields.score_modifier).toBe(0.3);
    expect(fields.modified_weighted_score).toBe(5.7);
  });

  it('defaults missing modifiers from weighted score', () => {
    expect(defaultModifierFieldsFromWeightedScore(5.4)).toEqual({
      depth_signal_modifier: 0,
      score_modifier: 0,
      modified_weighted_score: 5.4,
    });
  });

  it('detects incomplete modifier rows', () => {
    expect(
      attemptRowMissingInterviewModifiers({
        weighted_score: 5.4,
        score_modifier: null,
        depth_signal_modifier: 0,
        modified_weighted_score: 5.4,
      }),
    ).toBe(true);
    expect(
      attemptRowMissingInterviewModifiers({
        score_modifier: 0,
        depth_signal_modifier: 0,
        modified_weighted_score: 5.4,
      }),
    ).toBe(false);
  });
});
