/** Labels stored in `interview_feedback.category`. */
export const FEEDBACK_CATEGORIES = [
  'Something broke',
  'Suggestion',
  'Feature request',
  'Compliment',
  'Other',
] as const;

export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number];

export const FEEDBACK_CATEGORY_BUG = 'Something broke' as const;
export const FEEDBACK_CATEGORY_SUGGESTION = 'Suggestion' as const;
export const FEEDBACK_CATEGORY_FEATURE_REQUEST = 'Feature request' as const;
export const FEEDBACK_CATEGORY_COMPLIMENT = 'Compliment' as const;
export const FEEDBACK_CATEGORY_OTHER = 'Other' as const;
