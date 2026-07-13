import type { PostInterviewFeedbackKey } from '@features/aria/interviewPostInterviewFeedbackConfig';
import type { SupabaseClient } from '@supabase/supabase-js';

export type SubmitPostInterviewFeedbackDeps = {
  userId: string | undefined;
  hasSubmittedPostInterviewFeedback: boolean;
  analysisAttemptId: string | null;
  postInterviewRatings: Record<PostInterviewFeedbackKey, number | null>;
  postInterviewComments: Record<PostInterviewFeedbackKey, string>;
  postInterviewGeneralFeedback: string;
  supabase: SupabaseClient;
  setPostInterviewFeedbackError: React.Dispatch<React.SetStateAction<string | null>>;
  setHasSubmittedPostInterviewFeedback: React.Dispatch<React.SetStateAction<boolean>>;
  setShowPostInterviewFeedback: React.Dispatch<React.SetStateAction<boolean>>;
  showFeedbackNotice: (title: string, message: string) => void;
  showMissingAttemptAlert: () => void;
};
