import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('@features/aria/telemetry/tsAutoplayTelemetry', () => ({
  logTtsAutoplayPlayOutcome: jest.fn(),
}));

jest.mock('@features/aria/utils/webInterviewActiveHtmlAudio', () => ({
  clearActiveWebHtmlAudio: jest.fn(),
  clearActiveWebHtmlAudioObjectUrlIfMatches: jest.fn(),
}));

jest.mock('@features/aria/utils/webInterviewHtmlAudioTabResume', () => ({
  getTabHtmlAudioResumeSnapshot: jest.fn(() => null),
  hasWebInterviewHtmlAudioTabResumePending: jest.fn(() => false),
  isHtmlAudioPausedForTabResume: jest.fn(() => false),
}));

import { logTtsAutoplayPlayOutcome } from '@features/aria/telemetry/tsAutoplayTelemetry';
import { clearActiveWebHtmlAudio } from '@features/aria/utils/webInterviewActiveHtmlAudio';
import { hasWebInterviewHtmlAudioTabResumePending } from '@features/aria/utils/webInterviewHtmlAudioTabResume';
import { createWebInterviewHtmlAudioSafetyTimeoutScheduler } from '@features/aria/utils/webInterviewHtmlAudioSafetyTimeout';

describe('webInterviewHtmlAudioSafetyTimeout', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('resolves via safety timeout when playback metadata is available', () => {
    const onSafetyTimeoutResolve = jest.fn();
    const htmlAudio = {
      duration: 2,
      currentTime: 1.8,
      ended: false,
      paused: true,
      pause: jest.fn(),
      addEventListener: jest.fn(),
    } as unknown as HTMLAudioElement;

    const scheduler = createWebInterviewHtmlAudioSafetyTimeoutScheduler({
      htmlAudio,
      objectUrl: 'blob:test',
      telemetrySource: 'turn',
      isSettled: () => false,
      onSafetyTimeoutResolve,
      clearTabResumeState: jest.fn(),
    });
    scheduler.attachMetadataListeners();

    jest.advanceTimersByTime(7000);

    expect(onSafetyTimeoutResolve).toHaveBeenCalled();
    expect(clearActiveWebHtmlAudio).toHaveBeenCalled();
    expect(logTtsAutoplayPlayOutcome).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'playback_timeout' }),
    );
  });

  it('holds safety timeout while tab resume is pending', () => {
    jest.mocked(hasWebInterviewHtmlAudioTabResumePending).mockReturnValue(true);
    const onSafetyTimeoutResolve = jest.fn();
    const htmlAudio = {
      duration: 2,
      currentTime: 0,
      ended: false,
      paused: false,
      pause: jest.fn(),
      addEventListener: jest.fn(),
    } as unknown as HTMLAudioElement;

    const scheduler = createWebInterviewHtmlAudioSafetyTimeoutScheduler({
      htmlAudio,
      objectUrl: 'blob:test',
      telemetrySource: 'replay',
      isSettled: () => false,
      onSafetyTimeoutResolve,
      clearTabResumeState: jest.fn(),
    });
    scheduler.scheduleSafetyTimeout('initial');

    jest.advanceTimersByTime(7000);
    expect(onSafetyTimeoutResolve).not.toHaveBeenCalled();
  });
});
