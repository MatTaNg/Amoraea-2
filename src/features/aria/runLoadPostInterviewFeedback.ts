import {
  POST_INTERVIEW_FEEDBACK_QUESTIONS,
  type PostInterviewFeedbackKey,
} from '@features/aria/interviewPostInterviewFeedbackConfig';
import { parseJsonObject } from '@features/aria/interviewSessionUtilities';
import type {
  LoadPostInterviewFeedbackDeps,
  LoadPostInterviewFeedbackSignal,
} from '@features/aria/loadPostInterviewFeedbackTypes';

export async function runLoadPostInterviewFeedback(
  deps: LoadPostInterviewFeedbackDeps,
  signal: LoadPostInterviewFeedbackSignal,
): Promise<void> {
  if (
    !deps.userId ||
    !(deps.interviewStatus === 'under_review' || deps.interviewStatus === 'congratulations')
  ) {
    return;
  }
  try {
    let attemptId = deps.analysisAttemptId;
    if (!attemptId) {
      const { data: userData } = await deps.supabase
        .from('users')
        .select('latest_attempt_id')
        .eq('id', deps.userId)
        .maybeSingle();
      attemptId = (userData?.latest_attempt_id as string | null | undefined) ?? null;
    }
    if (!attemptId || signal.isCancelled()) {
      if (!signal.isCancelled()) {
        deps.setHasSubmittedPostInterviewFeedback(false);
      }
      return;
    }
    const { data } = await deps.supabase
      .from('interview_attempts')
      .select('user_analysis_comment, per_construct_ratings')
      .eq('id', attemptId)
      .maybeSingle();
    if (signal.isCancelled() || !data) return;

    const per = parseJsonObject(data.per_construct_ratings) ?? {};
    const nextRatings: Record<PostInterviewFeedbackKey, number | null> = {
      conversation_quality: null,
      clarity_flow: null,
      trust_accuracy: null,
    };
    const nextComments: Record<PostInterviewFeedbackKey, string> = {
      conversation_quality: '',
      clarity_flow: '',
      trust_accuracy: '',
    };

    for (const q of POST_INTERVIEW_FEEDBACK_QUESTIONS) {
      const row = parseJsonObject(per[q.id]);
      const rawRating = row?.rating;
      const n = typeof rawRating === 'number' ? rawRating : Number(rawRating);
      nextRatings[q.id] = Number.isFinite(n) ? Math.min(10, Math.max(1, Math.round(n))) : null;
      nextComments[q.id] = typeof row?.comment === 'string' ? row.comment : '';
    }

    const other = parseJsonObject(per.other_feedback);
    const otherComment = typeof other?.comment === 'string' ? other.comment : '';
    const overallComment =
      typeof data.user_analysis_comment === 'string' ? data.user_analysis_comment : '';

    deps.setPostInterviewRatings(nextRatings);
    deps.setPostInterviewComments(nextComments);
    deps.setPostInterviewGeneralFeedback(otherComment || overallComment);
    deps.setHasSubmittedPostInterviewFeedback(
      POST_INTERVIEW_FEEDBACK_QUESTIONS.every(({ id }) => nextRatings[id] != null),
    );
  } catch {
    if (!signal.isCancelled()) {
      deps.setHasSubmittedPostInterviewFeedback(false);
    }
  }
}
