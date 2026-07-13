import { useState } from 'react';

import type { PostInterviewFeedbackKey } from '@features/aria/interviewPostInterviewFeedbackConfig';
import type { AriaInterviewScreenRouterScope } from '@features/aria/buildAriaInterviewScreenRouterProps';

const EMPTY_POST_INTERVIEW_RATINGS: Record<PostInterviewFeedbackKey, number | null> = {
  conversation_quality: null,
  clarity_flow: null,
  trust_accuracy: null,
};

const EMPTY_POST_INTERVIEW_COMMENTS: Record<PostInterviewFeedbackKey, string> = {
  conversation_quality: '',
  clarity_flow: '',
  trust_accuracy: '',
};

export type AriaPostInterviewFeedbackState = {
  showPostInterviewFeedback: boolean;
  postInterviewRatings: Record<PostInterviewFeedbackKey, number | null>;
  postInterviewComments: Record<PostInterviewFeedbackKey, string>;
  postInterviewGeneralFeedback: string;
  postInterviewFeedbackError: string | null;
  hasSubmittedPostInterviewFeedback: boolean;
  setShowPostInterviewFeedback: React.Dispatch<React.SetStateAction<boolean>>;
  setPostInterviewRatings: React.Dispatch<
    React.SetStateAction<Record<PostInterviewFeedbackKey, number | null>>
  >;
  setPostInterviewComments: React.Dispatch<
    React.SetStateAction<Record<PostInterviewFeedbackKey, string>>
  >;
  setPostInterviewGeneralFeedback: React.Dispatch<React.SetStateAction<string>>;
  setPostInterviewFeedbackError: React.Dispatch<React.SetStateAction<string | null>>;
  setHasSubmittedPostInterviewFeedback: React.Dispatch<React.SetStateAction<boolean>>;
};

export function useAriaPostInterviewFeedbackState(): AriaPostInterviewFeedbackState {
  const [showPostInterviewFeedback, setShowPostInterviewFeedback] = useState(false);
  const [postInterviewRatings, setPostInterviewRatings] = useState(EMPTY_POST_INTERVIEW_RATINGS);
  const [postInterviewComments, setPostInterviewComments] = useState(EMPTY_POST_INTERVIEW_COMMENTS);
  const [postInterviewGeneralFeedback, setPostInterviewGeneralFeedback] = useState('');
  const [postInterviewFeedbackError, setPostInterviewFeedbackError] = useState<string | null>(null);
  const [hasSubmittedPostInterviewFeedback, setHasSubmittedPostInterviewFeedback] = useState(false);

  return {
    showPostInterviewFeedback,
    postInterviewRatings,
    postInterviewComments,
    postInterviewGeneralFeedback,
    postInterviewFeedbackError,
    hasSubmittedPostInterviewFeedback,
    setShowPostInterviewFeedback,
    setPostInterviewRatings,
    setPostInterviewComments,
    setPostInterviewGeneralFeedback,
    setPostInterviewFeedbackError,
    setHasSubmittedPostInterviewFeedback,
  };
}

export function toAriaInterviewScreenRouterPostInterviewFeedbackScope(
  state: AriaPostInterviewFeedbackState,
  handlers: Pick<
    AriaInterviewScreenRouterScope['postInterviewFeedback'],
    'handleSubmitPostInterviewFeedback' | 'handleBackToValidationReport'
  >,
): AriaInterviewScreenRouterScope['postInterviewFeedback'] {
  return {
    hasSubmittedPostInterviewFeedback: state.hasSubmittedPostInterviewFeedback,
    showPostInterviewFeedback: state.showPostInterviewFeedback,
    postInterviewFeedbackError: state.postInterviewFeedbackError,
    postInterviewRatings: state.postInterviewRatings,
    postInterviewComments: state.postInterviewComments,
    postInterviewGeneralFeedback: state.postInterviewGeneralFeedback,
    setPostInterviewFeedbackError: state.setPostInterviewFeedbackError,
    setShowPostInterviewFeedback: state.setShowPostInterviewFeedback,
    setPostInterviewRatings: state.setPostInterviewRatings,
    setPostInterviewComments: state.setPostInterviewComments,
    setPostInterviewGeneralFeedback: state.setPostInterviewGeneralFeedback,
    handleSubmitPostInterviewFeedback: handlers.handleSubmitPostInterviewFeedback,
    handleBackToValidationReport: handlers.handleBackToValidationReport,
  };
}
