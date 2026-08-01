import { Platform } from 'react-native';

import { applyInterviewStartUnavailableFailure } from '@features/aria/applyInterviewStartUnavailableFailure';
import { deliverInterviewOpeningGreeting } from '@features/aria/deliverInterviewOpeningGreeting';
import { resolveDevScenarioJumpTargetFromSession } from '@features/aria/devScenarioJumpReferral';
import { clearInterviewResumeHandle } from '@features/aria/interviewResumeHandleCoordinator';
import { isGreetingOnly } from '@features/aria/interviewLocalPersistence';
import { runHandleResume } from '@features/aria/runHandleResume';
import { runInterviewSessionStartLogging } from '@features/aria/runInterviewSessionStartLogging';
import type {
  HandleResumeDeps,
  StartInterviewDeps,
  StartInterviewParams,
} from '@features/aria/sessionLifecycleTypes';
import { remoteLog } from '@utilities/remoteLog';
import {
  clearInterviewFromStorage,
  loadInterviewFromStorage,
  type StoredInterviewData,
} from '@utilities/storage/InterviewStorage';
import { shouldResumeMidInterviewFromSaved } from '@utilities/interviewResumeCursor';

function interviewResumeStartSucceeded(deps: Pick<StartInterviewDeps, 'interviewStatusRef'>): boolean {
  return deps.interviewStatusRef.current === 'in_progress';
}

async function attemptResumeStartFromSaved(
  deps: StartInterviewDeps,
  saved: StoredInterviewData,
  logTag: string,
): Promise<boolean> {
  void remoteLog(logTag, {
    messageCount: saved.messages.length,
    resumeActiveScenario: saved.resumeActiveScenario ?? null,
  });
  await runHandleResume(deps as HandleResumeDeps, { saved });
  if (interviewResumeStartSucceeded(deps)) {
    return true;
  }
  deps.hasResumedRef.current = false;
  return false;
}

function logStartSkip(reason: string, detail?: Record<string, unknown>): void {
  void remoteLog(`[START] skipped ${reason}`, detail);
  if (__DEV__) {
    console.warn('[START] skipped', reason, detail ?? '');
  }
}

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
    resumeHandleInFlightRef,
    interviewStatusRef,
    interruptAllInterviewTtsOutput,
    setVoiceState,
    setMicError,
    setStatus,
    setInterviewStatus,
    setMessages,
    currentMessagesRef,
  } = deps;

  const fromUserGesture = params?.fromUserGesture === true;

  if (__DEV__) {
    console.log('[START] runStartInterview', {
      fromUserGesture,
      interviewStatus: interviewStatusRef.current,
      interviewAttemptBootstrap,
      resumeLoading: resumeLoadingFlowActiveRef.current,
      startInFlight: startInterviewInFlightRef.current,
      hasResumed: hasResumedRef.current,
    });
  }

  if (fromUserGesture) {
    clearInterviewResumeHandle(userId);
    if (resumeHandleInFlightRef) resumeHandleInFlightRef.current = false;
    resumeLoadingFlowActiveRef.current = false;
    (deps as HandleResumeDeps).setResumeLoadingVisible?.(false);
    (deps as HandleResumeDeps).setResumeHydrationPending?.(false);
    /** Supersede any mount-time resume still hydrating when the user explicitly taps Begin. */
    if (deps.interviewUserTurnEpochRef) {
      deps.interviewUserTurnEpochRef.current += 1;
    }
  }

  if (startInterviewInFlightRef.current) {
    logStartSkip('duplicate in_flight');
    return;
  }
  if (resumeLoadingFlowActiveRef.current) {
    if (fromUserGesture) {
      void remoteLog('[START] cleared stale resume_loading_in_flight');
      resumeLoadingFlowActiveRef.current = false;
    } else {
      logStartSkip('resume_loading_in_flight');
      return;
    }
  }

  const hydratedMidInterviewInMemory =
    currentMessagesRef.current.length > 0 && !isGreetingOnly(currentMessagesRef.current);

  if (
    !fromUserGesture &&
    hasResumedRef.current &&
    (interviewStatusRef.current === 'in_progress' || hydratedMidInterviewInMemory)
  ) {
    logStartSkip('already resume_hydrated', {
      interviewStatus: interviewStatusRef.current,
      messageCount: currentMessagesRef.current.length,
    });
    return;
  }
  if (!fromUserGesture && hasResumedRef.current && interviewStatusRef.current !== 'not_started') {
    logStartSkip('resume_hydrated');
    return;
  }

  if (fromUserGesture && interviewStatusRef.current === 'not_started' && userId && !isAdmin) {
    const savedOnBegin = await loadInterviewFromStorage(userId);
    if (__DEV__) {
      console.log('[START] begin_gesture storage check', {
        hasSaved: Boolean(savedOnBegin),
        resumable: Boolean(savedOnBegin && shouldResumeMidInterviewFromSaved(savedOnBegin)),
        messageCount: savedOnBegin?.messages?.length ?? 0,
      });
    }
    /**
     * Mount-time resume owns re-entry after app background / navigation away.
     * On "Before you begin", Begin always starts fresh — inline resume here can hang
     * (resume welcome TTS / screen-ready wait) and block the opening greeting entirely.
     */
    if (savedOnBegin && shouldResumeMidInterviewFromSaved(savedOnBegin)) {
      await clearInterviewFromStorage(userId);
      hasResumedRef.current = false;
      clearInterviewResumeHandle(userId);
      interruptAllInterviewTtsOutput();
      void remoteLog('[START] begin_gesture_cleared_resumable_save_for_fresh_start', {
        messageCount: savedOnBegin.messages.length,
        resumeActiveScenario: savedOnBegin.resumeActiveScenario ?? null,
      });
      if (__DEV__) {
        console.log('[START] cleared resumable save — starting fresh on Begin');
      }
    }
  }

  const devJumpTarget =
    userId && !isAdmin ? await resolveDevScenarioJumpTargetFromSession(undefined) : null;
  if (devJumpTarget != null && userId && !isAdmin) {
    await clearInterviewFromStorage(userId);
    hasResumedRef.current = false;
    void remoteLog('[START] Dev scenario jump — cleared saved progress', { target: devJumpTarget });
  }
  if (!fromUserGesture && hasResumedRef.current && interviewStatusRef.current === 'not_started') {
    const savedStaleResume =
      userId && !isAdmin ? await loadInterviewFromStorage(userId) : null;
    if (savedStaleResume && shouldResumeMidInterviewFromSaved(savedStaleResume)) {
      startInterviewInFlightRef.current = true;
      setInterviewStartInFlight(true);
      try {
        if (
          await attemptResumeStartFromSaved(
            deps,
            savedStaleResume,
            '[START] resume_realigned_after_stale_status',
          )
        ) {
          return;
        }
        void remoteLog('[START] resume_realigned_aborted_falling_through_to_fresh');
      } finally {
        startInterviewInFlightRef.current = false;
        setInterviewStartInFlight(false);
      }
    } else {
      hasResumedRef.current = false;
      void remoteLog('[START] cleared stale resume flag for fresh begin');
    }
  }
  startInterviewInFlightRef.current = true;
  setInterviewStartInFlight(true);
  if (__DEV__) {
    console.log('[START] proceeding to opening greeting');
  }
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

    if (__DEV__) {
      console.log('[START] startInterview called', {
        userId: userId ?? null,
        isAdmin,
        platform: Platform.OS,
        fromUserGesture,
      });
    }
    await remoteLog('[START] startInterview called', {
      userId: userId ?? null,
      isAdmin,
      platform: Platform.OS,
      fromUserGesture,
    });
    if (userId && !isAdmin) {
      if (interviewAttemptBootstrap === 'failed') {
        setMicError('Could not create your interview session. Please refresh the page and try again.');
        setVoiceState('idle');
        return;
      }
    }
    if (isAdmin) await clearInterviewFromStorage(userId);
    const saved =
      devJumpTarget != null && userId && !isAdmin
        ? null
        : savedForResumeDecision ?? (await loadInterviewFromStorage(userId));
    if (saved && (saved.scenariosCompleted?.length ?? 0) >= 3 && !shouldResumeMidInterviewFromSaved(saved)) {
      await clearInterviewFromStorage(userId);
    } else if (
      saved &&
      userId &&
      !isAdmin &&
      shouldResumeMidInterviewFromSaved(saved) &&
      !fromUserGesture
    ) {
      if (hasResumedRef.current && interviewStatusRef.current === 'in_progress') {
        logStartSkip('already in_progress');
        return;
      }
      if (await attemptResumeStartFromSaved(deps, saved, '[START] routing_to_resume_hydration')) {
        return;
      }
      void remoteLog('[START] routing_to_resume_aborted_falling_through_to_fresh');
      hasResumedRef.current = false;
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
