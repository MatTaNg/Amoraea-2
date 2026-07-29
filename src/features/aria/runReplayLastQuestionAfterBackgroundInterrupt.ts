import { resolveResumeWelcomeQuestionText } from '@features/aria/applyResumeWelcomeMessagesAndPlayback';
import type { InterviewMicLifecycleDeps } from '@features/aria/hooks/interviewMicLifecycleTypes';
import { stripControlTokens } from '@features/aria/interviewControlTokens';
import {
  bumpResumeWelcomePlaybackGeneration,
  markResumeWelcomeSpoken,
  releaseResumeWelcomePlaybackLock,
  wasResumeWelcomeSpoken,
} from '@features/aria/interviewLocalPersistence';
import { flushResumeDeferredUserSpeechWhenUnblocked } from '@features/aria/resumeDeferredUserSpeech';
import { markNativePlaybackBridgeBeforeNextTts } from '@features/aria/utils/audioModeHelpers';
import {
  buildResumeWelcomeMessage,
  resumeWelcomeMessageEmbedsLastQuestion,
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
  options: { skipWelcomeIfAlreadySpoken: boolean },
): Promise<boolean> {
  const welcomeBack = resolveWelcomeBackText(deps);
  if (!welcomeBack) return false;

  markNativePlaybackBridgeBeforeNextTts(bridgeReason);
  const attemptId = deps.interviewSessionAttemptIdRef.current;
  const welcomeAlreadySpoken =
    options.skipWelcomeIfAlreadySpoken && attemptId
      ? await wasResumeWelcomeSpoken(attemptId)
      : false;

  try {
    if (!welcomeAlreadySpoken) {
      await deps.speakTextSafe!(welcomeBack, welcomeSpeakOpts);
      if (options.skipWelcomeIfAlreadySpoken && attemptId) {
        await markResumeWelcomeSpoken(attemptId);
      }
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
        await deps.speakTextSafe!(stripControlTokens(last), replaySpeakOpts);
      }
    }
  } finally {
    finishForegroundReplayPlaybackWindow(deps);
  }

  return true;
}

/** After background interrupted mic/TTS, replay welcome and/or last question so the user can continue. */
export async function runReplayLastQuestionAfterBackgroundInterrupt(
  deps: InterviewMicLifecycleDeps,
  kind: 'recording' | 'tts',
): Promise<void> {
  if (deps.resumeLoadingFlowActiveRef.current) return;
  if (deps.interviewStatusRef.current !== 'in_progress') return;
  if (!deps.speakTextSafe) return;

  bumpResumeWelcomePlaybackGeneration();

  const bridgeReason =
    kind === 'recording'
      ? 'foreground_after_recording_interrupt'
      : 'foreground_after_tts_interrupt';

  if (kind === 'recording') {
    const replayed = await replayWelcomeAndLastQuestionAfterForegroundInterrupt(deps, bridgeReason, {
      skipWelcomeIfAlreadySpoken: false,
    });
    if (replayed) return;
  }

  if (deps.resumeOfferWelcomeTtsRef?.current && kind === 'tts') {
    const replayed = await replayWelcomeAndLastQuestionAfterForegroundInterrupt(deps, bridgeReason, {
      skipWelcomeIfAlreadySpoken: true,
    });
    if (replayed) {
      deps.resumeOfferWelcomeTtsRef.current = false;
    }
    return;
  }

  const last = deps.lastQuestionTextRef.current?.trim();
  if (!last) return;

  markNativePlaybackBridgeBeforeNextTts(bridgeReason);
  try {
    await deps.speakTextSafe(stripControlTokens(last), replaySpeakOpts);
  } finally {
    finishForegroundReplayPlaybackWindow(deps);
  }
}
