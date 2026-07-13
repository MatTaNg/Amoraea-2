import { Platform } from 'react-native';

import { S1_CONTEMPT_FIX_VERSION } from '@features/aria/interviewAdminConfig';
import { stripControlTokens } from '@features/aria/interviewControlTokens';
import {
  isInterviewPreambleBriefingMoment,
} from '@features/aria/interviewLanguageGate';
import { isInterviewRecordingRetryLine } from '@features/aria/interviewNameValidation';
import { transcriptAssistantContainsMoment5PrimaryConflictQuestion } from '@features/aria/moment5TranscriptHelpers';
import { looksLikeScenarioAContemptProbeQuestion } from '@features/aria/scenarioAContemptProbeLogic';
import type { TtsTelemetrySource } from '@features/aria/telemetry/tsAutoplayTelemetry';
import {
  TTS_PREMATURE_RATIO_STABILITY_EPSILON,
  TTS_REPLAY_PREMATURE_ACCEPT_MIN_RATIO,
} from '@features/aria/interviewTtsExpectedDuration';
import { isWebInterviewPlaybackSurfaceActive } from '@features/aria/utils/webInterviewPlaybackSurface';
import { getSessionLogRuntime } from '@utilities/sessionLogging';
import { TTS_CALIBRATION_MIN_RATIO_TO_INCLUDE } from '@utilities/sessionLogging/ttsDurationCalibration';
import { writeSessionLog } from '@utilities/sessionLogging/writeSessionLog';
import { remoteLog } from '@utilities/remoteLog';

export function shouldUseWebTtsDurationVerification(args: {
  silent: boolean;
  charCount: number;
  telemetrySource: TtsTelemetrySource;
}): boolean {
  return (
    Platform.OS === 'web' &&
    !args.silent &&
    args.charCount > 0 &&
    args.telemetrySource !== 'greeting' &&
    args.telemetrySource !== 'replay'
  );
}

export type TtsDurationVerificationBypassDecision = {
  accept: true;
  acceptStableTruncation: boolean;
  reason: string;
};

export function evaluateTtsDurationVerificationBypass(args: {
  attemptIx: number;
  /** Raw duration check — used for estimation-overshoot suppressions even when tab-throttled. */
  wouldBePremature: boolean;
  /** Tab-throttled lines are not treated as premature for replay/turn acceptance paths. */
  premature: boolean;
  telemetrySource: TtsTelemetrySource;
  interviewSpeechRole?: 'assistant_response';
  currentInterviewMoment: number;
  currentScenario: number;
  text: string;
  skipLastQuestionRef: boolean;
  ratioActualToExpected: number | null;
  actualTtsMs: number;
}): TtsDurationVerificationBypassDecision | null {
  const stripped = stripControlTokens(args.text).trim();
  const isMoment5PrimaryConflictTts =
    args.telemetrySource === 'turn' &&
    args.interviewSpeechRole === 'assistant_response' &&
    args.currentInterviewMoment === 5 &&
    transcriptAssistantContainsMoment5PrimaryConflictQuestion(args.text);

  if (args.attemptIx === 0 && isMoment5PrimaryConflictTts) {
    return {
      accept: true,
      acceptStableTruncation: args.wouldBePremature,
      reason: 'avoid_replaying_long_moment5_primary_prompt',
    };
  }

  const ttsPlaybackLikelySilent =
    Platform.OS === 'web' && args.actualTtsMs < 250 && !isWebInterviewPlaybackSurfaceActive();
  const isScenarioAContemptProbeTts =
    args.telemetrySource === 'turn' &&
    args.interviewSpeechRole === 'assistant_response' &&
    args.currentInterviewMoment === 1 &&
    args.currentScenario === 1 &&
    looksLikeScenarioAContemptProbeQuestion(stripped);

  if (args.attemptIx === 0 && isScenarioAContemptProbeTts && !ttsPlaybackLikelySilent) {
    return {
      accept: true,
      acceptStableTruncation: args.wouldBePremature,
      reason: 'avoid_replaying_contempt_probe_on_duration_estimation_overshoot',
    };
  }

  const isPreambleBriefingTts =
    args.telemetrySource === 'turn' &&
    args.interviewSpeechRole === 'assistant_response' &&
    args.currentInterviewMoment === 1 &&
    isInterviewPreambleBriefingMoment(stripped);

  if (args.attemptIx === 0 && isPreambleBriefingTts) {
    return {
      accept: true,
      acceptStableTruncation: args.wouldBePremature,
      reason: 'avoid_replaying_intro_briefing_on_duration_estimation_overshoot',
    };
  }

  const isRecordingRetryLineTts =
    args.skipLastQuestionRef && isInterviewRecordingRetryLine(stripped);

  if (args.attemptIx === 0 && isRecordingRetryLineTts) {
    return {
      accept: true,
      acceptStableTruncation: args.wouldBePremature,
      reason: 'avoid_replaying_mic_retry_prompt_on_duration_estimation_overshoot',
    };
  }

  if (
    args.premature &&
    args.attemptIx === 0 &&
    args.telemetrySource === 'replay' &&
    args.ratioActualToExpected != null &&
    args.ratioActualToExpected >= TTS_REPLAY_PREMATURE_ACCEPT_MIN_RATIO
  ) {
    return {
      accept: true,
      acceptStableTruncation: true,
      reason: 'replay_substantially_complete',
    };
  }

  if (
    args.premature &&
    args.attemptIx === 0 &&
    args.telemetrySource === 'turn' &&
    args.interviewSpeechRole === 'assistant_response' &&
    args.ratioActualToExpected != null &&
    args.ratioActualToExpected >= TTS_REPLAY_PREMATURE_ACCEPT_MIN_RATIO
  ) {
    return {
      accept: true,
      acceptStableTruncation: true,
      reason: 'turn_estimation_overshoot_substantially_complete',
    };
  }

  if (
    args.premature &&
    args.attemptIx === 0 &&
    args.telemetrySource === 'turn' &&
    args.interviewSpeechRole === 'assistant_response' &&
    args.currentInterviewMoment === 5 &&
    args.ratioActualToExpected != null &&
    args.ratioActualToExpected >= TTS_REPLAY_PREMATURE_ACCEPT_MIN_RATIO &&
    transcriptAssistantContainsMoment5PrimaryConflictQuestion(args.text)
  ) {
    return {
      accept: true,
      acceptStableTruncation: true,
      reason: 'moment5_conflict_bundle_substantially_complete',
    };
  }

  if (
    args.premature &&
    args.ratioActualToExpected != null &&
    args.ratioActualToExpected >= TTS_CALIBRATION_MIN_RATIO_TO_INCLUDE
  ) {
    return {
      accept: true,
      acceptStableTruncation: true,
      reason: 'substantially_complete',
    };
  }

  return null;
}

export function logTtsDurationVerificationBypassSideEffects(args: {
  bypass: TtsDurationVerificationBypassDecision;
  wouldBePremature: boolean;
  premature: boolean;
  interviewSessionId: string | null;
  userId: string | null;
  actualTtsMs: number;
  expectedMs: number;
  ratioActualToExpected: number | null;
  attemptIx: number;
}): void {
  const base = {
    interviewSessionId: args.interviewSessionId,
    actualTtsMs: args.actualTtsMs,
    expectedMs: args.expectedMs,
    ratio_actual_to_expected: args.ratioActualToExpected,
    reason: args.bypass.reason,
  };

  switch (args.bypass.reason) {
    case 'avoid_replaying_long_moment5_primary_prompt':
      if (args.wouldBePremature) {
        void remoteLog('[TTS_M5_DURATION_VERIFY_BYPASSED]', base);
      }
      return;
    case 'avoid_replaying_contempt_probe_on_duration_estimation_overshoot':
      if (args.wouldBePremature) {
        void remoteLog('[S1_CONTEMPT_PROBE_TTS_RETRY_SUPPRESSED]', {
          ...base,
          s1ContemptFixVersion: S1_CONTEMPT_FIX_VERSION,
        });
      }
      return;
    case 'avoid_replaying_intro_briefing_on_duration_estimation_overshoot':
      if (args.wouldBePremature) {
        void remoteLog('[PREAMBLE_BRIEFING_TTS_RETRY_SUPPRESSED]', base);
      }
      return;
    case 'avoid_replaying_mic_retry_prompt_on_duration_estimation_overshoot':
      if (args.wouldBePremature) {
        void remoteLog('[RECORDING_RETRY_TTS_RETRY_SUPPRESSED]', base);
      }
      return;
    case 'turn_estimation_overshoot_substantially_complete':
      if (args.premature && args.userId) {
        const rt = getSessionLogRuntime();
        writeSessionLog({
          userId: args.userId,
          attemptId: rt.attemptId,
          eventType: 'tts_retry_suppressed',
          eventData: {
            ratio_actual_to_expected: args.ratioActualToExpected,
            suppression_reason: args.bypass.reason,
            attempt_index: args.attemptIx + 1,
            expected_duration_ms: args.expectedMs,
            actual_duration_ms: args.actualTtsMs,
          },
          platform: rt.platform,
        });
      }
      return;
    case 'substantially_complete':
      if (args.premature && args.userId) {
        const rt = getSessionLogRuntime();
        writeSessionLog({
          userId: args.userId,
          attemptId: rt.attemptId,
          eventType: 'tts_retry_suppressed',
          eventData: {
            ratio_actual_to_expected: args.ratioActualToExpected,
            suppression_reason: args.bypass.reason,
            attempt_index: args.attemptIx + 1,
            expected_duration_ms: args.expectedMs,
            actual_duration_ms: args.actualTtsMs,
          },
          platform: rt.platform,
        });
      }
      return;
    default:
      return;
  }
}

export function shouldAcceptStablePrematureRatioOnSecondAttempt(args: {
  attemptIx: number;
  ratioActualToExpected: number | null;
  firstPrematureActualToExpectedRatio: number | null;
}): boolean {
  return (
    args.attemptIx === 1 &&
    args.firstPrematureActualToExpectedRatio != null &&
    args.ratioActualToExpected != null &&
    Math.abs(args.ratioActualToExpected - args.firstPrematureActualToExpectedRatio) <=
      TTS_PREMATURE_RATIO_STABILITY_EPSILON
  );
}
