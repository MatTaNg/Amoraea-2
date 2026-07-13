import type { MutableRefObject } from 'react';
import { Platform } from 'react-native';

import { stripControlTokens } from '@features/aria/interviewControlTokens';
import {
  computeExpectedTtsWallClockMs,
  MAX_TTS_PLAYBACK_COMPLETION_ATTEMPTS,
} from '@features/aria/interviewTtsExpectedDuration';
import type { InterviewTtsSpeakOpts, InterviewTtsSpeakOutcome } from '@features/aria/interviewTtsSpeakOptions';
import { looksLikeScenarioBRepairAsJamesQuestion } from '@features/aria/scenarioBProbeLogic';
import { isScenarioCRepairAssistantPrompt } from '@features/aria/probeAndScoringUtils';
import type { SpeakTextSafeTtsTriggerSource } from '@features/aria/runSpeakTextSafeImmediateWebGreeting';
import {
  evaluateTtsDurationVerificationBypass,
  logTtsDurationVerificationBypassSideEffects,
  shouldAcceptStablePrematureRatioOnSecondAttempt,
} from '@features/aria/speakTextSafeWebDurationRetry';
import { WebInterviewTtsTabHiddenAbortError } from '@features/aria/utils/webTtsGestureErrors';
import { isTtsPlaybackPrematureCutoff } from '@features/aria/utils/interviewTtsDurationMatch';
import type { TtsTelemetrySource } from '@features/aria/telemetry/tsAutoplayTelemetry';
import { getSessionLogRuntime, markQuestionDelivered } from '@utilities/sessionLogging';
import { writeAudioSessionLog } from '@utilities/sessionLogging/audioSessionLogEnvelope';

export type SpeakTextSafeWebDurationVerificationResult = {
  speakOutcome: InterviewTtsSpeakOutcome | void | undefined;
  actualTtsMs: number;
  verificationOk: boolean;
  acceptedStableTruncationAsEstimationError: boolean;
};

export async function runSpeakTextSafeWebDurationVerificationLoop(args: {
  speak: (text: string, speakOpts?: InterviewTtsSpeakOpts) => Promise<InterviewTtsSpeakOutcome>;
  textForAudio: string;
  text: string;
  charCount: number;
  telemetrySource: TtsTelemetrySource;
  interviewSpeechRole?: 'assistant_response';
  skipLastQuestionRef: boolean;
  skipPcmStream: boolean;
  skipMicPreInitDuringPlayback?: boolean;
  effectiveTtsTriggerSource: SpeakTextSafeTtsTriggerSource;
  prefetchedMpegArrayBuffer?: ArrayBuffer;
  onScenarioPlaybackStarted?: () => void;
  priorRec: boolean;
  userId: string;
  interviewSessionId: string;
  stopElevenLabsPlayback: () => Promise<void>;
  shouldYieldInFlightSpeakToTabRestore: () => boolean;
  tabHiddenDuringActiveTtsLine: boolean;
  currentInterviewMoment: number;
  currentScenario: 1 | 2 | 3;
  s2RepairProbeDeliveredRef: MutableRefObject<boolean>;
  s3RepairProbeDeliveredRef: MutableRefObject<boolean>;
  ttsSessionHardFailureCountRef: MutableRefObject<number>;
  setTtsPlaybackReliabilityNotice: (notice: string | null) => void;
  skipQuestionTiming: boolean;
  timingRef: MutableRefObject<{
    questionEndTime: number | null;
    recordingStartTime: number | null;
    recordingEndTime: number | null;
  }>;
}): Promise<SpeakTextSafeWebDurationVerificationResult> {
  let speakOutcome: InterviewTtsSpeakOutcome | void | undefined;
  let actualTtsMs = 0;
  let verificationOk = false;
  let acceptedStableTruncationAsEstimationError = false;
  let firstPrematureActualToExpectedRatio: number | null = null;

  for (let attemptIx = 0; attemptIx < MAX_TTS_PLAYBACK_COMPLETION_ATTEMPTS; attemptIx++) {
    if (args.shouldYieldInFlightSpeakToTabRestore()) {
      throw new WebInterviewTtsTabHiddenAbortError();
    }
    const attemptStart = Date.now();
    try {
      speakOutcome = await args.speak(args.textForAudio, {
        telemetrySource: args.telemetrySource,
        skipQuestionTiming: true,
        skipLastQuestionRef: args.skipLastQuestionRef,
        ttsTriggerSource: args.effectiveTtsTriggerSource,
        skipPcmStream: args.skipPcmStream || attemptIx > 0,
        skipMicPreInitDuringPlayback: args.skipMicPreInitDuringPlayback,
        prefetchedMpegArrayBuffer: args.prefetchedMpegArrayBuffer,
        onPlaybackStarted: args.onScenarioPlaybackStarted,
        afterRecordingForScenarioSplitSeg2: args.priorRec,
      });
    } catch (e) {
      if (args.shouldYieldInFlightSpeakToTabRestore()) {
        throw e instanceof WebInterviewTtsTabHiddenAbortError
          ? e
          : new WebInterviewTtsTabHiddenAbortError();
      }
      if (attemptIx < MAX_TTS_PLAYBACK_COMPLETION_ATTEMPTS - 1) {
        await args.stopElevenLabsPlayback();
        continue;
      }
      throw e;
    }
    if (args.shouldYieldInFlightSpeakToTabRestore()) {
      throw new WebInterviewTtsTabHiddenAbortError();
    }
    actualTtsMs = Date.now() - attemptStart;
    const wall = computeExpectedTtsWallClockMs(args.charCount, speakOutcome);
    const tabThrottledDuringLine = Platform.OS === 'web' && args.tabHiddenDuringActiveTtsLine;
    const wouldBePremature = isTtsPlaybackPrematureCutoff(actualTtsMs, wall.expectedMs);
    const premature = !tabThrottledDuringLine && wouldBePremature;
    const ratioActualToExpected =
      wall.expectedMs > 0 && Number.isFinite(actualTtsMs) ? actualTtsMs / wall.expectedMs : null;

    const bypass = evaluateTtsDurationVerificationBypass({
      attemptIx,
      wouldBePremature,
      premature,
      telemetrySource: args.telemetrySource,
      interviewSpeechRole: args.interviewSpeechRole,
      currentInterviewMoment: args.currentInterviewMoment,
      currentScenario: args.currentScenario,
      text: args.text,
      skipLastQuestionRef: args.skipLastQuestionRef,
      ratioActualToExpected,
      actualTtsMs,
    });
    if (bypass) {
      verificationOk = true;
      acceptedStableTruncationAsEstimationError = bypass.acceptStableTruncation;
      logTtsDurationVerificationBypassSideEffects({
        bypass,
        wouldBePremature,
        premature,
        interviewSessionId: args.interviewSessionId,
        userId: args.userId,
        actualTtsMs,
        expectedMs: wall.expectedMs,
        ratioActualToExpected,
        attemptIx,
      });
      break;
    }

    if (args.userId && premature) {
      const rtpInc = getSessionLogRuntime();
      writeAudioSessionLog({
        userId: args.userId,
        attemptId: rtpInc.attemptId,
        eventType: 'tts_playback_incomplete',
        eventData: {
          attempt_index: attemptIx + 1,
          max_attempts: MAX_TTS_PLAYBACK_COMPLETION_ATTEMPTS,
          expected_duration_ms: wall.expectedMs,
          expected_duration_calculation_method: wall.calculationMethod,
          actual_duration_ms: actualTtsMs,
          ratio_actual_to_expected: ratioActualToExpected,
          skip_pcm_stream: attemptIx > 0,
          moment_number: args.currentInterviewMoment,
        },
        durationMs: actualTtsMs,
        platform: rtpInc.platform,
      });
    }

    if (!premature) {
      verificationOk = true;
      if (
        args.currentInterviewMoment === 2 &&
        args.currentScenario === 2 &&
        looksLikeScenarioBRepairAsJamesQuestion(stripControlTokens(args.text).trim())
      ) {
        args.s2RepairProbeDeliveredRef.current = true;
      }
      if (
        args.currentInterviewMoment === 3 &&
        args.currentScenario === 3 &&
        isScenarioCRepairAssistantPrompt(stripControlTokens(args.text).trim())
      ) {
        args.s3RepairProbeDeliveredRef.current = true;
      }
      break;
    }

    if (attemptIx === 0 && ratioActualToExpected != null) {
      firstPrematureActualToExpectedRatio = ratioActualToExpected;
    }
    if (
      shouldAcceptStablePrematureRatioOnSecondAttempt({
        attemptIx,
        ratioActualToExpected,
        firstPrematureActualToExpectedRatio,
      })
    ) {
      verificationOk = true;
      acceptedStableTruncationAsEstimationError = true;
      break;
    }

    if (attemptIx < MAX_TTS_PLAYBACK_COMPLETION_ATTEMPTS - 1) {
      if (args.shouldYieldInFlightSpeakToTabRestore()) {
        throw new WebInterviewTtsTabHiddenAbortError();
      }
      await args.stopElevenLabsPlayback();
    }
  }

  if (!verificationOk) {
    args.ttsSessionHardFailureCountRef.current += 1;
    if (args.ttsSessionHardFailureCountRef.current > 2) {
      args.setTtsPlaybackReliabilityNotice(
        'Playback keeps stopping early. Try a wired connection or reload this page.',
      );
    }
  } else {
    args.setTtsPlaybackReliabilityNotice(null);
    args.ttsSessionHardFailureCountRef.current = 0;
  }

  if (!args.skipQuestionTiming) {
    args.timingRef.current.questionEndTime = Date.now();
    markQuestionDelivered(new Date().toISOString());
  }

  return {
    speakOutcome,
    actualTtsMs,
    verificationOk,
    acceptedStableTruncationAsEstimationError,
  };
}
