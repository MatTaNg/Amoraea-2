import {
  normalizeTtsTextForConsecutiveDedup,
} from '@features/aria/interviewControlTokens';
import { pickAlternateInterviewRecordingRetryLine } from '@features/aria/interviewNameValidation';
import {
  appendAssistantTurn,
  assistantTurnHasPersistableContent,
} from '@features/aria/interviewTranscriptTurns';
import type {
  DeliverRecordingRetryLineDeps,
  DeliverRecordingRetryLineParams,
} from '@features/aria/deliverRecordingRetryLineTypes';

export async function runDeliverRecordingRetryLine(
  deps: DeliverRecordingRetryLineDeps,
  params: DeliverRecordingRetryLineParams,
): Promise<void> {
  const now = Date.now();
  let speakMessage = params.message;
  let norm = normalizeTtsTextForConsecutiveDedup(speakMessage);
  const recentDuplicateRetry =
    norm.length > 0 &&
    deps.lastRecordingRetryDeliveredNormRef.current === norm &&
    now - deps.lastRecordingRetryDeliveredAtMsRef.current < 4000;
  if (recentDuplicateRetry) {
    const alternate = pickAlternateInterviewRecordingRetryLine(speakMessage);
    if (alternate) {
      speakMessage = alternate;
      norm = normalizeTtsTextForConsecutiveDedup(alternate);
    }
  }

  const prevSuccessfulNorm = deps.lastSuccessfulTtsTextNormalizedRef.current;
  if (norm.length > 0 && prevSuccessfulNorm === norm) {
    const alternate = pickAlternateInterviewRecordingRetryLine(speakMessage);
    const alternateNorm = alternate ? normalizeTtsTextForConsecutiveDedup(alternate) : null;
    if (alternate && alternateNorm !== prevSuccessfulNorm) {
      speakMessage = alternate;
      norm = alternateNorm ?? norm;
    }
  }

  deps.lastRecordingRetryDeliveredNormRef.current = norm;
  deps.lastRecordingRetryDeliveredAtMsRef.current = now;

  deps.commitInterviewMessages((prev) => {
    if (!assistantTurnHasPersistableContent(speakMessage)) {
      return prev;
    }
    const last = prev[prev.length - 1];
    const speakNorm = normalizeTtsTextForConsecutiveDedup(speakMessage);
    if (
      last?.role === 'assistant' &&
      normalizeTtsTextForConsecutiveDedup(String(last.content ?? '')) === speakNorm
    ) {
      return prev;
    }
    const scenarioNum =
      deps.currentScenarioRef.current === 1 ||
      deps.currentScenarioRef.current === 2 ||
      deps.currentScenarioRef.current === 3
        ? deps.currentScenarioRef.current
        : 1;
    return appendAssistantTurn(prev, speakMessage, {
      scenarioNumber: scenarioNum,
      interviewMoment: deps.currentInterviewMomentRef.current,
    });
  });
  deps.setVoiceState('speaking');
  await deps.speakTextSafe(speakMessage, {
    telemetrySource: 'turn',
    skipLastQuestionRef: true,
    allowDuplicateConsecutiveTts: true,
    ...params.speakOpts,
  }).catch(() => {});
  deps.setVoiceState('idle');
}
