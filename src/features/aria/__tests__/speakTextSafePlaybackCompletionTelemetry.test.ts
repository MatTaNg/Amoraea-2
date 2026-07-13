import { describe, expect, it, jest } from '@jest/globals';

jest.mock('@utilities/sessionLogging', () => ({
  getSessionLogRuntime: jest.fn(() => ({ attemptId: 'attempt-test', platform: 'web' })),
  markLastAudioSessionEventType: jest.fn(),
}));

jest.mock('@utilities/sessionLogging/writeSessionLog', () => ({
  writeSessionLog: jest.fn(),
}));

jest.mock('@utilities/sessionLogging/audioSessionLogEnvelope', () => ({
  writeAudioSessionLog: jest.fn(),
}));

jest.mock('@utilities/sessionLogging/ttsDurationCalibration', () => ({
  getTtsExpectedDurationMsFromCharCount: jest.fn((charCount: number) => ({
    expectedMs: charCount * 85,
    calculationMethod: 'char_count',
  })),
  recordTtsTurnDurationRatio: jest.fn(() => ({
    ratio: 0.82,
    calibration_adjusted: false,
    calibration_skip_reason: null,
    previous_multiplier_ms_per_char: 85,
    new_multiplier_ms_per_char: 85,
    calibration_escape_applied: false,
  })),
}));

jest.mock('@features/aria/utils/interviewTtsDurationMatch', () => ({
  isTtsDurationMatchWithinOverrunTolerance: jest.fn(() => true),
}));

import { SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY } from '@features/aria/scenarioAContemptProbeLogic';
import { writeSpeakTextSafePlaybackCompletionTelemetry } from '@features/aria/speakTextSafePlaybackCompletionTelemetry';
import { markLastAudioSessionEventType } from '@utilities/sessionLogging';
import { writeAudioSessionLog } from '@utilities/sessionLogging/audioSessionLogEnvelope';
import { writeSessionLog } from '@utilities/sessionLogging/writeSessionLog';

describe('writeSpeakTextSafePlaybackCompletionTelemetry', () => {
  it('writes playback completion logs and marks contempt probe confirmation', () => {
    const scenarioAContemptProbePlaybackConfirmedRef = { current: false };
    const showScenarioCardCanonicalPlaybackConfirmedKindsRef = { current: {} as const };

    const result = writeSpeakTextSafePlaybackCompletionTelemetry({
      userId: 'user-test',
      text: SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY,
      telemetrySource: 'turn',
      speakOutcome: undefined,
      actualTtsMs: 2_400,
      charCount: SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY.length,
      useWebDurationVerification: true,
      verificationOk: false,
      acceptedStableTruncationAsEstimationError: true,
      currentInterviewMoment: 1,
      scenarioAContemptProbePlaybackConfirmedRef,
      showScenarioCardCanonicalPlaybackConfirmedKindsRef,
    });

    expect(result.audioPlaybackTruncated).toBe(true);
    expect(scenarioAContemptProbePlaybackConfirmedRef.current).toBe(true);
    expect(markLastAudioSessionEventType).toHaveBeenCalledWith('tts_playback_complete');
    expect(writeSessionLog).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'tts_playback_complete' }),
    );
    expect(writeAudioSessionLog).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'tts_playback_duration',
        eventData: expect.objectContaining({
          playback_truncated: true,
          accepted_stable_truncation_as_estimation_error: true,
        }),
      }),
    );
  });

  it('logs split delivery telemetry when speak returns segment durations', () => {
    writeSpeakTextSafePlaybackCompletionTelemetry({
      userId: 'user-test',
      text: 'Scenario split line.',
      telemetrySource: 'turn',
      speakOutcome: {
        scenarioSplitDelivery: {
          segment1_expected_duration_ms: 1_200,
          segment2_expected_duration_ms: 900,
        },
      },
      actualTtsMs: 2_100,
      charCount: 20,
      useWebDurationVerification: false,
      verificationOk: true,
      acceptedStableTruncationAsEstimationError: false,
      currentInterviewMoment: 1,
      scenarioAContemptProbePlaybackConfirmedRef: { current: false },
      showScenarioCardCanonicalPlaybackConfirmedKindsRef: { current: {} },
    });

    expect(writeAudioSessionLog).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'tts_split_delivery' }),
    );
  });
});
