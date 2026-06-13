import type { CompatibilityFormData } from '@/domain/models/CompatibilityForm';
import type { MatchmakingUserSnapshot } from '../matchmakingPairPayload';

const PVQ_BALANCED = {
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

function baseInterviewPillars() {
  return {
    mentalizing: 7,
    accountability: 7,
    contempt: 6,
    repair: 7.5,
    regulation: 7,
    attunement: 7,
    appreciation: 6.5,
    commitment_threshold: 6.5,
  };
}

function baseSnapshot(
  userId: string,
  overrides: Partial<MatchmakingUserSnapshot> = {},
): MatchmakingUserSnapshot {
  const profile = {
    displayName: userId,
    relationshipStyle: 'monogamy',
    wantKids: 'Want kids',
    religion: 'Christian',
    politics: 'Moderate',
    lifeDomains: {
      intimacy: 25,
      finance: 20,
      spirituality: 15,
      family: 25,
      physicalHealth: 15,
      answers: {
        finance: {
          financesPooled: 'Pooled',
          yearlyIncome: '$100,000 – $149,999',
        },
      },
    },
    ...(overrides.profile ?? {}),
  };

  return {
    userId,
    eligibleForMatching: true,
    interview: {
      passed: true,
      weightedScore: 7.0,
      modifiedWeightedScore: 7.0,
      pillarScores: baseInterviewPillars(),
      ...(overrides.interview ?? {}),
    },
    preInterviewPsychometrics: {
      rfqScore: 5,
      gaspScore: 2,
      brsScore: 5,
      scsSfScore: 4,
      dweckScore: 5,
      ...(overrides.preInterviewPsychometrics ?? {}),
    },
    postInterviewTypology: {
      assessmentsCompleted: true,
      sexualCommunicationMean: 4.0,
      attachment: { anxiety: 2.5, avoidance: 2.5, style: 'secure' },
      values: { ...PVQ_BALANCED },
      conflictStyle: {
        competing: 15,
        collaborating: 45,
        compromising: 25,
        avoiding: 10,
        accommodating: 5,
      },
      ...(overrides.postInterviewTypology ?? {}),
    },
    profile,
    preferences: {
      relationshipType: 'monogamy',
      willingToRelocate: false,
      ...(overrides.preferences ?? {}),
    },
    ...overrides,
  };
}

export const idealPairUserA: MatchmakingUserSnapshot = baseSnapshot('ideal-a');
export const idealPairUserB: MatchmakingUserSnapshot = baseSnapshot('ideal-b', {
  profile: {
    displayName: 'ideal-b',
    relationshipStyle: 'monogamy',
    wantKids: 'Want kids',
    religion: 'Christian',
    politics: 'Moderate',
    lifeDomains: {
      intimacy: 22,
      finance: 22,
      spirituality: 18,
      family: 23,
      physicalHealth: 15,
      answers: {
        finance: {
          financesPooled: 'Pooled',
          yearlyIncome: '$100,000 – $149,999',
        },
      },
    },
  },
});

export const blockedKidsUserA: MatchmakingUserSnapshot = baseSnapshot('kids-a', {
  profile: { wantKids: 'Want kids' },
});
export const blockedKidsUserB: MatchmakingUserSnapshot = baseSnapshot('kids-b', {
  profile: { wantKids: "Don't want kids" },
});

export const sparseDataUser: MatchmakingUserSnapshot = {
  userId: 'sparse-user',
  eligibleForMatching: true,
  interview: {
    passed: true,
    weightedScore: 6.5,
    pillarScores: {
      repair: 6,
      regulation: 6,
      contempt: 5,
      accountability: 6,
      mentalizing: 6,
    },
  },
  profile: {
    wantKids: 'Undecided',
    relationshipStyle: 'monogamy',
    lifeDomains: { intimacy: 20, finance: 20, spirituality: 20, family: 20, physicalHealth: 20 },
  },
  preferences: { willingToRelocate: true },
};

export const anxiousAvoidantUserA: MatchmakingUserSnapshot = baseSnapshot('anx-a', {
  postInterviewTypology: {
    attachment: { anxiety: 6.5, avoidance: 2.0, style: 'anxious' },
  },
});

export const anxiousAvoidantUserB: MatchmakingUserSnapshot = baseSnapshot('avo-b', {
  postInterviewTypology: {
    attachment: { anxiety: 2.0, avoidance: 6.5, style: 'avoidant' },
  },
});

export const lowCapacityUser: MatchmakingUserSnapshot = baseSnapshot('low-capacity', {
  interview: {
    pillarScores: {
      ...baseInterviewPillars(),
      repair: 3,
      regulation: 3,
      contempt: 8,
      accountability: 3,
      mentalizing: 3,
    },
  },
  preInterviewPsychometrics: {
    rfqScore: 2,
    gaspScore: 6,
    brsScore: 2,
    scsSfScore: 2,
    dweckScore: 2,
  },
});

export const compatibleCompatibilityData: Partial<CompatibilityFormData> = {
  financialRiskComfort: 5,
  willingToRelocate: false,
  alcoholFrequency: 'socially',
  partnerDrinksComfort: 'socially_fine',
};

export const fixtureMappingExtras = {
  npiEntitlementScore: 2,
  anxietyTraitScore: 3,
  gaspExternalizationScore: 2,
  compatibilityData: compatibleCompatibilityData,
  locationCoords: { lat: 30.27, lng: -97.74 },
  prefPartnerPoliticalAlignmentImportance: 'No',
};
