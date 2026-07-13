import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('@features/aria/utils/webInterviewHtmlAudioTabResume', () => ({
  hasWebInterviewHtmlAudioTabResumePending: jest.fn(() => false),
}));

jest.mock('@features/aria/utils/webInterviewGestureContext', () => ({
  getMsSinceWebTabBecameVisible: jest.fn(() => null),
}));

jest.mock('@features/aria/utils/webInterviewTtsOutputVolume', () => ({
  ensureWebInterviewTtsOutputVolumePrimed: jest.fn(),
}));

jest.mock('@features/aria/utils/webInterviewWebAudioContext', () => ({
  ensureSharedWebAudioContextResumedForPlayback: jest.fn(async () => true),
}));

jest.mock('@features/aria/utils/webInterviewSharedHtmlAudio', () => ({
  reprimeSharedHtmlAudioSilentPlay: jest.fn(),
}));

import { getMsSinceWebTabBecameVisible } from '@features/aria/utils/webInterviewGestureContext';
import { hasWebInterviewHtmlAudioTabResumePending } from '@features/aria/utils/webInterviewHtmlAudioTabResume';
import { reprimeSharedHtmlAudioSilentPlay } from '@features/aria/utils/webInterviewSharedHtmlAudio';
import { ensureWebInterviewTtsOutputVolumePrimed } from '@features/aria/utils/webInterviewTtsOutputVolume';
import { ensureSharedWebAudioContextResumedForPlayback } from '@features/aria/utils/webInterviewWebAudioContext';
import {
  ensureWebPlaybackPrimedForNextTurn,
  shouldSkipSilentReprimeForTelemetry,
} from '@features/aria/utils/webInterviewWebPlaybackPriming';

describe('webInterviewWebPlaybackPriming', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(hasWebInterviewHtmlAudioTabResumePending).mockReturnValue(false);
    jest.mocked(getMsSinceWebTabBecameVisible).mockReturnValue(null);
  });

  it('skips silent reprime during tab resume replay shortly after tab visible', () => {
    jest.mocked(hasWebInterviewHtmlAudioTabResumePending).mockReturnValue(true);
    expect(shouldSkipSilentReprimeForTelemetry('replay')).toBe(true);

    jest.mocked(hasWebInterviewHtmlAudioTabResumePending).mockReturnValue(false);
    jest.mocked(getMsSinceWebTabBecameVisible).mockReturnValue(5_000);
    expect(shouldSkipSilentReprimeForTelemetry('replay')).toBe(true);
    expect(shouldSkipSilentReprimeForTelemetry('turn')).toBe(false);
  });

  it('primes volume, resumes context, and reprimes shared HTML audio', async () => {
    await ensureWebPlaybackPrimedForNextTurn('turn');

    expect(ensureWebInterviewTtsOutputVolumePrimed).toHaveBeenCalled();
    expect(ensureSharedWebAudioContextResumedForPlayback).toHaveBeenCalledWith('turn');
    expect(reprimeSharedHtmlAudioSilentPlay).toHaveBeenCalled();
  });

  it('can skip silent reprime while still resuming context', async () => {
    await ensureWebPlaybackPrimedForNextTurn('turn', { skipSilentReprime: true });

    expect(ensureSharedWebAudioContextResumedForPlayback).toHaveBeenCalled();
    expect(reprimeSharedHtmlAudioSilentPlay).not.toHaveBeenCalled();
  });
});
