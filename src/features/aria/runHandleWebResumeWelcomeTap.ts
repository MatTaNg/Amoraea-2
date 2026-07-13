import { stripControlTokens } from '@features/aria/interviewControlTokens';
import { findLastRepeatableInterviewQuestionText } from '@features/aria/interviewDisengagementProbes';
import {
  transcriptHasInterviewClosingAssistantMessage,
} from '@features/aria/elongatingProbe';
import {
  isResumeWelcomePlaybackLocked,
  markResumeWelcomeSpoken,
  releaseResumeWelcomePlaybackLock,
  tryAcquireResumeWelcomePlayback,
  wasResumeWelcomeSpoken,
} from '@features/aria/interviewLocalPersistence';
import { clearPendingWebSpeechGesturePair } from '@features/aria/interviewWebPendingSpeechGesture';
import {
  markWebInterviewUserGestureNow,
} from '@features/aria/utils/webInterviewGestureContext';
import { primeHtmlAudioForMobileTtsFromMicGesture } from '@features/aria/utils/webInterviewSharedHtmlAudio';
import { unlockWebAudioForAutoplay } from '@features/aria/utils/webInterviewTtsDocumentLifecycle';
import { preAuthorizeAudioElementOnMicTapGesture } from '@features/aria/utils/webPreAuthorizedTtsAudio';
import { remoteLog } from '@utilities/remoteLog';
import type { WebResumeWelcomeTapDeps } from '@features/aria/webResumeWelcomeTapTypes';

export async function runHandleWebResumeWelcomeTap(deps: WebResumeWelcomeTapDeps): Promise<void> {
  if (deps.webResumeWelcomeTapHandledRef.current) {
    void remoteLog('[resume] welcome_tap_ignored_duplicate', {
      attemptId: deps.interviewSessionAttemptIdRef.current,
    });
    return;
  }
  if (
    deps.isInterviewCompleteRef.current ||
    deps.interviewStatusRef.current === 'preparing_results' ||
    transcriptHasInterviewClosingAssistantMessage(deps.currentMessagesRef.current)
  ) {
    deps.webResumeWelcomeTapHandledRef.current = true;
    deps.webResumeWelcomeTapPendingRef.current = false;
    deps.setWebResumeWelcomeTapPending(false);
    deps.resumeOfferWelcomeTtsRef.current = false;
    void remoteLog('[resume] welcome_tap_blocked_post_closing', {
      attemptId: deps.interviewSessionAttemptIdRef.current,
      interviewComplete: deps.isInterviewCompleteRef.current,
      interviewStatus: deps.interviewStatusRef.current,
    });
    return;
  }
  deps.webResumeWelcomeTapHandledRef.current = true;
  deps.webResumeWelcomeTapPendingRef.current = false;
  deps.setWebResumeWelcomeTapPending(false);
  clearPendingWebSpeechGesturePair(deps.pendingWebSpeechForGestureRef);
  deps.detachWebGestureFlushListener();
  deps.setWebDesktopPendingTtsGestureOverlay(false);
  markWebInterviewUserGestureNow();
  deps.setMobileWebTapToBeginDone(true);
  unlockWebAudioForAutoplay();
  preAuthorizeAudioElementOnMicTapGesture();
  primeHtmlAudioForMobileTtsFromMicGesture();
  if (deps.emotionModalPendingTransitionRef.current) {
    deps.setEmotionModalVisible(true);
    return;
  }
  const catchUpIndices = deps.resumeEmotionCatchUpIndicesRef.current;
  const hadEmotionCatchUp = catchUpIndices != null && catchUpIndices.length > 0;
  if (hadEmotionCatchUp) {
    for (const itemIndex of catchUpIndices) {
      await deps.awaitEmotionModalForIndex(itemIndex);
    }
    deps.resumeEmotionCatchUpIndicesRef.current = null;
  }
  const offerWelcome = deps.resumeOfferWelcomeTtsRef.current;
  const attemptId = deps.interviewSessionAttemptIdRef.current;
  let spokeWelcome = false;
  try {
    if (offerWelcome) {
      const alreadySpoken = await wasResumeWelcomeSpoken(attemptId);
      /** Deferred bootstrap may leave attemptId null — still play welcome on tap (no attempt-scoped lock). */
      const acquiredLock = !attemptId || tryAcquireResumeWelcomePlayback(attemptId);
      if (!alreadySpoken && acquiredLock) {
        try {
          await deps.speakTextSafe(deps.resumeWelcomeMessageRef.current, {
            telemetrySource: 'greeting',
            ttsTriggerSource: 'gesture_handler',
            skipQuestionDeliveredTelemetry: true,
            skipInterviewSpeechAdvance: true,
            skipQuestionTiming: true,
            skipLastQuestionRef: true,
          });
          await markResumeWelcomeSpoken(attemptId);
          spokeWelcome = true;
          void remoteLog('[resume] welcome_tts_completed', { attemptId });
        } finally {
          releaseResumeWelcomePlaybackLock(attemptId);
        }
      } else {
        void remoteLog('[resume] welcome_tts_skipped', {
          attemptId,
          offerWelcome,
          alreadySpoken,
          lockHeld: isResumeWelcomePlaybackLocked(attemptId),
        });
      }
    }
    const intro = deps.pendingScenarioIntroAfterResumeWelcomeRef.current;
    deps.pendingScenarioIntroAfterResumeWelcomeRef.current = null;
    if (intro?.trim()) {
      await deps.speakTextSafe(intro, { telemetrySource: 'greeting', ttsTriggerSource: 'gesture_handler' });
    } else if (hadEmotionCatchUp && deps.resumeEmotionAfterModalTextRef.current?.trim()) {
      const afterModal = deps.resumeEmotionAfterModalTextRef.current;
      deps.resumeEmotionAfterModalTextRef.current = null;
      await deps.speakTextSafe(stripControlTokens(afterModal), {
        telemetrySource: 'replay',
        ttsTriggerSource: 'gesture_handler',
        skipQuestionDeliveredTelemetry: true,
        skipInterviewSpeechAdvance: true,
        skipQuestionTiming: true,
        skipLastQuestionRef: true,
      });
      void remoteLog('[resume] emotion_after_modal_tts', { preview: afterModal.slice(0, 120) });
    } else if (!spokeWelcome) {
      const welcomeFallback = offerWelcome ? deps.resumeWelcomeMessageRef.current?.trim() : '';
      const last =
        welcomeFallback ||
        findLastRepeatableInterviewQuestionText(
          deps.currentMessagesRef.current,
          deps.resumeLastAssistantTextRef.current ?? deps.lastQuestionTextRef.current,
        )?.trim() ||
        '';
      if (last) {
        await deps.speakTextSafe(stripControlTokens(last), {
          telemetrySource: welcomeFallback ? 'greeting' : 'replay',
          ttsTriggerSource: 'gesture_handler',
          skipQuestionDeliveredTelemetry: true,
          skipInterviewSpeechAdvance: true,
          skipQuestionTiming: true,
          skipLastQuestionRef: true,
        });
        if (welcomeFallback) {
          spokeWelcome = true;
        }
        void remoteLog('[resume] replay_last_assistant_on_tap', {
          preview: last.slice(0, 120),
          hadEmotionCatchUp: false,
          welcomeFallback: Boolean(welcomeFallback),
        });
      }
    }
  } finally {
    /** Repeat gate only when welcome TTS invited "repeat what I said". */
    deps.resumeRepeatChoicePendingRef.current = offerWelcome && spokeWelcome;
  }
}
