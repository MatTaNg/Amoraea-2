import { remoteLog } from '@utilities/remoteLog';
import { clearInterviewResumeHandle } from '@features/aria/interviewResumeHandleCoordinator';

export const RESUME_LOADING_FAILSAFE_MS = 8000;

type ResumeLoadingFailsafeDeps = {
  userId?: string;
  resumeLoadingFlowActiveRef: { current: boolean };
  resumeHandleInFlightRef?: { current: boolean };
  setResumeLoadingVisible: (visible: boolean) => void;
  logSessionResumeState: (state: 'loading' | 'ready') => void;
};

export function startResumeLoadingFailsafe(
  deps: ResumeLoadingFailsafeDeps,
  timeoutMs = RESUME_LOADING_FAILSAFE_MS,
): () => void {
  const timer = setTimeout(() => {
    if (!deps.resumeLoadingFlowActiveRef.current) return;
    void remoteLog('[REENTRY_RESUME] loading_failsafe_timeout', { timeout_ms: timeoutMs });
    deps.resumeLoadingFlowActiveRef.current = false;
    if (deps.resumeHandleInFlightRef) deps.resumeHandleInFlightRef.current = false;
    clearInterviewResumeHandle(deps.userId);
    deps.setResumeLoadingVisible(false);
    deps.logSessionResumeState('ready');
  }, timeoutMs);
  return () => clearTimeout(timer);
}
