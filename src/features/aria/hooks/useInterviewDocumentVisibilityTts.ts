import { useEffect } from 'react';
import { Platform } from 'react-native';

import type { InterviewDocumentVisibilityTtsDeps } from '@features/aria/interviewDocumentVisibilityTtsTypes';
import { runHandleInterviewDocumentVisible } from '@features/aria/runHandleInterviewDocumentVisible';

export function useInterviewDocumentVisibilityTts(
  depsRef: React.MutableRefObject<InterviewDocumentVisibilityTtsDeps>,
): void {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const onDocumentHidden = () => {
      const deps = depsRef.current;
      if (deps.docVisibilityWasHiddenRef) {
        deps.docVisibilityWasHiddenRef.current = true;
      }
      deps.interruptInterviewTtsForDocumentHidden?.();
    };
    const onDocumentVisible = () => {
      runHandleInterviewDocumentVisible(depsRef.current);
    };
    const onVis = () => {
      if (document.visibilityState === 'hidden') {
        onDocumentHidden();
      } else {
        onDocumentVisible();
      }
    };
    const onWindowBlur = () => {
      if (document.visibilityState === 'hidden') {
        onDocumentHidden();
      }
    };
    /**
     * Capture phase runs before the bubble listener in {@link attachWebInterviewAudioVisibilityHandler}
     * so tab-hide interrupt can snapshot the in-flight utterance before PCM/HTML teardown clears refs.
     */
    document.addEventListener('visibilitychange', onVis, true);
    window.addEventListener('blur', onWindowBlur);
    return () => {
      document.removeEventListener('visibilitychange', onVis, true);
      window.removeEventListener('blur', onWindowBlur);
    };
  }, [depsRef]);
}
