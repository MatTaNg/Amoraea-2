import { sanitizePersonalMomentScoresForAggregate } from '../personalMomentSliceSanitize';

describe('sanitizePersonalMomentScoresForAggregate', () => {
  it('strips non-assessed keys from Moment 4 (including spurious repair)', () => {
    const out = sanitizePersonalMomentScoresForAggregate({
      pillarScores: { repair: 7, mentalizing: 8, attunement: 2 },
      keyEvidence: { repair: 'x', mentalizing: 'y' },
    });
    expect(out?.pillarScores.repair).toBeUndefined();
    expect(out?.pillarScores.mentalizing).toBe(8);
    expect(out?.keyEvidence?.repair).toBeUndefined();
  });

  it('strips Moment 4 keys case-insensitively (model may echo Repair)', () => {
    const out = sanitizePersonalMomentScoresForAggregate({
      pillarScores: { Repair: 7, mentalizing: 8 } as Record<string, number | null>,
      keyEvidence: { Repair: 'x', mentalizing: 'y' },
    });
    expect(out?.pillarScores.Repair).toBeUndefined();
    expect((out?.pillarScores as Record<string, unknown>).repair).toBeUndefined();
    expect(out?.pillarScores.mentalizing).toBe(8);
    expect(out?.keyEvidence?.Repair).toBeUndefined();
  });
});
