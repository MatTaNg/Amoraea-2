import {
  computeAttachmentScore,
  computeCapacityDiscount,
  computeConflictStyleAdjustment,
  computeDealbreakerMultiplier,
  computeFinalCompatibilityScore,
  computeFinanceAlignment,
  computeInterviewProcessScore,
  computeRelationalCapacity,
  computeValuesScore,
  type AttachmentProfile,
  type ConflictStyleProfile,
  type DealbreakerProfile,
  type FinanceProfile,
  type RelationalCapacityInput,
  type ValuesProfile,
} from '../computeCompatibilityScore';

// Attachment profiles
const secureAttachment: AttachmentProfile = { anxiety: 2.0, avoidance: 2.0 };
const mildlyAnxious: AttachmentProfile = { anxiety: 4.5, avoidance: 2.0 };
const highlyAnxious: AttachmentProfile = { anxiety: 6.5, avoidance: 2.0 };
const mildlyAvoidant: AttachmentProfile = { anxiety: 2.0, avoidance: 4.5 };
const highlyAvoidant: AttachmentProfile = { anxiety: 2.0, avoidance: 6.5 };
const disorganised: AttachmentProfile = { anxiety: 5.5, avoidance: 5.5 };

// Values profiles — MRAT-centered, roughly -2 to +2
const conservativeValues: ValuesProfile = {
  self_direction: -1.5,
  stimulation: -1.2,
  hedonism: -1.0,
  achievement: 0.5,
  power: 0.3,
  security: 1.8,
  conformity: 1.5,
  tradition: 1.8,
  benevolence: 0.8,
  universalism: 0.5,
};
const progressiveValues: ValuesProfile = {
  self_direction: 1.8,
  stimulation: 1.5,
  hedonism: 1.2,
  achievement: 0.3,
  power: -0.5,
  security: -1.2,
  conformity: -1.5,
  tradition: -1.8,
  benevolence: 1.0,
  universalism: 1.5,
};
const balancedValues: ValuesProfile = {
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
};
const flatValues: ValuesProfile = {
  self_direction: 0.0,
  stimulation: 0.0,
  hedonism: 0.0,
  achievement: 0.0,
  power: 0.0,
  security: 0.0,
  conformity: 0.0,
  tradition: 0.0,
  benevolence: 0.0,
  universalism: 0.0,
};

// Capacity profiles
const highCapacityUser: RelationalCapacityInput = {
  repair: 8,
  regulation: 8,
  contempt: 2,
  accountability: 8,
  mentalizing: 8,
  rfqScore: 6.0,
  gaspGuiltRepairScore: 6.0,
  gaspShameWithdrawScore: 1.5,
  gaspExternalizationScore: 1.5,
  scsSfScore: 4.5,
  brsScore: 4.5,
  anxietyTraitScore: 1.5,
};
const lowCapacityUser: RelationalCapacityInput = {
  repair: 3,
  regulation: 3,
  contempt: 8,
  accountability: 3,
  mentalizing: 3,
  rfqScore: 1.5,
  gaspGuiltRepairScore: 1.5,
  gaspShameWithdrawScore: 6.5,
  gaspExternalizationScore: 6.0,
  scsSfScore: 1.5,
  brsScore: 2.0,
  anxietyTraitScore: 4.5,
};
const moderateCapacityUser: RelationalCapacityInput = {
  repair: 6,
  regulation: 6,
  contempt: 5,
  accountability: 6,
  mentalizing: 6,
  rfqScore: 4.0,
  gaspGuiltRepairScore: 4.0,
  gaspShameWithdrawScore: 3.5,
  gaspExternalizationScore: 3.5,
  scsSfScore: 3.5,
  brsScore: 3.5,
  anxietyTraitScore: 3.0,
};

// Finance profiles
const pooledFinances: FinanceProfile = {
  financesPooled: 'pool',
  financialRiskComfort: 5,
  yearlyIncome: '$50,000 – $74,999',
};
const separateFinances: FinanceProfile = {
  financesPooled: 'separate',
  financialRiskComfort: 5,
  yearlyIncome: '$50,000 – $74,999',
};
const highRiskFinance: FinanceProfile = {
  financesPooled: 'pool',
  financialRiskComfort: 9,
  yearlyIncome: '$100,000 – $149,999',
};
const lowRiskFinance: FinanceProfile = {
  financesPooled: 'pool',
  financialRiskComfort: 1,
  yearlyIncome: '$25,000 – $49,999',
};

// Conflict style profiles (0-100 percentages)
const collaboratingStyle: ConflictStyleProfile = {
  competing: 5,
  collaborating: 70,
  compromising: 15,
  avoiding: 5,
  accommodating: 5,
};
const avoidingStyle: ConflictStyleProfile = {
  competing: 5,
  collaborating: 10,
  compromising: 20,
  avoiding: 60,
  accommodating: 5,
};
const competingStyle: ConflictStyleProfile = {
  competing: 65,
  collaborating: 10,
  compromising: 15,
  avoiding: 5,
  accommodating: 5,
};

// User profiles for dealbreaker tests
const wantsKids: DealbreakerProfile = {
  wantKids: 'Yes',
  requireSameReligion: false,
  relationshipStyle: 'monogamous',
  willingToRelocate: false,
  requiresPoliticalAlignment: false,
  politics: 'moderate',
  location: { lat: 34.05, lng: -118.24 },
};
const doesntWantKids: DealbreakerProfile = { ...wantsKids, wantKids: "Don't want kids" };
const requiresReligion: DealbreakerProfile = {
  ...wantsKids,
  requireSameReligion: true,
  religion: 'Christian',
};
const differentReligion: DealbreakerProfile = {
  ...wantsKids,
  requireSameReligion: false,
  religion: 'Jewish',
};
const requiresPolitics: DealbreakerProfile = {
  ...wantsKids,
  requiresPoliticalAlignment: true,
  politics: 'liberal',
};
const conservativePolitics: DealbreakerProfile = {
  ...wantsKids,
  requiresPoliticalAlignment: false,
  politics: 'conservative',
};

const HIGH_ATTACHMENT_THRESHOLD = 0.8;
const LOW_VALUES_OPPOSITE_THRESHOLD = 0.4;
const HIGH_CAPACITY_THRESHOLD = 0.7;
const LOW_CAPACITY_THRESHOLD = 0.4;
const FINANCE_MATCH_THRESHOLD = 0.75;
const FINANCE_POOL_MISMATCH_DELTA = 0.15;
const SEVERE_AA_DELTA = 0.1;
const CAPACITY_DISCOUNT_LOW_PAIR_MIN = 0.05;
const CAPACITY_DISCOUNT_MAX = 0.2;
const IDEAL_PAIR_MIN_SCORE = 0.75;
const COLLAB_CONFLICT_BONUS_MIN = 0;
const DEMAND_WITHDRAW_PENALTY_MAX = 0;
const CONFLICT_ADJ_MIN = -0.08;
const CONFLICT_ADJ_MAX = 0.03;

describe('computeAttachmentScore', () => {
  it('secure-secure pair scores high', () => {
    const score = computeAttachmentScore(secureAttachment, secureAttachment);
    expect(score).toBeGreaterThan(HIGH_ATTACHMENT_THRESHOLD);
  });

  it('mild anxious-avoidant pair scores lower than secure-secure', () => {
    const secureScore = computeAttachmentScore(secureAttachment, secureAttachment);
    const aaScore = computeAttachmentScore(mildlyAnxious, mildlyAvoidant);
    expect(aaScore).toBeLessThan(secureScore);
  });

  it('severe anxious-avoidant pair scores significantly lower than mild', () => {
    const mildScore = computeAttachmentScore(mildlyAnxious, mildlyAvoidant);
    const severeScore = computeAttachmentScore(highlyAnxious, highlyAvoidant);
    expect(severeScore).toBeLessThan(mildScore - SEVERE_AA_DELTA);
  });

  it('avoidant homogamy penalty fires for two highly avoidant users', () => {
    const homogamyScore = computeAttachmentScore(highlyAvoidant, highlyAvoidant);
    const secureAvoidantScore = computeAttachmentScore(secureAttachment, highlyAvoidant);
    expect(homogamyScore).toBeLessThan(secureAvoidantScore);
  });

  it('dual high insecurity penalty fires when both mean insecurity above 4.5', () => {
    const dualInsecureScore = computeAttachmentScore(disorganised, disorganised);
    const oneInsecureScore = computeAttachmentScore(disorganised, secureAttachment);
    expect(dualInsecureScore).toBeLessThan(oneInsecureScore);
  });

  it('score is always between 0 and 1', () => {
    const pairs: [AttachmentProfile, AttachmentProfile][] = [
      [secureAttachment, secureAttachment],
      [highlyAnxious, highlyAvoidant],
      [highlyAvoidant, highlyAvoidant],
      [disorganised, disorganised],
      [{ anxiety: 7, avoidance: 7 }, { anxiety: 7, avoidance: 7 }],
      [{ anxiety: 1, avoidance: 1 }, { anxiety: 1, avoidance: 1 }],
    ];
    for (const [a, b] of pairs) {
      const score = computeAttachmentScore(a, b);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    }
  });
});

describe('computeValuesScore', () => {
  it('identical profiles score near 1.0', () => {
    const score = computeValuesScore(balancedValues, balancedValues);
    expect(score).toBeGreaterThan(0.9);
  });

  it('opposite profiles score low', () => {
    const score = computeValuesScore(conservativeValues, progressiveValues);
    expect(score).toBeLessThan(LOW_VALUES_OPPOSITE_THRESHOLD);
  });

  it('similar profiles score higher than opposite profiles', () => {
    const similarScore = computeValuesScore(balancedValues, balancedValues);
    const oppositeScore = computeValuesScore(conservativeValues, progressiveValues);
    expect(similarScore).toBeGreaterThan(oppositeScore);
  });

  it('flat profiles do not produce NaN — epsilon guard working', () => {
    const score = computeValuesScore(flatValues, flatValues);
    expect(score).not.toBeNaN();
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  it('high prosocial users get baseline boost', () => {
    const highProsocial: ValuesProfile = {
      ...balancedValues,
      benevolence: 1.8,
      universalism: 1.8,
    };
    const lowProsocial: ValuesProfile = {
      ...balancedValues,
      benevolence: -1.5,
      universalism: -1.5,
    };
    const highScore = computeValuesScore(highProsocial, highProsocial);
    const lowScore = computeValuesScore(lowProsocial, lowProsocial);
    expect(highScore).toBeGreaterThan(lowScore);
  });

  it('score is always between 0 and 1', () => {
    const pairs: [ValuesProfile, ValuesProfile][] = [
      [conservativeValues, progressiveValues],
      [flatValues, flatValues],
      [balancedValues, conservativeValues],
    ];
    for (const [a, b] of pairs) {
      const score = computeValuesScore(a, b);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    }
  });
});

describe('computeRelationalCapacity', () => {
  it('high capacity user scores above 0.70', () => {
    const score = computeRelationalCapacity(highCapacityUser);
    expect(score).toBeGreaterThan(HIGH_CAPACITY_THRESHOLD);
  });

  it('low capacity user scores below 0.40', () => {
    const score = computeRelationalCapacity(lowCapacityUser);
    expect(score).toBeLessThan(LOW_CAPACITY_THRESHOLD);
  });

  it('high capacity scores higher than moderate which scores higher than low', () => {
    const high = computeRelationalCapacity(highCapacityUser);
    const moderate = computeRelationalCapacity(moderateCapacityUser);
    const low = computeRelationalCapacity(lowCapacityUser);
    expect(high).toBeGreaterThan(moderate);
    expect(moderate).toBeGreaterThan(low);
  });

  it('high anxiety trait reduces capacity score', () => {
    const lowAnxiety = { ...highCapacityUser, anxietyTraitScore: 1.0 };
    const highAnxiety = { ...highCapacityUser, anxietyTraitScore: 5.0 };
    expect(computeRelationalCapacity(lowAnxiety)).toBeGreaterThan(
      computeRelationalCapacity(highAnxiety),
    );
  });

  it('null GASP subscores default to 0.5 without crashing', () => {
    const userWithNullGasp: RelationalCapacityInput = {
      ...moderateCapacityUser,
      gaspGuiltRepairScore: null,
      gaspShameWithdrawScore: null,
    };
    expect(() => computeRelationalCapacity(userWithNullGasp)).not.toThrow();
    const score = computeRelationalCapacity(userWithNullGasp);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  it('score is always between 0 and 1', () => {
    [highCapacityUser, moderateCapacityUser, lowCapacityUser].forEach((user) => {
      const score = computeRelationalCapacity(user);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });
  });
});

describe('computeCapacityDiscount', () => {
  it('both high capacity produces zero discount', () => {
    const discount = computeCapacityDiscount(0.8, 0.8);
    expect(discount).toBe(0);
  });

  it('both low capacity produces meaningful discount', () => {
    const discount = computeCapacityDiscount(0.25, 0.25);
    expect(discount).toBeGreaterThan(CAPACITY_DISCOUNT_LOW_PAIR_MIN);
  });

  it('one high one very low produces discount', () => {
    const discount = computeCapacityDiscount(0.85, 0.2);
    expect(discount).toBeGreaterThan(0);
  });

  it('discount is always non-negative', () => {
    const pairs: [number, number][] = [
      [0.9, 0.9],
      [0.5, 0.5],
      [0.1, 0.1],
      [0.8, 0.2],
    ];
    for (const [a, b] of pairs) {
      expect(computeCapacityDiscount(a, b)).toBeGreaterThanOrEqual(0);
    }
  });

  it('discount never exceeds 0.20', () => {
    const discount = computeCapacityDiscount(0, 0);
    expect(discount).toBeLessThanOrEqual(CAPACITY_DISCOUNT_MAX);
  });
});

describe('computeFinanceAlignment', () => {
  it('identical finance profiles score high', () => {
    const score = computeFinanceAlignment(pooledFinances, pooledFinances);
    expect(score).toBeGreaterThan(FINANCE_MATCH_THRESHOLD);
  });

  it('pooling mismatch significantly reduces score', () => {
    const matchScore = computeFinanceAlignment(pooledFinances, pooledFinances);
    const mismatchScore = computeFinanceAlignment(pooledFinances, separateFinances);
    expect(mismatchScore).toBeLessThan(matchScore - FINANCE_POOL_MISMATCH_DELTA);
  });

  it('high vs low risk comfort reduces score', () => {
    const alignedScore = computeFinanceAlignment(pooledFinances, pooledFinances);
    const misalignedScore = computeFinanceAlignment(highRiskFinance, lowRiskFinance);
    expect(misalignedScore).toBeLessThan(alignedScore);
  });

  it('null fields default to 0.5 without crashing', () => {
    const nullFinance: FinanceProfile = {
      financesPooled: null,
      financialRiskComfort: null,
      yearlyIncome: null,
    };
    expect(() => computeFinanceAlignment(nullFinance, nullFinance)).not.toThrow();
    const score = computeFinanceAlignment(nullFinance, nullFinance);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });
});

describe('computeDealbreakerMultiplier', () => {
  it('kids mismatch returns 0', () => {
    expect(computeDealbreakerMultiplier(wantsKids, doesntWantKids)).toBe(0);
    expect(computeDealbreakerMultiplier(doesntWantKids, wantsKids)).toBe(0);
  });

  it('religion mismatch with requirement returns 0', () => {
    expect(computeDealbreakerMultiplier(requiresReligion, differentReligion)).toBe(0);
  });

  it('religion mismatch without requirement returns 1', () => {
    expect(computeDealbreakerMultiplier(wantsKids, differentReligion)).toBe(1);
  });

  it('politics mismatch with requirement returns 0', () => {
    expect(computeDealbreakerMultiplier(requiresPolitics, conservativePolitics)).toBe(0);
  });

  it('politics mismatch without requirement returns 1', () => {
    expect(computeDealbreakerMultiplier(wantsKids, conservativePolitics)).toBe(1);
  });

  it('fully compatible pair returns 1', () => {
    expect(computeDealbreakerMultiplier(wantsKids, wantsKids)).toBe(1);
  });
});

describe('computeConflictStyleAdjustment', () => {
  it('two collaborating users get positive bonus', () => {
    const adj = computeConflictStyleAdjustment(collaboratingStyle, collaboratingStyle, 100);
    expect(adj).toBeGreaterThan(COLLAB_CONFLICT_BONUS_MIN);
  });

  it('competing-avoiding pair gets negative penalty', () => {
    const adj = computeConflictStyleAdjustment(competingStyle, avoidingStyle, 100);
    expect(adj).toBeLessThan(DEMAND_WITHDRAW_PENALTY_MAX);
  });

  it('demand-withdraw penalty worse than collaborating bonus', () => {
    const penalty = computeConflictStyleAdjustment(competingStyle, avoidingStyle, 100);
    const bonus = computeConflictStyleAdjustment(collaboratingStyle, collaboratingStyle, 100);
    expect(Math.abs(penalty)).toBeGreaterThan(bonus);
  });

  it('adjustment never exceeds bounds', () => {
    const pairs: [ConflictStyleProfile, ConflictStyleProfile][] = [
      [collaboratingStyle, collaboratingStyle],
      [competingStyle, avoidingStyle],
      [avoidingStyle, avoidingStyle],
    ];
    for (const [a, b] of pairs) {
      const adj = computeConflictStyleAdjustment(a, b, 100);
      expect(adj).toBeGreaterThanOrEqual(CONFLICT_ADJ_MIN);
      expect(adj).toBeLessThanOrEqual(CONFLICT_ADJ_MAX);
    }
  });
});

describe('computeFinalCompatibilityScore — integration', () => {
  it('ideal pair scores high', () => {
    const result = computeFinalCompatibilityScore({
      attachmentScore: computeAttachmentScore(secureAttachment, secureAttachment),
      valuesScore: computeValuesScore(balancedValues, balancedValues),
      semanticScore: 0.75,
      financeScore: computeFinanceAlignment(pooledFinances, pooledFinances),
      interviewProcessScore: computeInterviewProcessScore(
        { repair: 8, accountability: 8, contempt: 2 },
        { repair: 8, accountability: 8, contempt: 2 },
      ),
      capacityA: computeRelationalCapacity(highCapacityUser),
      capacityB: computeRelationalCapacity(highCapacityUser),
      interviewWeightedScoreA: 8.0,
      interviewWeightedScoreB: 8.0,
      sexualCommAdjustment: 0.03,
      conflictStyleAdjustment: computeConflictStyleAdjustment(
        collaboratingStyle,
        collaboratingStyle,
        100,
      ),
      politicsAdjustment: 0,
      psychometricSoftAdjustment: 0.02,
      dealbreakerMultiplier: 1,
    });
    expect(result.finalScore).toBeGreaterThan(IDEAL_PAIR_MIN_SCORE);
  });

  it('dealbreaker mismatch returns score of exactly 0', () => {
    const result = computeFinalCompatibilityScore({
      attachmentScore: 0.9,
      valuesScore: 0.9,
      semanticScore: 0.9,
      financeScore: 0.9,
      interviewProcessScore: 0.9,
      capacityA: 0.9,
      capacityB: 0.9,
      interviewWeightedScoreA: 8.0,
      interviewWeightedScoreB: 8.0,
      sexualCommAdjustment: 0.03,
      conflictStyleAdjustment: 0,
      politicsAdjustment: 0,
      psychometricSoftAdjustment: 0,
      dealbreakerMultiplier: 0,
    });
    expect(result.finalScore).toBe(0);
  });

  it('low capacity pair scores lower than identical pair with high capacity', () => {
    const sharedParams = {
      attachmentScore: 0.75,
      valuesScore: 0.75,
      semanticScore: 0.5,
      financeScore: 0.7,
      interviewProcessScore: 0.7,
      interviewWeightedScoreA: 7.5,
      interviewWeightedScoreB: 7.5,
      sexualCommAdjustment: 0,
      conflictStyleAdjustment: 0,
      politicsAdjustment: 0,
      psychometricSoftAdjustment: 0,
      dealbreakerMultiplier: 1,
    };

    const highCapResult = computeFinalCompatibilityScore({
      ...sharedParams,
      capacityA: computeRelationalCapacity(highCapacityUser),
      capacityB: computeRelationalCapacity(highCapacityUser),
    });

    const lowCapResult = computeFinalCompatibilityScore({
      ...sharedParams,
      capacityA: computeRelationalCapacity(lowCapacityUser),
      capacityB: computeRelationalCapacity(lowCapacityUser),
    });

    expect(highCapResult.finalScore).toBeGreaterThan(lowCapResult.finalScore);
  });

  it('severe anxious-avoidant pair scores lower than secure pair with same values', () => {
    const sharedParams = {
      valuesScore: 0.75,
      semanticScore: 0.5,
      financeScore: 0.7,
      interviewProcessScore: 0.7,
      capacityA: 0.7,
      capacityB: 0.7,
      interviewWeightedScoreA: 7.5,
      interviewWeightedScoreB: 7.5,
      sexualCommAdjustment: 0,
      conflictStyleAdjustment: 0,
      politicsAdjustment: 0,
      psychometricSoftAdjustment: 0,
      dealbreakerMultiplier: 1,
    };

    const secureResult = computeFinalCompatibilityScore({
      ...sharedParams,
      attachmentScore: computeAttachmentScore(secureAttachment, secureAttachment),
    });

    const aaResult = computeFinalCompatibilityScore({
      ...sharedParams,
      attachmentScore: computeAttachmentScore(highlyAnxious, highlyAvoidant),
    });

    expect(secureResult.finalScore).toBeGreaterThan(aaResult.finalScore);
  });

  it('final score is always between 0 and 1', () => {
    const result = computeFinalCompatibilityScore({
      attachmentScore: computeAttachmentScore(highlyAnxious, highlyAvoidant),
      valuesScore: computeValuesScore(conservativeValues, progressiveValues),
      semanticScore: 0,
      financeScore: 0,
      interviewProcessScore: 0,
      capacityA: computeRelationalCapacity(lowCapacityUser),
      capacityB: computeRelationalCapacity(lowCapacityUser),
      interviewWeightedScoreA: 6.0,
      interviewWeightedScoreB: 6.0,
      sexualCommAdjustment: -0.05,
      conflictStyleAdjustment: -0.08,
      politicsAdjustment: -0.02,
      psychometricSoftAdjustment: -0.1,
      dealbreakerMultiplier: 1,
    });
    expect(result.finalScore).toBeGreaterThanOrEqual(0);
    expect(result.finalScore).toBeLessThanOrEqual(1);
  });

  it('breakdown components sum approximately to final score', () => {
    const result = computeFinalCompatibilityScore({
      attachmentScore: 0.7,
      valuesScore: 0.7,
      semanticScore: 0.5,
      financeScore: 0.6,
      interviewProcessScore: 0.65,
      capacityA: 0.75,
      capacityB: 0.75,
      interviewWeightedScoreA: 7.5,
      interviewWeightedScoreB: 7.5,
      sexualCommAdjustment: 0,
      conflictStyleAdjustment: 0,
      politicsAdjustment: 0,
      psychometricSoftAdjustment: 0,
      dealbreakerMultiplier: 1,
    });
    expect(result.breakdown).toBeDefined();
    expect(typeof result.breakdown.attachment).toBe('number');
    expect(typeof result.breakdown.values).toBe('number');
    expect(typeof result.breakdown.capacityDiscount).toBe('number');

    const reconstructed =
      result.breakdown.weightedCore +
      result.breakdown.sexualCommAdjustment +
      result.breakdown.conflictStyleAdjustment +
      result.breakdown.politicsAdjustment +
      result.breakdown.psychometricSoftAdjustment -
      result.breakdown.capacityDiscount;
    expect(result.finalScore).toBeCloseTo(Math.max(0, Math.min(1, reconstructed)), 2);
  });
});
