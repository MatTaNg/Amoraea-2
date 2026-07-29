import { Platform } from 'react-native';

import type { InterviewMicLifecycleDeps } from '@features/aria/hooks/interviewMicLifecycleTypes';

/** Re-probe mic route and reset native audio after foreground or navigation return. */
export async function runRecoverInterviewMicAfterForeground(
  deps: InterviewMicLifecycleDeps,
): Promise<void> {
  if (Platform.OS === 'web') return;
  if (deps.interviewStatusRef.current !== 'in_progress') return;
  deps.setMicSessionRecovering(true);
  try {
    const ok = await deps.audioRecorder.reinitializeMicrophoneSession();
    if (!ok) deps.setMicNeedsReconnect(true);
    else deps.setMicNeedsReconnect(false);
    if (deps.userIdRef.current) {
      await deps.applyRouteProbeAfterResume('app_resume');
    }
  } finally {
    deps.setMicSessionRecovering(false);
  }
}
