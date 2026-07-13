import type { MutableRefObject } from 'react';
import { Platform } from 'react-native';

import { setPendingWebSpeechGesturePair } from '@features/aria/interviewWebPendingSpeechGesture';
import {
  isWebInterviewTtsTabHiddenAbortError,
  isWebTtsRequiresUserGestureError,
} from '@features/aria/utils/webTtsGestureErrors';
import type { VoiceState } from '@features/aria/hooks/useAriaInterviewSession';
import type { PendingGestureRestoreSpeakEntry } from '@features/aria/hooks/useAriaInterviewSession';
import { shouldSkipSpeakTextSafeAdvanceForTabInterrupt } from '@features/aria/speakTextSafeWebGestureGate';

export function handleSpeakTextSafeTtsPlaybackError(args: {
  err: unknown;
  text: string;
  interviewSpeechRole?: 'assistant_response';
  skipInterviewSpeechAdvance: boolean;
  isWeb: boolean;
  webTtsTabInterruptPendingReplay: boolean;
  speakGenerationAtStart: number;
  webTtsSpeakGeneration: number;
  setVoiceState: (state: VoiceState) => void;
  pendingGestureRestoreSpeakRef: MutableRefObject<PendingGestureRestoreSpeakEntry | null>;
  needsGestureRestoreRef: MutableRefObject<boolean>;
  setWebTabGestureRestoreOverlay: (visible: boolean) => void;
  pendingWebSpeechForGestureRef: MutableRefObject<string | null>;
  ensureWebGestureFlushListener: () => void;
  setWebDesktopPendingTtsGestureOverlay: (visible: boolean) => void;
  applyInterviewSpeechComplete: (rawText: string) => void;
}): void {
  const skipAdvanceForTabInterrupt = shouldSkipSpeakTextSafeAdvanceForTabInterrupt({
    isWeb: args.isWeb,
    webTtsTabInterruptPendingReplay: args.webTtsTabInterruptPendingReplay,
    speakGenerationAtStart: args.speakGenerationAtStart,
    webTtsSpeakGeneration: args.webTtsSpeakGeneration,
    err: args.err,
  });

  if (isWebInterviewTtsTabHiddenAbortError(args.err)) {
    args.setVoiceState('idle');
    if (args.pendingGestureRestoreSpeakRef.current) {
      args.needsGestureRestoreRef.current = true;
      args.setWebTabGestureRestoreOverlay(true);
    }
    return;
  }

  if (isWebTtsRequiresUserGestureError(args.err)) {
    setPendingWebSpeechGesturePair(args.pendingWebSpeechForGestureRef, args.err.text);
    args.ensureWebGestureFlushListener();
    if (Platform.OS === 'web') {
      args.setWebDesktopPendingTtsGestureOverlay(true);
    }
    args.setVoiceState('idle');
    if (
      !skipAdvanceForTabInterrupt &&
      args.interviewSpeechRole === 'assistant_response' &&
      !args.skipInterviewSpeechAdvance
    ) {
      args.applyInterviewSpeechComplete(args.text);
    }
    return;
  }

  if (__DEV__) {
    console.warn(
      'TTS failed, falling back to visual display:',
      args.err instanceof Error ? args.err.message : args.err,
    );
  }
  args.setVoiceState('idle');
  if (
    !skipAdvanceForTabInterrupt &&
    args.interviewSpeechRole === 'assistant_response' &&
    !args.skipInterviewSpeechAdvance
  ) {
    args.applyInterviewSpeechComplete(args.text);
  }
}
