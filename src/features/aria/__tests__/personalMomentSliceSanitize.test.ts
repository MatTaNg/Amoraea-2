import {
  promoteMoment5LegacyContemptForScoringResult,
  sanitizeMoment5PersonalScoresForAggregate,
  sanitizePersonalMomentScoresForAggregate,
  sanitizeSupportMomentScoresForAggregate,
} from '../personalMomentSliceSanitize';

describe('sanitizePersonalMomentScoresForAggregate', () => {
  it('strips leaked Moment 4 repair without spontaneous evidence', () => {
    const out = sanitizePersonalMomentScoresForAggregate({
      pillarScores: { repair: 7, mentalizing: 8, attunement: 2 },
      keyEvidence: { repair: 'x', mentalizing: 'y' },
    });
    expect(out?.pillarScores.repair).toBeUndefined();
    expect(out?.pillarScores.mentalizing).toBe(8);
    expect(out?.keyEvidence?.repair).toBeUndefined();
  });

  it('keeps Moment 4 regulation when the model scored it', () => {
    const out = sanitizePersonalMomentScoresForAggregate({
      pillarScores: { mentalizing: 8, regulation: 6, repair: 7 },
    });
    expect(out?.pillarScores.regulation).toBe(6);
    expect(out?.pillarScores.repair).toBeUndefined();
  });

  it('keeps Moment 4 repair when evidence is assessable spontaneous process', () => {
    const out = sanitizePersonalMomentScoresForAggregate({
      pillarScores: { mentalizing: 8, repair: 7 },
      keyEvidence: { repair: 'spontaneous: I apologized and we talked it through.' },
    });
    expect(out?.pillarScores.repair).toBe(7);
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

describe('sanitizeSupportMomentScoresForAggregate', () => {
  it('keeps responsiveness slices and drops leaked repair without process evidence', () => {
    const out = sanitizeSupportMomentScoresForAggregate({
      pillarScores: {
        responsiveness_support: 8,
        need_recognition: 7,
        attunement: 6,
        repair: 9,
      },
    });
    expect(out?.pillarScores.responsiveness_support).toBe(8);
    expect(out?.pillarScores.need_recognition).toBe(7);
    expect(out?.pillarScores.attunement).toBe(6);
    expect(out?.pillarScores.repair).toBeUndefined();
  });

  it('keeps support-moment repair when spontaneous process evidence is present', () => {
    const out = sanitizeSupportMomentScoresForAggregate({
      pillarScores: { responsiveness_support: 8, repair: 6 },
      keyEvidence: { repair: 'I apologized and we talked it through after I showed up late.' },
    });
    expect(out?.pillarScores.repair).toBe(6);
  });
});
