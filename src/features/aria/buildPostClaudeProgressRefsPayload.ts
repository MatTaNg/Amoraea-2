import type { InterviewProgressRefs } from '@features/aria/interviewProgressSync';
import type { PostClaudeAssistantTurnDeps } from '@features/aria/postClaudeAssistantTurnTypes';

export function buildPostClaudeProgressRefsPayload(deps: PostClaudeAssistantTurnDeps): InterviewProgressRefs {
  return {
    interviewMomentsCompleteRef: deps.interviewMomentsCompleteRef,
    currentInterviewMomentRef: deps.currentInterviewMomentRef,
    personalHandoffInjectedRef: deps.personalHandoffInjectedRef,
  };
}
