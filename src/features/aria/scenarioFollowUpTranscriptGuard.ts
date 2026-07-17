/**
 * Transcript-based deduplication for scripted scenario follow-up questions.
 * Independent safety net — prevents duplicate delivery even when in-memory refs desync.
 */
import {
  looksLikeScenarioARepairQuestion,
  looksLikeScenarioBJamesDifferentlyQuestion,
  looksLikeScenarioBRepairAsJamesQuestion,
} from './interviewDisengagementProbes';
import {
  findLastUserWithPriorAssistantContent,
  findLastUserWithPriorScenarioARepairContext,
  userAnswerSatisfiesScenarioARepairPrompt,
} from './interviewRepairRefusalDetection';
import { hasScenarioBoundaryWrapPhrase } from './emotionModalTransitionOrchestration';
import { textContainsScenarioBVignetteBody } from './emotionScenarioTransitionInference';
import { isScenarioCRepairAssistantPrompt, isScenarioCQ1Prompt, transcriptContainsScenarioCQ1Prompt } from './scenarioCPromptDetection';
import { isScenarioBQ1Prompt, looksLikeScenarioBQ1Question } from './scenarioBProbeLogic';
import {
  isScenarioABoundaryReflectionWithoutNextVignette,
  looksLikeScenarioAContemptProbeQuestion,
} from './scenarioAContemptProbeTextMatch';
import {
  SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY,
  SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY,
} from './scenarioAContemptProbeTtsStrip';

export type ScenarioFollowUpTranscriptMessage = {
  role: string;
  content?: string;
  isWelcomeBack?: boolean;
  isScoreCard?: boolean;
};

/** S1 scripted follow-ups (contempt / repair) — use scenario ref; moment index can drift to 2 before S2. */
/** S3 scripted follow-ups (Sophie perspective / repair-as-Daniel) — use scenario ref; moment index can drift before M4. */
export function isActiveScenarioCConstructProbeTurn(
  currentScenario: number | null | undefined,
  currentInterviewMoment: number,
): boolean {
  // Personal moments keep scenarioRef at 3 — do not treat as Situation 3 construct turns.
  if (currentInterviewMoment >= 4) return false;
  if (currentScenario === 3) return true;
  return currentInterviewMoment === 3 && (currentScenario == null || currentScenario <= 3);
}

/** S2 scripted follow-ups (James-differently / repair-as-James) — use scenario ref; moment index can drift before S3. */
export function isActiveScenarioBConstructProbeTurn(
  currentScenario: number | null | undefined,
  currentInterviewMoment: number,
): boolean {
  if (currentInterviewMoment >= 4) return false;
  if (currentScenario === 2) return true;
  return currentInterviewMoment === 2 && (currentScenario == null || currentScenario <= 2);
}

export function isActiveScenarioAConstructProbeTurn(
  currentScenario: number | null | undefined,
  currentInterviewMoment: number,
): boolean {
  if (currentInterviewMoment >= 4) return false;
  if (currentScenario === 1) return true;
  return currentInterviewMoment === 1 && (currentScenario == null || currentScenario <= 1);
}

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

export function transcriptContainsScenarioCRepairQuestion(
  msgs: readonly ScenarioFollowUpTranscriptMessage[],
): boolean {
  return priorAssistantTurns(msgs).some((m) =>
    isScenarioCRepairAssistantPrompt((m as { content?: string }).content ?? ''),
  );
}

function substantiveTranscriptMessages(msgs: readonly ScenarioFollowUpTranscriptMessage[]) {
  return msgs.filter(
    (m) =>
      !(m as { isWelcomeBack?: boolean }).isWelcomeBack &&
      !(m as { isScoreCard?: boolean }).isScoreCard,
  );
}

function assistantTurnParagraphs(content: string): string[] {
  return (content ?? '')
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/** Repair paraphrases the model emits after the contempt probe (not only canonical copy). */
export function looksLikeScenarioARepairQuestionLoose(text: string): boolean {
  if (looksLikeScenarioARepairQuestion(text)) return true;
  const t = (text ?? '').toLowerCase();
  return /\bhow would you repair\b/.test(t) && /\bryan\b/.test(t);
}

/**
 * Repair counts as complete only when the user answered a delivered repair ask.
 * Phantom repair lines glued into the same turn as a contempt probe do not count —
 * the user may have answered the contempt question only (TTS often speaks contempt first).
 */
export function isScenarioARepairFollowUpCompleteInTranscript(
  msgs: readonly ScenarioFollowUpTranscriptMessage[],
): boolean {
  const filtered = substantiveTranscriptMessages(msgs);
  for (let i = 0; i < filtered.length; i++) {
    const m = filtered[i];
    if (m.role !== 'assistant') continue;
    const content = (m as { content?: string }).content ?? '';
    const paragraphs = assistantTurnParagraphs(content);
    const hasRepairParagraph = paragraphs.some((p) => looksLikeScenarioARepairQuestionLoose(p));
    if (!hasRepairParagraph) continue;

    const hasContemptInTurn = paragraphs.some((p) => looksLikeScenarioAContemptProbeQuestion(p));
    if (hasContemptInTurn && paragraphs.length > 1) continue;

    const next = filtered[i + 1];
    if (!next) {
      return paragraphs.length === 1 && looksLikeScenarioARepairQuestionLoose(content.trim());
    }
    if (next.role === 'user') return true;
    return false;
  }
  return false;
}

/**
 * Contempt was spoken via stream-only TTS (ref set) but the assistant row may be missing from the
 * live transcript until post-Claude persist — detect the turn after that delivery via lastQuestionText.
 */
export function userIsAnsweringAfterStreamDeliveredScenarioAContemptProbe(params: {
  scenarioAContemptProbeAsked: boolean;
  scenarioARepairQuestionAsked: boolean;
  lastDeliveredQuestionText?: string | null;
  messagesToUse: readonly ScenarioFollowUpTranscriptMessage[];
}): boolean {
  if (!params.scenarioAContemptProbeAsked || params.scenarioARepairQuestionAsked) {
    return false;
  }
  if (transcriptHasUserResponseAfterScenarioAContemptProbe(params.messagesToUse)) {
    return true;
  }
  const lastQ = (params.lastDeliveredQuestionText ?? '').trim();
  if (!looksLikeScenarioAContemptProbeQuestion(lastQ)) {
    return false;
  }
  const userTurnCount = substantiveTranscriptMessages(params.messagesToUse).filter(
    (m) => m.role === 'user',
  ).length;
  return userTurnCount >= 2;
}

/** True when a user turn follows the most recent Scenario A contempt probe in the transcript. */
export function transcriptHasUserResponseAfterScenarioAContemptProbe(
  msgs: readonly ScenarioFollowUpTranscriptMessage[],
): boolean {
  const filtered = substantiveTranscriptMessages(msgs);
  for (let i = filtered.length - 1; i >= 0; i--) {
    const m = filtered[i];
    if (m.role !== 'assistant') continue;
    if (
      !looksLikeScenarioAContemptProbeQuestion((m as { content?: string }).content ?? '')
    ) {
      continue;
    }
    return filtered.slice(i + 1).some((t) => t.role === 'user');
  }
  return false;
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

export function transcriptContainsScenarioBRepairAsJamesQuestion(
  msgs: readonly ScenarioFollowUpTranscriptMessage[],
): boolean {
  return priorAssistantTurns(msgs).some((m) =>
    looksLikeScenarioBRepairAsJamesQuestion((m as { content?: string }).content ?? ''),
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
    return isScenarioARepairFollowUpCompleteInTranscript(msgs);
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
  if (looksLikeScenarioBRepairAsJamesQuestion(t)) {
    return transcriptContainsScenarioBRepairAsJamesQuestion(msgs);
  }
  if (isScenarioBQ1Prompt(t) || looksLikeScenarioBQ1Question(t)) {
    return msgs.some(
      (m) =>
        m.role === 'assistant' &&
        (isScenarioBQ1Prompt((m.content ?? '').trim()) ||
          looksLikeScenarioBQ1Question((m.content ?? '').trim())),
    );
  }
  if (isScenarioCQ1Prompt(t)) {
    return transcriptContainsScenarioCQ1Prompt(msgs);
  }
  if (isScenarioCRepairAssistantPrompt(t)) {
    return transcriptContainsScenarioCRepairQuestion(msgs);
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
    repairQuestionAsked: isScenarioARepairFollowUpCompleteInTranscript(msgs),
  };
}

/** Scenario A may close only after a substantive repair-as-Ryan answer (mirrors S2 minimum engagement). */
export function scenarioAMinimumEngagementForHandoff(
  messages: readonly ScenarioFollowUpTranscriptMessage[],
): boolean {
  const repairCtx = findLastUserWithPriorScenarioARepairContext(messages);
  const direct = findLastUserWithPriorAssistantContent(messages);
  const lastUserContent = repairCtx.lastUserContent ?? direct.lastUserContent;
  const priorRepairAssistantContent =
    repairCtx.priorRepairAssistantContent ?? direct.priorAssistantContent;
  if (
    lastUserContent &&
    priorRepairAssistantContent &&
    (userAnswerSatisfiesScenarioARepairPrompt(lastUserContent, priorRepairAssistantContent) ||
      (looksLikeScenarioAContemptProbeQuestion(priorRepairAssistantContent) &&
        userAnswerSatisfiesScenarioARepairPrompt(
          lastUserContent,
          SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY,
        )))
  ) {
    return true;
  }

  if (!isScenarioARepairFollowUpCompleteInTranscript(messages)) {
    const filtered = substantiveTranscriptMessages(messages);
    const userTurnCount = filtered.filter((m) => m.role === 'user').length;
    if (userTurnCount >= 2 && !transcriptContainsScenarioAContemptProbe(messages)) {
      const lastUserContent = (direct.lastUserContent ?? '').trim();
      if (
        lastUserContent &&
        userAnswerSatisfiesScenarioARepairPrompt(
          lastUserContent,
          SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY,
        )
      ) {
        return true;
      }
    }
    return false;
  }
  const filtered = substantiveTranscriptMessages(messages);
  for (let i = filtered.length - 1; i >= 0; i--) {
    const m = filtered[i];
    if (m.role !== 'user') continue;
    const userContent = (m as { content?: string }).content ?? '';
    for (let j = i - 1; j >= 0; j--) {
      if (filtered[j].role !== 'assistant') continue;
      const asst = (filtered[j] as { content?: string }).content ?? '';
      if (looksLikeScenarioARepairQuestionLoose(asst)) {
        return userAnswerSatisfiesScenarioARepairPrompt(userContent, asst);
      }
      break;
    }
    break;
  }
  return false;
}

/** Next scripted S1 follow-up when a premature S1→S2 handoff is blocked. */
export function resolveScenarioANextRequiredFollowUpPrompt(
  messages: readonly ScenarioFollowUpTranscriptMessage[],
): string {
  if (!transcriptContainsScenarioAContemptProbe(messages)) {
    return SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY;
  }
  if (!transcriptHasUserResponseAfterScenarioAContemptProbe(messages)) {
    return SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY;
  }
  return SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY;
}

/** Drop premature S1 boundary / S2 vignette paragraphs while follow-ups are still pending. */
export function stripPrematureScenarioABoundaryFromDraft(text: string): string {
  const paragraphs = (text ?? '')
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
  const kept = paragraphs.filter(
    (p) =>
      !isScenarioABoundaryReflectionWithoutNextVignette(p) &&
      !hasScenarioBoundaryWrapPhrase(p) &&
      !textContainsScenarioBVignetteBody(p),
  );
  return kept.join('\n\n').trim();
}
