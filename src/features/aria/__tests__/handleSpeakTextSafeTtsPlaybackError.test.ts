import { describe, expect, it, jest } from '@jest/globals';

jest.mock('react-native', () => ({
  Platform: { OS: 'web' },
}));

jest.mock('@features/aria/speakTextSafeWebGestureGate', () => ({
  shouldSkipSpeakTextSafeAdvanceForTabInterrupt: jest.fn(() => false),
}));

jest.mock('@features/aria/interviewWebPendingSpeechGesture', () => ({
  setPendingWebSpeechGesturePair: jest.fn(),
}));

import { setPendingWebSpeechGesturePair } from '@features/aria/interviewWebPendingSpeechGesture';
import { handleSpeakTextSafeTtsPlaybackError } from '@features/aria/handleSpeakTextSafeTtsPlaybackError';
import { shouldSkipSpeakTextSafeAdvanceForTabInterrupt } from '@features/aria/speakTextSafeWebGestureGate';
import {
  WebInterviewTtsTabHiddenAbortError,
  WebTtsRequiresUserGestureError,
} from '@features/aria/utils/webTtsGestureErrors';

function baseArgs(
  overrides: Partial<Parameters<typeof handleSpeakTextSafeTtsPlaybackError>[0]> = {},
) {
  return {
    err: new Error('generic'),
    text: 'What is going on between these two?',
    interviewSpeechRole: 'assistant_response' as const,
    skipInterviewSpeechAdvance: false,
    isWeb: true,
    webTtsTabInterruptPendingReplay: false,
    speakGenerationAtStart: 1,
    webTtsSpeakGeneration: 1,
    setVoiceState: jest.fn(),
    pendingGestureRestoreSpeakRef: { current: null },
    needsGestureRestoreRef: { current: false },
    setWebTabGestureRestoreOverlay: jest.fn(),
    pendingWebSpeechForGestureRef: { current: null },
    ensureWebGestureFlushListener: jest.fn(),
    setWebDesktopPendingTtsGestureOverlay: jest.fn(),
    applyInterviewSpeechComplete: jest.fn(),
    ...overrides,
  };
}

describe('handleSpeakTextSafeTtsPlaybackError', () => {
  it('queues gesture restore overlay after tab-hidden abort when replay is pending', () => {
    const args = baseArgs({
      err: new WebInterviewTtsTabHiddenAbortError(),
      pendingGestureRestoreSpeakRef: { current: { text: 'replay me', options: {} } },
    });

    handleSpeakTextSafeTtsPlaybackError(args);

    expect(args.setVoiceState).toHaveBeenCalledWith('idle');
    expect(args.needsGestureRestoreRef.current).toBe(true);
    expect(args.setWebTabGestureRestoreOverlay).toHaveBeenCalledWith(true);
    expect(args.applyInterviewSpeechComplete).not.toHaveBeenCalled();
  });

  it('stores pending web speech and still advances assistant text on gesture-required errors', () => {
    const args = baseArgs({ err: new WebTtsRequiresUserGestureError('Replay line') });

    handleSpeakTextSafeTtsPlaybackError(args);

    expect(setPendingWebSpeechGesturePair).toHaveBeenCalledWith(
      args.pendingWebSpeechForGestureRef,
      'Replay line',
    );
    expect(args.setWebDesktopPendingTtsGestureOverlay).toHaveBeenCalledWith(true);
    expect(args.applyInterviewSpeechComplete).toHaveBeenCalledWith(args.text);
  });

  it('falls back to visual display and advances assistant speech on generic failures', () => {
    const args = baseArgs();

    handleSpeakTextSafeTtsPlaybackError(args);

    expect(args.setVoiceState).toHaveBeenCalledWith('idle');
    expect(args.applyInterviewSpeechComplete).toHaveBeenCalledWith(args.text);
    expect(shouldSkipSpeakTextSafeAdvanceForTabInterrupt).toHaveBeenCalled();
  });
});
