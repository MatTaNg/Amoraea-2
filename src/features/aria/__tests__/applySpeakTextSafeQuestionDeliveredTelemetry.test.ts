import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('@utilities/sessionLogging', () => ({
  getSessionLogRuntime: jest.fn(() => ({ attemptId: 'attempt-test', platform: 'web' })),
}));

jest.mock('@utilities/sessionLogging/writeSessionLog', () => ({
  writeSessionLog: jest.fn(),
}));

import {
  applySpeakTextSafeQuestionDeliveredTelemetry,
  resolveSpeakTextSafeInterviewLineDelivery,
} from '@features/aria/applySpeakTextSafeQuestionDeliveredTelemetry';
import { writeSessionLog } from '@utilities/sessionLogging/writeSessionLog';

describe('resolveSpeakTextSafeInterviewLineDelivery', () => {
  it('skips delivery when web tab interrupt invalidated the speak generation', () => {
    expect(
      resolveSpeakTextSafeInterviewLineDelivery({
        isWeb: true,
        webTtsTabInterruptPendingReplay: false,
        tabHiddenDuringActiveTtsLine: false,
        speakGenerationAtStart: 1,
        webTtsSpeakGeneration: 2,
        skipQuestionDeliveredTelemetry: false,
        interviewSpeechRole: 'assistant_response',
        telemetrySource: 'turn',
      }),
    ).toEqual({
      skipDeliveryForTabInterrupt: true,
      isInterviewLine: false,
    });
  });

  it('treats assistant turn playback as an interview line when delivery is not interrupted', () => {
    expect(
      resolveSpeakTextSafeInterviewLineDelivery({
        isWeb: true,
        webTtsTabInterruptPendingReplay: false,
        tabHiddenDuringActiveTtsLine: false,
        speakGenerationAtStart: 3,
        webTtsSpeakGeneration: 3,
        skipQuestionDeliveredTelemetry: false,
        interviewSpeechRole: 'assistant_response',
        telemetrySource: 'turn',
      }).isInterviewLine,
    ).toBe(true);
  });
});

describe('applySpeakTextSafeQuestionDeliveredTelemetry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('writes question_delivered and persists first-scenario lifecycle once', () => {
    const recordDelivery = jest.fn();
    const persistLifecycle = jest.fn().mockResolvedValue(undefined);
    const firstScenarioLifecyclePersistedRef = { current: false };

    applySpeakTextSafeQuestionDeliveredTelemetry({
      userId: 'user-test',
      text: 'What is going on between these two?',
      isInterviewLine: true,
      audioPlaybackTruncated: true,
      ttsPipeline: 'parallel_streaming',
      currentInterviewMoment: 1,
      currentScenario: 1,
      incomingAssistantTtsTextForS2Repair: 'What is going on between these two?',
      s2RepairProbeDeliveredRef: { current: false },
      s3RepairProbeDeliveredRef: { current: false },
      recordInterviewAssistantDeliveryForMetaExemptionRef: { current: recordDelivery },
      firstScenarioLifecyclePersistedRef,
      interviewSessionAttemptIdRef: { current: 'attempt-1' },
      persistInterviewAttemptSessionLifecycle: persistLifecycle,
    });

    expect(writeSessionLog).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'question_delivered',
        eventData: expect.objectContaining({
          audio_playback_truncated: true,
          tts_pipeline: 'parallel_streaming',
        }),
      }),
    );
    expect(recordDelivery).toHaveBeenCalled();
    expect(firstScenarioLifecyclePersistedRef.current).toBe(true);
    expect(persistLifecycle).toHaveBeenCalledWith('attempt-1', 'in_progress');
  });

  it('no-ops when interview line delivery is suppressed', () => {
    applySpeakTextSafeQuestionDeliveredTelemetry({
      userId: 'user-test',
      text: 'What is going on between these two?',
      isInterviewLine: false,
      audioPlaybackTruncated: false,
      currentInterviewMoment: 1,
      currentScenario: 1,
      incomingAssistantTtsTextForS2Repair: 'What is going on between these two?',
      s2RepairProbeDeliveredRef: { current: false },
      s3RepairProbeDeliveredRef: { current: false },
      recordInterviewAssistantDeliveryForMetaExemptionRef: { current: jest.fn() },
      firstScenarioLifecyclePersistedRef: { current: false },
      interviewSessionAttemptIdRef: { current: 'attempt-1' },
      persistInterviewAttemptSessionLifecycle: jest.fn(),
    });

    expect(writeSessionLog).not.toHaveBeenCalled();
  });
});
