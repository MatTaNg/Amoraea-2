import { describe, expect, it } from '@jest/globals';

import { COMPAT_V3_CORE_WEIGHTS, FINANCE_OWNED_INPUT_FIELDS } from '@config/matching/compatibilityScoring';
import {
  computeConcreteLifeFit,
  CONCRETE_LIFE_FIT_EXCLUDED_FINANCE_FIELDS,
  CONCRETE_LIFE_FIT_INPUT_FIELDS,
  type ConcreteLifeFitProfile,
} from '../computeConcreteLifeFit';
import {
  computeFinalCompatibilityScore,
  computeFinalCompatibilityScoreV3,
  listDealbreakerHardFilterCodes,
} from '../computeCompatibilityScore';

const aligned: ConcreteLifeFitProfile = {
  wantKids: 'Want kids',
  familyKidsCount: '2',
  familyKidsTiming: 'In 1–3 years',
  relationshipStyle: 'monogamy',
  marriagePartnershipPreference: 'yes',
  religion: 'Christian',
  politics: 'Liberal',
  livingLocation: 'City',
  diet: 'Vegetarian',
  sleepSchedule: 'Morning person — typically up between 7–9am',
  sexDrive: '1-2x a week',
};

describe('computeConcreteLifeFit', () => {
  it('raises fit when concrete desired-life fields align', () => {
    const high = computeConcreteLifeFit(aligned, aligned);
    const low = computeConcreteLifeFit(aligned, {
      ...aligned,
      wantKids: 'Want kids',
      familyKidsCount: '4 or more',
      familyKidsTiming: 'In 5+ years',
      livingLocation: 'Rural',
      diet: 'Carnivore',
      sexDrive: 'Daily, or almost daily',
    });
    expect(high.score).toBeGreaterThan(low.score);
    expect(high.usedDimensionIds.length).toBeGreaterThan(0);
  });

  it('reduces fit for flexible mismatches without hard-blocking', () => {
    const samePolitics = computeConcreteLifeFit(
      { ...aligned, politics: 'Liberal' },
      { ...aligned, politics: 'Liberal' },
    );
    const mismatchPolitics = computeConcreteLifeFit(
      { ...aligned, politics: 'Liberal', prefPartnerPoliticalAlignmentImportance: 'preference' },
      { ...aligned, politics: 'Conservative', prefPartnerPoliticalAlignmentImportance: 'preference' },
    );
    expect(mismatchPolitics.score).toBeLessThan(samePolitics.score);
    expect(mismatchPolitics.skippedHardBlockedIds).not.toContain('politics');
  });

  it('omits hard-blocked children instead of scoring them again', () => {
    const hard = ['kids_want_vs_dont'];
    const blocked = computeConcreteLifeFit(
      { wantKids: 'Want kids', relationshipStyle: 'monogamy', religion: 'Christian' },
      { wantKids: "Don't want kids", relationshipStyle: 'monogamy', religion: 'Christian' },
      hard,
    );
    expect(blocked.skippedHardBlockedIds).toContain('children');
    expect(blocked.usedDimensionIds).not.toContain('children');
    const codes = listDealbreakerHardFilterCodes(
      { wantKids: 'Want kids' },
      { wantKids: "Don't want kids" },
    );
    expect(codes).toContain('kids_want_vs_dont');
  });

  it('does not include raw finance fields', () => {
    for (const field of FINANCE_OWNED_INPUT_FIELDS) {
      expect((CONCRETE_LIFE_FIT_INPUT_FIELDS as readonly string[]).includes(field)).toBe(false);
    }
    expect(CONCRETE_LIFE_FIT_EXCLUDED_FINANCE_FIELDS.length).toBeGreaterThan(0);
    const withFinanceNoise = computeConcreteLifeFit(
      { ...aligned, wantKids: 'Want kids' },
      { ...aligned, wantKids: 'Want kids' },
    );
    const clone = computeConcreteLifeFit(aligned, aligned);
    expect(withFinanceNoise.score).toBeCloseTo(clone.score, 10);
  });
});

describe('production ranking vs historical V2 sexual-comm', () => {
  const v3Base = {
    attachmentScore: 0.8,
    valuesScore: 0.8,
    lifeDomainImportanceAlignment: 0.8,
    concreteLifeFitScore: 0.8,
    financeScore: 0.8,
    interviewProcessScore: 0.8,
    capacityA: 0.8,
    capacityB: 0.8,
    conflictStyleAdjustment: 0,
    politicsAdjustment: 0,
    psychometricSoftAdjustment: 0,
    anxiousAvoidantSoftPenalty: 0,
    dealbreakerMultiplier: 1 as const,
  };

  it('V3 ignores sexualCommAdjustment', () => {
    const a = computeFinalCompatibilityScoreV3(v3Base);
    const b = computeFinalCompatibilityScoreV3({ ...v3Base, sexualCommAdjustment: 0.03 });
    expect(b.finalScore).toBeCloseTo(a.finalScore, 10);
  });

  it('historical V2 still applies sexualCommAdjustment when called directly', () => {
    const shared = {
      attachmentScore: 0.8,
      valuesScore: 0.8,
      semanticScore: 0.5,
      financeScore: 0.8,
      interviewProcessScore: 0.8,
      capacityA: 0.8,
      capacityB: 0.8,
      interviewWeightedScoreA: 8,
      interviewWeightedScoreB: 8,
      conflictStyleAdjustment: 0,
      politicsAdjustment: 0,
      psychometricSoftAdjustment: 0,
      dealbreakerMultiplier: 1 as const,
    };
    const without = computeFinalCompatibilityScore({ ...shared, sexualCommAdjustment: 0 });
    const withAdj = computeFinalCompatibilityScore({ ...shared, sexualCommAdjustment: 0.03 });
    expect(withAdj.finalScore).toBeGreaterThan(without.finalScore);
    expect(withAdj.finalScore - without.finalScore).toBeCloseTo(0.03, 8);
  });

  it('core weights remain 1.00 without a padding component', () => {
    const sum =
      COMPAT_V3_CORE_WEIGHTS.concreteLifeFit +
      COMPAT_V3_CORE_WEIGHTS.finance +
      COMPAT_V3_CORE_WEIGHTS.lifeDomainImportanceAlignment +
      COMPAT_V3_CORE_WEIGHTS.valuesSimilarity +
      COMPAT_V3_CORE_WEIGHTS.attachmentSimilarity;
    expect(sum).toBeCloseTo(1, 10);
  });
});
