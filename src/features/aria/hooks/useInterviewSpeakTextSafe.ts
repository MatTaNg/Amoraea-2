import { useCallback } from 'react';

import { runSpeakTextSafe } from '@features/aria/runSpeakTextSafe';
import type { SpeakTextSafeDeps, SpeakTextSafeOptions } from '@features/aria/speakTextSafeDeps';

export function useInterviewSpeakTextSafe(depsRef: React.MutableRefObject<SpeakTextSafeDeps>) {
  const speakTextSafe = useCallback(async (text: string, options: SpeakTextSafeOptions = {}) => {
    await runSpeakTextSafe(depsRef.current, text, options);
  }, []);

  return { speakTextSafe };
}
