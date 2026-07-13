import type { SupabaseClient } from '@supabase/supabase-js';

import type { InterviewResults } from '@features/aria/interviewResultsTypes';
import type { ScoreInterviewDeps } from '@features/aria/scoreInterviewTypes';
import {
  sanitizeMoment5PersonalScoresForAggregate,
  sanitizePersonalMomentScoresForAggregate,
} from '@features/aria/personalMomentSliceSanitize';
import type { AttemptScoringBaseline } from '@utilities/persistPersonalMomentScoresIncremental';

export type ScoreStandardDeferredPersistGateParams = {
  deps: ScoreInterviewDeps;
  supabase: SupabaseClient;
  msgsDeferred: import('@features/aria/interviewScenarioScoringSlice').MessageWithScenario[];
  finalMessages: unknown[];
  moment4ForAggregate: ReturnType<typeof sanitizePersonalMomentScoresForAggregate> | null;
  moment5ForAggregate: ReturnType<typeof sanitizeMoment5PersonalScoresForAggregate> | null;
  scoringBaseline: AttemptScoringBaseline;
  attemptIdForIncremental: string | null;
  nextAttemptNumber: number;
  apiUrl: string;
  typologyContext: string;
  fetchHolisticOnceBound: () => Promise<InterviewResults>;
  emotionRawScoreForGate: () => number | null;
  emotionResponsesForGate: () => string[];
};

export type ScoreStandardDeferredPersistGateResult = {
  serverDelegateOk: boolean;
  standardDeferredHolisticForEgoCache: InterviewResults | null;
  scoringBaseline: AttemptScoringBaseline;
};

export function scenarioBundleForDeferred(
  deps: ScoreInterviewDeps,
  n: 1 | 2 | 3,
): {
  pillarScores: Record<string, number | null>;
  pillarConfidence: Record<string, number | null>;
  keyEvidence: Record<string, string>;
  scenarioName: string;
  mentalizing_inference_source: string | null | undefined;
  mentalizing_overcertainty: boolean;
} | null {
  const s = deps.scenarioScoresRef.current[n];
  if (!s) return null;
  return {
    pillarScores: s.pillarScores,
    pillarConfidence: s.pillarConfidence,
    keyEvidence: s.keyEvidence,
    scenarioName: s.scenarioName,
    mentalizing_inference_source: s.mentalizing_inference_source,
    mentalizing_overcertainty: s.mentalizing_overcertainty === true,
  };
}
