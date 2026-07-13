import type { MutableRefObject } from 'react';

import type { ScenarioScoreResult } from '@features/aria/scoreInterviewScoringHelpers';
import type { SupabaseClient } from '@supabase/supabase-js';

export type SaveScenarioCheckpointDeps = {
  interviewSessionAttemptIdRef: MutableRefObject<string | null>;
  resumeActiveScenarioRef: MutableRefObject<1 | 2 | 3 | null>;
  supabase: SupabaseClient;
  loadInterviewFromStorage: (userId: string) => Promise<unknown>;
  saveInterviewToStorage: (userId: string, data: unknown) => Promise<void>;
};

export type SaveScenarioCheckpointParams = {
  scenarioNumber: 1 | 2 | 3;
  result: ScenarioScoreResult;
  allMessages: Array<{ role: string; content: string }>;
  uid: string;
};
