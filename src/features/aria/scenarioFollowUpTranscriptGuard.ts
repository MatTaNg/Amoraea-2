/**
 * Transcript-based deduplication for scripted scenario follow-up questions.
 * Independent safety net — prevents duplicate delivery even when in-memory refs desync.
 */
import {
  looksLikeScenarioARepairQuestion,
  looksLikeScenarioBJamesDifferentlyQuestion,
} from './interviewDisengagementProbes';
import {
  looksLikeScenarioAContemptProbeQuestion,
  SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY,
  SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY,
} from './probeAndScoringUtils';

export type ScenarioFollowUpTranscriptMessage = {
  role: string;
  content?: string;
  isWelcomeBack?: boolean;
  isScoreCard?: boolean;
};

function priorAssistantTurns(msgs: readonly ScenarioFollowUpTranscriptMessage[]) {
  return msgs.filter(
    (m) =>
      m.role === 'assistant' &&
      !(m as { isWelcomeBack?: boolean }).isWelcomeBack &&
      !(m as { isScoreCard?: boolean }).isScoreCard,
  );
}

export function looksLikeScenarioBFullAppreciationProbeQuestion(text: string): boolean {
  const t = (text ?? '').toLowerCase();
  return t.includes("what do you think james could've done differently so sarah feels better");
}

export function transcriptContainsScenarioAContemptProbe(
  msgs: readonly ScenarioFollowUpTranscriptMessage[],
): boolean {
  return priorAssistantTurns(msgs).some((m) =>
    looksLikeScenarioAContemptProbeQuestion((m as { content?: string }).content ?? ''),
  );
}

export function transcriptContainsScenarioARepairQuestion(
  msgs: readonly ScenarioFollowUpTranscriptMessage[],
): boolean {
  return priorAssistantTurns(msgs).some((m) =>
    looksLikeScenarioARepairQuestion((m as { content?: string }).content ?? ''),
  );
}

export function transcriptContainsScenarioBAppreciationProbe(
  msgs: readonly ScenarioFollowUpTranscriptMessage[],
): boolean {
  return priorAssistantTurns(msgs).some((m) =>
    looksLikeScenarioBFullAppreciationProbeQuestion((m as { content?: string }).content ?? ''),
  );
}

export function transcriptContainsScenarioBJamesDifferentlyProbe(
  msgs: readonly ScenarioFollowUpTranscriptMessage[],
): boolean {
  return priorAssistantTurns(msgs).some((m) =>
    looksLikeScenarioBJamesDifferentlyQuestion((m as { content?: string }).content ?? ''),
  );
}

/** True when an equivalent follow-up question already appears in prior assistant turns. */
export function scenarioFollowUpAlreadyInTranscript(
  msgs: readonly ScenarioFollowUpTranscriptMessage[],
  candidateText: string,
): boolean {
  const t = (candidateText ?? '').trim();
  if (!t) return false;
  if (looksLikeScenarioAContemptProbeQuestion(t)) {
    return transcriptContainsScenarioAContemptProbe(msgs);
  }
  if (looksLikeScenarioARepairQuestion(t)) {
    return transcriptContainsScenarioARepairQuestion(msgs);
  }
  if (looksLikeScenarioBFullAppreciationProbeQuestion(t)) {
    return transcriptContainsScenarioBAppreciationProbe(msgs);
  }
  if (looksLikeScenarioBJamesDifferentlyQuestion(t)) {
    return (
      transcriptContainsScenarioBJamesDifferentlyProbe(msgs) ||
      transcriptContainsScenarioBAppreciationProbe(msgs)
    );
  }
  return false;
}

/** Safe to deliver — false when transcript already contains this follow-up type. */
export function shouldDeliverScenarioFollowUpQuestion(
  msgs: readonly ScenarioFollowUpTranscriptMessage[],
  candidateText: string,
): boolean {
  return !scenarioFollowUpAlreadyInTranscript(msgs, candidateText);
}

/** Sync in-memory Scenario 1 follow-up flags from persisted transcript (resume + turn start). */
export function scenarioOneFollowUpFlagsFromTranscript(msgs: readonly ScenarioFollowUpTranscriptMessage[]): {
  contemptProbeAsked: boolean;
  repairQuestionAsked: boolean;
} {
  return {
    contemptProbeAsked: transcriptContainsScenarioAContemptProbe(msgs),
    repairQuestionAsked: transcriptContainsScenarioARepairQuestion(msgs),
  };
}

export {
  SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY,
  SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY,
};
