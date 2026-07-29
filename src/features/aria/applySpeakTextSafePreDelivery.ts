import { sanitizeAssistantInterviewerCharacterNames } from '@/constants/interviewCharacterNames';
import { dedupeAdjacentBoundaryValidationsBeforeParticipantName } from '@features/aria/interviewerFrameworkPrompt';
import { resolvePlausibleInterviewFirstName } from '@features/aria/interviewNameValidation';
import {
  normalizeTtsTextForConsecutiveDedup,
  stripControlTokens,
} from '@features/aria/interviewControlTokens';
import type { VoiceState } from '@features/aria/hooks/useAriaInterviewSession';
import {
  markInterviewClosingTtsDelivered,
  releaseInterviewClosingSpeak,
  shouldSuppressDuplicateInterviewClosingTts,
} from '@features/aria/interviewClosingTtsSession';
import { S1_CONTEMPT_FIX_VERSION } from '@features/aria/interviewAdminConfig';
import type { TtsTelemetrySource } from '@features/aria/telemetry/tsAutoplayTelemetry';
import {
  coerceScenarioAContemptProbeForTts,
  looksLikeScenarioAContemptProbeQuestion,
} from '@features/aria/scenarioAContemptProbeLogic';
import {
  coerceScenarioARepairQuestionForTts,
  looksLikeScenarioARepairQuestion,
} from '@features/aria/scenarioARepairQuestionHelpers';
import {
  looksLikeScenarioBRepairAsJamesQuestion,
  stripScenarioBRepairAsJamesQuestion,
  coerceScenarioBQ1QuestionForTts,
  coerceScenarioBJamesDifferentlyQuestionForTts,
  coerceScenarioBJamesRepairQuestionForTts,
  coerceScenarioBJamesSayToJamesQuestionForTts,
} from '@features/aria/scenarioBProbeLogic';
import {
  coerceScenarioCQ1PrescriptiveStripForTts,
  coerceScenarioCRepairAsDanielQuestionForTts,
  coerceScenarioCRepairQuestionForTts,
  coerceScenarioCBoundaryHandoffForTts,
  coerceScenarioCSophiePerspectiveQuestionForTts,
  looksLikeScenarioCDanielPrescriptiveBackInRoomQuestion,
  looksLikeScenarioCSophiePerspectiveQuestion,
  isIncompleteScenarioCSophieReceiveLeadSentence,
  looksLikeScenarioCSophieReceiveMisparaphraseQuestion,
} from '@features/aria/scenarioCPromptDetection';
import { coerceMidScenarioRelationalReflectionToBriefAck } from '@features/aria/interviewReflectionTextStrips';
import { isActiveScenarioBConstructProbeTurn } from '@features/aria/scenarioFollowUpTranscriptGuard';
import { coerceMoment4ThresholdQuestionForTts } from '@features/aria/moment4ProbeLogic';
import { coerceMoment4SpecificityFollowUpForTts } from '@features/aria/moment4SpecificityFollowUp';
import { coerceIncompleteInterviewClosingForTts } from '@features/aria/elongatingProbe';
import { ensureCanonicalIntroBriefingForTts, coerceOpeningNamePromptForTts } from '@features/aria/interviewPreambleBriefing';
import { SCENARIO_3_TEXT } from '@features/aria/interviewScenarioVignetteCopy';
import { buildScenario2To3BundleForInterview } from '@features/aria/interviewTransitionBundles';
import { shouldRedirectPrematureMoment4ToScenario2To3Handoff } from '@features/aria/prematureMoment4HandoffPlaybackGuard';
import {
  peelRepeatRequestAcknowledgmentPrefix,
  withRepeatRequestAcknowledgment,
} from '@features/aria/interviewRepeatRequestTarget';
import { substituteCanonicalInterviewScenarioBodiesForTts } from '@features/aria/substituteCanonicalInterviewScenarioBodiesForTts';
import { isLockedShowScenarioExactTtsText } from '@features/aria/showScenarioCardCanonicalTts';
import { remoteLog } from '@utilities/remoteLog';
import { isResumeWelcomeBackAssistantText } from '@utilities/interviewResumeCursor';
import { getSessionLogRuntime, writeSessionLog } from '@utilities/sessionLogging';

export type SpeakTextSafePreDeliverySuppressionReason =
  | 's2_repair_empty_after_strip'
  | 'duplicate_consecutive'
  | 'duplicate_closing_session'
  | 'duplicate_scenario_a_contempt_probe';

export type ApplySpeakTextSafePreDeliveryArgs = {
  text: string;
  silent: boolean;
  interviewSpeechRole?: 'assistant_response';
  telemetrySourceOpt?: TtsTelemetrySource;
  allowDuplicateConsecutiveTts: boolean;
  skipClosingSessionDedup: boolean;
  skipScenarioAContemptProbeSessionDedup: boolean;
  userId: string;
  interviewName: string | null;
  currentInterviewMoment: number;
  currentScenario: 1 | 2 | 3;
  s2RepairProbeDelivered: boolean;
  lastSuccessfulTtsTextNormalized: string | null;
  lastSuccessfulTtsDeliveredPreview: string;
  lastQuestionText: string;
  closingTtsSessionKey: string | null;
  interviewSessionId: string;
  scenarioAContemptProbePlaybackConfirmed: boolean;
  /** When true, Situation 3 canonical card TTS already confirmed this session. */
  situation3CanonicalPlaybackConfirmed?: boolean;
  /** When true, Situation 3 repair probe was already delivered. */
  s3RepairProbeDelivered?: boolean;
  setVoiceState: (state: VoiceState) => void;
};

export type ApplySpeakTextSafePreDeliveryResult =
  | { suppressed: true; reason: SpeakTextSafePreDeliverySuppressionReason }
  | { suppressed: false; text: string; textForAudio: string };

/**
 * Sanitize assistant TTS copy and apply session-level dedup guards before playback starts.
 */
export function applySpeakTextSafePreDelivery(
  args: ApplySpeakTextSafePreDeliveryArgs,
): ApplySpeakTextSafePreDeliveryResult {
  let { text } = args;
  const resumeWelcomeBackTts = isResumeWelcomeBackAssistantText(stripControlTokens(text).trim());
  const telemetryEarlyForS2Repair =
    args.telemetrySourceOpt ?? (args.interviewSpeechRole === 'assistant_response' ? 'turn' : 'other');

  if (!args.silent) {
    const beforeNameCoerce = text;
    text = coerceOpeningNamePromptForTts(text);
    if (text !== beforeNameCoerce) {
    }
  }

  if (
    !args.silent &&
    (args.interviewSpeechRole === 'assistant_response' || telemetryEarlyForS2Repair === 'turn') &&
    isActiveScenarioBConstructProbeTurn(args.currentScenario, args.currentInterviewMoment) &&
    looksLikeScenarioBRepairAsJamesQuestion(stripControlTokens(text).trim()) &&
    args.s2RepairProbeDelivered
  ) {
    const dedupedRepairStripped = stripScenarioBRepairAsJamesQuestion(text).trim();
    if (!dedupedRepairStripped) {
      args.setVoiceState('idle');
      return { suppressed: true, reason: 's2_repair_empty_after_strip' };
    }
    text = dedupedRepairStripped;
  }

  if (args.interviewSpeechRole === 'assistant_response' && !args.silent) {
    // Explicit repeat requests prefix "Sure." — peel it so canonical probe coercions
    // (contempt/repair/etc.) do not drop the ack, then restore before playback.
    const peeledRepeatAck = peelRepeatRequestAcknowledgmentPrefix(text);
    const restoreRepeatAck = peeledRepeatAck.prefix != null;
    if (restoreRepeatAck) {
      text = peeledRepeatAck.body;
    }
    if (!isLockedShowScenarioExactTtsText(text)) {
      const interviewNameForTts = resolvePlausibleInterviewFirstName(args.interviewName) ?? '';
      text = dedupeAdjacentBoundaryValidationsBeforeParticipantName(
        sanitizeAssistantInterviewerCharacterNames(text),
        interviewNameForTts,
      );
      text = substituteCanonicalInterviewScenarioBodiesForTts(text);
      if (
        shouldRedirectPrematureMoment4ToScenario2To3Handoff({
          text,
          currentInterviewMoment: args.currentInterviewMoment,
          lastQuestionText: args.lastQuestionText,
          lastSuccessfulTtsDeliveredPreview: args.lastSuccessfulTtsDeliveredPreview,
          situation3CanonicalPlaybackConfirmed: args.situation3CanonicalPlaybackConfirmed,
          s3RepairProbeDelivered: args.s3RepairProbeDelivered,
        })
      ) {
        const beforeRedirectPreview = stripControlTokens(text).trim().slice(0, 180);
        text = buildScenario2To3BundleForInterview(interviewNameForTts, SCENARIO_3_TEXT);
        void remoteLog('[PREMATURE_M4_REDIRECTED_TO_S2_S3]', {
          interviewSessionId: args.interviewSessionId,
          moment: args.currentInterviewMoment,
          scenario: args.currentScenario,
          situation3Confirmed: !!args.situation3CanonicalPlaybackConfirmed,
          s3RepairDelivered: !!args.s3RepairProbeDelivered,
          beforePreview: beforeRedirectPreview,
          afterPreview: stripControlTokens(text).trim().slice(0, 180),
        });
      }
      text = ensureCanonicalIntroBriefingForTts(text, interviewNameForTts);
      if (!args.allowDuplicateConsecutiveTts && !resumeWelcomeBackTts) {
        text = coerceMidScenarioRelationalReflectionToBriefAck(text);
      }
      if (
        isActiveScenarioBConstructProbeTurn(args.currentScenario, args.currentInterviewMoment)
      ) {
        const beforeCoerce = text;
        text = coerceScenarioBQ1QuestionForTts(text);
        text = coerceScenarioBJamesSayToJamesQuestionForTts(text);
        text = coerceScenarioBJamesDifferentlyQuestionForTts(text);
        text = coerceScenarioBJamesRepairQuestionForTts(text);
        if (text !== beforeCoerce) {
        }
      }
      if (args.currentInterviewMoment === 1 && args.currentScenario === 1 && !resumeWelcomeBackTts) {
        const beforeContemptCoerce = text;
        text = coerceScenarioAContemptProbeForTts(text);
        if (text !== beforeContemptCoerce) {
        }
        const beforeRepairCoerce = text;
        text = coerceScenarioARepairQuestionForTts(text);
        if (text !== beforeRepairCoerce) {
        }
      }
      if (args.currentInterviewMoment === 3 && args.currentScenario === 3) {
        const beforeDanielCoerce = text;
        text = coerceScenarioCRepairAsDanielQuestionForTts(text);
        text = coerceScenarioCRepairQuestionForTts(text);
        if (text !== beforeDanielCoerce) {
        }
        text = coerceScenarioCQ1PrescriptiveStripForTts(text);
        if (text !== beforeDanielCoerce && looksLikeScenarioCDanielPrescriptiveBackInRoomQuestion(beforeDanielCoerce)) {
        }
        const beforeSophieCoerce = text;
        text = coerceScenarioCSophiePerspectiveQuestionForTts(text);
        if (text !== beforeSophieCoerce) {
        }
        if (
          looksLikeScenarioCSophieReceiveMisparaphraseQuestion(text) ||
          isIncompleteScenarioCSophieReceiveLeadSentence(text)
        ) {
          text = coerceScenarioCRepairQuestionForTts(text);
        }
        const beforeBoundaryCoerce = text;
        text = coerceScenarioCBoundaryHandoffForTts(
          text,
          interviewNameForTts,
        );
        if (text !== beforeBoundaryCoerce) {
        }
      }
      if (args.currentInterviewMoment === 4) {
        text = coerceMoment4SpecificityFollowUpForTts(text);
        text = coerceMoment4ThresholdQuestionForTts(text);
      }
      if (args.currentInterviewMoment === 5) {
        const interviewNameForClosing = resolvePlausibleInterviewFirstName(args.interviewName) ?? '';
        text = coerceIncompleteInterviewClosingForTts(text, interviewNameForClosing);
      }
    }
    if (restoreRepeatAck) {
      text = withRepeatRequestAcknowledgment(text);
    }
  }

  const textForAudio = text;

  const skipConsecutiveTtsDedup = args.silent || args.allowDuplicateConsecutiveTts;
  if (!skipConsecutiveTtsDedup) {
    const normalizedIncoming = normalizeTtsTextForConsecutiveDedup(text);
    const prevNorm = args.lastSuccessfulTtsTextNormalized;
    if (normalizedIncoming.length > 0 && prevNorm !== null && normalizedIncoming === prevNorm) {
      if (args.userId) {
        const r = getSessionLogRuntime();
        writeSessionLog({
          userId: args.userId,
          attemptId: r.attemptId,
          eventType: 'tts_delivery_suppressed',
          eventData: {
            suppressed_text_preview: stripControlTokens(text).trim().slice(0, 100),
            last_delivered_text_preview: args.lastSuccessfulTtsDeliveredPreview,
            suppression_reason: 'duplicate_consecutive',
          },
          platform: r.platform,
        });
      }
      args.setVoiceState('idle');
      return { suppressed: true, reason: 'duplicate_consecutive' };
    }
  }

  if (
    !args.skipClosingSessionDedup &&
    shouldSuppressDuplicateInterviewClosingTts(args.closingTtsSessionKey, text)
  ) {
    void remoteLog('[M5_CLOSING_TTS_SUPPRESSED_DUPLICATE]', {
      interviewSessionId: args.interviewSessionId,
      source: 'speak_text_safe',
      preview: stripControlTokens(text).trim().slice(0, 220),
    });
    releaseInterviewClosingSpeak(args.closingTtsSessionKey);
    args.setVoiceState('idle');
    return { suppressed: true, reason: 'duplicate_closing_session' };
  }

  const strippedForDedup = stripControlTokens(text).trim();
  if (
    !args.skipScenarioAContemptProbeSessionDedup &&
    args.scenarioAContemptProbePlaybackConfirmed &&
    !resumeWelcomeBackTts &&
    looksLikeScenarioAContemptProbeQuestion(strippedForDedup)
  ) {
    void remoteLog('[S1_CONTEMPT_PROBE_TTS_SUPPRESSED_SESSION_DEDUP]', {
      interviewSessionId: args.interviewSessionId,
      preview: strippedForDedup.slice(0, 220),
      s1ContemptFixVersion: S1_CONTEMPT_FIX_VERSION,
    });
    args.setVoiceState('idle');
    return { suppressed: true, reason: 'duplicate_scenario_a_contempt_probe' };
  }

  return { suppressed: false, text, textForAudio };
}

/** Re-export for callers that need closing dedup bookkeeping after successful playback. */
export { markInterviewClosingTtsDelivered };
