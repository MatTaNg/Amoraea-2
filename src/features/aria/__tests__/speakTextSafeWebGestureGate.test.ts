import { describe, expect, it } from '@jest/globals';

import { WebInterviewTtsTabHiddenAbortError } from '@features/aria/utils/webTtsGestureErrors';
import {
  buildPendingGestureRestoreSpeakPayload,
  isSpeakTextSafeInFlightTabRestorePending,
  shouldClearGestureRestoreAfterTabReauth,
  shouldSkipSpeakTextSafeAdvanceForTabInterrupt,
  shouldYieldSpeakTextSafeInFlightToTabRestore,
  webSpeakNeedsTabReauth,
} from '@features/aria/speakTextSafeWebGestureGate';

describe('webSpeakNeedsTabReauth', () => {
  it('returns true when the document is hidden', () => {
    expect(
      webSpeakNeedsTabReauth({
        documentVisible: false,
        needsGestureRestore: false,
        tabVisibilityGestureLossPending: false,
        gestureContextLostReason: undefined,
      }),
    ).toBe(true);
  });

  it('returns true when tab visibility gesture loss is pending', () => {
    expect(
      webSpeakNeedsTabReauth({
        documentVisible: true,
        needsGestureRestore: false,
        tabVisibilityGestureLossPending: true,
        gestureContextLostReason: undefined,
      }),
    ).toBe(true);
  });
});

describe('shouldClearGestureRestoreAfterTabReauth', () => {
  it('returns false when a tab-hide replay is already queued', () => {
    expect(
      shouldClearGestureRestoreAfterTabReauth({
        webTtsTabInterruptPendingReplay: true,
        pendingGestureRestoreSpeak: null,
      }),
    ).toBe(false);
  });

  it('returns true when no replay or pending restore is queued', () => {
    expect(
      shouldClearGestureRestoreAfterTabReauth({
        webTtsTabInterruptPendingReplay: false,
        pendingGestureRestoreSpeak: null,
      }),
    ).toBe(true);
  });
});

describe('isSpeakTextSafeInFlightTabRestorePending', () => {
  it('detects generation mismatch during web playback', () => {
    expect(
      isSpeakTextSafeInFlightTabRestorePending({
        isWeb: true,
        webTtsTabInterruptPendingReplay: false,
        tabHiddenDuringActiveTtsLine: false,
        speakGenerationAtStart: 1,
        webTtsSpeakGeneration: 2,
      }),
    ).toBe(true);
  });

  it('returns false on native platforms', () => {
    expect(
      isSpeakTextSafeInFlightTabRestorePending({
        isWeb: false,
        webTtsTabInterruptPendingReplay: true,
        tabHiddenDuringActiveTtsLine: true,
        speakGenerationAtStart: 1,
        webTtsSpeakGeneration: 9,
      }),
    ).toBe(false);
  });
});

describe('shouldYieldSpeakTextSafeInFlightToTabRestore', () => {
  it('does not yield replay telemetry turns', () => {
    expect(
      shouldYieldSpeakTextSafeInFlightToTabRestore({
        isWeb: true,
        telemetrySourceOpt: 'replay',
        skipGestureGate: false,
        webTtsTabInterruptPendingReplay: true,
        tabHiddenDuringActiveTtsLine: false,
        speakGenerationAtStart: 1,
        webTtsSpeakGeneration: 1,
      }),
    ).toBe(false);
  });

  it('yields when tab interrupt is pending and gesture gate is active', () => {
    expect(
      shouldYieldSpeakTextSafeInFlightToTabRestore({
        isWeb: true,
        telemetrySourceOpt: 'turn',
        skipGestureGate: false,
        webTtsTabInterruptPendingReplay: true,
        tabHiddenDuringActiveTtsLine: false,
        speakGenerationAtStart: 1,
        webTtsSpeakGeneration: 1,
      }),
    ).toBe(true);
  });
});

describe('shouldSkipSpeakTextSafeAdvanceForTabInterrupt', () => {
  it('skips advance when tab-hidden abort fires', () => {
    expect(
      shouldSkipSpeakTextSafeAdvanceForTabInterrupt({
        isWeb: true,
        webTtsTabInterruptPendingReplay: false,
        speakGenerationAtStart: 1,
        webTtsSpeakGeneration: 1,
        err: new WebInterviewTtsTabHiddenAbortError(),
      }),
    ).toBe(true);
  });
});

describe('buildPendingGestureRestoreSpeakPayload', () => {
  it('preserves prior html resume text when resume mode is active', () => {
    const payload = buildPendingGestureRestoreSpeakPayload({
      text: 'new turn text',
      options: { silent: false },
      prior: {
        text: 'prior replay text',
        restoreMode: 'resume_html',
        queuedAtMs: 100,
        options: {},
        resolve: () => {},
        reject: () => {},
      },
    });

    expect(payload.text).toBe('prior replay text');
    expect(payload.restoreMode).toBe('resume_html');
    expect(payload.queuedAtMs).toBe(100);
  });
});
