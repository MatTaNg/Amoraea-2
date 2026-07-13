import { useEffect } from 'react';

import {
  runSaveActiveInterviewProgress,
  type SaveActiveInterviewProgressDeps,
} from '@features/aria/interviewActivePersistenceTypes';

export function useSaveActiveInterviewProgress(
  depsRef: React.MutableRefObject<SaveActiveInterviewProgressDeps>,
  trigger: {
    userId: string | undefined;
    isAdmin: boolean;
    status: string;
    pendingCompletion: boolean;
    messages: SaveActiveInterviewProgressDeps['messages'];
    scenarioScores: SaveActiveInterviewProgressDeps['scenarioScores'];
  },
): void {
  useEffect(() => {
    runSaveActiveInterviewProgress(depsRef.current, {
      userId: trigger.userId,
      isAdmin: trigger.isAdmin,
      status: trigger.status,
      messageCount: trigger.messages.length,
      pendingCompletion: trigger.pendingCompletion,
    });
  }, [
    depsRef,
    trigger.userId,
    trigger.isAdmin,
    trigger.status,
    trigger.pendingCompletion,
    trigger.messages,
    trigger.scenarioScores,
  ]);
}
