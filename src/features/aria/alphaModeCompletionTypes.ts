import type { SupabaseClient } from '@supabase/supabase-js';

import type { GateResult } from '@features/aria/computeGateResult';
import type { InterviewResults } from '@features/aria/interviewResultsTypes';
import type { ScoreInterviewDeps } from '@features/aria/scoreInterviewTypes';

export type RunAlphaModeCompletionParams = {
  deps: ScoreInterviewDeps;
  supabase: SupabaseClient;
  finalMessages: { role: string; content: string }[];
  parsed: InterviewResults;
  gateResult: GateResult;
  weightedMin: number;
  apiUrl: string;
  headers: Record<string, string>;
  isStandardOnboardingApplicant: boolean;
  hydrateScenarioScoresFromAttemptIfNeeded: () => Promise<void>;
  emotionRawScoreForGate: () => number | null;
  emotionResponsesForGate: () => string[];
};
