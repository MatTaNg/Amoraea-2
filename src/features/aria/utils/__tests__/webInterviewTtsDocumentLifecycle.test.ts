import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('react-native', () => ({
  Platform: { OS: 'web' },
}));

jest.mock('../webInterviewHtmlAudioTabRestoreOrchestration', () => ({
  canSoftPauseActiveWebHtmlAudioForTabResume: jest.fn(() => false),
  clearHtmlAudioTabResumeState: jest.fn(),
  clearWebInterviewHtmlTabRestoreState: jest.fn(),
  holdTabStashedHtmlAudioForGestureResume: jest.fn(),
  refreshWebInterviewHtmlTabStashForRepeatHide: jest.fn(),
  softPauseActiveWebHtmlAudioForTabHide: jest.fn(),
}));

jest.mock('../webInterviewHtmlAudioTabResume', () => ({
  hasWebInterviewHtmlAudioTabResumePending: jest.fn(() => false),
  isWebInterviewMidUtteranceTabResumeActive: jest.fn(() => false),
}));

jest.mock('../webInterviewPlaybackSurface', () => ({
  isWebInterviewPlaybackSurfaceActive: jest.fn(() => false),
}));

jest.mock('../webInterviewWebAudioPlaybackSurface', () => ({
  bumpWebInterviewTtsScheduleEpoch: jest.fn(),
  resetWebInterviewWebAudioPlaybackSurface: jest.fn(),
  stopActiveWebBufferAndPcmPlayback: jest.fn(),
}));

jest.mock('../webInterviewHtmlAudioPlaybackHooks', () => ({
  abortInFlightWebInterviewPlaybackForTabHide: jest.fn(),
  resetWebInterviewHtmlAudioPlaybackHooks: jest.fn(),
}));

jest.mock('../webInterviewWebAudioContext', () => ({
  getSharedWebAudioContext: jest.fn(() => null),
  resetWebInterviewWebAudioContext: jest.fn(),
  suspendSharedWebAudioContextForTabHide: jest.fn(),
  unlockWebInterviewSharedAudioContext: jest.fn(),
  ensureSharedWebAudioContextResumedForPlayback: jest.fn(async () => true),
}));

jest.mock('../webInterviewAudioVisibilityTeardown', () => ({
  attachWebInterviewAudioVisibilityHandler: jest.fn(),
  clearWebTabHideAudioTeardownApplied: jest.fn(),
  markWebTabHideAudioTeardownApplied: jest.fn(),
  resetWebInterviewAudioVisibilityTeardown: jest.fn(),
  takeWebTabHideAudioTeardownApplied: jest.fn(() => false),
}));

jest.mock('../webInterviewActiveHtmlAudio', () => ({
  assignActiveWebHtmlAudioObjectUrl: jest.fn(),
  clearActiveWebHtmlAudio: jest.fn(),
  getActiveWebHtmlAudioRef: jest.fn(() => null),
  resetWebInterviewActiveHtmlAudio: jest.fn(),
}));

jest.mock('../webInterviewSharedHtmlAudio', () => ({
  reprimeSharedHtmlAudioSilentPlay: jest.fn(),
  resetWebInterviewSharedHtmlAudio: jest.fn(),
}));

jest.mock('../webInterviewGestureContext', () => ({
  markWebTabBecameVisible: jest.fn(),
}));

jest.mock('../webInterviewTtsOutputVolume', () => ({
  ensureWebInterviewTtsOutputVolumePrimed: jest.fn(),
}));

jest.mock('../elevenLabsSpokenContext', () => ({
  resetElevenLabsSpokenContext: jest.fn(),
}));

jest.mock('../webInterviewPendingGestureBlob', () => ({
  resetWebInterviewPendingGestureBlob: jest.fn(),
}));

jest.mock('../nativeElevenLabsMp3Playback', () => ({
  resetNativeElevenLabsMp3PlaybackState: jest.fn(),
}));

jest.mock('../interviewWebSpeechSynthesis', () => ({
  resetCachedWebSpeechVoice: jest.fn(),
}));

import { clearWebTabHideAudioTeardownApplied } from '../webInterviewAudioVisibilityTeardown';
import { isWebInterviewPlaybackSurfaceActive } from '../webInterviewPlaybackSurface';
import {
  interruptWebInterviewTtsForTabHide,
  pauseWebInterviewHtmlAudioForDocumentHidden,
  resetWebInterviewAudioSession,
} from '../webInterviewTtsDocumentLifecycle';

describe('webInterviewTtsDocumentLifecycle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('pauseWebInterviewHtmlAudioForDocumentHidden clears teardown flag when idle', () => {
    pauseWebInterviewHtmlAudioForDocumentHidden();
    expect(clearWebTabHideAudioTeardownApplied).toHaveBeenCalled();
    expect(isWebInterviewPlaybackSurfaceActive).toHaveBeenCalled();
  });

  it('interruptWebInterviewTtsForTabHide delegates to document hidden handler', () => {
    interruptWebInterviewTtsForTabHide();
    expect(clearWebTabHideAudioTeardownApplied).toHaveBeenCalled();
  });

  it('resetWebInterviewAudioSession resets spoken context and web modules', () => {
    expect(() => resetWebInterviewAudioSession()).not.toThrow();
  });
});
