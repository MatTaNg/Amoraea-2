import { useEffect } from 'react';
import { Platform } from 'react-native';

import type { InterviewWebSpeechRecognitionDeps } from '@features/aria/interviewWebSpeechRecognitionTypes';
import { runInstallInterviewWebSpeechRecognition } from '@features/aria/runInstallInterviewWebSpeechRecognition';

export function useInterviewWebSpeechRecognition(
  depsRef: React.MutableRefObject<InterviewWebSpeechRecognitionDeps>,
  useMediaRecorderPath: boolean,
): void {
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const cleanup = runInstallInterviewWebSpeechRecognition(depsRef.current);
    return cleanup;
  }, [depsRef, useMediaRecorderPath]);
}
