import type { SupabaseClient } from '@supabase/supabase-js';

import type { MessageWithScenario } from '@features/aria/interviewScenarioScoringSlice';
import type { InterviewResults } from '@features/aria/interviewResultsTypes';
import {
  prepareScenarioScoresForCompletion,
  rescoreMissingStandardScenarioScores,
  listMissingAssessableScenarioScores,
} from '@features/aria/prepareScenarioScoresForCompletion';
import {
  scoreStandardDeferredMoment4,
  scoreStandardDeferredMoment5,
} from '@features/aria/scoreStandardDeferredPersonalMoments';
import { runStandardDeferredPersistGate } from '@features/aria/scoreStandardDeferredPersistGate';
import type { ScoreInterviewDeps } from '@features/aria/scoreInterviewTypes';
import {
  sanitizeMoment5PersonalScoresForAggregate,
  sanitizePersonalMomentScoresForAggregate,
} from '@features/aria/personalMomentSliceSanitize';
import { resolveAttemptNumberForCompletion } from '@features/interview/interviewAttemptLifecycle';
import { persistInterviewAttemptSessionLifecycle } from '@utilities/interviewAttemptLifecycle';
import {
  fetchAttemptScoringBaseline,
  logScorePipelineBaseline,
} from '@utilities/persistPersonalMomentScoresIncremental';
import type { AttemptScoringBaseline } from '@utilities/persistPersonalMomentScoresIncremental';
import { remoteLog } from '@utilities/remoteLog';
import { kickClientInterviewNarrativeIfPending } from '@utilities/kickClientInterviewNarrativeIfPending';

export type RunStandardOnboardingServerDelegateParams = {
  deps: ScoreInterviewDeps;
  supabase: SupabaseClient;
  finalMessages: unknown[];
  apiUrl: string;
  headers: Record<string, string>;
  typologyContext: string;
  fetchHolisticOnceBound: () => Promise<InterviewResults>;
  emotionRawScoreForGate: () => number | null;
  emotionResponsesForGate: () => string[];
};

export type RunStandardOnboardingServerDelegateResult = {
  handled: boolean;
  standardDeferredHolisticForEgoCache: InterviewResults | null;
};

/**
 * Standard onboarding server-delegate path: rescore gaps, deferred M4/M5, persist + edge.
 * When `handled` is true, caller should return early (delegate succeeded).
 */
export async function runStandardOnboardingServerDelegate(
  params: RunStandardOnboardingServerDelegateParams,
): Promise<RunStandardOnboardingServerDelegateResult> {
  const {
    deps,
    supabase,
    finalMessages,
    apiUrl,
    headers,
    typologyContext,
    fetchHolisticOnceBound,
    emotionRawScoreForGate,
    emotionResponsesForGate,
  } = params;

  let standardDeferredHolisticForEgoCache: InterviewResults | null = null;
  let serverDelegateOk = false;

  try {
    deps.interviewStatusRef.current = 'preparing_results';
    deps.setInterviewStatus('preparing_results');
    void persistInterviewAttemptSessionLifecycle(deps.interviewSessionAttemptIdRef.current, 'scoring');
    deps.setStatus('scoring');
    await deps.ensureValidSession();
    const nextAttemptNumber = await resolveAttemptNumberForCompletion(
      deps.userId,
      deps.interviewSessionAttemptIdRef.current,
    );
    const msgsDeferred = finalMessages as MessageWithScenario[];
    const missingForDeferred = await prepareScenarioScoresForCompletion(deps, supabase);
    if (missingForDeferred.length === 0) {
      void remoteLog('[STANDARD] all scenario scores present after hydrate/backfill; skipping rescore', {
        attemptId: deps.interviewSessionAttemptIdRef.current,
      });
    }

    let moment4ForAggregate: ReturnType<typeof sanitizePersonalMomentScoresForAggregate> | null = null;
    let moment5ForAggregate: ReturnType<typeof sanitizeMoment5PersonalScoresForAggregate> | null = null;
    const attemptIdForIncremental = deps.interviewSessionAttemptIdRef.current;
    let scoringBaseline: AttemptScoringBaseline = {
      patterns: {},
      moment_4_concreteness: null,
      moment_5_concreteness: null,
      ego_development_level: null,
      personal_moment_emotional_vocab_low: false,
      personal_moment_emotional_vocab_density: null,
      disclosure_calibration: null,
      defense_patterns: null,
      mentalizing_overcertainty_count: 0,
    };
    if (attemptIdForIncremental && deps.userId) {
      scoringBaseline = await fetchAttemptScoringBaseline(supabase, attemptIdForIncremental, deps.userId);
      logScorePipelineBaseline(scoringBaseline);
    }
    if (apiUrl) {
      const deferredPersonalParams = {
        apiUrl,
        headers,
        msgsDeferred,
        userId: deps.userId,
        attemptIdForIncremental,
        interviewSessionAttemptId: deps.interviewSessionAttemptIdRef.current,
        scoringBaseline,
        supabase,
        deferredMoment4NarrativeRef: deps.deferredMoment4NarrativeRef,
        moment4SpecificityScoringRef: deps.moment4SpecificityScoringRef,
        moment5ClientScoringMetaRef: deps.moment5ClientScoringMetaRef,
        moment5AccountabilityProbeFiredRef: deps.moment5AccountabilityProbeFiredRef,
        probeLogRef: deps.probeLogRef,
      };
      const [m4Deferred] = await Promise.all([
        scoreStandardDeferredMoment4(deferredPersonalParams),
        missingForDeferred.length > 0
          ? rescoreMissingStandardScenarioScores(deps, msgsDeferred)
          : Promise.resolve(),
      ]);
      moment4ForAggregate = m4Deferred.moment4ForAggregate;
      scoringBaseline = m4Deferred.scoringBaseline;
      const m5Deferred = await scoreStandardDeferredMoment5({
        ...deferredPersonalParams,
        scoringBaseline,
      });
      moment5ForAggregate = m5Deferred.moment5ForAggregate;
      scoringBaseline = m5Deferred.scoringBaseline;
    } else if (missingForDeferred.length > 0) {
      await rescoreMissingStandardScenarioScores(deps, msgsDeferred);
    }

    const deferredPersist = await runStandardDeferredPersistGate({
      deps,
      supabase,
      msgsDeferred,
      finalMessages,
      moment4ForAggregate,
      moment5ForAggregate,
      scoringBaseline,
      attemptIdForIncremental,
      nextAttemptNumber,
      apiUrl,
      typologyContext,
      fetchHolisticOnceBound,
      emotionRawScoreForGate,
      emotionResponsesForGate,
    });
    standardDeferredHolisticForEgoCache = deferredPersist.standardDeferredHolisticForEgoCache;
    serverDelegateOk = deferredPersist.serverDelegateOk;
  } catch (err) {
    await remoteLog('[STANDARD] server delegate failed; using client scoring path', {
      message: err instanceof Error ? err.message : String(err),
    });
  }

  if (serverDelegateOk) {
    const attemptIdForNarrativeBackup = deps.interviewSessionAttemptIdRef.current;
    if (deps.userId && attemptIdForNarrativeBackup && listMissingAssessableScenarioScores(deps).length === 0) {
      void kickClientInterviewNarrativeIfPending(
        deps.userId,
        attemptIdForNarrativeBackup,
        'scoreInterview_standard_server_delegate',
      );
    }
    return { handled: true, standardDeferredHolisticForEgoCache };
  }

  return { handled: false, standardDeferredHolisticForEgoCache };
}
