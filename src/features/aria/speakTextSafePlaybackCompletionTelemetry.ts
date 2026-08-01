import type { MutableRefObject } from 'react';

import type { InterviewTtsSpeakOutcome } from '@features/aria/interviewTtsSpeakOptions';
import { computeExpectedTtsWallClockMs } from '@features/aria/interviewTtsExpectedDuration';
import { stripControlTokens } from '@features/aria/interviewControlTokens';
import { looksLikeScenarioAContemptProbeQuestion } from '@features/aria/scenarioAContemptProbeLogic';
import {
  isShowScenarioCardCanonicalDeliveryText,
  type ShowScenarioCardCanonicalPlaybackConfirmedKinds,
} from '@features/aria/showScenarioCardCanonicalTts';
import type { TtsTelemetrySource } from '@features/aria/telemetry/tsAutoplayTelemetry';
import {
  isTtsDurationMatchWithinOverrunTolerance,
  isTtsPlaybackCompleteForScenarioOpeningCheckpoint,
} from '@features/aria/utils/interviewTtsDurationMatch';
import { getSessionLogRuntime, markLastAudioSessionEventType } from '@utilities/sessionLogging';
import { writeAudioSessionLog } from '@utilities/sessionLogging/audioSessionLogEnvelope';
import { writeSessionLog } from '@utilities/sessionLogging/writeSessionLog';
import {
  recordTtsTurnDurationRatio,
  type TtsCalibrationResult,
} from '@utilities/sessionLogging/ttsDurationCalibration';

export type SpeakTextSafePlaybackCompletionTelemetryResult = {
  audioPlaybackTruncated: boolean;
  expectedTtsMs: number;
  expectedDurationCalculationMethod: string;
  durationMatch: boolean;
};

export function writeSpeakTextSafePlaybackCompletionTelemetry(args: {
  userId: string;
  text: string;
  telemetrySource: TtsTelemetrySource;
  speakOutcome: InterviewTtsSpeakOutcome | void | undefined;
  actualTtsMs: number;
  charCount: number;
  useWebDurationVerification: boolean;
  verificationOk: boolean;
  acceptedStableTruncationAsEstimationError: boolean;
  currentInterviewMoment: number;
  scenarioAContemptProbePlaybackConfirmedRef: MutableRefObject<boolean>;
  showScenarioCardCanonicalPlaybackConfirmedKindsRef: MutableRefObject<ShowScenarioCardCanonicalPlaybackConfirmedKinds>;
}): SpeakTextSafePlaybackCompletionTelemetryResult {
  const { expectedMs: expectedTtsMs, calculationMethod: expectedDurationCalculationMethod } =
    computeExpectedTtsWallClockMs(args.charCount, args.speakOutcome);
  const audioPlaybackTruncated = args.useWebDurationVerification && !args.verificationOk;
  const durRatio = recordTtsTurnDurationRatio(args.actualTtsMs, expectedTtsMs);
  const durationMatch = isTtsDurationMatchWithinOverrunTolerance(args.actualTtsMs, expectedTtsMs);
  const calibrationExcluded =
    durRatio != null && 'excluded' in durRatio && durRatio.excluded === true;
  const durRatioForCalibration: TtsCalibrationResult | null =
    calibrationExcluded || durRatio == null ? null : (durRatio as TtsCalibrationResult);

  const rtp = getSessionLogRuntime();
  markLastAudioSessionEventType('tts_playback_complete');
  writeSessionLog({
    userId: args.userId,
    attemptId: rtp.attemptId,
    eventType: 'tts_playback_complete',
    eventData: { telemetry_source: args.telemetrySource },
    durationMs: args.actualTtsMs,
    platform: rtp.platform,
  });

  if (looksLikeScenarioAContemptProbeQuestion(stripControlTokens(args.text).trim())) {
    if (args.scenarioAContemptProbePlaybackConfirmedRef) {
      args.scenarioAContemptProbePlaybackConfirmedRef.current = true;
    }
  }

  const showScenarioCardKind = isShowScenarioCardCanonicalDeliveryText(args.text);
  const scenarioOpeningPlaybackComplete = isTtsPlaybackCompleteForScenarioOpeningCheckpoint(
    args.actualTtsMs,
    expectedTtsMs,
    audioPlaybackTruncated,
  );
  if (
    showScenarioCardKind &&
    scenarioOpeningPlaybackComplete &&
    args.showScenarioCardCanonicalPlaybackConfirmedKindsRef
  ) {
    args.showScenarioCardCanonicalPlaybackConfirmedKindsRef.current = {
      ...args.showScenarioCardCanonicalPlaybackConfirmedKindsRef.current,
      [showScenarioCardKind]: true,
    };
  }

  writeAudioSessionLog({
    userId: args.userId,
    attemptId: rtp.attemptId,
    eventType: 'tts_playback_duration',
    eventData: {
      expected_duration_ms: expectedTtsMs,
      actual_duration_ms: args.actualTtsMs,
      duration_match: durationMatch,
      expected_duration_calculation_method: expectedDurationCalculationMethod,
      completion_via: 'callback',
      moment_number: args.currentInterviewMoment,
      playback_truncated: audioPlaybackTruncated,
      ...(args.acceptedStableTruncationAsEstimationError
        ? { accepted_stable_truncation_as_estimation_error: true }
        : {}),
    },
    durationMs: args.actualTtsMs,
    platform: rtp.platform,
  });

  if (
    args.speakOutcome &&
    'scenarioSplitDelivery' in args.speakOutcome &&
    args.speakOutcome.scenarioSplitDelivery
  ) {
    writeAudioSessionLog({
      userId: args.userId,
      attemptId: rtp.attemptId,
      eventType: 'tts_split_delivery',
      eventData: {
        userId: args.userId,
        telemetry_source: args.telemetrySource,
        moment_number: args.currentInterviewMoment,
        segment1_expected_duration_ms: args.speakOutcome.scenarioSplitDelivery.segment1_expected_duration_ms,
        segment2_expected_duration_ms: args.speakOutcome.scenarioSplitDelivery.segment2_expected_duration_ms,
      },
      platform: rtp.platform,
    });
  }

  if (calibrationExcluded && durRatio != null && 'excluded' in durRatio) {
    writeSessionLog({
      userId: args.userId,
      attemptId: rtp.attemptId,
      eventType: 'calibration_turn_excluded',
      eventData: {
        ratio_actual_to_expected: durRatio.ratio,
        exclusion_reason: durRatio.exclusion_reason,
      },
      platform: rtp.platform,
    });
  }

  if (durRatioForCalibration) {
    writeAudioSessionLog({
      userId: args.userId,
      attemptId: rtp.attemptId,
      eventType: 'tts_duration_estimation_ratio',
      eventData: {
        expected_duration_ms: expectedTtsMs,
        actual_duration_ms: args.actualTtsMs,
        ratio_actual_to_expected: durRatioForCalibration.ratio,
        calibration_adjusted: durRatioForCalibration.calibration_adjusted,
        calibration_skip_reason: durRatioForCalibration.calibration_skip_reason,
        previous_multiplier_ms_per_char: durRatioForCalibration.previous_multiplier_ms_per_char,
        new_multiplier_ms_per_char: durRatioForCalibration.new_multiplier_ms_per_char,
        moment_number: args.currentInterviewMoment,
        ...(durRatioForCalibration.calibration_adjustment_detail
          ? { calibration_adjustment_detail: durRatioForCalibration.calibration_adjustment_detail }
          : {}),
      },
      platform: rtp.platform,
    });
    if (durRatioForCalibration.calibration_escape_applied) {
      writeAudioSessionLog({
        userId: args.userId,
        attemptId: rtp.attemptId,
        eventType: 'calibration_escape_applied',
        eventData: {
          previous_multiplier_ms_per_char: durRatioForCalibration.previous_multiplier_ms_per_char,
          new_multiplier_ms_per_char: durRatioForCalibration.new_multiplier_ms_per_char,
          rolling_avg_ratio: durRatioForCalibration.calibration_adjustment_detail?.rolling_avg_ratio ?? null,
          moment_number: args.currentInterviewMoment,
        },
        platform: rtp.platform,
      });
    }
  }

  return {
    audioPlaybackTruncated,
    expectedTtsMs,
    expectedDurationCalculationMethod,
    durationMatch,
  };
}
