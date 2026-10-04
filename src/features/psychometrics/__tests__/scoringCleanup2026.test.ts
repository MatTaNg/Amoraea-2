import { describe, expect, it } from '@jest/globals';

import {
  ACTIVE_NEW_USER_MODIFIER_INSTRUMENTS,
  ACTIVE_PRE_INTERVIEW_ASSESSMENT_IDS,
  EXPERIMENTAL_NON_GATING_ASSESSMENT_IDS,
  RETIRED_HISTORICAL_ASSESSMENT_IDS,
} from '@config/psychometrics/activeNewUserScoring';
import {
  CAPACITY_ACCOUNTABILITY_WEIGHT,
  CAPACITY_CONTEMPT_WEIGHT,
  CAPACITY_EXTERNALIZE_WEIGHT,
  CAPACITY_MENTALIZING_WEIGHT,
  CAPACITY_REGULATION_WEIGHT,
  CAPACITY_REPAIR_WEIGHT,
  CAPACITY_RESILIENCE_WEIGHT,
  CAPACITY_SELF_COMPASSION_WEIGHT,
  COMPAT_V3_ANXIOUS_AVOIDANT_SOFT_PENALTY_MAX,
  COMPAT_V3_CORE_WEIGHTS,
  compatV3CoreWeightsSum,
} from '@config/matching/compatibilityScoring';
import {
  COMPATIBILITY_EVIDENCE_RULES,
  experimentalInstrumentRegistryEntries,
} from '@config/matching/compatibilityEvidenceRegistry';
import { GATE_MARKER_BASE_WEIGHTS } from '@config/scoring/interviewGateThresholds';
import { ASSESSMENT_ORDER, ASSESSMENTS } from '../assessmentContent';
import { computePsychometricModifier } from '../computePsychometricModifier';
import { computeGamingCorrection } from '../computeGamingCorrection';
import {
  ACTIVE_NEW_USER_PSYCHOMETRIC_FLOOR_CODES,
  collectPsychometricFloorGateFailReasons,
  RSES_LOW_SELF_ESTEEM_FLOOR_CODE,
  wouldTriggerAnxietyTraitHighFloor,
} from '../psychometricFloorBreaches';
import {
  computeAnxiousAvoidantSoftPenalty,
  computeDealbreakerMultiplier,
  computeFinalCompatibilityScoreV3,
  computeLifeDomainAlignment,
  computeSemanticScore,
  LIFE_VISION_RANKING_SLIDER_KEYS,
} from '@features/compatibility/computeCompatibilityScore';
import { computePairCompatibilityScore } from '@features/compatibility/computePairCompatibilityScore';
import type { MappedUserCompatibilityInputs } from '@features/compatibility/mapMatchmakingUserToCompatibilityInputs';
import { computePreDealbreakerFinalScore } from '@features/compatibility/pairCompatibilityPresentation';
import { PARTNER_ALIGNMENT_IMPORTANCE } from '@/shared/constants/partnerAlignmentImportance';

const NULL_SCORES = {
  brsScore: null as number | null,
  anxietyTraitScore: null as number | null,
  scsSfScore: null as number | null,
  gaspScore: null as number | null,
  gaspGuiltRepairScore: null as number | null,
  gaspShameWithdrawScore: null as number | null,
  dweckScore: null as number | null,
  aaq2Score: null as number | null,
  rsesScore: null as number | null,
  scsPublicScore: null as number | null,
  scsPrivateScore: null as number | null,
  mspssFriendsScore: null as number | null,
  mspssFamilyScore: null as number | null,
  sd3NarcissismScore: null as number | null,
  npiEntitlementScore: null as number | null,
  rfqScore: null as number | null,
};

const HEALTHY_ACTIVE = {
  ...NULL_SCORES,
  brsScore: 4.5,
  anxietyTraitScore: 2.0,
  scsSfScore: 4.2,
  gaspScore: 2.0,
  rsesScore: 35,
};

const WORST_RETIRED = {
  aaq2Score: 40,
  rfqScore: 1.2,
  npiEntitlementScore: 7,
  dweckScore: 1.0,
  scsPublicScore: 20,
  scsPrivateScore: 4,
  mspssFriendsScore: 1.0,
  sd3NarcissismScore: 5.0,
};

const ZERO_PILLARS = {
  mentalizing: null,
  accountability: null,
  contempt: null,
  regulation: null,
};

const ZERO_PSYCH = {
  rfq: null,
  gasp: null,
  brs: null,
  scs_sf: null,
  aaq2: null,
  rses: null,
  sd3_narcissism: null,
  npi_entitlement: null,
  dweck: null,
};

function basePairUser(
  overrides: Partial<MappedUserCompatibilityInputs> = {},
): MappedUserCompatibilityInputs {
  return {
    userId: 'a',
    dealbreaker: { wantKids: 'Want kids' },
    relationalCapacity: {
      repair: 8,
      regulation: 8,
      contempt: 2,
      accountability: 8,
      mentalizing: 8,
      gaspExternalizationScore: null,
      scsSfScore: null,
      brsScore: null,
      anxietyTraitScore: null,
    },
    attachment: { anxiety: 1, avoidance: 1 },
    values: {
      self_direction: 0.5,
      stimulation: 0.2,
      hedonism: 0.1,
      achievement: 0.3,
      power: -0.2,
      security: 0.4,
      conformity: 0.1,
      tradition: 0.2,
      benevolence: 0.8,
      universalism: 0.6,
    },
    finance: { financesPooled: 'Pooled', financialRiskComfort: 4, yearlyIncome: '$100,000 – $149,999' },
    lifeDomainSettings: {
      intimacy: 50,
      finance: 50,
      spirituality: 50,
      family: 50,
      physicalHealth: 50,
    },
    interviewProcess: { repair: 8, accountability: 8, contempt: 2 },
    interviewWeightedScore: 8,
    conflictStyle: {
      competing: 20,
      collaborating: 40,
      compromising: 20,
      avoiding: 10,
      accommodating: 10,
    },
    politics: { politics: 'Moderate' },
    psychometricSoft: { npiEntitlementScore: null, dweckScore: null, scsSfScore: null },
    sexualCommunicationMean: 4,
    ...overrides,
  };
}

describe('scoring cleanup 2026 — inventory', () => {
  it('active pre-interview battery matches ASSESSMENT_ORDER and excludes retired instruments', () => {
    expect([...ASSESSMENT_ORDER]).toEqual([...ACTIVE_PRE_INTERVIEW_ASSESSMENT_IDS]);
    for (const retired of RETIRED_HISTORICAL_ASSESSMENT_IDS) {
      expect(ASSESSMENT_ORDER).not.toContain(retired);
    }
    expect(ASSESSMENT_ORDER).toEqual(
      expect.arrayContaining([...EXPERIMENTAL_NON_GATING_ASSESSMENT_IDS]),
    );
  });

  it('new-user floors are GASP, SCS-SF, BRS, and RSES only', () => {
    expect([...ACTIVE_NEW_USER_PSYCHOMETRIC_FLOOR_CODES].sort()).toEqual(
      [
        'gasp_extreme_externalization_floor',
        'scs_sf_low_self_compassion_floor',
        'brs_low_resilience_floor',
        'rses_low_self_esteem_floor',
      ].sort(),
    );
  });

  it('live modifier instruments exclude experimental and retired ids', () => {
    expect([...ACTIVE_NEW_USER_MODIFIER_INSTRUMENTS].sort()).toEqual(
      ['gasp', 'brs', 'anxiety_trait', 'rses', 'scs_sf'].sort(),
    );
  });

  it('production BRS uses a 1–5 Likert scale (six items, not a 1–6 response range)', () => {
    expect(ASSESSMENTS.brs.scale.min).toBe(1);
    expect(ASSESSMENTS.brs.scale.max).toBe(5);
    expect(ASSESSMENTS.brs.questions).toHaveLength(6);
    expect(ASSESSMENTS.anxiety_trait.scale.max).toBe(5);
  });

  it('diagnostic capacity excludes RFQ/Dweck and keeps remaining weights at 1.00', () => {
    const capacityKeys = Object.keys(basePairUser().relationalCapacity);
    expect(capacityKeys).not.toContain('rfqScore');
    expect(capacityKeys).not.toContain('dweckScore');
    expect(
      CAPACITY_CONTEMPT_WEIGHT +
        CAPACITY_REPAIR_WEIGHT +
        CAPACITY_ACCOUNTABILITY_WEIGHT +
        CAPACITY_REGULATION_WEIGHT +
        CAPACITY_MENTALIZING_WEIGHT +
        CAPACITY_EXTERNALIZE_WEIGHT +
        CAPACITY_SELF_COMPASSION_WEIGHT +
        CAPACITY_RESILIENCE_WEIGHT,
    ).toBeCloseTo(1, 10);
  });
});

describe('scoring cleanup 2026 — retired instruments cannot affect a new user', () => {
  it('AAQ-II, RFQ-8, NPI, Dweck, SCS orientation, MSPSS, and SD3 do not change modifier or floors', () => {
    const healthy = computePsychometricModifier(HEALTHY_ACTIVE);
    const withRetired = computePsychometricModifier({ ...HEALTHY_ACTIVE, ...WORST_RETIRED });
    expect(withRetired.modifier).toBe(healthy.modifier);
    expect(withRetired.psychometricFloorBreaches).toEqual(healthy.psychometricFloorBreaches);

    const floors = collectPsychometricFloorGateFailReasons(
      {
        rfqScore: 1.2,
        gaspScore: 2,
        gaspGuiltRepairScore: null,
        gaspShameWithdrawScore: null,
        dweckScore: 1,
        scsSfScore: 4.2,
        sd3NarcissismScore: 5,
        npiEntitlementScore: 7,
        brsScore: 4.5,
        anxietyTraitScore: 2,
        aaq2Score: 40,
        rsesScore: 35,
        scsPublicScore: 20,
        scsPrivateScore: 4,
      },
      [],
    );
    expect(floors).toEqual([]);
  });

  it('experimental battery instruments persist in order but never gate', () => {
    expect(ASSESSMENT_ORDER).toContain('amoraea_entitlement_v1');
    expect(ASSESSMENT_ORDER).toContain('relationship_growth_beliefs');
    expect(ASSESSMENT_ORDER).toContain('conflict_catastrophizing');
    expect(ASSESSMENT_ORDER).toContain('sexual_communication_comfort');
    for (const experimental of experimentalInstrumentRegistryEntries()) {
      expect(experimental.hardFilter).toBe(false);
      expect(experimental.coefficient).toBe(0);
      expect(experimental.amoraeaValidationStatus).toBe('not_validated');
    }
    expect(ACTIVE_NEW_USER_PSYCHOMETRIC_FLOOR_CODES.join(',')).not.toMatch(
      /entitlement|growth_beliefs|catastrophizing/,
    );
  });
});

describe('scoring cleanup 2026 — RSES and trait anxiety', () => {
  it('RSES admissions floor fails at 20 and passes at 21 on the 10–40 range', () => {
    const fail = collectPsychometricFloorGateFailReasons(
      { ...HEALTHY_ACTIVE, rsesScore: 20 },
      [],
    );
    const pass = collectPsychometricFloorGateFailReasons(
      { ...HEALTHY_ACTIVE, rsesScore: 21 },
      [],
    );
    expect(fail).toContain(RSES_LOW_SELF_ESTEEM_FLOOR_CODE);
    expect(pass).not.toContain(RSES_LOW_SELF_ESTEEM_FLOOR_CODE);
    expect(computePsychometricModifier({ ...HEALTHY_ACTIVE, rsesScore: 24 }).rsesComponent).toBe(0);
    expect(computePsychometricModifier({ ...HEALTHY_ACTIVE, rsesScore: 22 }).rsesComponent).toBe(-0.1);
    expect(computePsychometricModifier({ ...HEALTHY_ACTIVE, rsesScore: 21 }).rsesComponent).toBe(-0.15);
    expect(computePsychometricModifier({ ...HEALTHY_ACTIVE, rsesScore: 20 }).rsesComponent).toBe(0);
  });

  it('high trait anxiety does not auto-fail and still applies a poor-band modifier', () => {
    expect(wouldTriggerAnxietyTraitHighFloor(5.0)).toBe(true);
    const floors = collectPsychometricFloorGateFailReasons(
      { ...HEALTHY_ACTIVE, anxietyTraitScore: 5.0 },
      [],
    );
    expect(floors).not.toContain('anxiety_trait_high_floor');
    const modifier = computePsychometricModifier({ ...HEALTHY_ACTIVE, anxietyTraitScore: 5.0 });
    expect(modifier.anxietyTraitComponent).toBe(-0.25);
    expect(modifier.modifier).toBe(-0.25);
  });
});

describe('scoring cleanup 2026 — uncertainty and gaming', () => {
  it('two otherwise-identical users get the same corrected modifier regardless of uncertainty', () => {
    const components = {
      gasp: 0.1,
      brs: 0.1,
      anxiety_trait: -0.25,
      aaq2: 0.1,
      rfq: 0.15,
      mspss: 0,
      sd3_narcissism: 0,
      npi_entitlement: 0,
      dweck: 0.05,
      rses: 0,
      scs_sf: 0.15,
      scs: 0,
    };
    const live = components.gasp + components.brs + components.anxiety_trait + components.rses + components.scs_sf;
    const low = computeGamingCorrection({
      instrumentComponents: components,
      totalModifier: live,
      straightLineFlags: [],
      uncertaintyScore: 0.05,
      pillarScores: ZERO_PILLARS,
      psychometricScores: ZERO_PSYCH,
    });
    const high = computeGamingCorrection({
      instrumentComponents: components,
      totalModifier: live,
      straightLineFlags: [],
      uncertaintyScore: 0.99,
      pillarScores: ZERO_PILLARS,
      psychometricScores: ZERO_PSYCH,
    });
    expect(low.correctedModifier).toBe(high.correctedModifier);
    expect(low.correctedModifier).toBeCloseTo(live, 5);
    expect(high.reviewTriggers.some((t) => t.type === 'high_uncertainty')).toBe(true);
  });
});

describe('scoring cleanup 2026 — compatibility ranking', () => {
  it('core weights sum to exactly 1.00 and match the intended production mix', () => {
    expect(compatV3CoreWeightsSum()).toBeCloseTo(1, 10);
    expect(COMPAT_V3_CORE_WEIGHTS).toEqual({
      concreteLifeFit: 0.5,
      finance: 0.22,
      lifeDomainImportanceAlignment: 0.21,
      valuesSimilarity: 0.05,
      attachmentSimilarity: 0.02,
    });
  });

  it('interview gate weights are unchanged and still sum to 1.00', () => {
    expect(GATE_MARKER_BASE_WEIGHTS).toEqual({
      destructive_conflict: 0.18,
      accountability: 0.18,
      repair: 0.17,
      regulation: 0.14,
      responsiveness_support: 0.09,
      mentalizing: 0.07,
      commitment_persistence: 0.07,
      appreciation: 0.10,
    });
    const sum = Object.values(GATE_MARKER_BASE_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 10);
  });

  it('slider alignment ignores finance sliders and is not a majority of ranking', () => {
    expect([...LIFE_VISION_RANKING_SLIDER_KEYS]).toEqual([
      'intimacy',
      'spirituality',
      'family',
      'physicalHealth',
    ]);
    expect(LIFE_VISION_RANKING_SLIDER_KEYS).not.toContain('finance');
    const aligned = { intimacy: 80, spirituality: 80, family: 80, physicalHealth: 80, finance: 10 };
    const financeMismatch = { ...aligned, finance: 90 };
    expect(computeLifeDomainAlignment(aligned, aligned)).toBe(
      computeLifeDomainAlignment(aligned, financeMismatch),
    );
    expect(COMPAT_V3_CORE_WEIGHTS.lifeDomainImportanceAlignment).toBeLessThan(
      COMPAT_V3_CORE_WEIGHTS.concreteLifeFit,
    );
    expect(COMPAT_V3_CORE_WEIGHTS.lifeDomainImportanceAlignment).toBeLessThan(0.5);
  });

  it('a constant narrative stub does not change ranking', () => {
    const user = basePairUser();
    const partner = basePairUser({ userId: 'b' });
    const a = computePairCompatibilityScore(user, partner, { narrativeFitScore: 0.5 });
    const b = computePairCompatibilityScore(user, partner, { narrativeFitScore: 0.9 });
    const c = computePairCompatibilityScore(user, partner, { narrativeFitScore: 0.1 });
    expect(a.finalScore).toBeCloseTo(b.finalScore, 10);
    expect(b.finalScore).toBeCloseTo(c.finalScore, 10);
    expect(a.contributionBreakdown?.unavailable.narrativeFit.available).toBe(false);
    expect(a.contributionBreakdown?.unavailable.narrativeFit.contribution).toBe(0);
    expect(a.breakdown.semantic).toBe(0);
  });

  it('capacity discount is gone from ranking and interview process is not in the core', () => {
    const user = basePairUser();
    const partner = basePairUser({ userId: 'b' });
    const pair = computePairCompatibilityScore(user, partner);
    expect(pair.breakdown.capacityDiscount).toBe(0);
    expect(pair.breakdown.interviewProcess).toBe(0);
    expect(pair.breakdown.baseline).toBe(0);
    expect(pair.contributionBreakdown?.core.finance.weight).toBe(0.22);
    expect(pair.contributionBreakdown?.core.lifeDomainImportanceAlignment.weight).toBe(0.21);
    expect(pair.contributionBreakdown?.core.concreteLifeFit.weight).toBe(0.5);
  });

  it('anxious×avoidant is a bounded soft penalty and never a hard block', () => {
    expect(computeAnxiousAvoidantSoftPenalty({ anxiety: 1, avoidance: 1 }, { anxiety: 1, avoidance: 1 })).toBe(0);
    const moderate = computeAnxiousAvoidantSoftPenalty(
      { anxiety: 4, avoidance: 1.5 },
      { anxiety: 1.5, avoidance: 4 },
    );
    expect(moderate).toBeLessThan(0);
    expect(moderate).toBeGreaterThan(-COMPAT_V3_ANXIOUS_AVOIDANT_SOFT_PENALTY_MAX);
    const severe = computeAnxiousAvoidantSoftPenalty(
      { anxiety: 7, avoidance: 1 },
      { anxiety: 1, avoidance: 7 },
    );
    expect(severe).toBeCloseTo(-COMPAT_V3_ANXIOUS_AVOIDANT_SOFT_PENALTY_MAX, 8);
    expect(severe).toBeGreaterThanOrEqual(-0.05);
    expect(
      computeDealbreakerMultiplier({ wantKids: 'Want kids' }, { wantKids: "Don't want kids" }),
    ).toBe(0);
    expect(computeDealbreakerMultiplier({ wantKids: 'Want kids' }, { wantKids: 'Want kids' })).toBe(1);
  });

  it('hard dealbreaker blocks without also applying overlapping soft penalties', () => {
    const blocked = computePairCompatibilityScore(
      basePairUser({
        dealbreaker: { wantKids: 'Want kids' },
        attachment: { anxiety: 6.5, avoidance: 1.5 },
      }),
      basePairUser({
        userId: 'b',
        dealbreaker: { wantKids: "Don't want kids" },
        attachment: { anxiety: 1.5, avoidance: 6.5 },
      }),
    );
    expect(blocked.subscores.dealbreakerMultiplier).toBe(0);
    expect(blocked.finalScore).toBe(0);
    expect(blocked.adjustments.total).toBe(0);
    expect(blocked.contributionBreakdown?.adjustments.anxiousAvoidant).toBe(0);
    expect(blocked.contributionBreakdown?.hardFilters).toContain('kids_want_vs_dont');
    const childrenDim = blocked.contributionBreakdown;
    expect(childrenDim?.core.concreteLifeFit).toBeDefined();
    const preBlock = computePreDealbreakerFinalScore(blocked);
    expect(preBlock).toBeGreaterThan(0);
    expect(preBlock).toBeCloseTo(
      (blocked.contributionBreakdown?.core.concreteLifeFit.contribution ?? 0) +
        (blocked.contributionBreakdown?.core.lifeDomainImportanceAlignment.contribution ?? 0) +
        (blocked.contributionBreakdown?.core.finance.contribution ?? 0) +
        (blocked.contributionBreakdown?.core.attachmentSimilarity.contribution ?? 0) +
        (blocked.contributionBreakdown?.core.valuesSimilarity.contribution ?? 0),
      8,
    );
  });

  it('flexible mismatch reduces concrete life fit and still ranks', () => {
    const aligned = computePairCompatibilityScore(
      basePairUser({
        dealbreaker: {
          wantKids: 'Want kids',
          politics: 'Liberal',
          prefPartnerPoliticalAlignmentImportance: PARTNER_ALIGNMENT_IMPORTANCE.preference,
        },
      }),
      basePairUser({
        userId: 'b',
        dealbreaker: {
          wantKids: 'Want kids',
          politics: 'Liberal',
          prefPartnerPoliticalAlignmentImportance: PARTNER_ALIGNMENT_IMPORTANCE.preference,
        },
      }),
    );
    const flexible = computePairCompatibilityScore(
      basePairUser({
        dealbreaker: {
          wantKids: 'Want kids',
          politics: 'Liberal',
          prefPartnerPoliticalAlignmentImportance: PARTNER_ALIGNMENT_IMPORTANCE.preference,
        },
      }),
      basePairUser({
        userId: 'b',
        dealbreaker: {
          wantKids: 'Want kids',
          politics: 'Conservative',
          prefPartnerPoliticalAlignmentImportance: PARTNER_ALIGNMENT_IMPORTANCE.preference,
        },
      }),
    );
    expect(flexible.subscores.dealbreakerMultiplier).toBe(1);
    expect(flexible.finalScore).toBeGreaterThan(0);
    expect(flexible.finalScore).toBeLessThan(aligned.finalScore);
    expect(flexible.subscores.concreteLifeFit).toBeLessThan(aligned.subscores.concreteLifeFit);
    expect(flexible.adjustments.politics).toBe(0);
  });

  it('NPI entitlement and historical Dweck do not change pair ranking', () => {
    const withoutRetired = computePairCompatibilityScore(
      basePairUser({
        psychometricSoft: { npiEntitlementScore: null, dweckScore: null, scsSfScore: 4.2 },
      }),
      basePairUser({
        userId: 'b',
        psychometricSoft: { npiEntitlementScore: null, dweckScore: null, scsSfScore: 4.2 },
      }),
    );
    const withRetired = computePairCompatibilityScore(
      basePairUser({
        psychometricSoft: { npiEntitlementScore: 7, dweckScore: 1, scsSfScore: 4.2 },
      }),
      basePairUser({
        userId: 'b',
        psychometricSoft: { npiEntitlementScore: 7, dweckScore: 1, scsSfScore: 4.2 },
      }),
    );
    expect(withRetired.finalScore).toBe(withoutRetired.finalScore);
    expect(withRetired.adjustments.psychometricSoft).toBe(withoutRetired.adjustments.psychometricSoft);
  });

  it('finance mismatch changes only the finance contribution, not slider alignment or concrete life fit', () => {
    const lifeAligned = {
      intimacy: 80,
      spirituality: 80,
      family: 80,
      physicalHealth: 80,
      finance: 10,
    };
    const matched = computePairCompatibilityScore(
      basePairUser({
        lifeDomainSettings: lifeAligned,
        finance: { financesPooled: 'Pooled', financialRiskComfort: 4, yearlyIncome: '$100,000 – $149,999' },
      }),
      basePairUser({
        userId: 'b',
        lifeDomainSettings: { ...lifeAligned, finance: 90 },
        finance: { financesPooled: 'Pooled', financialRiskComfort: 4, yearlyIncome: '$100,000 – $149,999' },
      }),
    );
    const financeMismatch = computePairCompatibilityScore(
      basePairUser({
        lifeDomainSettings: lifeAligned,
        finance: { financesPooled: 'Pooled', financialRiskComfort: 2, yearlyIncome: '$25,000 – $49,999' },
      }),
      basePairUser({
        userId: 'b',
        lifeDomainSettings: { ...lifeAligned, finance: 90 },
        finance: { financesPooled: 'Separate', financialRiskComfort: 7, yearlyIncome: '$250,000 – $499,999' },
      }),
    );
    expect(financeMismatch.contributionBreakdown?.core.lifeDomainImportanceAlignment.rawScore).toBeCloseTo(
      matched.contributionBreakdown?.core.lifeDomainImportanceAlignment.rawScore ?? -1,
      10,
    );
    expect(financeMismatch.contributionBreakdown?.core.concreteLifeFit.rawScore).toBeCloseTo(
      matched.contributionBreakdown?.core.concreteLifeFit.rawScore ?? -1,
      10,
    );
    expect(financeMismatch.contributionBreakdown?.core.finance.contribution).toBeLessThan(
      matched.contributionBreakdown?.core.finance.contribution ?? 1,
    );
  });

  it('v3 final score is core + soft adjustments with no capacity term', () => {
    const result = computeFinalCompatibilityScoreV3({
      attachmentScore: 1,
      valuesScore: 1,
      lifeDomainImportanceAlignment: 1,
      concreteLifeFitScore: 1,
      semanticScore: 1,
      financeScore: 1,
      interviewProcessScore: 1,
      capacityA: 0.2,
      capacityB: 0.2,
      sexualCommAdjustment: 0,
      conflictStyleAdjustment: 0,
      politicsAdjustment: 0,
      psychometricSoftAdjustment: 0,
      anxiousAvoidantSoftPenalty: 0,
      dealbreakerMultiplier: 1,
    });
    expect(result.finalScore).toBeCloseTo(1, 10);
    expect(result.breakdown.capacityDiscount).toBe(0);
    expect(result.contributionBreakdown?.duplicateInputFlags).toEqual([]);
    const core = result.contributionBreakdown!.core;
    expect(
      core.concreteLifeFit.contribution +
        core.lifeDomainImportanceAlignment.contribution +
        core.finance.contribution +
        core.valuesSimilarity.contribution +
        core.attachmentSimilarity.contribution,
    ).toBeCloseTo(result.contributionBreakdown!.coreScore, 10);
  });

  it('ignores a passed sexualCommAdjustment in v3 ranking', () => {
    const base = {
      attachmentScore: 1,
      valuesScore: 1,
      lifeDomainImportanceAlignment: 1,
      concreteLifeFitScore: 1,
      semanticScore: 1,
      financeScore: 1,
      interviewProcessScore: 1,
      capacityA: 0.2,
      capacityB: 0.2,
      conflictStyleAdjustment: 0,
      politicsAdjustment: 0,
      psychometricSoftAdjustment: 0,
      anxiousAvoidantSoftPenalty: 0,
      dealbreakerMultiplier: 1 as const,
    };
    const without = computeFinalCompatibilityScoreV3(base);
    const withRetired = computeFinalCompatibilityScoreV3({
      ...base,
      sexualCommAdjustment: 0.03,
    });
    expect(withRetired.finalScore).toBeCloseTo(without.finalScore, 10);
    expect(withRetired.contributionBreakdown?.adjustments.sexualDiscrepancy).toBe(0);
  });
});
describe('scoring cleanup 2026 — evidence registry', () => {
  it('marks retired ranking rules rejected and keeps one entry per live coefficient', () => {
    const byId = Object.fromEntries(COMPATIBILITY_EVIDENCE_RULES.map((r) => [r.ruleId, r]));
    expect(byId.interview_process_pillars?.amoraeaValidationStatus).toBe('rejected');
    expect(byId.relational_capacity_discount?.amoraeaValidationStatus).toBe('rejected');
    expect(byId.interview_values_confidence_discount?.amoraeaValidationStatus).toBe('rejected');
    expect(byId.duplicate_contempt_penalty?.amoraeaValidationStatus).toBe('rejected');
    expect(byId.level_b_intimacy_sexual_communication?.amoraeaValidationStatus).toBe('rejected');
    expect(byId.level_b_intimacy_sexual_communication?.lifecycle).toBe('retired');
    expect(byId.level_b_intimacy_sexual_communication?.coefficient).toBe(0);
    expect(byId.psychometric_modifier_cap?.coefficient).toBe(-0.35);
    expect(byId.psychometric_modifier_cap?.coefficientSource).toBe('amoraea_heuristic');
    expect(byId.level_c_anxious_avoidant_soft_penalty?.coefficient).toBe(-0.05);
    expect(byId.level_c_anxious_avoidant_soft_penalty?.coefficientSource).toBe('amoraea_heuristic');
    expect(byId.level_e_generic_ecr_similarity?.coefficient).toBe(0.02);
    expect(byId.level_e_generic_pvq_similarity?.coefficient).toBe(0.05);
    expect(byId.level_b_narrative_fit?.coefficient).toBe(0);
    expect(byId.level_b_narrative_fit?.amoraeaValidationStatus).toBe('rejected');
    expect(byId.level_b_life_domain_alignment?.coefficient).toBe(0.21);
    expect(byId.level_b_finance_outlook?.coefficient).toBe(0.22);
    expect(byId.level_b_concrete_life_fit?.coefficient).toBe(0.5);
    const ruleIds = COMPATIBILITY_EVIDENCE_RULES.map((r) => r.ruleId);
    expect(new Set(ruleIds).size).toBe(ruleIds.length);
    for (const experimental of experimentalInstrumentRegistryEntries()) {
      expect(experimental.coefficient).toBe(0);
      expect(experimental.description).toMatch(/never a hard filter/i);
    }
  });
});
