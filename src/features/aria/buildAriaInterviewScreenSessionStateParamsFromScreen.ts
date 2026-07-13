import type { useAriaInterviewSession } from '@features/aria/hooks/useAriaInterviewSession';
import type { UseAriaInterviewScreenSessionStateParams } from '@features/aria/hooks/useAriaInterviewScreenSessionState';

export type BuildAriaInterviewScreenSessionStateParamsFromScreenInput = {
  userId: string;
  routeName?: string;
  fromValidationTrack: boolean;
  interview: ReturnType<typeof useAriaInterviewSession>;
};

/** Assemble `useAriaInterviewScreenSessionState` params from screen route + interview hook. */
export function buildAriaInterviewScreenSessionStateParamsFromScreen(
  input: BuildAriaInterviewScreenSessionStateParamsFromScreenInput,
): UseAriaInterviewScreenSessionStateParams {
  const { userId, routeName, fromValidationTrack, interview } = input;
  return {
    userId,
    routeName,
    fromValidationTrack,
    status: interview.status,
    setMessages: interview.setMessages,
  };
}
