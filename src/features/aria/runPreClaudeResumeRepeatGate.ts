import { Platform } from 'react-native';

import {
  looksLikeInterviewClosingAssistantMessage,
  transcriptHasInterviewClosingAssistantMessage,
} from '@features/aria/elongatingProbe';
import {
  stripControlTokens,
} from '@features/aria/interviewControlTokens';
import {
  findLastRepeatableInterviewQuestionText,
  resolveInterviewQuestionRepeatTtsText,
} from '@features/aria/interviewDisengagementProbes';
import {
  classifyResumeWelcomeBackRepeatIntent,
} from '@features/aria/resumeWelcomeBackRepeat';
import {
  buildScenarioPlusQuestionRepeatTts,
  getScenarioVignetteBodyForRepeat,
  looksLikeScenarioRepeatRequest,
  shouldAttachScenarioVignetteForRepeat,
  withRepeatRequestAcknowledgment,
} from '@features/aria/interviewRepeatRequestTarget';
import { countSpokenWords } from '@features/aria/interviewLanguageGate';
import type { MetaCommentClassification } from '@features/aria/metaCommentClassification';
import { isExplicitRepeatRequestPreClassification } from '@features/aria/metaCommentClassification';
import type { PreClaudeTurnGateDeps } from '@features/aria/preClaudeTurnGateTypes';
import { scenarioAContemptProbeResumeRepeatTtsText } from '@features/aria/probeAndScoringUtils';
import {
  looksLikeDirectResumeAnswer,
  looksLikeRepeatCueInAmbiguousReply,
  shouldBypassResumeRepeatGateForLongAnswer,
} from '@features/aria/resumeRepeatGate';
import { fetchElevenLabsMpegArrayBuffer } from '@features/aria/utils/elevenLabsTtsFetch';
import { remoteLog } from '@utilities/remoteLog';
import { getSessionLogRuntime, writeSessionLog } from '@utilities/sessionLogging';

export type PreClaudeResumeRepeatReentryType = 'repeat_requested' | 'continue_requested' | 'direct_answer' | null;

export type PreClaudeResumeRepeatGateResult = {
  /** When true, `runPreClaudeTurnGates` should return false and stop the turn. */
  haltTurn: boolean;
  reentryTypeForLogging: PreClaudeResumeRepeatReentryType;
};

function logResumeRepeatResponseReceived(
  deps: PreClaudeTurnGateDeps,
  trimmed: string,
  reentryTypeForLogging: PreClaudeResumeRepeatReentryType,
  routeChangedDuringRecordingSnap: boolean,
): void {
  if (!deps.userId) return;
  const r = getSessionLogRuntime();
  const deliveredAt = r.lastQuestionDeliveredAt;
  let latencyMs: number | null = null;
  if (deliveredAt) {
    const t = Date.parse(deliveredAt);
    if (!Number.isNaN(t)) latencyMs = Math.max(0, Date.now() - t);
  }
  writeSessionLog({
    userId: deps.userId,
    attemptId: r.attemptId,
    eventType: 'response_received',
    eventData: {
      moment_number: deps.currentInterviewMomentRef.current,
      word_count: countSpokenWords(trimmed),
      response_latency_ms: latencyMs,
      detected_language: deps.lastVoiceTurnLanguageRef.current,
      transcription_confidence: deps.lastVoiceTurnConfidenceRef.current,
      reentry_type: reentryTypeForLogging,
      route_changed_during_recording: routeChangedDuringRecordingSnap,
    },
    platform: r.platform,
  });
}

/**
 * Resume welcome-back gate: repeat last question TTS, continue without LLM, or fall through as direct answer.
 */
export async function runPreClaudeResumeRepeatGate(
  deps: PreClaudeTurnGateDeps,
  args: {
    trimmed: string;
    spokenText: string;
    routeChangedDuringRecordingSnap: boolean;
    metaCommentClassification: MetaCommentClassification | null;
    proactiveScenarioSkipConfirmationInjection: boolean;
    skipRequestMetaConfirmationInjection: boolean;
  },
): Promise<PreClaudeResumeRepeatGateResult> {
  if (!deps.resumeRepeatChoicePendingRef.current) {
    return { haltTurn: false, reentryTypeForLogging: null };
  }

  deps.resumeRepeatChoicePendingRef.current = false;
  let reentryTypeForLogging: PreClaudeResumeRepeatReentryType = null;

  let welcomeIntent = classifyResumeWelcomeBackRepeatIntent(args.trimmed);
  if (
    welcomeIntent === 'ambiguous' &&
    looksLikeRepeatCueInAmbiguousReply(args.trimmed)
  ) {
    welcomeIntent = 'repeat_scenario';
  }

  const isConfusionRepeatMeta =
    args.metaCommentClassification?.type === 'confusion' &&
    args.metaCommentClassification?.confusion_subtype === 'repeat_request';

  const deferRepeatToMetaVerbatimHandler =
    (welcomeIntent === 'ambiguous' &&
      (isConfusionRepeatMeta || isExplicitRepeatRequestPreClassification(args.trimmed))) ||
    (isConfusionRepeatMeta && !looksLikeScenarioRepeatRequest(args.trimmed));
  if (deferRepeatToMetaVerbatimHandler) {
    // Keep resumeLastAssistantTextRef — meta verbatim replay uses it as fallback so a
    // post-reentry "repeat what you said" does not fall through to the opening briefing.
    return { haltTurn: false, reentryTypeForLogging: 'repeat_requested' };
  }

  const resumeCueWordCount = countSpokenWords(args.trimmed);
  const resumeLastLooksLikeClosing = looksLikeInterviewClosingAssistantMessage(
    deps.resumeLastAssistantTextRef.current ?? '',
  );
  const longAnswerBypass =
    shouldBypassResumeRepeatGateForLongAnswer(resumeCueWordCount) && !resumeLastLooksLikeClosing;
  if (longAnswerBypass) {
    void remoteLog('[S1_RESUME_GATE_LONG_ANSWER_BYPASS]', { resumeCueWordCount });
    deps.resumeLastAssistantTextRef.current = null;
    deps.resumeRepeatPrefetchMpegRef.current = null;
    return { haltTurn: false, reentryTypeForLogging: 'direct_answer' };
  }

  if (
    (welcomeIntent === 'repeat_scenario' ||
      welcomeIntent === 'repeat_question' ||
      welcomeIntent === 'continue') &&
    resumeCueWordCount > 18
  ) {
    welcomeIntent = 'ambiguous';
  }
  if (
    welcomeIntent === 'continue' &&
    (args.proactiveScenarioSkipConfirmationInjection || args.skipRequestMetaConfirmationInjection)
  ) {
    welcomeIntent = 'ambiguous';
  }
  const directAnswer =
    welcomeIntent === 'ambiguous' &&
    looksLikeDirectResumeAnswer(args.trimmed, deps.resumeLastAssistantTextRef.current);

  if (welcomeIntent === 'repeat_scenario' || welcomeIntent === 'repeat_question') {
    reentryTypeForLogging = 'repeat_requested';
    logResumeRepeatResponseReceived(
      deps,
      args.trimmed,
      reentryTypeForLogging,
      args.routeChangedDuringRecordingSnap,
    );
    const last = findLastRepeatableInterviewQuestionText(
      deps.messages,
      deps.resumeLastAssistantTextRef.current ?? deps.lastQuestionTextRef.current,
      { activeScenario: deps.currentScenarioRef.current },
    );
    if (last?.trim() && !deps.resumeClosingRepeatSpeakInFlightRef.current) {
      deps.resumeClosingRepeatSpeakInFlightRef.current = true;
      try {
        const strippedRepeat = stripControlTokens(last).trim();
        const lastUserAnswer = [...deps.messages].reverse().find((m) => m.role === 'user')?.content;
        const questionOnlyText = resolveInterviewQuestionRepeatTtsText(
          scenarioAContemptProbeResumeRepeatTtsText(strippedRepeat),
          {
            firstName: deps.interviewNameRef.current ?? '',
            lastUserAnswer,
            activeScenario: deps.currentScenarioRef.current,
          },
        );
        const scenarioNumRaw = deps.currentScenarioRef.current ?? 1;
        const scenarioNum = (scenarioNumRaw === 2 || scenarioNumRaw === 3 ? scenarioNumRaw : 1) as
          | 1
          | 2
          | 3;
        const attachVignette =
          welcomeIntent === 'repeat_scenario' &&
          shouldAttachScenarioVignetteForRepeat({
            target: 'scenario',
            interviewMoment: deps.currentInterviewMomentRef.current,
            scenarioNumber: scenarioNum,
          });
        const repeatTtsText = withRepeatRequestAcknowledgment(
          attachVignette
            ? buildScenarioPlusQuestionRepeatTts(
                getScenarioVignetteBodyForRepeat(scenarioNum),
                questionOnlyText,
              )
            : questionOnlyText,
        );
        const usedContemptResumeRepeatTts = questionOnlyText !== strippedRepeat;
        void remoteLog('[S1_CONTEMPT_PROBE_RESUME_REPEAT_TTS]', {
          usedContemptResumeRepeatTts,
          storedPreview: strippedRepeat.slice(0, 200),
          ttsPreview: repeatTtsText.slice(0, 200),
          repeatTarget: attachVignette ? 'scenario' : 'question',
          s1ContemptFixVersion: 13,
        });
        const prefetched = deps.resumeRepeatPrefetchMpegRef.current;
        let prefetchedMpegArrayBuffer: ArrayBuffer | undefined =
          prefetched?.text === repeatTtsText && prefetched.buffer.byteLength > 0
            ? prefetched.buffer
            : undefined;
        deps.resumeRepeatPrefetchMpegRef.current = null;
        if (!prefetchedMpegArrayBuffer && Platform.OS === 'web') {
          const fetched = await fetchElevenLabsMpegArrayBuffer(repeatTtsText);
          if (fetched && fetched.byteLength > 0) {
            prefetchedMpegArrayBuffer = fetched;
          }
        }
        await deps.speakTextSafe(repeatTtsText, {
          telemetrySource: 'turn',
          skipPcmStream: true,
          prefetchedMpegArrayBuffer,
          skipQuestionDeliveredTelemetry: true,
          skipInterviewSpeechAdvance: true,
          skipQuestionTiming: true,
          skipLastQuestionRef: true,
          allowDuplicateConsecutiveTts: !resumeLastLooksLikeClosing,
          skipClosingSessionDedup: resumeLastLooksLikeClosing,
          skipScenarioAContemptProbeSessionDedup: true,
        });
      } finally {
        deps.resumeClosingRepeatSpeakInFlightRef.current = false;
      }
    }
    deps.resumeLastAssistantTextRef.current = null;
    if (resumeLastLooksLikeClosing && transcriptHasInterviewClosingAssistantMessage(deps.messages)) {
      const kicked = await deps.kickPostClosingInterviewCompletionIfReady(
        'resume_repeat_closing',
        deps.messages,
      );
      if (kicked) {
        return { haltTurn: true, reentryTypeForLogging };
      }
    }
    deps.setVoiceState('idle');
    return { haltTurn: true, reentryTypeForLogging };
  }

  if (welcomeIntent === 'continue') {
    reentryTypeForLogging = 'continue_requested';
    logResumeRepeatResponseReceived(
      deps,
      args.trimmed,
      reentryTypeForLogging,
      args.routeChangedDuringRecordingSnap,
    );
    if (transcriptHasInterviewClosingAssistantMessage(deps.messages)) {
      const kicked = await deps.kickPostClosingInterviewCompletionIfReady(
        'resume_continue_after_closing',
        deps.messages,
      );
      if (kicked) {
        return { haltTurn: true, reentryTypeForLogging };
      }
    }
    deps.setVoiceState('idle');
    return { haltTurn: true, reentryTypeForLogging };
  }

  reentryTypeForLogging = 'direct_answer';
  deps.resumeLastAssistantTextRef.current = null;
  return { haltTurn: false, reentryTypeForLogging };
}
