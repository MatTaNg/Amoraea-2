import { supabase } from '@data/supabase/client';

import {

  USER_INTERVIEW_ROUTING_TABLE,

  USER_LOGIN_ROUTING_SELECT,

} from '@data/supabase/userInterviewRoutingSelect';

import { fetchInterviewAttemptRevealSnapshot } from '@utilities/fetchInterviewAttemptRevealSnapshot';

import { determinePostInterviewRoute } from '@features/psychometrics/determinePostInterviewRoute';



export type InterviewStackRoute =

  | 'PsychometricAssessment'

  | 'Aria'

  | 'PostInterview'

  | 'PostInterviewProcessing'

  | 'PostInterviewPassed'

  | 'PostInterviewFailed'

  | 'PostInterviewSexualCommunication';



export type InitialInterviewRouteResult = {

  screen: InterviewStackRoute;

  interviewAlreadyCompleted: boolean;

  needsMarketResearch: boolean;

  interviewPassedAdminOverride?: boolean | null;

  interviewPassedComputed?: boolean | null;

};



/** Login / bootstrap routing read via view, falling back to `users`. */

async function fetchUserLoginRoutingRow(userId: string) {

  const { data: viewRow, error: viewErr } = await supabase

    .from(USER_INTERVIEW_ROUTING_TABLE)

    .select(USER_LOGIN_ROUTING_SELECT)

    .eq('id', userId)

    .maybeSingle();

  if (!viewErr && viewRow) return viewRow;

  const { data: userRow, error: userErr } = await supabase

    .from('users')

    .select(USER_LOGIN_ROUTING_SELECT)

    .eq('id', userId)

    .maybeSingle();

  if (!userErr && userRow) return userRow;

  return viewRow ?? userRow ?? null;

}



/**

 * Decides the first screen after login for the interview stack.

 * Market research (root overlay) → psychometrics → interview / post-interview.

 */

export async function resolveInitialInterviewRoute(userId: string): Promise<InitialInterviewRouteResult> {

  const data = await fetchUserLoginRoutingRow(userId);



  let interviewCompleted = data?.interview_completed === true;

  const latestAttemptId =

    typeof data?.latest_attempt_id === 'string' && data.latest_attempt_id.length > 0

      ? data.latest_attempt_id

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



  const needsMarketResearch = data != null && data.market_research_completed_at == null;



  if (!data?.psychometrics_completed_at) {

    return {

      screen: 'PsychometricAssessment',

      interviewAlreadyCompleted: interviewCompleted,

      needsMarketResearch,

      interviewPassedAdminOverride: data?.interview_passed_admin_override ?? null,

      interviewPassedComputed: data?.interview_passed_computed ?? null,

    };

  }



  if (!interviewCompleted) {

    return {

      screen: 'Aria',

      interviewAlreadyCompleted: false,

      needsMarketResearch,

      interviewPassedAdminOverride: data?.interview_passed_admin_override ?? null,

      interviewPassedComputed: data?.interview_passed_computed ?? null,

    };

  }



  const snapshot = await fetchInterviewAttemptRevealSnapshot(userId);
  const decision = determinePostInterviewRoute(snapshot);

  return {
    screen: decision.route,
    interviewAlreadyCompleted: true,
    needsMarketResearch,
    interviewPassedAdminOverride: data.interview_passed_admin_override ?? null,
    interviewPassedComputed: data.interview_passed_computed ?? null,
  };

}

