import { supabase } from '@data/supabase/client';
import {
  USER_INTERVIEW_ROUTING_TABLE,
  USER_LOGIN_ROUTING_SELECT,
} from '@data/supabase/userInterviewRoutingSelect';

import type { InterviewStackRoute } from './resolveInitialInterviewRoute';

export type UserLoginRoutingRow = {
  interview_completed?: boolean | null;
  latest_attempt_id?: string | null;
  psychometrics_completed_at?: string | null;
  market_research_completed_at?: string | null;
  interview_passed_admin_override?: boolean | null;
  interview_passed_computed?: boolean | null;
};

export type UserInterviewCompletionStatus = {
  interviewCompleted: boolean;
  psychometricsCompletedAt: string | null;
  routingRow: UserLoginRoutingRow | null;
};

/** Login / bootstrap routing read via view, falling back to `users`. */
export async function fetchUserLoginRoutingRow(userId: string): Promise<UserLoginRoutingRow | null> {
  const { data: viewRow, error: viewErr } = await supabase
    .from(USER_INTERVIEW_ROUTING_TABLE)
    .select(USER_LOGIN_ROUTING_SELECT)
    .eq('id', userId)
    .maybeSingle();

  if (!viewErr && viewRow) return viewRow as UserLoginRoutingRow;

  const { data: userRow, error: userErr } = await supabase
    .from('users')
    .select(USER_LOGIN_ROUTING_SELECT)
    .eq('id', userId)
    .maybeSingle();

  if (!userErr && userRow) return userRow as UserLoginRoutingRow;

  return (viewRow ?? userRow ?? null) as UserLoginRoutingRow | null;
}

/**
 * Interview complete when `users.interview_completed` is true, or the user's
 * `latest_attempt_id` row has `completed_at` set (same rules as post-login routing).
 */
export async function resolveInterviewCompletedForUser(
  userId: string,
  routingRow: UserLoginRoutingRow | null,
): Promise<boolean> {
  let interviewCompleted = routingRow?.interview_completed === true;
  const latestAttemptId =
    typeof routingRow?.latest_attempt_id === 'string' && routingRow.latest_attempt_id.length > 0
      ? routingRow.latest_attempt_id
      : null;

  if (!interviewCompleted && latestAttemptId) {
    const { data: attemptRow } = await supabase
      .from('interview_attempts')
      .select('completed_at')
      .eq('id', latestAttemptId)
      .eq('user_id', userId)
      .maybeSingle();

    interviewCompleted = !!attemptRow?.completed_at;
  }

  return interviewCompleted;
}

export async function fetchUserInterviewCompletionStatus(
  userId: string,
): Promise<UserInterviewCompletionStatus> {
  const routingRow = await fetchUserLoginRoutingRow(userId);
  const interviewCompleted = await resolveInterviewCompletedForUser(userId, routingRow);
  const psychometricsCompletedAt =
    typeof routingRow?.psychometrics_completed_at === 'string'
      ? routingRow.psychometrics_completed_at
      : null;

  return {
    interviewCompleted,
    psychometricsCompletedAt,
    routingRow,
  };
}

/** Most recent completed attempt by `completed_at` (not merely latest created row). */
export async function fetchMostRecentCompletedInterviewAttemptId(
  userId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('interview_attempts')
    .select('id')
    .eq('user_id', userId)
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn('[interviewCompletionStatus] fetchMostRecentCompletedInterviewAttemptId failed:', error.message);
    return null;
  }

  return typeof data?.id === 'string' ? data.id : null;
}

export type InterviewStackRouteInput = {
  psychometricsCompletedAt: string | null;
  interviewCompleted: boolean;
  postInterviewScreen?: InterviewStackRoute | null;
};

/**
 * Priority: legacy psychometrics → new-user psychometrics → interview → post-interview.
 * `legacyPsychometricsMode` is true only when interview is done and psychometrics are not.
 */
export function resolveInterviewStackScreenFromStatus(
  input: InterviewStackRouteInput,
): {
  screen: InterviewStackRoute;
  legacyPsychometricsMode: boolean;
  interviewAlreadyCompleted: boolean;
} {
  const psychometricsComplete = input.psychometricsCompletedAt != null;

  if (!psychometricsComplete) {
    const legacyPsychometricsMode = input.interviewCompleted;
    return {
      screen: 'PsychometricAssessment',
      legacyPsychometricsMode,
      interviewAlreadyCompleted: legacyPsychometricsMode,
    };
  }

  if (!input.interviewCompleted) {
    return {
      screen: 'Aria',
      legacyPsychometricsMode: false,
      interviewAlreadyCompleted: false,
    };
  }

  return {
    screen: input.postInterviewScreen ?? 'PostInterview',
    legacyPsychometricsMode: false,
    interviewAlreadyCompleted: true,
  };
}
