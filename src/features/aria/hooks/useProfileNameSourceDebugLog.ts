import { useEffect } from 'react';

import type { InterviewFirstNameProfile } from '@features/aria/interviewerFrameworkPrompt';
import { runLogProfileNameSourceDebug } from '@features/aria/runLogProfileNameSourceDebug';
import type { ProfileNameSourceDebugDeps } from '@features/aria/referenceCardFromAssistantSpeechTypes';

export function useProfileNameSourceDebugLog(
  depsRef: React.MutableRefObject<ProfileNameSourceDebugDeps>,
  trigger: { userId: string | undefined; profile: InterviewFirstNameProfile },
): void {
  useEffect(() => {
    runLogProfileNameSourceDebug(depsRef.current, trigger);
  }, [depsRef, trigger.userId, trigger.profile]);
}
