import type { MutableRefObject } from 'react';

import type { PostInterviewFeedbackKey } from '@features/aria/interviewPostInterviewFeedbackConfig';
import type { SupabaseClient } from '@supabase/supabase-js';

export type LoadPostInterviewFeedbackDeps = {
  userId: string | undefined;
  interviewStatus: string;
  analysisAttemptId: string | null;
  supabase: SupabaseClient;
  setPostInterviewRatings: React.Dispatch<
    React.SetStateAction<Record<PostInterviewFeedbackKey, number | null>>
  >;
  setPostInterviewComments: React.Dispatch<
    React.SetStateAction<Record<PostInterviewFeedbackKey, string>>
  >;
  setPostInterviewGeneralFeedback: React.Dispatch<React.SetStateAction<string>>;
  setHasSubmittedPostInterviewFeedback: React.Dispatch<React.SetStateAction<boolean>>;
};

export type LoadPostInterviewFeedbackSignal = {
  isCancelled: () => boolean;
};
