import type { MutableRefObject } from 'react';

import type { PendingGestureRestoreSpeakEntry } from '@features/aria/hooks/useAriaInterviewSession';
import type { SpeakTextSafeOptions } from '@features/aria/speakTextSafeDeps';
import type { TtsTelemetrySource } from '@features/aria/telemetry/tsAutoplayTelemetry';
import { hasWebInterviewHtmlAudioTabResumePending } from '@features/aria/utils/webInterviewHtmlAudioTabResume';
import { isWebInterviewAudioUnlocked } from '@features/aria/utils/webInterviewWebAudioContext';
import type { GestureContextLostReason } from '@features/aria/utils/webInterviewGestureContext';
import {
  clearAiProcessingTurnStarted,
  peekAiProcessingTurnStartedAtMs,
} from '@features/aria/utils/webInterviewGestureContext';
import {
  isPreAuthorizedAudioPendingForNextTts,
  refreshPreAuthorizedAudioForLongProcessingGap,
  reauthorizePendingPreAuthorizedElement,
} from '@features/aria/utils/webPreAuthorizedTtsAudio';
import { isWebInterviewTtsTabHiddenAbortError } from '@features/aria/utils/webTtsGestureErrors';
import { getSessionLogRuntime, writeSessionLog } from '@utilities/sessionLogging';

export function webSpeakNeedsTabReauth(args: {
  documentVisible: boolean;
  needsGestureRestore: boolean;
  tabVisibilityGestureLossPending: boolean;
  gestureContextLostReason: GestureContextLostReason | null | undefined;
}): boolean {
  return (
    !args.documentVisible ||
    args.needsGestureRestore ||
    args.tabVisibilityGestureLossPending ||
    args.gestureContextLostReason === 'tab_visibility_change'
  );
}

export function shouldClearGestureRestoreAfterTabReauth(args: {
  webTtsTabInterruptPendingReplay: boolean;
  pendingGestureRestoreSpeak: PendingGestureRestoreSpeakEntry | null;
}): boolean {
  return !args.webTtsTabInterruptPendingReplay && args.pendingGestureRestoreSpeak == null;
}

export function isSpeakTextSafeInFlightTabRestorePending(args: {
  isWeb: boolean;
  webTtsTabInterruptPendingReplay: boolean;
  tabHiddenDuringActiveTtsLine: boolean;
  speakGenerationAtStart: number;
  webTtsSpeakGeneration: number;
}): boolean {
  return (
    args.isWeb &&
    (args.webTtsTabInterruptPendingReplay ||
      args.tabHiddenDuringActiveTtsLine ||
      args.speakGenerationAtStart !== args.webTtsSpeakGeneration)
  );
}

export function shouldYieldSpeakTextSafeInFlightToTabRestore(args: {
  isWeb: boolean;
  telemetrySourceOpt: TtsTelemetrySource | undefined;
  skipGestureGate: boolean;
  webTtsTabInterruptPendingReplay: boolean;
  tabHiddenDuringActiveTtsLine: boolean;
  speakGenerationAtStart: number;
  webTtsSpeakGeneration: number;
}): boolean {
  return (
    isSpeakTextSafeInFlightTabRestorePending(args) &&
    args.telemetrySourceOpt !== 'replay' &&
    !args.skipGestureGate
  );
}

export function shouldSkipSpeakTextSafeAdvanceForTabInterrupt(args: {
  isWeb: boolean;
  webTtsTabInterruptPendingReplay: boolean;
  speakGenerationAtStart: number;
  webTtsSpeakGeneration: number;
  err: unknown;
}): boolean {
  return (
    args.isWeb &&
    (args.webTtsTabInterruptPendingReplay ||
      args.speakGenerationAtStart !== args.webTtsSpeakGeneration ||
      isWebInterviewTtsTabHiddenAbortError(args.err))
  );
}

export function readWebTtsGestureContextTelemetry(args: {
  isWeb: boolean;
  mobileWebTapToBeginDone: boolean;
}): {
  gestureContextActive: boolean | null;
  webTtsGestureErrorPrevented: boolean | null;
} {
  if (!args.isWeb) {
    return { gestureContextActive: null, webTtsGestureErrorPrevented: null };
  }
  const nav = typeof navigator !== 'undefined' ? navigator : undefined;
  const ua = nav as (Navigator & { userActivation?: { isActive?: boolean } }) | undefined;
  const gestureContextActive = ua?.userActivation?.isActive === true;
  const webUnlock = isWebInterviewAudioUnlocked();
  const webTtsGestureErrorPrevented =
    webUnlock && (gestureContextActive === true || args.mobileWebTapToBeginDone);
  return { gestureContextActive, webTtsGestureErrorPrevented };
}

export function buildPendingGestureRestoreSpeakPayload(args: {
  text: string;
  options: SpeakTextSafeOptions;
  prior: PendingGestureRestoreSpeakEntry | null;
  defaultRestoreMode?: 'resume_html' | 'replay';
}): Omit<PendingGestureRestoreSpeakEntry, 'resolve' | 'reject'> {
  const preserveHtmlResume =
    args.prior?.restoreMode === 'resume_html' || hasWebInterviewHtmlAudioTabResumePending();
  return {
    text: preserveHtmlResume && args.prior?.text ? args.prior.text : args.text,
    restoreMode: preserveHtmlResume
      ? 'resume_html'
      : (args.prior?.restoreMode ?? args.defaultRestoreMode),
    queuedAtMs: args.prior?.queuedAtMs ?? Date.now(),
    options: { ...args.options },
  };
}

export function queueSpeakTextSafePendingGestureRestore(args: {
  text: string;
  options: SpeakTextSafeOptions;
  prior: PendingGestureRestoreSpeakEntry | null;
  pendingGestureRestoreSpeakRef: MutableRefObject<PendingGestureRestoreSpeakEntry | null>;
  setWebTabGestureRestoreOverlay: (visible: boolean) => void;
  defaultRestoreMode?: 'resume_html' | 'replay';
}): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    args.pendingGestureRestoreSpeakRef.current = {
      ...buildPendingGestureRestoreSpeakPayload({
        text: args.text,
        options: args.options,
        prior: args.prior,
        defaultRestoreMode: args.defaultRestoreMode,
      }),
      resolve,
      reject,
    };
    args.setWebTabGestureRestoreOverlay(true);
  });
}

export async function refreshSpeakTextSafeWebGestureAfterLongProcessing(userId: string): Promise<boolean> {
  const processingStartedAt = peekAiProcessingTurnStartedAtMs();
  if (processingStartedAt == null) {
    return false;
  }
  const gapMs = Date.now() - processingStartedAt;
  clearAiProcessingTurnStarted();
  await refreshPreAuthorizedAudioForLongProcessingGap();
  const usePreauthorized = isPreAuthorizedAudioPendingForNextTts();
  if (userId) {
    const rProc = getSessionLogRuntime();
    writeSessionLog({
      userId,
      attemptId: rProc.attemptId,
      eventType: 'gesture_context_refresh_on_long_processing',
      eventData: {
        processing_gap_ms: gapMs,
        trigger_reason: 'pre_tts_delivery_refresh',
      },
      platform: rProc.platform,
    });
  }
  return usePreauthorized;
}

export async function waitForDocumentVisible(): Promise<boolean> {
  if (typeof document === 'undefined' || document.visibilityState === 'visible') {
    return false;
  }
  await new Promise<void>((resolve) => {
    const onVis = () => {
      if (document.visibilityState === 'visible') {
        document.removeEventListener('visibilitychange', onVis);
        resolve();
      }
    };
    document.addEventListener('visibilitychange', onVis);
  });
  return true;
}

export async function runSpeakTextSafePreauthorizedTabGestureRestore(args: {
  userId: string;
  needsGestureRestoreRef: MutableRefObject<boolean>;
  tabVisibilityGestureLossPendingRef: MutableRefObject<boolean>;
  gestureContextLostAtRef: MutableRefObject<{ atMs: number; reason: GestureContextLostReason } | null>;
  webTtsTabInterruptPendingReplayRef: MutableRefObject<boolean>;
  pendingGestureRestoreSpeakRef: MutableRefObject<PendingGestureRestoreSpeakEntry | null>;
  setWebTabGestureRestoreOverlay: (visible: boolean) => void;
}): Promise<{
  ttsQueuedPendingTabReturn: boolean;
  gestureRestoredAfterTabSwitch: boolean;
}> {
  const documentVisible = typeof document === 'undefined' || document.visibilityState === 'visible';
  const needsTabReauth = webSpeakNeedsTabReauth({
    documentVisible,
    needsGestureRestore: args.needsGestureRestoreRef.current,
    tabVisibilityGestureLossPending: args.tabVisibilityGestureLossPendingRef.current,
    gestureContextLostReason: args.gestureContextLostAtRef.current?.reason,
  });
  if (!needsTabReauth || typeof document === 'undefined') {
    return { ttsQueuedPendingTabReturn: false, gestureRestoredAfterTabSwitch: false };
  }

  const ttsQueuedPendingTabReturn = await waitForDocumentVisible();
  await reauthorizePendingPreAuthorizedElement();

  let gestureRestoredAfterTabSwitch = false;
  if (
    shouldClearGestureRestoreAfterTabReauth({
      webTtsTabInterruptPendingReplay: args.webTtsTabInterruptPendingReplayRef.current,
      pendingGestureRestoreSpeak: args.pendingGestureRestoreSpeakRef.current,
    })
  ) {
    args.needsGestureRestoreRef.current = false;
    args.tabVisibilityGestureLossPendingRef.current = false;
    args.gestureContextLostAtRef.current = null;
    args.setWebTabGestureRestoreOverlay(false);
    args.pendingGestureRestoreSpeakRef.current = null;
    gestureRestoredAfterTabSwitch = true;
    if (args.userId) {
      const r = getSessionLogRuntime();
      writeSessionLog({
        userId: args.userId,
        attemptId: r.attemptId,
        eventType: 'gesture_restored_after_tab_switch',
        eventData: { gesture_restored_after_tab_switch: true },
        platform: r.platform,
      });
    }
  }

  return { ttsQueuedPendingTabReturn, gestureRestoredAfterTabSwitch };
}
