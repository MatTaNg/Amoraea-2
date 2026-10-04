import { describe, expect, it } from '@jest/globals';
import { REPAIR_SOURCE_VALIDATION_NO_AUTOCHANGE_TODO } from '@config/scoring/repairSourceSignals';
import { evaluateRepairSourceValidation } from '@features/admin/repairSourceValidationAnalytics';
import { hierarchicalR2Increment, pearsonR, spearmanBrownFromR } from '@features/admin/scoringStats';

describe('repair source validation analytics', () => {
  it('flags high hypothetical–autobiographical agreement for review only', () => {
    const attempts = Array.from({ length: 8 }, (_, i) => ({
      userId: `u${i}`,
      hypothetical: i + 2,
      autobiographical: i + 2,
      spontaneous: 5,
      pillarRepair: i + 2,
      gapHypoMinusAuto: 0,
    }));
    const report = evaluateRepairSourceValidation({ attempts });
    expect(report.agreement.reviewFlag).toBe(true);
    expect(report.agreement.rHypotheticalAutobiographical).toBeCloseTo(1, 5);
    expect(report.noAutoChangeTodo).toBe(REPAIR_SOURCE_VALIDATION_NO_AUTOCHANGE_TODO);
  });

  it('does not treat hypo/auto disagreement as error and can evaluate gap vs outcomes', () => {
    const attempts = Array.from({ length: 12 }, (_, i) => {
      const hypothetical = 8;
      const autobiographical = i % 2 === 0 ? 8 : 3;
      return {
        userId: `u${i}`,
        hypothetical,
        autobiographical,
        spontaneous: 6,
        spontaneousScenario1: 6,
        spontaneousScenario2: 6,
        pillarRepair: Math.round((8 + autobiographical + 6) / 3),
        gapHypoMinusAuto: hypothetical - autobiographical,
      };
    });
    const outcomes = attempts.map((row) => ({
      userId: row.userId,
      outcomeId: 'wanted_second_date',
      outcome: row.gapHypoMinusAuto != null && row.gapHypoMinusAuto > 0 ? 0 : 1,
    }));
    const report = evaluateRepairSourceValidation({ attempts, outcomes });
    expect(report.agreement.reviewFlag).toBe(false);
    const validity = report.incrementalValidity.find((v) => v.outcomeId === 'wanted_second_date');
    expect(validity?.rGap).not.toBeNull();
    expect(validity?.rGap ?? 0).toBeLessThan(0);
  });

  it('reports single-item reliability for S3/M5 and split-half for spontaneous S1/S2', () => {
    const attempts = Array.from({ length: 12 }, (_, i) => ({
      userId: `u${i}`,
      hypothetical: 5 + (i % 3),
      autobiographical: 4 + (i % 4),
      spontaneous: 6,
      spontaneousScenario1: i,
      spontaneousScenario2: i,
      pillarRepair: 6,
      gapHypoMinusAuto: 1,
    }));
    const report = evaluateRepairSourceValidation({ attempts });
    const hypo = report.reliability.find((r) => r.source === 'hypothetical_repair');
    const auto = report.reliability.find((r) => r.source === 'autobiographical_repair');
    const spont = report.reliability.find((r) => r.source === 'spontaneous_repair');
    expect(hypo?.singleItem).toBe(true);
    expect(auto?.singleItem).toBe(true);
    expect(spont?.singleItem).toBe(false);
    expect(spont?.splitHalfReliability).toBeCloseTo(1, 5);
  });
});

describe('scoringStats helpers', () => {
  it('computes hierarchical R² increment for a second predictor', () => {
    const x1 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    const x2 = [2, 1, 4, 3, 6, 5, 8, 7, 10, 9, 12, 11];
    const y = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    const inc = hierarchicalR2Increment(x1, x2, y, 10);
    expect(inc.r2Base).toBeCloseTo(1, 5);
    expect(inc.deltaR2 ?? 0).toBeCloseTo(0, 5);
  });

  it('returns Spearman-Brown from r', () => {
    expect(spearmanBrownFromR(1)).toBe(1);
    expect(pearsonR([1, 2, 3], [1, 2, 3])).toBeCloseTo(1, 5);
  });
});
