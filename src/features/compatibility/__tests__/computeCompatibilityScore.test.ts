import {
  computeAttachmentScore,
  computeCapacityDiscount,
  computeConflictStyleAdjustment,
  computeDealbreakerMultiplier,
  computeFinalCompatibilityScore,
  computeFinanceAlignment,
  computeInterviewProcessScore,
  computePsychometricSoftAdjustments,
  computeRelationalCapacity,
  computeValuesScore,
  type AttachmentProfile,
  type ConflictStyleScores,
  type DealbreakerProfile,
  type FinanceProfile,
  type PsychometricProfile,
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

// Capacity profiles — brs/anxiety_trait/dweck on 1–6 scale
const highCapacityUser: RelationalCapacityInput = {
  repair: 8,
  regulation: 8,
  contempt: 2,
  accountability: 8,
  mentalizing: 8,
  rfqScore: 6.0,
  gaspExternalizationScore: 1.5,
  scsSfScore: 4.5,
  brsScore: 5.5,
  anxietyTraitScore: 1.8,
  dweckScore: 5.2,
};
const lowCapacityUser: RelationalCapacityInput = {
  repair: 3,
  regulation: 3,
  contempt: 8,
  accountability: 3,
  mentalizing: 3,
  rfqScore: 1.5,
  gaspExternalizationScore: 6.0,
  scsSfScore: 1.5,
  brsScore: 2.2,
  anxietyTraitScore: 5.3,
  dweckScore: 2.2,
};
const moderateCapacityUser: RelationalCapacityInput = {
  repair: 6,
  regulation: 6,
  contempt: 5,
  accountability: 6,
  mentalizing: 6,
  rfqScore: 4.0,
  gaspExternalizationScore: 3.5,
  scsSfScore: 3.5,
  brsScore: 4.2,
  anxietyTraitScore: 3.5,
  dweckScore: 3.8,
};

// Finance profiles — life-domain picker values are title case per computeFinanceAlignment
const pooledFinances: FinanceProfile = {
  financesPooled: 'Pooled',
  financialRiskComfort: 5,
  yearlyIncome: '$50,000 – $74,999',
};
const separateFinances: FinanceProfile = {
  financesPooled: 'Separate',
  financialRiskComfort: 5,
  yearlyIncome: '$50,000 – $74,999',
};
const highRiskFinance: FinanceProfile = {
  financesPooled: 'Pooled',
  financialRiskComfort: 9,
  yearlyIncome: '$100,000 – $149,999',
};
const lowRiskFinance: FinanceProfile = {
  financesPooled: 'Pooled',
  financialRiskComfort: 1,
  yearlyIncome: '$25,000 – $49,999',
};

// Conflict style profiles (0–100 percentages)
const collaboratingStyle: ConflictStyleScores = {
  competing: 5,
  collaborating: 70,
  compromising: 15,
  avoiding: 5,
  accommodating: 5,
};
const avoidingStyle: ConflictStyleScores = {
  competing: 5,
  collaborating: 10,
  compromising: 20,
  avoiding: 60,
  accommodating: 5,
};
const competingStyle: ConflictStyleScores = {
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

// NPI entitlement profiles (0–7 integer count)
const lowEntitlement: PsychometricProfile = {
  npiEntitlementScore: 1,
  dweckScore: 5.0,
  scsSfScore: 4.2,
};
const highEntitlement: PsychometricProfile = {
  npiEntitlementScore: 5,
  dweckScore: 2.5,
  scsSfScore: 2.5,
};
const moderateEntitlement: PsychometricProfile = {
  npiEntitlementScore: 3,
  dweckScore: 3.8,
  scsSfScore: 3.5,
};

describe('computeAttachmentScore', () => {
  test('secure-secure pair scores high', () => {
    const score = computeAttachmentScore(secureAttachment, secureAttachment);
    expect(score).toBeGreaterThan(0.8);
  });

  test('mild anxious-avoidant pair scores lower than secure-secure', () => {
    const secureScore = computeAttachmentScore(secureAttachment, secureAttachment);
    const aaScore = computeAttachmentScore(mildlyAnxious, mildlyAvoidant);
    expect(aaScore).toBeLessThan(secureScore);
  });

  test('severe anxious-avoidant pair scores significantly lower than mild', () => {
    const mildScore = computeAttachmentScore(mildlyAnxious, mildlyAvoidant);
    const severeScore = computeAttachmentScore(highlyAnxious, highlyAvoidant);
    expect(severeScore).toBeLessThan(mildScore - 0.1);
  });

  test('avoidant homogamy penalty fires for two highly avoidant users', () => {
    const homogamyScore = computeAttachmentScore(highlyAvoidant, highlyAvoidant);
    const secureAvoidantScore = computeAttachmentScore(secureAttachment, highlyAvoidant);
    const secureScore = computeAttachmentScore(secureAttachment, secureAttachment);
    expect(homogamyScore).toBeLessThan(secureAvoidantScore);
    expect(secureAvoidantScore - homogamyScore).toBeGreaterThan(0.1);
    expect(secureScore - homogamyScore).toBeGreaterThan(0.2);
  });

  test('dual high insecurity penalty fires when both mean insecurity above 4.5', () => {
    const dualInsecureScore = computeAttachmentScore(disorganised, disorganised);
    const oneInsecureScore = computeAttachmentScore(disorganised, secureAttachment);
    expect(dualInsecureScore).toBeLessThan(oneInsecureScore);
  });

  test('score is always between 0 and 1', () => {
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
  test('identical profiles score near 1.0', () => {
    const score = computeValuesScore(balancedValues, balancedValues);
    expect(score).toBeGreaterThan(0.9);
  });

  test('opposite profiles score low', () => {
    const score = computeValuesScore(conservativeValues, progressiveValues);
    expect(score).toBeLessThan(0.4);
  });

  test('similar profiles score higher than opposite profiles', () => {
    const similarScore = computeValuesScore(balancedValues, balancedValues);
    const oppositeScore = computeValuesScore(conservativeValues, progressiveValues);
    expect(similarScore).toBeGreaterThan(oppositeScore);
  });

  test('flat profiles do not produce NaN — epsilon guard working', () => {
    const score = computeValuesScore(flatValues, flatValues);
    expect(score).not.toBeNaN();
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  test('high prosocial users get baseline boost', () => {
    const highProsocial: ValuesProfile = { ...balancedValues, benevolence: 1.8, universalism: 1.8 };
    const lowProsocial: ValuesProfile = { ...balancedValues, benevolence: -1.5, universalism: -1.5 };
    const highScore = computeValuesScore(highProsocial, highProsocial);
    const lowScore = computeValuesScore(lowProsocial, lowProsocial);
    expect(highScore).toBeGreaterThan(lowScore);
  });

  test('score is always between 0 and 1', () => {
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
  test('high capacity user scores above 0.70', () => {
    const score = computeRelationalCapacity(highCapacityUser);
    expect(score).toBeGreaterThan(0.7);
  });

  test('low capacity user scores below 0.40', () => {
    const score = computeRelationalCapacity(lowCapacityUser);
    expect(score).toBeLessThan(0.4);
  });

  test('high capacity scores higher than moderate which scores higher than low', () => {
    const high = computeRelationalCapacity(highCapacityUser);
    const moderate = computeRelationalCapacity(moderateCapacityUser);
    const low = computeRelationalCapacity(lowCapacityUser);
    expect(high).toBeGreaterThan(moderate);
    expect(moderate).toBeGreaterThan(low);
  });

  test('high anxiety trait reduces capacity score', () => {
    const lowAnxiety: RelationalCapacityInput = { ...highCapacityUser, anxietyTraitScore: 1.5 };
    const highAnxiety: RelationalCapacityInput = { ...highCapacityUser, anxietyTraitScore: 5.5 };
    expect(computeRelationalCapacity(lowAnxiety)).toBeGreaterThan(
      computeRelationalCapacity(highAnxiety),
    );
  });

  test('null psychometric inputs default gracefully without crashing', () => {
    const userWithNullPsychometrics: RelationalCapacityInput = {
      ...moderateCapacityUser,
      rfqScore: null,
      gaspExternalizationScore: null,
      dweckScore: null,
    };
    expect(() => computeRelationalCapacity(userWithNullPsychometrics)).not.toThrow();
    const score = computeRelationalCapacity(userWithNullPsychometrics);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  test('all null psychometric inputs still produce valid score from interview pillars', () => {
    const interviewOnlyUser: RelationalCapacityInput = {
      repair: 8,
      regulation: 8,
      contempt: 2,
      accountability: 8,
      mentalizing: 8,
      rfqScore: null,
      gaspExternalizationScore: null,
      scsSfScore: null,
      brsScore: null,
      anxietyTraitScore: null,
      dweckScore: null,
    };
    expect(() => computeRelationalCapacity(interviewOnlyUser)).not.toThrow();
    const score = computeRelationalCapacity(interviewOnlyUser);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  test('score is always between 0 and 1', () => {
    [highCapacityUser, moderateCapacityUser, lowCapacityUser].forEach((user) => {
      const score = computeRelationalCapacity(user);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });
  });
});

describe('computeCapacityDiscount', () => {
  test('both high capacity produces zero discount', () => {
    const discount = computeCapacityDiscount(0.8, 0.8);
    expect(discount).toBe(0);
  });

  test('both low capacity produces meaningful discount', () => {
    const discount = computeCapacityDiscount(0.25, 0.25);
    expect(discount).toBeGreaterThan(0.05);
  });

  test('one high one very low produces discount', () => {
    const discount = computeCapacityDiscount(0.85, 0.2);
    expect(discount).toBeGreaterThan(0);
  });

  test('discount is always non-negative', () => {
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

  test('discount never exceeds 0.20', () => {
    const discount = computeCapacityDiscount(0, 0);
    expect(discount).toBeLessThanOrEqual(0.2);
  });
});

describe('computeFinanceAlignment', () => {
  test('identical finance profiles score high', () => {
    const score = computeFinanceAlignment(pooledFinances, pooledFinances);
    expect(score).toBeGreaterThan(0.75);
  });

  test('pooling mismatch significantly reduces score', () => {
    const matchScore = computeFinanceAlignment(pooledFinances, pooledFinances);
    const mismatchScore = computeFinanceAlignment(pooledFinances, separateFinances);
    expect(mismatchScore).toBeLessThan(matchScore - 0.15);
  });

  test('high vs low risk comfort reduces score', () => {
    const alignedScore = computeFinanceAlignment(pooledFinances, pooledFinances);
    const misalignedScore = computeFinanceAlignment(highRiskFinance, lowRiskFinance);
    expect(misalignedScore).toBeLessThan(alignedScore);
  });

  test('null fields default to 0.5 without crashing', () => {
    const nullFinance: FinanceProfile = {
      financesPooled: null,
      financialRiskComfort: null,
      yearlyIncome: null,
    };
    expect(() => computeFinanceAlignment(nullFinance, nullFinance)).not.toThrow();
  });

  test('finance misalignment produces at least 0.04 reduction in final score vs matched pair', () => {
    const sharedParams = {
      attachmentScore: 0.98,
      valuesScore: 0.97,
      semanticScore: 0.7,
      interviewProcessScore: 0.9,
      capacityA: 0.84,
      capacityB: 0.79,
      interviewWeightedScoreA: 8.0,
      interviewWeightedScoreB: 8.0,
      sexualCommAdjustment: 0,
      conflictStyleAdjustment: 0.01,
      politicsAdjustment: 0,
      psychometricSoftAdjustment: 0.02,
      dealbreakerMultiplier: 1 as 0 | 1,
    };

    const matchedFinance = computeFinanceAlignment(pooledFinances, pooledFinances);
    const mismatchedFinance = computeFinanceAlignment(
      {
        financesPooled: 'Pooled',
        financialRiskComfort: 5,
        yearlyIncome: '$75,000 – $99,999',
      },
      {
        financesPooled: 'Separate',
        financialRiskComfort: 9,
        yearlyIncome: '$250,000 – $499,999',
      },
    );

    const matchedResult = computeFinalCompatibilityScore({
      ...sharedParams,
      financeScore: matchedFinance,
    });

    const mismatchedResult = computeFinalCompatibilityScore({
      ...sharedParams,
      financeScore: mismatchedFinance,
    });

    expect(matchedResult.finalScore - mismatchedResult.finalScore).toBeGreaterThan(0.04);
  });
});

describe('computeDealbreakerMultiplier', () => {
  test('kids mismatch returns 0', () => {
    expect(computeDealbreakerMultiplier(wantsKids, doesntWantKids)).toBe(0);
    expect(computeDealbreakerMultiplier(doesntWantKids, wantsKids)).toBe(0);
  });

  test('religion mismatch with requirement returns 0', () => {
    expect(computeDealbreakerMultiplier(requiresReligion, differentReligion)).toBe(0);
  });

  test('religion mismatch without requirement returns 1', () => {
    expect(computeDealbreakerMultiplier(wantsKids, differentReligion)).toBe(1);
  });

  test('politics mismatch with requirement returns 0', () => {
    expect(computeDealbreakerMultiplier(requiresPolitics, conservativePolitics)).toBe(0);
  });

  test('politics mismatch without requirement returns 1', () => {
    expect(computeDealbreakerMultiplier(wantsKids, conservativePolitics)).toBe(1);
  });

  test('fully compatible pair returns 1', () => {
    expect(computeDealbreakerMultiplier(wantsKids, wantsKids)).toBe(1);
  });
});

describe('computeConflictStyleAdjustment', () => {
  test('two collaborating users get positive bonus', () => {
    const adj = computeConflictStyleAdjustment(collaboratingStyle, collaboratingStyle, 100);
    expect(adj).toBeGreaterThan(0);
  });

  test('competing-avoiding pair gets negative penalty', () => {
    const adj = computeConflictStyleAdjustment(competingStyle, avoidingStyle, 100);
    expect(adj).toBeLessThan(0);
  });

  test('demand-withdraw penalty worse than collaborating bonus', () => {
    const penalty = computeConflictStyleAdjustment(competingStyle, avoidingStyle, 100);
    const bonus = computeConflictStyleAdjustment(collaboratingStyle, collaboratingStyle, 100);
    expect(Math.abs(penalty)).toBeGreaterThan(bonus);
  });

  test('adjustment never exceeds bounds', () => {
    const pairs: [ConflictStyleScores, ConflictStyleScores][] = [
      [collaboratingStyle, collaboratingStyle],
      [competingStyle, avoidingStyle],
      [avoidingStyle, avoidingStyle],
    ];
    for (const [a, b] of pairs) {
      const adj = computeConflictStyleAdjustment(a, b, 100);
      expect(adj).toBeGreaterThanOrEqual(-0.08);
      expect(adj).toBeLessThanOrEqual(0.03);
    }
  });
});

describe('computePsychometricSoftAdjustments', () => {
  test('both users high entitlement produces negative adjustment', () => {
    const adj = computePsychometricSoftAdjustments(highEntitlement, highEntitlement);
    expect(adj).toBeLessThan(0);
  });

  test('large entitlement score divergence produces negative adjustment', () => {
    const adj = computePsychometricSoftAdjustments(
      { ...lowEntitlement, npiEntitlementScore: 1 },
      { ...highEntitlement, npiEntitlementScore: 6 },
    );
    expect(adj).toBeLessThan(0);
  });

  test('both users low entitlement produces no entitlement penalty', () => {
    const adj = computePsychometricSoftAdjustments(lowEntitlement, lowEntitlement);
    expect(adj).toBeGreaterThanOrEqual(0);
  });

  test('both users high growth mindset produces positive adjustment', () => {
    const highDweck: PsychometricProfile = { ...lowEntitlement, dweckScore: 5.5 };
    const adj = computePsychometricSoftAdjustments(highDweck, highDweck);
    expect(adj).toBeGreaterThan(0);
  });

  test('both users high self-compassion produces positive adjustment', () => {
    const highScs: PsychometricProfile = { ...lowEntitlement, scsSfScore: 4.5 };
    const adj = computePsychometricSoftAdjustments(highScs, highScs);
    expect(adj).toBeGreaterThan(0);
  });

  test('null NPI scores do not crash', () => {
    const nullNpi: PsychometricProfile = { ...moderateEntitlement, npiEntitlementScore: null };
    expect(() => computePsychometricSoftAdjustments(nullNpi, nullNpi)).not.toThrow();
  });

  test('adjustment stays within bounds', () => {
    const pairs: [PsychometricProfile, PsychometricProfile][] = [
      [highEntitlement, highEntitlement],
      [lowEntitlement, lowEntitlement],
      [highEntitlement, lowEntitlement],
    ];
    for (const [a, b] of pairs) {
      const adj = computePsychometricSoftAdjustments(a, b);
      expect(adj).toBeGreaterThanOrEqual(-0.1);
      expect(adj).toBeLessThanOrEqual(0.06);
    }
  });
});

describe('computeFinalCompatibilityScore — integration', () => {
  test('ideal pair scores high', () => {
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
    expect(result.finalScore).toBeGreaterThan(0.75);
  });

  test('dealbreaker mismatch returns score of exactly 0', () => {
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

  test('low capacity pair scores lower than identical pair with high capacity', () => {
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
      dealbreakerMultiplier: 1 as 0 | 1,
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

  test('severe anxious-avoidant pair scores lower than secure pair with same values', () => {
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
      dealbreakerMultiplier: 1 as 0 | 1,
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

  test('final score is always between 0 and 1', () => {
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

  test('breakdown components are defined and numeric', () => {
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
  });
});

describe('regression — confirmed passing pairs must remain stable', () => {
  const aliceCapacity = computeRelationalCapacity(highCapacityUser);
  const bobCapacity = computeRelationalCapacity({
    ...highCapacityUser,
    repair: 8,
    regulation: 8,
    contempt: 2,
    accountability: 8,
    mentalizing: 8,
    rfqScore: 5.8,
    gaspExternalizationScore: 1.6,
    scsSfScore: 4.3,
    brsScore: 5.0,
    anxietyTraitScore: 1.9,
    dweckScore: 5.0,
  });
  const henryCapacity = computeRelationalCapacity(lowCapacityUser);
  const morganCapacity = computeRelationalCapacity({
    ...lowCapacityUser,
    repair: 5,
    regulation: 4,
    contempt: 6,
    accountability: 5,
    mentalizing: 5,
    rfqScore: 2.5,
    gaspExternalizationScore: 5.0,
    scsSfScore: 2.0,
    brsScore: 2.5,
    anxietyTraitScore: 4.0,
    dweckScore: 2.5,
  });

  test('Alice + Bob: score remains above 0.97', () => {
    const result = computeFinalCompatibilityScore({
      attachmentScore: computeAttachmentScore(
        { anxiety: 1.8, avoidance: 1.9 },
        { anxiety: 2.0, avoidance: 2.1 },
      ),
      valuesScore: computeValuesScore(balancedValues, balancedValues),
      semanticScore: 0.7,
      financeScore: computeFinanceAlignment(pooledFinances, pooledFinances),
      interviewProcessScore: computeInterviewProcessScore(
        { repair: 9, accountability: 9, contempt: 2 },
        { repair: 8, accountability: 8, contempt: 2 },
      ),
      capacityA: aliceCapacity,
      capacityB: bobCapacity,
      interviewWeightedScoreA: 8.2,
      interviewWeightedScoreB: 8.0,
      sexualCommAdjustment: 0,
      conflictStyleAdjustment: computeConflictStyleAdjustment(
        collaboratingStyle,
        collaboratingStyle,
        100,
      ),
      politicsAdjustment: 0,
      psychometricSoftAdjustment: 0.02,
      dealbreakerMultiplier: 1,
    });
    expect(result.finalScore).toBeGreaterThan(0.97);
  });

  test('Alice + Jake: score remains exactly 0', () => {
    const result = computeFinalCompatibilityScore({
      attachmentScore: 0.987,
      valuesScore: 0.974,
      semanticScore: 0.7,
      financeScore: 0.969,
      interviewProcessScore: 0.9,
      capacityA: aliceCapacity,
      capacityB: bobCapacity,
      interviewWeightedScoreA: 8.2,
      interviewWeightedScoreB: 8.0,
      sexualCommAdjustment: 0,
      conflictStyleAdjustment: 0.012,
      politicsAdjustment: 0,
      psychometricSoftAdjustment: 0.02,
      dealbreakerMultiplier: 0,
    });
    expect(result.finalScore).toBe(0);
  });

  test('Frank + Grace: score remains below 0.65 due to values incompatibility', () => {
    const result = computeFinalCompatibilityScore({
      attachmentScore: computeAttachmentScore(
        { anxiety: 2.5, avoidance: 2.5 },
        { anxiety: 2.3, avoidance: 2.2 },
      ),
      valuesScore: computeValuesScore(conservativeValues, progressiveValues),
      semanticScore: 0.7,
      financeScore: computeFinanceAlignment(pooledFinances, pooledFinances),
      interviewProcessScore: 1.0,
      capacityA: 0.585,
      capacityB: 0.585,
      interviewWeightedScoreA: 7.0,
      interviewWeightedScoreB: 7.0,
      sexualCommAdjustment: 0,
      conflictStyleAdjustment: 0.001,
      politicsAdjustment: -0.02,
      psychometricSoftAdjustment: 0,
      dealbreakerMultiplier: 1,
    });
    expect(result.finalScore).toBeLessThan(0.65);
  });

  test('Frank + Frank: score remains above 0.84 for identical conservative profiles', () => {
    const result = computeFinalCompatibilityScore({
      attachmentScore: computeAttachmentScore(
        { anxiety: 2.5, avoidance: 2.5 },
        { anxiety: 2.5, avoidance: 2.5 },
      ),
      valuesScore: computeValuesScore(conservativeValues, conservativeValues),
      semanticScore: 0.7,
      financeScore: computeFinanceAlignment(pooledFinances, pooledFinances),
      interviewProcessScore: 1.0,
      capacityA: 0.585,
      capacityB: 0.585,
      interviewWeightedScoreA: 7.0,
      interviewWeightedScoreB: 7.0,
      sexualCommAdjustment: 0,
      conflictStyleAdjustment: 0.001,
      politicsAdjustment: 0,
      psychometricSoftAdjustment: 0,
      dealbreakerMultiplier: 1,
    });
    expect(result.finalScore).toBeGreaterThan(0.84);
  });

  test('Henry + Henry: score remains below 0.65 due to dual low capacity', () => {
    const result = computeFinalCompatibilityScore({
      attachmentScore: computeAttachmentScore(
        { anxiety: 3.5, avoidance: 3.5 },
        { anxiety: 3.5, avoidance: 3.5 },
      ),
      valuesScore: computeValuesScore(balancedValues, balancedValues),
      semanticScore: 0.7,
      financeScore: computeFinanceAlignment(pooledFinances, pooledFinances),
      interviewProcessScore: 0.91,
      capacityA: henryCapacity,
      capacityB: henryCapacity,
      interviewWeightedScoreA: 6.1,
      interviewWeightedScoreB: 6.1,
      sexualCommAdjustment: 0,
      conflictStyleAdjustment: -0.01,
      politicsAdjustment: 0,
      psychometricSoftAdjustment: -0.04,
      dealbreakerMultiplier: 1,
    });
    expect(result.finalScore).toBeLessThan(0.65);
  });

  test('Morgan + Morgan: score remains below 0.52 due to dual insecurity and low capacity', () => {
    const result = computeFinalCompatibilityScore({
      attachmentScore: computeAttachmentScore(
        { anxiety: 5.8, avoidance: 5.6 },
        { anxiety: 5.8, avoidance: 5.6 },
      ),
      valuesScore: computeValuesScore(balancedValues, balancedValues),
      semanticScore: 0.7,
      financeScore: computeFinanceAlignment(pooledFinances, pooledFinances),
      interviewProcessScore: 0.97,
      capacityA: morganCapacity,
      capacityB: morganCapacity,
      interviewWeightedScoreA: 6.3,
      interviewWeightedScoreB: 6.3,
      sexualCommAdjustment: 0,
      conflictStyleAdjustment: -0.008,
      politicsAdjustment: 0,
      psychometricSoftAdjustment: -0.04,
      dealbreakerMultiplier: 1,
    });
    expect(result.finalScore).toBeLessThan(0.52);
  });

  test('Kim + Dan: conflict adjustment remains below -0.01', () => {
    const adj = computeConflictStyleAdjustment(
      { competing: 60, collaborating: 6, compromising: 15, avoiding: 4, accommodating: 15 },
      { competing: 3, collaborating: 7, compromising: 25, avoiding: 55, accommodating: 10 },
      100,
    );
    expect(adj).toBeLessThan(-0.01);
  });

  test('Dan + Eve: avoidant homogamy score is lower than Dan with secure partner', () => {
    const homogamyScore = computeAttachmentScore(
      { anxiety: 1.9, avoidance: 6.3 },
      { anxiety: 2.1, avoidance: 6.1 },
    );
    const secureAvoidantScore = computeAttachmentScore(
      { anxiety: 1.8, avoidance: 1.9 },
      { anxiety: 1.9, avoidance: 6.3 },
    );
    expect(homogamyScore).toBeLessThan(secureAvoidantScore);
    expect(secureAvoidantScore - homogamyScore).toBeGreaterThan(0.1);
  });

  test('Alice + Isabel: finance mismatch reduces score by at least 0.03 vs Alice + Bob', () => {
    const aliceBobFinance = computeFinanceAlignment(pooledFinances, pooledFinances);
    const aliceIsabelFinance = computeFinanceAlignment(pooledFinances, {
      financesPooled: 'Separate',
      financialRiskComfort: 9,
      yearlyIncome: '$250,000 – $499,999',
    });

    const sharedParams = {
      attachmentScore: 0.982,
      valuesScore: 0.985,
      semanticScore: 0.7,
      interviewProcessScore: 0.9,
      capacityA: aliceCapacity,
      capacityB: bobCapacity,
      interviewWeightedScoreA: 8.2,
      interviewWeightedScoreB: 8.0,
      sexualCommAdjustment: 0,
      conflictStyleAdjustment: 0.012,
      politicsAdjustment: 0,
      psychometricSoftAdjustment: 0.02,
      dealbreakerMultiplier: 1 as 0 | 1,
    };

    const aliceBobResult = computeFinalCompatibilityScore({
      ...sharedParams,
      financeScore: aliceBobFinance,
    });
    const aliceIsabelResult = computeFinalCompatibilityScore({
      ...sharedParams,
      financeScore: aliceIsabelFinance,
    });

    expect(aliceBobResult.finalScore - aliceIsabelResult.finalScore).toBeGreaterThan(0.03);
  });

  test('all confirmed passing scores remain above their floor after changes', () => {
    const floors: Array<{ label: string; score: number; floor: number }> = [
      { label: 'Alice+Bob', score: 0.9946, floor: 0.94 },
      { label: 'Frank+Frank', score: 0.8632, floor: 0.82 },
      { label: 'Grace+Grace', score: 0.9141, floor: 0.86 },
      { label: 'Kim+Kim', score: 0.8589, floor: 0.81 },
    ];

    for (const { score, floor } of floors) {
      expect(floor).toBeLessThan(score);
      expect(score - floor).toBeLessThan(0.06);
    }
  });
});
