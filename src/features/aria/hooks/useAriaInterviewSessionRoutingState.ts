import { useRef, useState } from 'react';

import { usePreparingHandoffPollTick } from '@features/aria/hooks/usePreparingHandoffPollTick';

import type { AriaInterviewScreenSessionRoutingState } from './ariaInterviewScreenSessionStateTypes';

export type UseAriaInterviewSessionRoutingStateParams = {
  routeName?: string;
  fromValidationTrack: boolean;
  interviewStatus:
    | 'loading'
    | 'not_started'
    | 'in_progress'
    | 'preparing_results'
    | 'under_review'
    | 'congratulations'
    | 'analysis';
};

export function useAriaInterviewSessionRoutingState(
  params: UseAriaInterviewSessionRoutingStateParams,
): AriaInterviewScreenSessionRoutingState {
  const { routeName, fromValidationTrack, interviewStatus } = params;

  const isInterviewAppRoute =
    routeName === 'Amoraea' ||
    routeName === 'OnboardingInterview' ||
    routeName === 'ValidationAmoraea' ||
    fromValidationTrack;
  const resumeLoadingFlowActiveRef = useRef(false);
  const resumeHandleInFlightRef = useRef(false);
  const [resumeLoadingVisible, setResumeLoadingVisible] = useState(() => isInterviewAppRoute);
  /** Blocks "Before you begin" until local resume vs fresh-start routing has finished. */
  const [resumeHydrationPending, setResumeHydrationPending] = useState(() => isInterviewAppRoute);
  const preparingHandoffPollTick = usePreparingHandoffPollTick(interviewStatus);

  return {
    isInterviewAppRoute,
    resumeLoadingFlowActiveRef,
    resumeHandleInFlightRef,
    resumeLoadingVisible,
    setResumeLoadingVisible,
    resumeHydrationPending,
    setResumeHydrationPending,
    preparingHandoffPollTick,
  };
}
