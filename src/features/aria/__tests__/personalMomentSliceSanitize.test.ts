import {
  promoteMoment5LegacyContemptForScoringResult,
  sanitizeMoment5PersonalScoresForAggregate,
  sanitizePersonalMomentScoresForAggregate,
} from '../personalMomentSliceSanitize';

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

describe('sanitizeMoment5PersonalScoresForAggregate', () => {
  it('promotes legacy contempt to contempt_expression before stripping contempt', () => {
    const out = sanitizeMoment5PersonalScoresForAggregate({
      pillarScores: {
        accountability: 8,
        mentalizing: 7,
        repair: 6,
        regulation: 7,
        contempt: 9,
      },
      keyEvidence: {
        accountability: 'Owned role.',
        mentalizing: 'Inferring parents.',
        repair: 'Distance as repair.',
        regulation: 'Managed overload.',
        contempt: 'Tier 1 analytical framing.',
      },
    });
    expect(out?.pillarScores.contempt).toBeUndefined();
    expect(out?.pillarScores.contempt_expression).toBe(9);
    expect(out?.keyEvidence?.contempt_expression).toContain('Tier 1');
    expect(out?.pillarScores.accountability).toBe(8);
  });

  it('does not overwrite an explicit contempt_expression', () => {
    const out = sanitizeMoment5PersonalScoresForAggregate({
      pillarScores: { contempt_expression: 8, contempt: 9 },
      keyEvidence: { contempt_expression: 'explicit', contempt: 'legacy' },
    });
    expect(out?.pillarScores.contempt_expression).toBe(8);
    expect(out?.keyEvidence?.contempt_expression).toBe('explicit');
  });
});

describe('promoteMoment5LegacyContemptForScoringResult', () => {
  it('mutates parsed scoring result in place', () => {
    const row = {
      pillarScores: { contempt: 7 } as Record<string, number | null | undefined>,
      keyEvidence: { contempt: 'legacy evidence' },
    };
    promoteMoment5LegacyContemptForScoringResult(row);
    expect(row.pillarScores.contempt_expression).toBe(7);
    expect(row.keyEvidence?.contempt_expression).toBe('legacy evidence');
  });
});
