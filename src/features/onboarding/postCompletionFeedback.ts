import { supabase } from '@data/supabase/client';
import { fetchMostRecentCompletedInterviewAttemptId } from '@features/psychometrics/interviewCompletionStatus';

export const POST_COMPLETION_FEEDBACK_CATEGORY = 'Post-completion feedback';
export const POST_COMPLETION_FEEDBACK_PAGE_CONTEXT = 'post_completion_feedback';

export const POST_COMPLETION_FEEDBACK_INTRO_TITLE = "You're all done!";
export const POST_COMPLETION_FEEDBACK_INTRO_BODY =
  "We'd love your help making the Amoraea interview process even better for future members of the community. Please take this quick survey, all questions are completely optional and take only about 2-3 minutes.";
export const POST_COMPLETION_FEEDBACK_GIVE_LABEL = 'Give Feedback';
export const POST_COMPLETION_FEEDBACK_DECLINE_LABEL = 'Maybe later';
export const POST_COMPLETION_FEEDBACK_THANKS_TITLE = 'Thank you';
export const POST_COMPLETION_FEEDBACK_THANKS_BODY =
  'Thank you for submitting your feedback and helping Amoraea create a better interview process.';
export const POST_COMPLETION_FEEDBACK_THANKS_DONE_LABEL = 'Done';

export const POST_COMPLETION_SCENARIO_OPTIONS = [
  'Ryan & Emma - Taking a call during dinner',
  'Sarah & James - The unappreciated celebration',
  'Daniel & Sophie - Daniel leaving an argument for 30 minutes',
  'Have you ever held a grudge against a person?',
  'When is a relationship something to work through versus something to walk away from',
  'When a friend is stressed, what did you do?',
  'When you had a conflict with someone, what happened?',
] as const;

/** Question 1 only. Not shown on questions 2 or 4. */
export const POST_COMPLETION_FATIGUE_ONLY_OPTIONS = [
  'During the psychometric tests',
  'I did not feel fatigue, the length was good.',
] as const;

export const POST_COMPLETION_QUESTIONS = {
  fatigue: 'Which scenario did you begin to feel fatigue? If any?',
  redundant: 'Which scenarios, if any, did you feel were unnecessary or redundant?',
  trust:
    "After finishing the interview, how much do you trust that Amoraea's community is a pool of datable, relationship-ready individuals?",
  unclear: 'Were there any questions you did not understand or were not sure how to answer?',
  difficulty: 'How difficult was the AI interview for you?',
  missedDimensions: 'Do you feel there are any personality dimensions that we missed?',
  bugs: 'Did you find any issues or bugs while going through the interview?',
  anythingElse: 'Anything else you want us to know?',
} as const;

export type PostCompletionFeedbackEntryPoint = 'intro' | 'congrats';

export type PostCompletionMultiAnswer = {
  selected: string[];
  freeform: string;
};

export type PostCompletionFeedbackDraft = {
  fatigue: PostCompletionMultiAnswer;
  redundant: PostCompletionMultiAnswer;
  trust: number | null;
  unclear: PostCompletionMultiAnswer;
  difficulty: number | null;
  missedDimensions: string;
  bugs: string;
  anythingElse: string;
};

export type PostCompletionStoredMulti = {
  prompt: string;
  selected: string[];
  freeform: string | null;
  answered: boolean;
};

export type PostCompletionStoredScale = {
  prompt: string;
  value: number | null;
  answered: boolean;
};

export type PostCompletionStoredText = {
  prompt: string;
  text: string | null;
  answered: boolean;
};

export type PostCompletionFeedbackResponse = {
  kind: 'post_completion_v1';
  submittedAt: string;
  entryPoint: PostCompletionFeedbackEntryPoint;
  questions: {
    fatigue: PostCompletionStoredMulti;
    redundant: PostCompletionStoredMulti;
    trust: PostCompletionStoredScale;
    unclear: PostCompletionStoredMulti;
    difficulty: PostCompletionStoredScale;
    missedDimensions: PostCompletionStoredText;
    bugs: PostCompletionStoredText;
    anythingElse: PostCompletionStoredText;
  };
};

function emptyMulti(): PostCompletionMultiAnswer {
  return { selected: [], freeform: '' };
}

export function emptyPostCompletionFeedbackDraft(): PostCompletionFeedbackDraft {
  return {
    fatigue: emptyMulti(),
    redundant: emptyMulti(),
    trust: null,
    unclear: emptyMulti(),
    difficulty: null,
    missedDimensions: '',
    bugs: '',
    anythingElse: '',
  };
}

/** One choice at a time. Tapping the current choice clears it. */
export function choosePostCompletionOption(selected: string[], option: string): string[] {
  return selected.length === 1 && selected[0] === option ? [] : [option];
}

function storedMulti(prompt: string, answer: PostCompletionMultiAnswer): PostCompletionStoredMulti {
  const freeform = answer.freeform.trim();
  const selected = [...answer.selected];
  return {
    prompt,
    selected,
    freeform: freeform.length > 0 ? freeform : null,
    answered: selected.length > 0 || freeform.length > 0,
  };
}

function storedScale(prompt: string, value: number | null): PostCompletionStoredScale {
  const valid = value != null && value >= 1 && value <= 10 ? value : null;
  return { prompt, value: valid, answered: valid != null };
}

function storedText(prompt: string, raw: string): PostCompletionStoredText {
  const text = raw.trim();
  return { prompt, text: text.length > 0 ? text : null, answered: text.length > 0 };
}

export function buildPostCompletionFeedbackResponse(
  draft: PostCompletionFeedbackDraft,
  entryPoint: PostCompletionFeedbackEntryPoint,
  submittedAt: string,
): PostCompletionFeedbackResponse {
  return {
    kind: 'post_completion_v1',
    submittedAt,
    entryPoint,
    questions: {
      fatigue: storedMulti(POST_COMPLETION_QUESTIONS.fatigue, draft.fatigue),
      redundant: storedMulti(POST_COMPLETION_QUESTIONS.redundant, draft.redundant),
      trust: storedScale(POST_COMPLETION_QUESTIONS.trust, draft.trust),
      unclear: storedMulti(POST_COMPLETION_QUESTIONS.unclear, draft.unclear),
      difficulty: storedScale(POST_COMPLETION_QUESTIONS.difficulty, draft.difficulty),
      missedDimensions: storedText(POST_COMPLETION_QUESTIONS.missedDimensions, draft.missedDimensions),
      bugs: storedText(POST_COMPLETION_QUESTIONS.bugs, draft.bugs),
      anythingElse: storedText(POST_COMPLETION_QUESTIONS.anythingElse, draft.anythingElse),
    },
  };
}

function formatMulti(answer: PostCompletionStoredMulti): string {
  const parts = [...answer.selected];
  if (answer.freeform) parts.push(`Other: ${answer.freeform}`);
  return parts.length > 0 ? parts.join('; ') : '(blank)';
}

/** Readable copy for the admin feedback table, which displays `message`. */
export function formatPostCompletionFeedbackMessage(response: PostCompletionFeedbackResponse): string {
  const q = response.questions;
  return [
    `Fatigue: ${formatMulti(q.fatigue)}`,
    `Redundant: ${formatMulti(q.redundant)}`,
    `Trust: ${q.trust.answered ? q.trust.value : '(blank)'}`,
    `Unclear: ${formatMulti(q.unclear)}`,
    `Difficulty: ${q.difficulty.answered ? q.difficulty.value : '(blank)'}`,
    `Missed dimensions: ${q.missedDimensions.answered ? q.missedDimensions.text : '(blank)'}`,
    `Bugs: ${q.bugs.answered ? q.bugs.text : '(blank)'}`,
    `Anything else: ${q.anythingElse.answered ? q.anythingElse.text : '(blank)'}`,
  ].join('\n');
}

export async function fetchPostCompletionFeedbackSubmittedAt(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('users')
    .select('post_completion_feedback_submitted_at')
    .eq('id', userId)
    .maybeSingle();
  if (error) return null;
  const stamp = data?.post_completion_feedback_submitted_at;
  return typeof stamp === 'string' && stamp.length > 0 ? stamp : null;
}

const submittedListeners = new Set<() => void>();

/** Lets the congrats screen hide its button when submit happens from the intro overlay. */
export function subscribePostCompletionFeedbackSubmitted(listener: () => void): () => void {
  submittedListeners.add(listener);
  return () => {
    submittedListeners.delete(listener);
  };
}

/**
 * Persists a response and sets users.post_completion_feedback_submitted_at.
 * Call this only from an explicit Submit press. Cancel/close must not call it.
 */
export async function submitPostCompletionFeedback(params: {
  userId: string;
  entryPoint: PostCompletionFeedbackEntryPoint;
  draft: PostCompletionFeedbackDraft;
  submittedAt?: string;
}): Promise<{ error: string | null }> {
  const submittedAt = params.submittedAt ?? new Date().toISOString();
  const response = buildPostCompletionFeedbackResponse(params.draft, params.entryPoint, submittedAt);
  const attemptId = await fetchMostRecentCompletedInterviewAttemptId(params.userId);

  const { error: insertError } = await supabase.from('interview_feedback').insert({
    attempt_id: attemptId,
    user_id: params.userId,
    category: POST_COMPLETION_FEEDBACK_CATEGORY,
    message: formatPostCompletionFeedbackMessage(response),
    rating: null,
    page_context: POST_COMPLETION_FEEDBACK_PAGE_CONTEXT,
    response,
  });
  if (insertError) return { error: insertError.message };

  const { error: flagError } = await supabase
    .from('users')
    .update({ post_completion_feedback_submitted_at: submittedAt })
    .eq('id', params.userId);
  if (flagError) return { error: flagError.message };

  submittedListeners.forEach((listener) => listener());
  return { error: null };
}
