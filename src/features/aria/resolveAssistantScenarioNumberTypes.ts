import type { MutableRefObject } from 'react';

import type { MessageWithScenario } from '@features/aria/interviewScenarioScoringSlice';
import type { InterviewMomentIndex } from '@features/aria/interviewScenarioScoringSlice';

export type ResolveAssistantScenarioNumberDeps = {
  currentInterviewMomentRef: MutableRefObject<InterviewMomentIndex>;
  currentScenarioRef: MutableRefObject<1 | 2 | 3>;
  detectScenarioFromResponse: (content: string) => 1 | 2 | 3 | null | undefined;
  isScenarioCQ1Prompt: (content: string) => boolean;
  getScenarioNumberForNewMessage: (
    prev: MessageWithScenario[],
    role: 'user' | 'assistant',
    content?: string,
  ) => number;
};
