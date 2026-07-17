import { Platform } from 'react-native';

import { applyInterviewStartUnavailableFailure } from '@features/aria/applyInterviewStartUnavailableFailure';
import { deliverInterviewOpeningGreeting } from '@features/aria/deliverInterviewOpeningGreeting';
import { isGreetingOnly } from '@features/aria/interviewLocalPersistence';
import { runHandleResume } from '@features/aria/runHandleResume';
import { runInterviewSessionStartLogging } from '@features/aria/runInterviewSessionStartLogging';
import type {
  HandleResumeDeps,
  StartInterviewDeps,
  StartInterviewParams,
} from '@features/aria/sessionLifecycleTypes';
import { remoteLog } from '@utilities/remoteLog';
import { clearInterviewFromStorage, loadInterviewFromStorage } from '@utilities/storage/InterviewStorage';
import { shouldResumeMidInterviewFromSaved } from '@utilities/interviewResumeCursor';

export async function runStartInterview(
  deps: StartInterviewDeps,
  params?: StartInterviewParams,
): Promise<void> {
  const {
    userId,
    isAdmin,
    interviewAttemptBootstrap,
    speakTextSafe,
    notifyScenarioStarted,
    currentScenarioRef,
    startInterviewInFlightRef,
    setInterviewStartInFlight,
    hasResumedRef,
    resumeLoadingFlowActiveRef,
    interviewStatusRef,
    interruptAllInterviewTtsOutput,
    setVoiceState,
    setMicError,
    setStatus,
    setInterviewStatus,
    setMessages,
    currentMessagesRef,
  } = deps;

  if (startInterviewInFlightRef.current) {
    void remoteLog('[START] skipped duplicate in_flight');
    return;
  }
  if (resumeLoadingFlowActiveRef.current) {
    void remoteLog('[START] skipped resume_loading_in_flight');
    return;
  }
  const hydratedMidInterviewInMemory =
    currentMessagesRef.current.length > 0 && !isGreetingOnly(currentMessagesRef.current);
  if (
    hasResumedRef.current &&
    (interviewStatusRef.current === 'in_progress' || hydratedMidInterviewInMemory)
  ) {
    void remoteLog('[START] skipped already resume_hydrated', {
      interviewStatus: interviewStatusRef.current,
      messageCount: currentMessagesRef.current.length,
    });
    return;
  }
  if (hasResumedRef.current && interviewStatusRef.current !== 'not_started') {
    void remoteLog('[START] skipped resume_hydrated');
    return;
  }
  if (hasResumedRef.current && interviewStatusRef.current === 'not_started') {
    const savedStaleResume =
      userId && !isAdmin ? await loadInterviewFromStorage(userId) : null;
    if (savedStaleResume && shouldResumeMidInterviewFromSaved(savedStaleResume)) {
      void remoteLog('[START] resume_realigned_after_stale_status', {
        messageCount: savedStaleResume.messages.length,
        resumeActiveScenario: savedStaleResume.resumeActiveScenario ?? null,
      });
      await runHandleResume(deps as HandleResumeDeps, { saved: savedStaleResume });
      return;
    }
    hasResumedRef.current = false;
    void remoteLog('[START] cleared stale resume flag for fresh begin');
  }
  startInterviewInFlightRef.current = true;
  setInterviewStartInFlight(true);
  try {
    const savedForResumeDecision =
      userId && !isAdmin ? await loadInterviewFromStorage(userId) : null;
    const willResumeMidInterview = Boolean(
      savedForResumeDecision &&
        userId &&
        !isAdmin &&
        shouldResumeMidInterviewFromSaved(savedForResumeDecision),
    );
    interruptAllInterviewTtsOutput();

    await remoteLog('[START] startInterview called', {
      userId: userId ?? null,
      isAdmin,
      platform: Platform.OS,
    });
    if (userId && !isAdmin) {
      if (interviewAttemptBootstrap === 'failed') {
        setMicError('Could not create your interview session. Please refresh the page and try again.');
        setVoiceState('idle');
        return;
      }
      if (interviewAttemptBootstrap === 'loading') {
        await remoteLog('[START] blocked attempt bootstrap still loading');
        setMicError('Still preparing your session. Please try again in a moment.');
        setVoiceState('idle');
        return;
      }
    }
    if (isAdmin) await clearInterviewFromStorage(userId);
    const saved = savedForResumeDecision ?? (await loadInterviewFromStorage(userId));
    if (saved && (saved.scenariosCompleted?.length ?? 0) >= 3 && !shouldResumeMidInterviewFromSaved(saved)) {
      await clearInterviewFromStorage(userId);
    } else if (
      saved &&
      userId &&
      !isAdmin &&
      shouldResumeMidInterviewFromSaved(saved)
    ) {
      if (hasResumedRef.current && interviewStatusRef.current === 'in_progress') {
        void remoteLog('[START] skipped already in_progress');
        return;
      }
      void remoteLog('[START] routing_to_resume_hydration', {
        resumeActiveScenario: saved.resumeActiveScenario ?? null,
        currentScenario: saved.currentScenario ?? null,
        messageCount: saved.messages.length,
        hadResumedFlag: hasResumedRef.current,
        interviewStatus: interviewStatusRef.current,
      });
      await runHandleResume(deps as HandleResumeDeps, { saved });
      return;
    }
    try {
      await deliverInterviewOpeningGreeting(deps, {
        opts: params,
        greetingSyncStarted: false,
        earlyWebRouteProbe: null,
        interviewAttemptBootstrap,
        runSessionStartLogging: (probe) => runInterviewSessionStartLogging(deps, probe),
      });
    } catch (err) {
      await remoteLog('[START] INIT ERROR causing fallback', {
        name: err instanceof Error ? err.name : 'unknown',
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack?.slice(0, 500) : undefined,
      });
      if (__DEV__) {
        console.error('=== INIT ERROR causing fallback ===');
        console.error('Name:', err instanceof Error ? err.name : 'unknown');
        console.error('Message:', err instanceof Error ? err.message : String(err));
        console.error('Stack:', err instanceof Error ? err.stack : '');
      }
      await applyInterviewStartUnavailableFailure(deps);
    }
  } finally {
    startInterviewInFlightRef.current = false;
    setInterviewStartInFlight(false);
  }
}
