import type { SupabaseClient } from '@supabase/supabase-js';

import type { GateResult } from '@features/aria/computeGateResult';
import type { InterviewCompletionGateResult } from '@features/aria/interviewCompletionGate';
import type { DefensePatternsJson } from '@features/aria/defensePatternsDetection';
import type { InterviewResults } from '@features/aria/interviewResultsTypes';
import type { ResponseConcretenessLevel } from '@features/aria/personalMomentConcreteness';
import type { ScoreInterviewDeps } from '@features/aria/scoreInterviewTypes';
import type { disclosureCalibrationFromMarkerSlices } from '@features/aria/aggregateMarkerScoresFromSlices';

export const EMPTY_HOLISTIC_RESULT: InterviewResults = {
  pillarScores: {},
  keyEvidence: {},
  narrativeCoherence: 'moderate',
  behavioralSpecificity: 'moderate',
  notableInconsistencies: [],
  interviewSummary: '',
};

export type HolisticClientScoringState = {
  parsed: InterviewResults;
  gateResult: GateResult;
  holisticStoredPatterns: Record<string, unknown> | null;
  moment4ConcretenessHolisticGate: ResponseConcretenessLevel | null;
  moment5ConcretenessHolisticGate: ResponseConcretenessLevel | null;
  completionGateHolistic: InterviewCompletionGateResult | null;
  holisticDisclosureCalibration: ReturnType<typeof disclosureCalibrationFromMarkerSlices>;
  mentalizingOvercertaintyCountHolistic: number;
  holisticDefensePatterns: DefensePatternsJson;
  holisticWeightedScoreForPersist: number | null;
  weightedPassMin: number;
};

export type ComputeHolisticClientScoringParams = {
  deps: ScoreInterviewDeps;
  supabase: SupabaseClient;
  finalMessages: unknown[];
  standardDeferredHolisticCache: InterviewResults | null;
  fetchHolisticOnceBound: () => Promise<InterviewResults>;
  emotionRawScoreForGate: () => number | null;
  emotionResponsesForGate: () => string[];
  hydrateScenarioScoresFromAttemptIfNeeded: () => Promise<void>;
};

export type FinalizeStandardHolisticClientFallbackParams = {
  deps: ScoreInterviewDeps;
  supabase: SupabaseClient;
  finalMessages: unknown[];
  isStandardOnboardingApplicant: boolean;
  state: HolisticClientScoringState;
};
