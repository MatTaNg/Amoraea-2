import { POST_INTERVIEW_FEEDBACK_QUESTIONS } from '@features/aria/interviewPostInterviewFeedbackConfig';
import type { SubmitPostInterviewFeedbackDeps } from '@features/aria/submitPostInterviewFeedbackTypes';

export async function runSubmitPostInterviewFeedback(
  deps: SubmitPostInterviewFeedbackDeps,
): Promise<void> {
  if (!deps.userId) return;
  const wasEditing = deps.hasSubmittedPostInterviewFeedback;
  const missingRating = POST_INTERVIEW_FEEDBACK_QUESTIONS.find(
    ({ id }) => deps.postInterviewRatings[id] == null,
  );
  if (missingRating) {
    const msg = 'Please provide a rating (1-10) for all three questions before submitting.';
    deps.setPostInterviewFeedbackError(msg);
    deps.showFeedbackNotice('Feedback', msg);
    return;
  }
  deps.setPostInterviewFeedbackError(null);
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
    if (!attemptId) {
      deps.showMissingAttemptAlert();
      return;
    }
    const perConstructRatings: Record<string, { rating?: number; comment?: string }> = {};
    for (const q of POST_INTERVIEW_FEEDBACK_QUESTIONS) {
      const rating = deps.postInterviewRatings[q.id];
      const comment = deps.postInterviewComments[q.id].trim();
      perConstructRatings[q.id] = {
        rating: rating ?? undefined,
        comment: comment.length > 0 ? comment : undefined,
      };
    }
    const additionalFeedback = deps.postInterviewGeneralFeedback.trim();
    if (additionalFeedback.length > 0) {
      perConstructRatings.other_feedback = { comment: additionalFeedback };
    }
    const total = POST_INTERVIEW_FEEDBACK_QUESTIONS.reduce(
      (sum, { id }) => sum + (deps.postInterviewRatings[id] ?? 0),
      0,
    );
    const overallRating = Math.round(total / POST_INTERVIEW_FEEDBACK_QUESTIONS.length);
    const { error } = await deps.supabase
      .from('interview_attempts')
      .update({
        user_analysis_rating: overallRating,
        user_analysis_comment: additionalFeedback.length > 0 ? additionalFeedback : null,
        per_construct_ratings: perConstructRatings,
        user_analysis_submitted_at: new Date().toISOString(),
      })
      .eq('id', attemptId);
    if (error) throw new Error(error.message);
    deps.setPostInterviewFeedbackError(null);
    deps.setHasSubmittedPostInterviewFeedback(true);
    deps.setShowPostInterviewFeedback(false);
    deps.showFeedbackNotice(
      'Thank you',
      wasEditing ? 'Your feedback was updated.' : 'Your feedback was submitted.',
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Could not submit feedback.';
    deps.showFeedbackNotice('Feedback error', msg);
  }
}
