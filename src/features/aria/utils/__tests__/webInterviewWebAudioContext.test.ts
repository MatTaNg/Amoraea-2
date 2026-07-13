import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('react-native', () => ({
  Platform: { OS: 'web' },
}));

jest.mock('@features/aria/telemetry/tsAutoplayTelemetry', () => ({
  logTtsAutoplayPlayOutcome: jest.fn(),
}));

import {
  ensureSharedWebAudioContextResumedForPlayback,
  getSharedWebAudioContext,
  isWebInterviewAudioUnlocked,
  resetWebInterviewWebAudioContext,
  suspendSharedWebAudioContextForTabHide,
  unlockWebInterviewSharedAudioContext,
} from '@features/aria/utils/webInterviewWebAudioContext';

describe('webInterviewWebAudioContext', () => {
  beforeEach(() => {
    resetWebInterviewWebAudioContext();
    jest.clearAllMocks();
  });

  it('unlocks shared AudioContext from a user gesture stack', () => {
    const resume = jest.fn().mockResolvedValue(undefined);
    const suspend = jest.fn().mockResolvedValue(undefined);
    const createBuffer = jest.fn(() => ({ duration: 0 }));
    const start = jest.fn();
    const connect = jest.fn();
    const createBufferSource = jest.fn(() => ({
      buffer: null as AudioBuffer | null,
      connect,
      start,
    }));
    const ctx = {
      state: 'suspended',
      sampleRate: 48_000,
      resume,
      suspend,
      createBuffer,
      createBufferSource,
      destination: {},
    };
    const AudioContextCtor = jest.fn(() => ctx);
    (globalThis as { window?: unknown }).window = {
      AudioContext: AudioContextCtor,
    };

    const onUnlocked = jest.fn();
    unlockWebInterviewSharedAudioContext(onUnlocked);

    expect(isWebInterviewAudioUnlocked()).toBe(true);
    expect(getSharedWebAudioContext()).toBe(ctx);
    expect(onUnlocked).toHaveBeenCalled();
    expect(createBufferSource).toHaveBeenCalled();
    expect(start).toHaveBeenCalledWith(0);
  });

  it('resumes a suspended shared context before playback', async () => {
    const resume = jest.fn().mockResolvedValue(undefined);
    const ctx = {
      state: 'suspended',
      resume,
    };
    (globalThis as { window?: unknown }).window = {
      AudioContext: jest.fn(() => ctx),
    };
    unlockWebInterviewSharedAudioContext();
    ctx.state = 'suspended';

    await expect(ensureSharedWebAudioContextResumedForPlayback('turn')).resolves.toBe(true);
    expect(resume).toHaveBeenCalled();
  });

  it('suspends running context on tab hide', () => {
    const suspend = jest.fn().mockResolvedValue(undefined);
    const ctx = {
      state: 'running',
      resume: jest.fn(),
      suspend,
      sampleRate: 48_000,
      createBuffer: jest.fn(),
      createBufferSource: jest.fn(),
      destination: {},
    };
    (globalThis as { window?: unknown }).window = {
      AudioContext: jest.fn(() => ctx),
    };
    unlockWebInterviewSharedAudioContext();

    suspendSharedWebAudioContextForTabHide();

    expect(suspend).toHaveBeenCalled();
  });
});
