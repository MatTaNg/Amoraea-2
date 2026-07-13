import { Platform } from 'react-native';

import {
  computeParallelStreamTabRestoreText,
  isUnauthorizedS1TabRestoreFollowUp,
  looksLikeBriefStreamAckOnly,
  looksLikeScenarioHandoffOrVignetteBundle,
  looksLikeShortProbeFallback,
} from '@features/aria/computeParallelStreamTabRestoreText';
import { normalizeTtsTextForConsecutiveDedup } from '@features/aria/interviewControlTokens';
import { TAB_RESTORE_PENDING_SPEAK_OPTIONS } from '@features/aria/interviewTtsSpeakOptions';
import type { InterruptInterviewTtsForDocumentHiddenDeps } from '@features/aria/interruptDocumentHiddenTtsTypes';
import { substituteCanonicalInterviewScenarioBodiesForTts } from '@features/aria/substituteCanonicalInterviewScenarioBodiesForTts';
import { getWebAutoplayContext } from '@features/aria/telemetry/tsAutoplayTelemetry';
import { captureWebSpeechSynthTabRestoreText } from '@features/aria/utils/webSpeechSynthTabResume';
import { hasWebInterviewHtmlAudioTabResumePending } from '@features/aria/utils/webInterviewHtmlAudioTabResume';
import { isWebInterviewPlaybackAudiblyActive } from '@features/aria/utils/webInterviewPlaybackSurface';
import { interruptWebInterviewTtsForTabHide } from '@features/aria/utils/webInterviewTtsDocumentLifecycle';
import { remoteLog } from '@utilities/remoteLog';
import { shouldSuppressTabSwitchDeactivationAfterLateStartRefresh } from '@features/aria/utils/webInterviewMicPreInit';
import { gateTabRestoreReplayTextForEmotionModal } from '@features/aria/tabRestoreEmotionModalReplayGate';
import { getSessionLogRuntime, writeSessionLog } from '@utilities/sessionLogging';

function interviewTtsLooksActiveForTabHide(
  deps: InterruptInterviewTtsForDocumentHiddenDeps,
): boolean {
  const utteranceInFlight = (deps.webTtsUtteranceInFlightRef.current ?? '').trim();
  const sessionTtsActive = getSessionLogRuntime().ttsPlaybackActive;
  const accumulated = deps.parallelStreamingTtsRef.current.accumulatedFullText.trim();
  const scenarioHandoffHtmlSpeakLikelyActive =
    deps.parallelStreamingTtsRef.current.active &&
    !deps.parallelStreamingTtsRef.current.cancelRequested &&
    looksLikeScenarioHandoffOrVignetteBundle(accumulated) &&
    (utteranceInFlight.length > 0 || deps.ttsLineInFlightRef.current);
  return (
    deps.ttsLineInFlightRef.current ||
    deps.parallelStreamingTtsRef.current.active ||
    deps.isWebInterviewPlaybackSurfaceActive() ||
    isWebInterviewPlaybackAudiblyActive() ||
    hasWebInterviewHtmlAudioTabResumePending() ||
    scenarioHandoffHtmlSpeakLikelyActive ||
    deps.webTabRestoreReplayInFlightRef.current ||
    deps.pendingGestureRestoreSpeakRef.current != null ||
    utteranceInFlight.length > 0 ||
    sessionTtsActive
  );
}

export function runInterruptInterviewTtsForDocumentHidden(
  deps: InterruptInterviewTtsForDocumentHiddenDeps,
): void {
  if (Platform.OS !== 'web' || deps.interviewStatusRef.current !== 'in_progress') {
    // #region agent log
    fetch('http://127.0.0.1:7668/ingest/668e0bd5-3283-4492-9f48-e33846c18218',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'03bb9d'},body:JSON.stringify({sessionId:'03bb9d',location:'runInterruptInterviewTtsForDocumentHidden.ts:entry_skip',message:'interrupt_skipped_not_in_progress',data:{status:deps.interviewStatusRef.current},timestamp:Date.now(),hypothesisId:'E'})}).catch(()=>{});
    // #endregion
    return;
  }
  const ttsActiveSnapshot = {
    lineInFlight: deps.ttsLineInFlightRef.current,
    parallelStream: deps.parallelStreamingTtsRef.current.active,
    surfaceActive: deps.isWebInterviewPlaybackSurfaceActive(),
    replayInFlight: deps.webTabRestoreReplayInFlightRef.current,
    pendingRestore: deps.pendingGestureRestoreSpeakRef.current != null,
    utteranceLen: (deps.webTtsUtteranceInFlightRef.current ?? '').trim().length,
    sessionTtsActive: getSessionLogRuntime().ttsPlaybackActive,
  };
  if (!interviewTtsLooksActiveForTabHide(deps)) {
    void remoteLog('[TAB_HIDE_INTERRUPT_SKIPPED_INACTIVE]', {
      ...ttsActiveSnapshot,
      audibleActive: isWebInterviewPlaybackAudiblyActive(),
      htmlResumePending: hasWebInterviewHtmlAudioTabResumePending(),
      accumulatedLen: deps.parallelStreamingTtsRef.current.accumulatedFullText.trim().length,
      parallelStreamActive: deps.parallelStreamingTtsRef.current.active,
    });
    // #region agent log
    fetch('http://127.0.0.1:7668/ingest/668e0bd5-3283-4492-9f48-e33846c18218',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'03bb9d'},body:JSON.stringify({sessionId:'03bb9d',location:'runInterruptInterviewTtsForDocumentHidden.ts:inactive_skip',message:'interrupt_skipped_tts_inactive',data:ttsActiveSnapshot,timestamp:Date.now(),hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    return;
  }
  const suppressTabDeactivation = shouldSuppressTabSwitchDeactivationAfterLateStartRefresh();
  if (suppressTabDeactivation) {
    const uidSuppress = deps.userIdRef.current;
    if (uidSuppress) {
      const rSuppress = getSessionLogRuntime();
      writeSessionLog({
        userId: uidSuppress,
        attemptId: rSuppress.attemptId,
        eventType: 'tab_switch_deactivation_suppressed_post_late_start_refresh',
        eventData: { tab_switch_deactivation_suppressed_post_late_start_refresh: true },
        platform: rSuppress.platform,
      });
    }
  }
  deps.gestureContextLostAtRef.current = { atMs: Date.now(), reason: 'tab_visibility_change' };
  const isMobileWeb = Platform.OS === 'web' && getWebAutoplayContext().isMobileWeb;
  if (isMobileWeb && deps.isMobileWebInterviewTtsSessionActive()) {
    deps.armMobileWebBackgroundTtsContinue();
    return;
  }
  if (deps.armMobileWebBackgroundTtsContinue()) {
    return;
  }
  deps.tabHiddenDuringActiveTtsLineRef.current = true;
  /** Snapshot before teardown — {@link interruptWebInterviewTtsForTabHide} clears playback surfaces. */
  const midRestoreOrPlaybackBeforeTeardown =
    deps.webTabRestoreReplayInFlightRef.current ||
    deps.isWebInterviewPlaybackSurfaceActive() ||
    deps.ttsLineInFlightRef.current ||
    (deps.webTtsUtteranceInFlightRef.current?.trim().length ?? 0) > 0 ||
    getSessionLogRuntime().ttsPlaybackActive;
  /**
   * Always pause/capture playback on tab hide — even during the post-late-start mic refresh
   * window. Skipping interrupt left PCM/HTML surfaces "audibly active" while restore was
   * queued, and {@link runSyncInterviewTtsAfterScreenReturn} then cleared Tap-to-continue.
   */
  interruptWebInterviewTtsForTabHide();
  const htmlTabResume = hasWebInterviewHtmlAudioTabResumePending();
  const speechSynthRemaining = captureWebSpeechSynthTabRestoreText();
  const inFlightUtterance = (deps.webTtsUtteranceInFlightRef.current ?? '').trim();
  const priorPendingText = (deps.pendingGestureRestoreSpeakRef.current?.text ?? '').trim();
  const streamRestoreText = computeParallelStreamTabRestoreText(
    deps.parallelStreamingTtsRef.current.accumulatedFullText,
    deps.parallelStreamingTtsRef.current.spokenCompleteText,
    /**
     * Prefer the in-flight utterance over lastQuestion — lastQuestion can still hold the
     * prior briefing while Scenario 1 is already speaking.
     */
    [inFlightUtterance, priorPendingText, deps.lastQuestionTextRef.current ?? ''],
  );
  /**
   * Prefer the tracked in-flight line over speechSynthesis remaining. Mid-line synth
   * estimates are often a suffix of the contempt probe while parallel stream still holds
   * a muted S1 vignette — preferring synth then letting stream deltas rewrite pending
   * caused restore to jump between S1 opening and the contempt probe.
   *
   * Exception: when stream restore already holds a later scenario handoff/vignette and
   * in-flight is still a short prior probe (S2 James repair during S3 card speak), prefer
   * the stream text so Tap-to-continue does not rewind a scenario.
   */
  const spokenComplete = deps.parallelStreamingTtsRef.current.spokenCompleteText.trim();
  const streamLooksLikeLaterHandoff =
    looksLikeScenarioHandoffOrVignetteBundle(streamRestoreText) ||
    looksLikeScenarioHandoffOrVignetteBundle(spokenComplete);
  const inFlightLooksLikeStaleShortProbe =
    looksLikeBriefStreamAckOnly(inFlightUtterance) ||
    looksLikeShortProbeFallback(inFlightUtterance) ||
    isUnauthorizedS1TabRestoreFollowUp(inFlightUtterance);
  let utteranceSource:
    | 'in_flight'
    | 'speech_synth'
    | 'prior_pending'
    | 'stream_restore' = 'stream_restore';
  let utteranceRaw = streamRestoreText;
  if (
    streamLooksLikeLaterHandoff &&
    (inFlightLooksLikeStaleShortProbe ||
      looksLikeBriefStreamAckOnly(streamRestoreText) ||
      isUnauthorizedS1TabRestoreFollowUp(streamRestoreText))
  ) {
    utteranceRaw = looksLikeScenarioHandoffOrVignetteBundle(streamRestoreText)
      ? streamRestoreText
      : spokenComplete.length >= 12
        ? spokenComplete
        : streamRestoreText;
    utteranceSource = 'stream_restore';
  } else if (
    inFlightUtterance.length >= 12 &&
    !(
      looksLikeScenarioHandoffOrVignetteBundle(spokenComplete) &&
      (looksLikeBriefStreamAckOnly(inFlightUtterance) ||
        isUnauthorizedS1TabRestoreFollowUp(inFlightUtterance) ||
        looksLikeShortProbeFallback(inFlightUtterance))
    )
  ) {
    utteranceRaw = inFlightUtterance;
    utteranceSource = 'in_flight';
  } else if (priorPendingText.length >= 12 && deps.webTabRestoreReplayInFlightRef.current) {
    /** Second hide mid-restore: keep the line already queued for Tap-to-continue. */
    utteranceRaw =
      looksLikeScenarioHandoffOrVignetteBundle(spokenComplete) &&
      (isUnauthorizedS1TabRestoreFollowUp(priorPendingText) ||
        looksLikeBriefStreamAckOnly(priorPendingText) ||
        looksLikeShortProbeFallback(priorPendingText))
        ? spokenComplete
        : priorPendingText;
    utteranceSource = 'prior_pending';
  } else if (speechSynthRemaining) {
    utteranceRaw =
      looksLikeScenarioHandoffOrVignetteBundle(spokenComplete) &&
      (isUnauthorizedS1TabRestoreFollowUp(speechSynthRemaining) ||
        looksLikeShortProbeFallback(speechSynthRemaining))
        ? spokenComplete
        : speechSynthRemaining;
    utteranceSource = 'speech_synth';
  } else if (priorPendingText.length >= 12) {
    utteranceRaw =
      looksLikeScenarioHandoffOrVignetteBundle(spokenComplete) &&
      (isUnauthorizedS1TabRestoreFollowUp(priorPendingText) ||
        looksLikeBriefStreamAckOnly(priorPendingText) ||
        looksLikeShortProbeFallback(priorPendingText))
        ? spokenComplete
        : priorPendingText;
    utteranceSource = 'prior_pending';
  } else if (
    looksLikeScenarioHandoffOrVignetteBundle(spokenComplete) &&
    spokenComplete.length >= 12
  ) {
    utteranceRaw = spokenComplete;
    utteranceSource = 'stream_restore';
  }
  if (!utteranceRaw.trim()) {
    const lastQuestion = (deps.lastQuestionTextRef.current ?? '').trim();
    if (inFlightUtterance.length >= 12) {
      utteranceRaw = inFlightUtterance;
      utteranceSource = 'in_flight';
    } else if (lastQuestion.length >= 12) {
      utteranceRaw = lastQuestion;
      utteranceSource = 'stream_restore';
    }
  }
  const utterance = gateTabRestoreReplayTextForEmotionModal(
    substituteCanonicalInterviewScenarioBodiesForTts(utteranceRaw),
    {
      pendingEmotionModalTransitionRef: deps.pendingEmotionModalTransitionRef,
      emotionModalShownForScenarioRef: deps.emotionModalShownForScenarioRef,
    },
  );
  deps.webTtsTabInterruptPendingReplayRef.current = true;
  if (deps.parallelStreamingTtsRef.current.active && !htmlTabResume) {
    deps.parallelStreamingTtsRef.current.cancelRequested = true;
  }
  if (utterance.length > 0) {
    const utteranceNorm = normalizeTtsTextForConsecutiveDedup(utterance);
    /**
     * Skip only when this line was already fully delivered *and* we are not mid-restore /
     * mid-playback. Otherwise a second tab-hide during replay would match deliveredNorm
     * (or race with finish) and leave audio stopped with no Tap-to-continue.
     */
    const midRestoreOrPlayback =
      midRestoreOrPlaybackBeforeTeardown ||
      deps.webTabRestoreReplayInFlightRef.current ||
      deps.ttsLineInFlightRef.current;
    if (
      utteranceNorm === deps.webTabRestoreDeliveredNormRef.current &&
      !midRestoreOrPlayback
    ) {
      // #region agent log
      fetch('http://127.0.0.1:7668/ingest/668e0bd5-3283-4492-9f48-e33846c18218',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'03bb9d'},body:JSON.stringify({sessionId:'03bb9d',location:'runInterruptInterviewTtsForDocumentHidden.ts:delivered_norm_skip',message:'interrupt_skipped_delivered_norm',data:{utteranceLen:utterance.length,deliveredNorm:deps.webTabRestoreDeliveredNormRef.current,midRestoreOrPlayback,midRestoreOrPlaybackBeforeTeardown},timestamp:Date.now(),hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      deps.tabHiddenDuringActiveTtsLineRef.current = false;
      deps.mobileTabHideLetPlaybackContinueRef.current = false;
      deps.mobileTabHideBackgroundUtteranceRef.current = null;
      deps.webTtsTabInterruptPendingReplayRef.current = false;
      return;
    }
    const preferMobileReplay = Platform.OS === 'web' && getWebAutoplayContext().isMobileWeb;
    const useHtmlResume = htmlTabResume && !preferMobileReplay;
    if (utteranceNorm !== deps.webTabRestoreDeliveredNormRef.current) {
      deps.webTabRestoreDeliveredNormRef.current = null;
    }
    deps.pendingGestureRestoreSpeakRef.current = {
      text: utterance,
      restoreMode: useHtmlResume ? 'resume_html' : 'replay',
      queuedAtMs: Date.now(),
      options: { ...TAB_RESTORE_PENDING_SPEAK_OPTIONS },
      resolve: () => {},
      reject: () => {},
    };
    deps.needsGestureRestoreRef.current = true;
    deps.tabVisibilityGestureLossPendingRef.current = true;
    deps.setWebTabRestoreOverlayVisible(true);
    void remoteLog('[TAB_HIDE_INTERRUPT_QUEUED_RESTORE]', {
      utteranceLen: utterance.length,
      restoreMode: useHtmlResume ? 'resume_html' : 'replay',
      utteranceSource,
      htmlResumePending: htmlTabResume,
    });
    // #region agent log
    fetch('http://127.0.0.1:7668/ingest/668e0bd5-3283-4492-9f48-e33846c18218',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'03bb9d'},body:JSON.stringify({sessionId:'03bb9d',location:'runInterruptInterviewTtsForDocumentHidden.ts:queued',message:'interrupt_queued_restore',data:{utteranceLen:utterance.length,restoreMode:useHtmlResume?'resume_html':'replay',utteranceSource,midRestoreOrPlaybackBeforeTeardown},timestamp:Date.now(),hypothesisId:'D'})}).catch(()=>{});
    // #endregion
  } else {
    // #region agent log
    fetch('http://127.0.0.1:7668/ingest/668e0bd5-3283-4492-9f48-e33846c18218',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'03bb9d'},body:JSON.stringify({sessionId:'03bb9d',location:'runInterruptInterviewTtsForDocumentHidden.ts:empty_utterance',message:'interrupt_no_utterance_to_queue',data:{inFlightLen:inFlightUtterance.length,streamRestoreLen:streamRestoreText.length,lastQuestionLen:(deps.lastQuestionTextRef.current??'').trim().length},timestamp:Date.now(),hypothesisId:'D'})}).catch(()=>{});
    // #endregion
  }
  if (htmlTabResume && !(Platform.OS === 'web' && getWebAutoplayContext().isMobileWeb)) {
    deps.setTtsPlaybackActive(false);
    deps.ttsLineInFlightRef.current = false;
    deps.setVoiceState('idle');
  } else {
    deps.webTtsSpeakGenerationRef.current += 1;
    deps.setTtsPlaybackActive(false);
    deps.ttsLineInFlightRef.current = false;
    deps.setVoiceState('idle');
  }
}
