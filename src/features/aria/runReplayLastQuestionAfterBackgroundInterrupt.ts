import { resolveResumeWelcomeQuestionText } from '@features/aria/applyResumeWelcomeMessagesAndPlayback';
import type { InterviewMicLifecycleDeps } from '@features/aria/hooks/interviewMicLifecycleTypes';
import { stripControlTokens } from '@features/aria/interviewControlTokens';
import {
  bumpResumeWelcomePlaybackGeneration,
  clearResumeWelcomeSpokenForHydration,
  getResumeWelcomePlaybackGeneration,
  markResumeWelcomeSpoken,
  peekMountResumeOwnsWelcomePlayback,
  releaseResumeWelcomePlaybackLock,
  resolveResumeWelcomeStorageAttemptId,
  wasResumeWelcomeSpoken,
} from '@features/aria/interviewLocalPersistence';
import { flushResumeDeferredUserSpeechWhenUnblocked } from '@features/aria/resumeDeferredUserSpeech';
import { markNativePlaybackBridgeBeforeNextTts } from '@features/aria/utils/audioModeHelpers';
import {
  buildResumeWelcomeMessage,
  resumeWelcomeMessageEmbedsLastQuestion,
  shouldOfferResumeWelcomeTts,
} from '@utilities/interviewResumeCursor';

const replaySpeakOpts = {
  telemetrySource: 'replay' as const,
  ttsTriggerSource: 'callback' as const,
  skipQuestionDeliveredTelemetry: true,
  skipInterviewSpeechAdvance: true,
  skipQuestionTiming: true,
  skipLastQuestionRef: true,
};

const welcomeSpeakOpts = {
  telemetrySource: 'greeting' as const,
  ttsTriggerSource: 'callback' as const,
  skipLastQuestionRef: true,
  skipQuestionDeliveredTelemetry: true,
  skipInterviewSpeechAdvance: true,
  skipQuestionTiming: true,
  skipScenarioAContemptProbeSessionDedup: true,
};

function resolveWelcomeBackText(deps: InterviewMicLifecycleDeps): string | null {
  const lastQuestion = resolveResumeWelcomeQuestionText(
    deps.currentMessagesRef?.current ?? [],
    deps.lastQuestionTextRef.current ?? deps.resumeLastAssistantTextRef?.current,
    {
      activeScenario: deps.currentScenarioRef.current,
      firstName: deps.interviewNameRef?.current,
      inPersonalPart: deps.resumeInPersonalPartRef?.current ?? false,
    },
  );
  if (lastQuestion?.trim() && deps.resumeLastAssistantTextRef) {
    deps.resumeLastAssistantTextRef.current = lastQuestion;
  }

  const scenario = deps.currentScenarioRef.current;
  if (scenario !== 1 && scenario !== 2 && scenario !== 3) return null;

  const welcomeBack = buildResumeWelcomeMessage({
    mode: deps.resumeInPersonalPartRef?.current ? 'resume_post_scenarios' : 'replay_incomplete',
    resumeScenario: scenario,
    lastQuestionText: lastQuestion,
  });
  if (deps.resumeWelcomeMessageRef) {
    deps.resumeWelcomeMessageRef.current = welcomeBack;
  }
  return welcomeBack;
}

export function shouldOfferWelcomeOnReentry(deps: InterviewMicLifecycleDeps): boolean {
  if (deps.resumeOfferWelcomeTtsRef?.current) return true;
  return shouldOfferResumeWelcomeTts({
    mode: deps.resumeInPersonalPartRef?.current ? 'resume_post_scenarios' : 'replay_incomplete',
    transcriptMessages: deps.currentMessagesRef?.current ?? [],
  });
}

function finishForegroundReplayPlaybackWindow(deps: InterviewMicLifecycleDeps): void {
  releaseResumeWelcomePlaybackLock(deps.interviewSessionAttemptIdRef.current);
  void flushResumeDeferredUserSpeechWhenUnblocked({
    processUserSpeech: deps.processUserSpeech,
    resumeLoadingFlowActiveRef: deps.resumeLoadingFlowActiveRef,
    resumeOfferWelcomeTtsRef: deps.resumeOfferWelcomeTtsRef,
    resumeRepeatChoicePendingRef: deps.resumeRepeatChoicePendingRef,
    interviewSessionAttemptIdRef: deps.interviewSessionAttemptIdRef,
    currentMessagesRef: deps.currentMessagesRef,
  });
}

async function replayWelcomeAndLastQuestionAfterForegroundInterrupt(
  deps: InterviewMicLifecycleDeps,
  bridgeReason: string,
  options: { skipWelcomeIfAlreadySpoken: boolean; forceClearWelcomeSpoken?: boolean },
): Promise<boolean> {
  const welcomeBack = resolveWelcomeBackText(deps);
  if (!welcomeBack) return false;

  const playbackGeneration = getResumeWelcomePlaybackGeneration();
  const isForegroundReplayStale = (): boolean =>
    getResumeWelcomePlaybackGeneration() !== playbackGeneration ||
    peekMountResumeOwnsWelcomePlayback() ||
    deps.resumeLoadingFlowActiveRef.current;

  markNativePlaybackBridgeBeforeNextTts(bridgeReason);
  const welcomeAttemptId = resolveResumeWelcomeStorageAttemptId({
    interviewSessionAttemptId: deps.interviewSessionAttemptIdRef.current,
    interviewSessionId: deps.interviewSessionIdRef.current,
  });
  if (options.forceClearWelcomeSpoken && welcomeAttemptId) {
    await clearResumeWelcomeSpokenForHydration(welcomeAttemptId);
  }
  const welcomeAlreadySpoken =
    options.skipWelcomeIfAlreadySpoken && welcomeAttemptId
      ? await wasResumeWelcomeSpoken(welcomeAttemptId)
      : false;

  try {
    if (!welcomeAlreadySpoken) {
      if (isForegroundReplayStale()) return false;
      await deps.speakTextSafe!(welcomeBack, welcomeSpeakOpts);
      if (isForegroundReplayStale()) return false;
      if (welcomeAttemptId) {
        await markResumeWelcomeSpoken(welcomeAttemptId);
      }
    } else {
    }

    if (!resumeWelcomeMessageEmbedsLastQuestion(welcomeBack)) {
      const last =
        resolveResumeWelcomeQuestionText(
          deps.currentMessagesRef?.current ?? [],
          deps.lastQuestionTextRef.current ?? deps.resumeLastAssistantTextRef?.current,
          {
            activeScenario: deps.currentScenarioRef.current,
            firstName: deps.interviewNameRef?.current,
            inPersonalPart: deps.resumeInPersonalPartRef?.current ?? false,
          },
        )?.trim() || deps.lastQuestionTextRef.current?.trim();
      if (last) {
        if (isForegroundReplayStale()) return false;
        await deps.speakTextSafe!(stripControlTokens(last), replaySpeakOpts);
      }
    }
  } finally {
    finishForegroundReplayPlaybackWindow(deps);
  }

  return true;
}

/** Welcome + last question when returning mid-interview without full resume hydration. */
export async function runReplayWelcomeAfterInterviewReentry(
  deps: InterviewMicLifecycleDeps,
  bridgeReason: string,
  interrupted: 'recording' | 'tts' | null,
): Promise<void> {
  if (deps.resumeLoadingFlowActiveRef.current) return;
  if (deps.interviewStatusRef.current !== 'in_progress') return;
  if (!deps.speakTextSafe) return;
  if (peekMountResumeOwnsWelcomePlayback()) {
    return;
  }

  bumpResumeWelcomePlaybackGeneration();

  const shouldOfferWelcome = shouldOfferWelcomeOnReentry(deps);

  if (interrupted === 'recording') {
    await replayWelcomeAndLastQuestionAfterForegroundInterrupt(deps, bridgeReason, {
      skipWelcomeIfAlreadySpoken: false,
    });
    return;
  }

  if (interrupted || shouldOfferWelcome) {
    const replayed = await replayWelcomeAndLastQuestionAfterForegroundInterrupt(deps, bridgeReason, {
      skipWelcomeIfAlreadySpoken: !shouldOfferWelcome && interrupted === 'tts',
      forceClearWelcomeSpoken: shouldOfferWelcome,
    });
    if (replayed && shouldOfferWelcome) {
      deps.resumeOfferWelcomeTtsRef!.current = false;
    }
  }
}

/** After background interrupted mic/TTS, replay welcome and/or last question so the user can continue. */
export async function runReplayLastQuestionAfterBackgroundInterrupt(
  deps: InterviewMicLifecycleDeps,
  kind: 'recording' | 'tts',
): Promise<void> {
  await runReplayWelcomeAfterInterviewReentry(
    deps,
    kind === 'recording' ? 'foreground_after_recording_interrupt' : 'foreground_after_tts_interrupt',
    kind,
  );
}
