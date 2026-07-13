import { useEffect } from 'react';

import type { InterviewScrollToEndDeps } from '@features/aria/referenceCardFromAssistantSpeechTypes';

export function useInterviewScrollToEndOnMessages(
  depsRef: React.MutableRefObject<InterviewScrollToEndDeps>,
  trigger: { messages: unknown; status: unknown },
): void {
  useEffect(() => {
    depsRef.current.scrollViewRef?.current?.scrollToEnd?.({ animated: true });
  }, [depsRef, trigger.messages, trigger.status]);
}
