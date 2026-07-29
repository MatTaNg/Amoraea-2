import { isAmoraeaAdminConsoleEmail } from '@/constants/adminConsole';
import { supabase } from '@data/supabase/client';
import {
  USER_INTERVIEW_PASS_SELECT,
  USER_INTERVIEW_ROUTING_TABLE,
} from '@data/supabase/userInterviewRoutingSelect';
import {
  markPsychometricsInterviewHandoffIssued,
  wasPsychometricsInterviewHandoffIssued,
} from '@features/aria/completionScoringKick';
import {
  buildEmotionRecognitionPersistPayload,
  hydrateEmotionResponsesFromSources,
  isEmotionRecognitionBatteryComplete,
} from '@features/aria/emotionRecognitionInterview';
import { clearPreparingResultsSession } from '@features/aria/interviewLocalPersistence';
import { triggerAsyncAiReasoningPipeline } from '@features/onboarding/triggerAsyncAiReasoningPipeline';
import { standardApplicantPostInterviewDestination } from '@features/onboarding/postInterviewLaunchMode';
import { PSYCHOMETRICS_ENABLED, fetchMostRecentCompletedInterviewAttemptId } from '@features/psychometrics/interviewCompletionStatus';
import {
  isValidationTrackInterviewHandoffActive,
  VALIDATION_POST_INTERVIEW_HANDOFF_ROUTE,
} from '@features/relationshipValidation/validationPostInterviewRouting';
import {
  fetchInterviewPassAdminOverride,
  interviewPassWhileScoringPending,
} from '@utilities/interviewPassEffective';
import { remoteLog } from '@utilities/remoteLog';
import { clearInterviewFromStorage, loadInterviewFromStorage } from '@utilities/storage/InterviewStorage';

export function tryHandOffToPsychometricsCongratulations(
  navigation: { replace: (name: string, params: { userId: string }) => void },
  userId: string,
  meta?: { interviewSessionId?: string | null; source?: string; attemptId?: string | null },
): boolean {
  if (!PSYCHOMETRICS_ENABLED) return false;
  replaceWithStandardApplicantPostInterviewHandoffForUser(navigation, userId, meta);
  return wasPsychometricsInterviewHandoffIssued();
}

export function replaceWithStandardApplicantPostInterviewHandoffForUser(
  navigation: { replace: (name: string, params: { userId: string }) => void },
  userId: string,
  meta?: { interviewSessionId?: string | null; source?: string; attemptId?: string | null }
) {
  if (isValidationTrackInterviewHandoffActive()) {
    void remoteLog('[RESULTS_SCREEN_TRANSITION]', {
      destination: VALIDATION_POST_INTERVIEW_HANDOFF_ROUTE,
      userId,
      interviewSessionId: meta?.interviewSessionId ?? null,
      source: meta?.source ?? 'validation_track_handoff',
      attemptId: meta?.attemptId ?? null,
    });
    navigation.replace(VALIDATION_POST_INTERVIEW_HANDOFF_ROUTE, { userId });
    return;
  }
  if (PSYCHOMETRICS_ENABLED) {
    const duplicateHandoff = wasPsychometricsInterviewHandoffIssued();
    if (!duplicateHandoff) {
      markPsychometricsInterviewHandoffIssued();
      const attemptId = meta?.attemptId;
      if (typeof attemptId === 'string' && attemptId.length > 0) {
        triggerAsyncAiReasoningPipeline(userId, attemptId);
      } else {
        void fetchMostRecentCompletedInterviewAttemptId(userId).then((resolvedId) => {
          if (resolvedId) triggerAsyncAiReasoningPipeline(userId, resolvedId);
        });
      }
    }
    void remoteLog('[RESULTS_SCREEN_TRANSITION]', {
      destination: 'InterviewComplete',
      skipped_duplicate: duplicateHandoff,
      userId,
      interviewSessionId: meta?.interviewSessionId ?? null,
      source: meta?.source ?? 'standard_handoff_psychometrics_enabled',
      attemptId: meta?.attemptId ?? null,
    });
    navigation.replace('InterviewComplete', { userId });
    return;
  }
  void remoteLog('[RESULTS_SCREEN_TRANSITION]', {
    destination: standardApplicantPostInterviewDestination(),
    userId,
    interviewSessionId: meta?.interviewSessionId ?? null,
    source: meta?.source ?? 'standard_handoff',
  });
  navigation.replace(standardApplicantPostInterviewDestination(), { userId });
}

/** Same cohort as `checkInterviewStatus` → PostInterview (not admin). */
export async function resolveStandardPostInterviewHandoffEligible(
  userId: string,
  opts: { isInterviewAppRoute: boolean; sessionEmail: string | null; profileEmail?: string | null }
): Promise<{
  shouldHandOff: boolean;
  interviewDoneForRouting: boolean;
  latestAttemptId: string | null;
}> {
  const { data } = await supabase
    .from(USER_INTERVIEW_ROUTING_TABLE)
    .select(USER_INTERVIEW_PASS_SELECT)
    .eq('id', userId)
    .maybeSingle();
  const latestAttemptId =
    typeof data?.latest_attempt_id === 'string' && data.latest_attempt_id.length > 0
      ? data.latest_attempt_id
      : null;
  let interviewDoneForRouting = data?.interview_completed === true;
  if (!interviewDoneForRouting && latestAttemptId) {
    const { data: latestAttemptMeta } = await supabase
      .from('interview_attempts')
      .select('completed_at')
      .eq('id', latestAttemptId)
      .eq('user_id', userId)
      .maybeSingle();
    interviewDoneForRouting = !!latestAttemptMeta?.completed_at;
  }
  const isAdminEmail = isAmoraeaAdminConsoleEmail(opts.sessionEmail ?? opts.profileEmail);
  const shouldHandOff = opts.isInterviewAppRoute && interviewDoneForRouting && !isAdminEmail;
  return { shouldHandOff, interviewDoneForRouting, latestAttemptId };
}

/** Standard onboarding cohort (not admin) — used when profile may be unavailable in effects. */
export async function resolveStandardApplicantCohort(
  userId: string,
  opts: { isInterviewAppRoute: boolean; sessionEmail: string | null; profileEmail?: string | null }
): Promise<boolean> {
  if (!opts.isInterviewAppRoute) return false;
  return !isAmoraeaAdminConsoleEmail(opts.sessionEmail ?? opts.profileEmail);
}

/**
 * Client scoring hung (e.g. M4 proxy) — commit routing + delegate to edge, then PostInterview processing.
 */
export async function recoverStuckPreparingResultsForStandardUser(
  navigation: { replace: (name: string, params: { userId: string }) => void },
  userId: string,
  attemptId: string,
  opts: { interviewSessionId?: string | null; source: string; gateOkForInterviewPassed?: boolean }
): Promise<void> {
  await remoteLog('[WARN] preparing_results_force_recovery', {
    userId,
    attemptId,
    source: opts.source,
  });
  const saved = await loadInterviewFromStorage(userId);
  const { data: attemptEmotionRow } = await supabase
    .from('interview_attempts')
    .select('emotion_recognition_responses')
    .eq('id', attemptId)
    .eq('user_id', userId)
    .maybeSingle();
  const hydratedEmotion = hydrateEmotionResponsesFromSources(
    saved?.emotionItemResponses,
    attemptEmotionRow?.emotion_recognition_responses,
  );
  if (isEmotionRecognitionBatteryComplete(hydratedEmotion)) {
    const emotionPayload = buildEmotionRecognitionPersistPayload(hydratedEmotion);
    await supabase.from('interview_attempts').update(emotionPayload).eq('id', attemptId).eq('user_id', userId);
  }
  await supabase
    .from('interview_attempts')
    .update({ scoring_deferred: true, completed_at: new Date().toISOString() })
    .eq('id', attemptId)
    .eq('user_id', userId);
  try {
    await supabase.functions.invoke('complete-standard-interview', { body: { attempt_id: attemptId } });
  } catch {
    /* edge may still run via cron; navigation must not block on invoke */
  }
  const passOverride = await fetchInterviewPassAdminOverride(supabase, userId);
  const { data: attMeta } = await supabase
    .from('interview_attempts')
    .select('attempt_number')
    .eq('id', attemptId)
    .eq('user_id', userId)
    .maybeSingle();
  const attemptCount =
    typeof attMeta?.attempt_number === 'number' && Number.isFinite(attMeta.attempt_number)
      ? attMeta.attempt_number
      : 1;
  const gateOk = opts.gateOkForInterviewPassed === true;
  await supabase
    .from('users')
    .update({
      interview_completed: true,
      interview_passed: gateOk ? interviewPassWhileScoringPending(passOverride) : false,
      interview_passed_computed: null,
      interview_completed_at: new Date().toISOString(),
      interview_attempt_count: attemptCount,
      latest_attempt_id: attemptId,
    })
    .eq('id', userId);
  clearPreparingResultsSession(userId);
  await clearInterviewFromStorage(userId);
  replaceWithStandardApplicantPostInterviewHandoffForUser(navigation, userId, {
    interviewSessionId: opts.interviewSessionId ?? null,
    source: opts.source,
    attemptId,
  });
}
