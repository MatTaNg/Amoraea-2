/**
 * Canonical snapshot shape for AI pairwise compatibility scoring.
 * Populate from Supabase (`users`, `profiles`, `interview_attempts`, `user_assessments`,
 * `compatibility`, `communication_style_profiles`) before calling the prompt builder.
 */

import type { ArchetypeId } from '@/shared/constants/archetypes';
import type { SchwartzValueKey } from '@/domain/models/TypologyForm';

/** 0–1 sub-scores the model (or deterministic layer) produces before final weighting. */
export type MatchmakingSubscores = {
  attachment: number;
  values: number;
  style: number;
  semantic: number;
  /** Soft adjustment from sexual communication comfort alignment (−0.05 … +0.03). */
  sexualCommunicationAdjustment?: number;
};

/** Weights mirror {@link computeFinalCompatibilityScore} in styleCompatibilityScore.ts. */
export const MATCHMAKING_SUBSCORE_WEIGHTS = {
  attachment: 0.35,
  values: 0.3,
  style: 0.2,
  semantic: 0.15,
} as const;

export type InterviewPillarId =
  | 'mentalizing'
  | 'accountability'
  | 'contempt'
  | 'repair'
  | 'regulation'
  | 'attunement'
  | 'appreciation'
  | 'commitment_threshold';

export type MatchmakingInterviewSnapshot = {
  attemptId?: string;
  passed?: boolean | null;
  /** Marker-only weighted average (0–10 scale). */
  weightedScore?: number | null;
  /** After depth-signal + psychometric modifiers (0–10). */
  modifiedWeightedScore?: number | null;
  /** Holistic ego development 1–5. */
  egoDevelopmentLevel?: number | null;
  pillarScores?: Partial<Record<InterviewPillarId, number | null>>;
  scenarioComposites?: { scenario_1?: number | null; scenario_2?: number | null; scenario_3?: number | null };
  reviewFlags?: string[];
  gateFailReasons?: string[];
  defensePatterns?: {
    projection_detected?: boolean;
    rationalization_detected?: boolean;
    splitting_detected?: boolean;
    denial_detected?: boolean;
  };
  moment4Concreteness?: string | null;
  moment5Concreteness?: string | null;
  disclosureCalibration?: string | null;
  /** Proportion correct 0–1 from in-interview emotion MC items. */
  emotionRecognitionRaw?: number | null;
};

export type MatchmakingPreInterviewPsychometrics = {
  brsScore?: number | null;
  scsSfScore?: number | null;
  gaspScore?: number | null;
  dweckScore?: number | null;
  aaq2Score?: number | null;
  rsesScore?: number | null;
  scsPublicScore?: number | null;
  scsPrivateScore?: number | null;
  mspssFriendsScore?: number | null;
  sd3NarcissismScore?: number | null;
  rfqScore?: number | null;
  psychometricModifier?: number | null;
  psychometricFloorBreaches?: string[];
  straightLineFlags?: string[];
};

export type AttachmentStyleLabel = 'secure' | 'anxious' | 'avoidant' | 'disorganised';

export type MatchmakingPostInterviewTypology = {
  sexualCommunicationMean?: number | null;
  attachment?: {
    anxiety?: number | null;
    avoidance?: number | null;
    style?: AttachmentStyleLabel | null;
  };
  /** Centered Schwartz value scores (MRAT-centered). */
  values?: Partial<Record<SchwartzValueKey, number | null>> & {
    self_transcendence?: number | null;
    self_enhancement?: number | null;
    openness_to_change?: number | null;
    conservation?: number | null;
  };
  conflictStyle?: Partial<
    Record<'competing' | 'collaborating' | 'compromising' | 'avoiding' | 'accommodating', number | null>
  >;
  assessmentsCompleted?: boolean;
};

export type MatchmakingCommunicationStyle = {
  emotionalAnalytical?: number | null;
  narrativeConceptual?: number | null;
  certaintyAmbiguity?: number | null;
  relationalIndividual?: number | null;
  warmth?: number | null;
  overallConfidence?: number | null;
  matchmakerSummary?: string | null;
};

export type MatchmakingLifeDomains = {
  intimacy?: number | null;
  finance?: number | null;
  spirituality?: number | null;
  family?: number | null;
  physicalHealth?: number | null;
  /** Domain id → question id → free text. */
  answers?: Partial<
    Record<'finance' | 'family' | 'intimacy' | 'spirituality' | 'health', Record<string, string>>
  >;
};

export type MatchmakingOptionalTypologies = {
  eroticBlueprintType?: string | null;
  loveLanguage?: string | null;
  myersBriggs?: string | null;
  enneagramType?: string | null;
  enneagramWing?: string | null;
  enneagramInstinct?: string | null;
  sunSign?: string | null;
  risingSign?: string | null;
  moonSign?: string | null;
  marsSign?: string | null;
  venusSign?: string | null;
  humanDesignType?: string | null;
  humanDesignAuthority?: string | null;
  humanDesignProfile?: string | null;
  spiralDynamics?: string | null;
};

export type MatchmakingProfileSnapshot = {
  displayName?: string | null;
  age?: number | null;
  gender?: string | null;
  ethnicity?: string | null;
  location?: string | null;
  attractedTo?: string[];
  relationshipStyle?: string | null;
  longestRomanticRelationship?: string | null;
  educationLevel?: string | null;
  haveKids?: string | null;
  wantKids?: string | null;
  politics?: string | null;
  religion?: string | null;
  smoking?: string | null;
  drinking?: string | null;
  recreationalDrugsSocial?: string | null;
  relationshipWithPsychedelics?: string | null;
  relationshipWithCannabis?: string | null;
  sexDrive?: string | null;
  sexInterestCategories?: string[];
  recentDatingEarlyWeeks?: string | null;
  spaceForNewRelationship?: string | null;
  bio?: string | null;
  hobbies?: string | null;
  archetypes?: ArchetypeId[];
  lifeDomains?: MatchmakingLifeDomains;
  typology?: MatchmakingOptionalTypologies;
};

/** Partner preferences + explicit dealbreakers from onboarding / compatibility form. */
export type MatchmakingPreferencesSnapshot = {
  relationshipType?: string | null;
  marriagePartnershipPreference?: string | null;
  kidsWanted?: string | null;
  kidsExisting?: string | null;
  openToAdopting?: boolean | null;
  religiousIdentity?: string | null;
  faithPracticeLevel?: string | null;
  futureLivingLocation?: string[];
  willingToRelocate?: boolean | null;
  workWeekHours?: string | null;
  hoursPerWeekQualityTime?: string | null;
  sexualConnectionImportance?: number | null;
  sexFrequency?: string | null;
  financialSupportExpectation?: number | null;
  financialStructure?: number | null;
  cleanlinessPreference?: number | null;
  hasPets?: string | null;
  partnerHasPetsPreference?: string | null;
  alcoholFrequency?: string | null;
  partnerDrinksComfort?: string | null;
  cigaretteFrequency?: string | null;
  partnerCigarettesComfort?: string | null;
  cannabisTobaccoFrequency?: string | null;
  partnerCannabisTobaccoComfort?: string | null;
  recreationalDrugsFrequency?: string | null;
  partnerRecreationalDrugsComfort?: string | null;
  /** Onboarding dealbreaker fields (long-term living, lifestyle, relocation, substance alignment, etc.). */
  matchPreferences?: Record<string, string | string[] | boolean | null | undefined>;
};

export type MatchmakingUserSnapshot = {
  userId: string;
  /** If false, pair should hard-block regardless of soft score. */
  eligibleForMatching?: boolean;
  interview?: MatchmakingInterviewSnapshot;
  preInterviewPsychometrics?: MatchmakingPreInterviewPsychometrics;
  postInterviewTypology?: MatchmakingPostInterviewTypology;
  communicationStyle?: MatchmakingCommunicationStyle;
  profile?: MatchmakingProfileSnapshot;
  preferences?: MatchmakingPreferencesSnapshot;
};

export type MatchmakingPairPayload = {
  schemaVersion: 1;
  userA: MatchmakingUserSnapshot;
  userB: MatchmakingUserSnapshot;
  /** Optional event or cohort context. */
  context?: {
    eventId?: string;
    eventName?: string;
    notes?: string;
  };
};

/** Structured model output — validate against matchmakingCompatibilityResult.schema.json. */
export type MatchmakingCompatibilityResult = {
  schemaVersion: 1;
  /** False when any hard filter blocks the pair. */
  eligible: boolean;
  hardBlockReasons: string[];
  /** 0–100 integer for display; derived from weighted 0–1 score × 100. */
  compatibilityScore: number;
  /** 0–1 before ×100; matches computeFinalCompatibilityScore when subscores supplied. */
  compatibilityScoreNormalized: number;
  subscores: MatchmakingSubscores;
  /** 0–1 multiplier applied to final score (1 = no dealbreakers). */
  dealbreakerMultiplier: number;
  /** Confidence 0–1 in the overall assessment given data completeness. */
  confidence: number;
  /** Top 2–4 alignment themes. */
  strengths: string[];
  /** Top 2–4 friction or risk themes. */
  risks: string[];
  /** Actionable growth areas for the pair (not individual therapy advice). */
  growthEdges: string[];
  /** 3–5 sentences, specific, no generic fluff. */
  narrativeSummary: string;
  /** Pillar or domain tags for ranking/filtering. */
  tags?: string[];
};
