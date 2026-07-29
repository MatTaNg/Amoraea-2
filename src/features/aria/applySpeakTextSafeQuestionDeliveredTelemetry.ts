import type { MutableRefObject } from 'react';
import { Platform } from 'react-native';

import { stripControlTokens } from '@features/aria/interviewControlTokens';
import { looksLikeScenarioBRepairAsJamesQuestion } from '@features/aria/scenarioBProbeLogic';
import { isScenarioCRepairAssistantPrompt } from '@features/aria/probeAndScoringUtils';
import { resolveAssessableQuestionTextForResponseTiming } from '@features/aria/resolveAssessableQuestionTextForResponseTiming';
import { getSessionLogRuntime } from '@utilities/sessionLogging';
import { writeSessionLog } from '@utilities/sessionLogging/writeSessionLog';

export function resolveSpeakTextSafeInterviewLineDelivery(args: {
  isWeb: boolean;
  webTtsTabInterruptPendingReplay: boolean;
  tabHiddenDuringActiveTtsLine: boolean;
  speakGenerationAtStart: number;
  webTtsSpeakGeneration: number;
  skipQuestionDeliveredTelemetry: boolean;
  interviewSpeechRole?: 'assistant_response';
  telemetrySource: TtsTelemetrySource;
}): {
  skipDeliveryForTabInterrupt: boolean;
  isInterviewLine: boolean;
} {
  const skipDeliveryForTabInterrupt =
    args.isWeb &&
    (args.webTtsTabInterruptPendingReplay ||
      args.tabHiddenDuringActiveTtsLine ||
      args.speakGenerationAtStart !== args.webTtsSpeakGeneration);

  const isInterviewLine =
    !skipDeliveryForTabInterrupt &&
    !args.skipQuestionDeliveredTelemetry &&
    (args.interviewSpeechRole === 'assistant_response' || args.telemetrySource === 'turn');

  return { skipDeliveryForTabInterrupt, isInterviewLine };
}

export function applySpeakTextSafeQuestionDeliveredTelemetry(args: {
  userId: string;
  text: string;
  isInterviewLine: boolean;
  audioPlaybackTruncated: boolean;
  ttsPipeline?: string;
  currentInterviewMoment: number;
  currentScenario: 1 | 2 | 3;
  incomingAssistantTtsTextForS2Repair: string;
  s2RepairProbeDeliveredRef: MutableRefObject<boolean>;
  s3RepairProbeDeliveredRef: MutableRefObject<boolean>;
  recordInterviewAssistantDeliveryForMetaExemptionRef: MutableRefObject<(deliveredQuestionText: string) => void>;
  firstScenarioLifecyclePersistedRef: MutableRefObject<boolean>;
  interviewSessionAttemptIdRef: MutableRefObject<string | null>;
  persistInterviewAttemptSessionLifecycle: (
    attemptId: string | null | undefined,
    lifecycle: 'in_progress' | 'completed',
  ) => Promise<void>;
}): void {
  if (
    args.isInterviewLine &&
    args.currentInterviewMoment === 2 &&
    args.currentScenario === 2 &&
    looksLikeScenarioBRepairAsJamesQuestion(
      stripControlTokens(args.incomingAssistantTtsTextForS2Repair).trim(),
    )
  ) {
    if (args.s2RepairProbeDeliveredRef) {
      args.s2RepairProbeDeliveredRef.current = true;
    }
  }
  if (
    args.isInterviewLine &&
    args.currentInterviewMoment === 3 &&
    args.currentScenario === 3 &&
    isScenarioCRepairAssistantPrompt(
      stripControlTokens(args.incomingAssistantTtsTextForS2Repair).trim(),
    )
  ) {
    if (args.s3RepairProbeDeliveredRef) {
      args.s3RepairProbeDeliveredRef.current = true;
    }
  }

  if (!args.isInterviewLine) {
    return;
  }

  const rtd = getSessionLogRuntime();
  const deliveredQuestionText = resolveAssessableQuestionTextForResponseTiming(
    stripControlTokens(args.text).trim(),
  ).slice(0, 2000);
  args.recordInterviewAssistantDeliveryForMetaExemptionRef?.current?.(
    deliveredQuestionText,
  );
  writeSessionLog({
    userId: args.userId,
    attemptId: rtd.attemptId,
    eventType: 'question_delivered',
    eventData: {
      moment_number: args.currentInterviewMoment,
      scenario_number: args.currentScenario,
      question_text: deliveredQuestionText,
      delivered_at: new Date().toISOString(),
      ...(args.audioPlaybackTruncated ? { audio_playback_truncated: true } : {}),
      ...(args.ttsPipeline ? { tts_pipeline: args.ttsPipeline } : {}),
    },
    platform: rtd.platform,
  });

  const sn = args.currentScenario;
  if (args.firstScenarioLifecyclePersistedRef && !args.firstScenarioLifecyclePersistedRef.current && sn >= 1 && sn <= 3) {
    args.firstScenarioLifecyclePersistedRef.current = true;
    void args.persistInterviewAttemptSessionLifecycle(args.interviewSessionAttemptIdRef?.current, 'in_progress');
  }
}
