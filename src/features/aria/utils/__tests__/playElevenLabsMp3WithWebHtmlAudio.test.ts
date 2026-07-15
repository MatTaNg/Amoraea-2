import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockFinalizeInterviewMicAmbientOnTtsEnd = jest.fn();
const mockTakePreAuthorizedAudioElementForTts = jest.fn(() => null as HTMLAudioElement | null);
const mockIsWebAudioAutoplayBlockedError = jest.fn((err: unknown) => {
  return err instanceof Error && err.name === 'NotAllowedError';
});

jest.mock('react-native', () => ({
  Platform: { OS: 'web' },
}));

jest.mock('@features/aria/utils/webInterviewMicPreInit', () => ({
  finalizeInterviewMicAmbientOnTtsEnd: (...args: unknown[]) =>
    mockFinalizeInterviewMicAmbientOnTtsEnd(...args),
}));

jest.mock('@features/aria/utils/webInterviewMicPreInitKick', () => ({
  kickInterviewMicPreInitForTtsPlayback: jest.fn(),
}));

jest.mock('../interviewWebSpeechSynthesis', () => ({
  speakWithWebSpeechSynthesis: jest.fn(async () => ({ ok: false, error: 'no-api' })),
}));

jest.mock('../webPreAuthorizedTtsAudio', () => ({
  takePreAuthorizedAudioElementForTts: () => mockTakePreAuthorizedAudioElementForTts(),
}));

jest.mock('../webInterviewWebAudioContext', () => ({
  ensureSharedWebAudioContextResumedForPlayback: jest.fn(async () => true),
}));

jest.mock('../webInterviewHtmlAudioVolume', () => ({
  ensureWebHtmlAudioElementMaxVolume: jest.fn(),
  waitForWebHtmlAudioElementReady: jest.fn(async () => undefined),
}));

jest.mock('../webTtsAutoplayPolicy', () => ({
  isWebAudioAutoplayBlockedError: (err: unknown) => mockIsWebAudioAutoplayBlockedError(err),
}));

jest.mock('../webSpeechDeferPolicy', () => ({
  webSpeechShouldDeferToUserGesture: jest.fn(() => false),
}));

jest.mock('../webInterviewSharedHtmlAudio', () => ({
  ensureSharedHtmlAudioElementForInterviewTts: jest.fn(() => null),
  getSharedHtmlAudioForMobileTts: jest.fn(() => null),
  hasSharedHtmlAudioForInterviewTts: jest.fn(() => false),
}));

jest.mock('../webInterviewHtmlAudioTabResume', () => ({
  applyTabStashedHtmlAudioVolume: jest.fn(),
  getTabHtmlAudioResumeSnapshot: jest.fn(() => null),
  hasWebInterviewHtmlAudioTabResumePending: jest.fn(() => false),
  isHtmlAudioPausedForTabResume: jest.fn(() => false),
}));

jest.mock('../webInterviewHtmlAudioTabRestoreOrchestration', () => ({
  clearHtmlAudioTabResumeState: jest.fn(),
}));

jest.mock('../webInterviewHtmlAudioPlaybackHooks', () => ({
  assignAbortActiveWebHtmlAudioPlayback: jest.fn(),
  assignActiveWebHtmlAudioPlaybackHandoff: jest.fn(),
  clearAbortActiveWebHtmlAudioPlaybackIfMatches: jest.fn(),
  clearActiveWebHtmlAudioPlaybackHandoffIfObjectUrl: jest.fn(),
}));

jest.mock('../webInterviewActiveHtmlAudio', () => ({
  assignActiveWebHtmlAudio: jest.fn(),
  assignActiveWebHtmlAudioObjectUrl: jest.fn(),
  clearActiveWebHtmlAudio: jest.fn(),
  clearActiveWebHtmlAudioObjectUrlIfMatches: jest.fn(),
}));

jest.mock('../webInterviewPendingGestureBlob', () => ({
  assignPendingWebGestureBlobUrl: jest.fn(),
}));

jest.mock('../webInterviewHtmlAudioSafetyTimeout', () => ({
  createWebInterviewHtmlAudioSafetyTimeoutScheduler: () => ({
    clearSafetyTimeout: jest.fn(),
    attachMetadataListeners: jest.fn(),
  }),
}));

jest.mock('@features/aria/telemetry/tsAutoplayTelemetry', () => ({
  logTtsAutoplayPlayOutcome: jest.fn(),
}));

import { playElevenLabsMp3WithWebHtmlAudio } from '../playElevenLabsMp3WithWebHtmlAudio';

function makeAudioElement(playImpl: () => Promise<void>) {
  const el = {
    muted: false,
    src: '',
    volume: 1,
    playbackRate: 1,
    paused: true,
    ended: false,
    currentTime: 0,
    pause: jest.fn(),
    play: jest.fn(playImpl),
    onended: null as null | (() => void),
    onerror: null as null | (() => void),
  };
  return el as unknown as HTMLAudioElement & {
    play: jest.Mock;
    onended: null | (() => void);
  };
}

describe('playElevenLabsMp3WithWebHtmlAudio', () => {
  beforeEach(() => {
    mockFinalizeInterviewMicAmbientOnTtsEnd.mockClear();
    mockTakePreAuthorizedAudioElementForTts.mockReset();
    mockTakePreAuthorizedAudioElementForTts.mockReturnValue(null);
    mockIsWebAudioAutoplayBlockedError.mockImplementation((err: unknown) => {
      return err instanceof Error && err.name === 'NotAllowedError';
    });
    (globalThis as { URL?: { createObjectURL: (b: Blob) => string; revokeObjectURL: (u: string) => void } }).URL =
      {
        createObjectURL: () => 'blob:test-audio',
        revokeObjectURL: jest.fn(),
      };
  });

  it('autoplay-retry path waits for onended instead of resolving immediately after play()', async () => {
    const NotAllowed = Object.assign(new Error('blocked'), { name: 'NotAllowedError' });
    let playCount = 0;
    const htmlAudio = makeAudioElement(async () => {
      playCount += 1;
      if (playCount === 1) throw NotAllowed;
    });
    mockTakePreAuthorizedAudioElementForTts.mockReturnValue(htmlAudio);
    (globalThis as { Audio?: unknown }).Audio = jest.fn(() => htmlAudio) as unknown as typeof Audio;

    const done = playElevenLabsMp3WithWebHtmlAudio({
      arrayBuffer: new ArrayBuffer(8),
      spokenText: 'Hello from Amoraea',
      telemetrySource: 'turn',
      preInitTriggerDuring: 'tts_playback',
      playbackRateMultiplier: 1,
      preferTabResumableHtmlAudio: true,
      options: { prefetchedMpegArrayBuffer: new ArrayBuffer(8) },
    });

    let resolved = false;
    let rejected: unknown = null;
    void done.then(
      () => {
        resolved = true;
      },
      (err) => {
        rejected = err;
      },
    );

    for (let i = 0; i < 10; i += 1) {
      await Promise.resolve();
      if (playCount >= 2 || rejected) break;
    }
    expect(rejected).toBeNull();
    expect(playCount).toBe(2);
    expect(resolved).toBe(false);

    htmlAudio.onended?.();
    await done;
    expect(resolved).toBe(true);
    expect(mockFinalizeInterviewMicAmbientOnTtsEnd).toHaveBeenCalled();
  });

  it('primary play path resolves only after onended', async () => {
    const htmlAudio = makeAudioElement(async () => undefined);
    mockTakePreAuthorizedAudioElementForTts.mockReturnValue(htmlAudio);
    (globalThis as { Audio?: unknown }).Audio = jest.fn(() => htmlAudio) as unknown as typeof Audio;

    const done = playElevenLabsMp3WithWebHtmlAudio({
      arrayBuffer: new ArrayBuffer(8),
      spokenText: 'Hello from Amoraea',
      telemetrySource: 'turn',
      preInitTriggerDuring: 'tts_playback',
      playbackRateMultiplier: 1,
      preferTabResumableHtmlAudio: true,
    });

    let resolved = false;
    void done.then(() => {
      resolved = true;
    });

    for (let i = 0; i < 10; i += 1) {
      await Promise.resolve();
      if ((htmlAudio.play as jest.Mock).mock.calls.length > 0) break;
    }
    expect((htmlAudio.play as jest.Mock).mock.calls.length).toBe(1);
    expect(resolved).toBe(false);

    htmlAudio.onended?.();
    await done;
    expect(resolved).toBe(true);
  });
});
