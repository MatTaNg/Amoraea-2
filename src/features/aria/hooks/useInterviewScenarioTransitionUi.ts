import { useEffect } from 'react';

import {
  runClearReferenceCardOnScenarioTransition,
  runResetInterviewUiPhaseWhenInactive,
  type InterviewScenarioTransitionUiDeps,
} from '@features/aria/interviewActivePersistenceTypes';
import { runRestoreReferenceCardFromTranscriptIfNeeded } from '@features/aria/interviewReferenceCardResumeHelpers';

export function useInterviewScenarioTransitionUi(
  depsRef: React.MutableRefObject<InterviewScenarioTransitionUiDeps>,
  trigger: {
    status: string;
    isAdmin: boolean;
    messages: InterviewScenarioTransitionUiDeps['messages'];
  },
): void {
  useEffect(() => {
    runClearReferenceCardOnScenarioTransition(depsRef.current, {
      status: trigger.status,
      isAdmin: trigger.isAdmin,
      messageCount: trigger.messages.length,
    });
    runRestoreReferenceCardFromTranscriptIfNeeded(depsRef.current);
  }, [depsRef, trigger.status, trigger.isAdmin, trigger.messages]);

  useEffect(() => {
    runResetInterviewUiPhaseWhenInactive(depsRef.current, trigger);
  }, [depsRef, trigger.status, trigger.isAdmin]);
}
