import type { MessageWithScenario } from '@features/aria/interviewScenarioScoringSlice';
import { ASSISTANT_INTERVIEW_SPEECH } from '@features/aria/interviewTtsSpeakOptions';
import type { PreClaudeTurnGateDeps } from '@features/aria/preClaudeTurnGateTypes';
import { getScenarioNumberForNewMessage } from '@features/aria/scenarioNumberDetection';
import { prepareEmotionTransitionAfterModalForTts } from '@features/aria/emotionTransitionModalTtsGuards';
import { remoteLog } from '@utilities/remoteLog';
export type PreClaudeDeferredEmotionModalInterceptResult = {
  handled: boolean;
};

/**
 * Deferred emotion modal after bundled in-scenario question + transition (INTERCEPT 0).
 * Runs before the user turn is appended to the main pipeline.
 */
export async function runPreClaudeDeferredEmotionModalIntercept(
  deps: PreClaudeTurnGateDeps,
  trimmed: string,
): Promise<PreClaudeDeferredEmotionModalInterceptResult> {
  if (
    !deps.isInterviewAppRoute ||
    deps.isAdmin ||
    deps.status !== 'active' ||
    deps.pendingEmotionModalTransitionRef.current == null
  ) {
    return { handled: false };
  }

  const pending = deps.pendingEmotionModalTransitionRef.current;
  deps.pendingEmotionModalTransitionRef.current = null;
  const userScenarioTag =
    pending.completedScenario === 1 || pending.completedScenario === 2 || pending.completedScenario === 3
      ? pending.completedScenario
      : ((deps.currentScenarioRef.current as 1 | 2 | 3 | undefined) ??
        (getScenarioNumberForNewMessage(deps.messages, 'user') as 1 | 2 | 3)) ||
        1;
  const userMsgDeferred: MessageWithScenario = {
    role: 'user',
    content: trimmed,
    scenarioNumber: userScenarioTag,
  };
  const messagesAfterDeferredUser = [...deps.messages, userMsgDeferred];
  deps.setMessages(messagesAfterDeferredUser);
  deps.setCurrentTranscript('');
  deps.transcriptAtReleaseRef.current = '';
  deps.setVoiceState('processing');
  deps.ensureCompletedScenarioScored(
    pending.completedScenario,
    messagesAfterDeferredUser,
    'deferred_bundled_handoff_intercept',
  );
  await deps.runEmotionModalAfterScenarioTransition(pending.completedScenario, {
    transitionText: pending.transitionText,
    priorScenario: pending.priorScenario,
    afterBeforeModalPlayback: true,
  });
  if (pending.afterModal.trim()) {
    const nextSn = (pending.completedScenario < 3
      ? ((pending.completedScenario + 1) as 2 | 3)
      : 3) as 1 | 2 | 3;
    if (pending.completedScenario === 1) {
      deps.interviewMomentsCompleteRef.current[1] = true;
      deps.currentInterviewMomentRef.current = 2;
    } else if (pending.completedScenario === 2) {
      deps.interviewMomentsCompleteRef.current[2] = true;
      deps.currentInterviewMomentRef.current = 3;
      deps.resetScenarioCClientGatesOnly();
    } else if (pending.completedScenario === 3) {
      deps.interviewMomentsCompleteRef.current[3] = true;
    }
    deps.currentScenarioRef.current = nextSn;
    deps.resumeActiveScenarioRef.current = nextSn;
    deps.setHighestScenarioReached((prev) => Math.max(prev, pending.completedScenario));
    const streamSpokeText = deps.parallelStreamingTtsRef.current.spokenCompleteText.trim();
    const afterModalForTts = prepareEmotionTransitionAfterModalForTts(pending.afterModal, {
      messages: messagesAfterDeferredUser,
      interviewMoment: deps.currentInterviewMomentRef.current,
      streamSpokeText,
      playbackConfirmedKinds:
        deps.showScenarioCardCanonicalPlaybackConfirmedKindsRef?.current ?? {},
      scenarioJustCompleted: pending.completedScenario,
      streamAlreadySpokeBefore: streamSpokeText.length > 0,
    });
    if (!afterModalForTts.trim()) {
      void remoteLog(
        pending.completedScenario === 3
          ? '[M4_AFTER_MODAL_SPEAK_SKIPPED]'
          : pending.completedScenario === 2
            ? '[S3_AFTER_MODAL_SPEAK_SKIPPED]'
            : '[S2_AFTER_MODAL_SPEAK_SKIPPED]',
        {
          interviewSessionId: deps.interviewSessionIdRef.current,
          reason: 'deferred_emotion_modal_guard',
          afterModalPreview: pending.afterModal.slice(0, 160),
          interviewMoment: deps.currentInterviewMomentRef.current,
        },
      );    } else {
      const afterMsg: MessageWithScenario = {
        role: 'assistant',
        content: afterModalForTts,
        scenarioNumber: nextSn,
      };
      const withAfter = [...messagesAfterDeferredUser, afterMsg];
      deps.setMessages(withAfter);
      void deps.notifyScenarioStarted(nextSn, withAfter);
      await deps.speakTextSafe(afterModalForTts, ASSISTANT_INTERVIEW_SPEECH);
    }
  }
  deps.setVoiceState('idle');
  deps.setIsWaiting(false);
  return { handled: true };
}
