import { transcriptHasInterviewClosingAssistantMessage } from '@features/aria/elongatingProbe';
import type { InterviewDocumentVisibilityTtsDeps } from '@features/aria/interviewDocumentVisibilityTtsTypes';
import { runRestoreReferenceCardFromTranscriptIfNeeded } from '@features/aria/interviewReferenceCardResumeHelpers';

export function runHandleInterviewDocumentVisible(deps: InterviewDocumentVisibilityTtsDeps): void {
  if (typeof document === 'undefined' || document.visibilityState !== 'visible') return;
  if (!deps.docVisibilityWasHiddenRef.current) return;
  deps.docVisibilityWasHiddenRef.current = false;
  if (deps.interviewStatusRef.current !== 'in_progress') return;
  if (
    deps.isInterviewCompleteRef.current ||
    transcriptHasInterviewClosingAssistantMessage(deps.currentMessagesRef.current)
  ) {
    return;
  }
  runRestoreReferenceCardFromTranscriptIfNeeded({
    messages: deps.currentMessagesRef.current,
    committedScenarioRef: deps.committedScenarioRef,
    isAssistantBubbleForTranscript: deps.isAssistantBubbleForTranscript,
    setInterviewUiPhase: deps.setInterviewUiPhase,
    setReferenceCardPrompt: deps.setReferenceCardPrompt,
    setReferenceCardScenario: deps.setReferenceCardScenario,
  });
  deps.syncInterviewTtsAfterScreenReturn();
  // #region agent log
  fetch('http://127.0.0.1:7668/ingest/668e0bd5-3283-4492-9f48-e33846c18218',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'03bb9d'},body:JSON.stringify({sessionId:'03bb9d',location:'runHandleInterviewDocumentVisible.ts:after_sync',message:'document_visible_restore_state',data:{hasPending:deps.pendingGestureRestoreSpeakRef.current!=null,tabHiddenFlag:deps.tabHiddenDuringActiveTtsLineRef.current,replayInFlight:deps.webTabRestoreReplayInFlightRef.current,interruptPending:deps.webTtsTabInterruptPendingReplayRef.current},timestamp:Date.now(),hypothesisId:'C'})}).catch(()=>{});
  // #endregion
  if (deps.webTabRestoreReplayInFlightRef.current) return;
  const emotionDeferred = deps.pendingEmotionModalTransitionRef?.current;
  if (
    emotionDeferred &&
    deps.emotionModalShownForScenarioRef &&
    !deps.emotionModalShownForScenarioRef.current.has(emotionDeferred.completedScenario)
  ) {
    deps.needsGestureRestoreRef.current = true;
    deps.tabVisibilityGestureLossPendingRef.current = true;
    deps.setWebTabRestoreOverlayVisible(true);
    deps.ensureWebGestureFlushListener();
    return;
  }
  if (
    deps.hasWebInterviewHtmlAudioTabResumePending() &&
    !deps.isWebInterviewPlaybackAudiblyActive()
  ) {
    deps.needsGestureRestoreRef.current = true;
    deps.tabVisibilityGestureLossPendingRef.current = true;
    deps.setWebTabRestoreOverlayVisible(true);
    deps.ensureWebGestureFlushListener();
    void deps.handleWebTabGestureRestoreTapRef.current?.();
    return;
  }
  if (deps.mobileTabHideLetPlaybackContinueRef.current) return;
  if (!deps.pendingGestureRestoreSpeakRef.current && !deps.tabHiddenDuringActiveTtsLineRef.current) {
    return;
  }
  deps.needsGestureRestoreRef.current = true;
  deps.tabVisibilityGestureLossPendingRef.current = true;
  if (deps.pendingGestureRestoreSpeakRef.current) {
    deps.setWebTabRestoreOverlayVisible(true);
    deps.ensureWebGestureFlushListener();
  }
}
