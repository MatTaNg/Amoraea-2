import { describe, expect, it } from '@jest/globals';

import { buildScoreReceipt } from '@features/admin/buildScoreReceipt';

describe('buildScoreReceipt', () => {
  it('uses recomputed depth line items for subtotals when stored modifier is stale', () => {
    const receipt = buildScoreReceipt({
      attempt: {
        weighted_score: 6.2,
        depth_signal_modifier: 0.15,
        modified_weighted_score: 6.35,
        modified_weighted_score_with_psychometrics: 6.35,
        psychometric_modifier_applied: 0,
        ego_development_level: 3,
        moment_4_concreteness: 'high',
        moment_5_concreteness: 'high',
        emotion_recognition_raw_score: 3,
      },
    });

    const interviewOnly = receipt.lines.find((l) => l.label === 'Interview-only modified score');
    const finalScore = receipt.lines.find((l) => l.label === 'Final modified score');
    const mismatchNote = receipt.lines.find(
      (l) => l.label === 'Stored depth modifier differs from recomputed line items',
    );

    expect(mismatchNote).toBeDefined();
    expect(interviewOnly?.amount).toBe(6.6);
    expect(finalScore?.amount).toBe(6.6);
  });
});
