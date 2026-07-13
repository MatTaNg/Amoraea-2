import { assistantMessageForRecordingHardwareFailure } from '@features/aria/interviewUserFacingErrors';
import type { HandleRecordingErrorDeps } from '@features/aria/handleRecordingErrorTypes';

export function runHandleRecordingError(deps: HandleRecordingErrorDeps, err: Error): void {
  if (__DEV__) console.error('Recording error:', err.message);
  deps.setVoiceState('idle');
  const msg = assistantMessageForRecordingHardwareFailure(deps.useWebCopy);
  deps.setMessages((prev) => [...prev, { role: 'assistant', content: msg }]);
  deps.speakTextSafe(msg).catch(() => {});
}
