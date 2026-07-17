import {
  detectScenarioFromResponse,
  type ScenarioTaggedMessage,
} from '@features/aria/scenarioNumberDetection';
import {
  resolveEffectiveActiveScenarioFromTranscript,
  textContainsScenarioBVignetteBody,
  textContainsScenarioCVignetteBody,
} from '@features/aria/emotionScenarioTransitionInference';
import type { InterviewMomentIndex } from '@features/aria/interviewProgressSync';
import { remoteLog } from '@utilities/remoteLog';

export type InterviewScenarioRefSyncTarget = {
  currentScenarioRef: { current: number | null | undefined };
  currentInterviewMomentRef: { current: InterviewMomentIndex };
  interviewMomentsCompleteRef: { current: Record<number, boolean> };
  resumeActiveScenarioRef: { current: number | null | undefined };
  scoredScenariosRef?: { current: Set<number> };
  interviewSessionIdRef?: { current: string | null };
};

function maxScenarioFromAssistantContent(
  messages: ReadonlyArray<{ role: string; content?: string | null }>,
): 1 | 2 | 3 {
  let maxScenario: 1 | 2 | 3 = 1;
  for (const m of messages) {
    if (m.role !== 'assistant') continue;
    const content = (m.content ?? '').trim();
    if (!content) continue;
    const detected = detectScenarioFromResponse(content);
    if (detected != null) {
      maxScenario = Math.max(maxScenario, detected) as 1 | 2 | 3;
    }
    if (textContainsScenarioBVignetteBody(content)) {
      maxScenario = Math.max(maxScenario, 2) as 1 | 2 | 3;
    }
    if (textContainsScenarioCVignetteBody(content)) {
      maxScenario = Math.max(maxScenario, 3) as 1 | 2 | 3;
    }
  }
  return maxScenario;
}

export type SessionSpokenDeliveryHints = {
  parallelStreamingTtsRef?: {
    current: { spokenCompleteText: string; accumulatedFullText: string };
  };
  lastQuestionTextRef?: { current: string | null };
  webTabRestoreDeliveredNormRef?: { current: string | null };
  extraTexts?: readonly string[];
};

export type PreClaudeSessionSpokenDeliverySource = Pick<
  SessionSpokenDeliveryHints,
  | 'parallelStreamingTtsRef'
  | 'lastQuestionTextRef'
  | 'webTabRestoreDeliveredNormRef'
>;

export function buildPreClaudeSessionSpokenDeliveryHints(
  deps: PreClaudeSessionSpokenDeliverySource,
): SessionSpokenDeliveryHints {
  return {
    parallelStreamingTtsRef: deps.parallelStreamingTtsRef,
    lastQuestionTextRef: deps.lastQuestionTextRef,
    webTabRestoreDeliveredNormRef: deps.webTabRestoreDeliveredNormRef,
  };
}

export function collectSessionSpokenDeliveryTexts(hints: SessionSpokenDeliveryHints): string[] {
  const out: string[] = [];
  const ps = hints.parallelStreamingTtsRef?.current;
  /** Only spokenCompleteText counts — accumulatedFullText is the full model stream and may include muted S2/S3 vignettes. */
  if (ps?.spokenCompleteText?.trim()) out.push(ps.spokenCompleteText.trim());
  const lastQuestion = hints.lastQuestionTextRef?.current?.trim();
  if (lastQuestion) out.push(lastQuestion);
  const deliveredNorm = hints.webTabRestoreDeliveredNormRef?.current?.trim();
  if (deliveredNorm) out.push(deliveredNorm);
  for (const text of hints.extraTexts ?? []) {
    const t = text.trim();
    if (t) out.push(t);
  }
  return out;
}

export function inferScenarioFromSpokenDeliveryTexts(texts: readonly string[]): 1 | 2 | 3 | null {
  let maxScenario: 1 | 2 | 3 = 1;
  for (const text of texts) {
    if (textContainsScenarioCVignetteBody(text)) {
      maxScenario = 3;
    } else if (textContainsScenarioBVignetteBody(text)) {
      maxScenario = Math.max(maxScenario, 2) as 1 | 2 | 3;
    }
  }
  return maxScenario > 1 ? maxScenario : null;
}

export function advanceInterviewScenarioRefsAfterCanonicalShowScenarioCard(
  deps: InterviewScenarioRefSyncTarget,
  kind: 'situation_2' | 'situation_3' | 'moment_4',
): { advanced: boolean; effectiveScenario: 1 | 2 | 3 } {
  if (!deps.currentScenarioRef || !deps.currentInterviewMomentRef || !deps.interviewMomentsCompleteRef) {
    void remoteLog('[SCENARIO_REFS_ADVANCE_SKIPPED_MISSING_REFS]', {
      kind,
      interviewSessionId: deps.interviewSessionIdRef?.current ?? null,
      hasCurrentScenarioRef: !!deps.currentScenarioRef,
      hasMomentRef: !!deps.currentInterviewMomentRef,
      hasMomentsCompleteRef: !!deps.interviewMomentsCompleteRef,
    });
    return { advanced: false, effectiveScenario: 3 };
  }
  if (kind === 'moment_4') {
    deps.interviewMomentsCompleteRef.current[3] = true;
    deps.currentInterviewMomentRef.current = 4;
    void remoteLog('[SCENARIO_REFS_ADVANCED_CANONICAL_MOMENT_4]', {
      interviewSessionId: deps.interviewSessionIdRef?.current ?? null,
      interviewMoment: 4,
    });
    const currentScenario =
      deps.currentScenarioRef.current === 1 ||
      deps.currentScenarioRef.current === 2 ||
      deps.currentScenarioRef.current === 3
        ? deps.currentScenarioRef.current
        : 3;
    return { advanced: true, effectiveScenario: currentScenario as 1 | 2 | 3 };
  }
  const targetScenario = kind === 'situation_2' ? 2 : 3;
  return advanceInterviewScenarioRefsTo(
    deps,
    targetScenario,
    kind === 'situation_2'
      ? '[SCENARIO_REFS_ADVANCED_CANONICAL_SITUATION_2]'
      : '[SCENARIO_REFS_ADVANCED_CANONICAL_SITUATION_3]',
  );
}

function advanceInterviewScenarioRefsTo(
  deps: InterviewScenarioRefSyncTarget,
  effectiveScenario: 1 | 2 | 3,
  source: string,
): { advanced: boolean; effectiveScenario: 1 | 2 | 3 } {
  const currentScenario =
    deps.currentScenarioRef.current === 1 ||
    deps.currentScenarioRef.current === 2 ||
    deps.currentScenarioRef.current === 3
      ? deps.currentScenarioRef.current
      : 1;
  if (effectiveScenario <= currentScenario) {
    return { advanced: false, effectiveScenario: currentScenario as 1 | 2 | 3 };
  }
  for (let n = currentScenario; n < effectiveScenario; n++) {
    if (n === 1 || n === 2 || n === 3) {
      deps.interviewMomentsCompleteRef.current[n] = true;
    }
  }
  deps.currentInterviewMomentRef.current = effectiveScenario;
  deps.currentScenarioRef.current = effectiveScenario;
  if (deps.resumeActiveScenarioRef) {
    deps.resumeActiveScenarioRef.current = effectiveScenario;
  }
  void remoteLog(source, {
    interviewSessionId: deps.interviewSessionIdRef?.current ?? null,
    fromScenario: currentScenario,
    toScenario: effectiveScenario,
    interviewMoment: effectiveScenario,
  });
  return { advanced: true, effectiveScenario };
}

/**
 * Advance scenario/moment refs when TTS/stream/tab-restore delivered a later vignette
 * that never made it into the persisted transcript (common after tab-hide replay).
 */
export function syncInterviewScenarioRefsFromSpokenDelivery(
  deps: InterviewScenarioRefSyncTarget,
  hints: SessionSpokenDeliveryHints,
): { advanced: boolean; effectiveScenario: 1 | 2 | 3 } {
  if (!deps.currentScenarioRef || !deps.currentInterviewMomentRef || !deps.interviewMomentsCompleteRef) {
    return { advanced: false, effectiveScenario: 1 };
  }
  const inferred = inferScenarioFromSpokenDeliveryTexts(collectSessionSpokenDeliveryTexts(hints));
  if (!inferred) {
    const currentScenario =
      deps.currentScenarioRef.current === 1 ||
      deps.currentScenarioRef.current === 2 ||
      deps.currentScenarioRef.current === 3
        ? deps.currentScenarioRef.current
        : 1;
    return { advanced: false, effectiveScenario: currentScenario as 1 | 2 | 3 };
  }
  return advanceInterviewScenarioRefsTo(
    deps,
    inferred,
    '[SCENARIO_REFS_SYNCED_FROM_SPOKEN_DELIVERY]',
  );
}

/** Sync transcript + spoken/tab-restore delivery hints in one pass. */
export function syncInterviewScenarioRefsFromSessionState(
  deps: InterviewScenarioRefSyncTarget,
  messages: ReadonlyArray<ScenarioTaggedMessage & { role: string; content?: string | null }>,
  hints: SessionSpokenDeliveryHints,
): { advanced: boolean; effectiveScenario: 1 | 2 | 3 } {
  const fromTranscript = syncInterviewScenarioRefsFromTranscript(deps, messages);
  const fromSpoken = syncInterviewScenarioRefsFromSpokenDelivery(deps, hints);
  return {
    advanced: fromTranscript.advanced || fromSpoken.advanced,
    effectiveScenario: Math.max(fromTranscript.effectiveScenario, fromSpoken.effectiveScenario) as
      | 1
      | 2
      | 3,
  };
}

/** Infer the furthest scenario reached from transcript tags and assistant vignette intros. */
export function inferActiveScenarioFromTranscriptMessages(
  messages: ReadonlyArray<ScenarioTaggedMessage & { role: string; content?: string | null }>,
  interviewMoment: number,
  currentScenario?: number | null,
): 1 | 2 | 3 {
  const fromTags = resolveEffectiveActiveScenarioFromTranscript(
    currentScenario,
    interviewMoment,
    messages,
  );
  const fromContent = maxScenarioFromAssistantContent(messages);
  return Math.max(fromTags, fromContent) as 1 | 2 | 3;
}

/**
 * Advance scenario/moment refs when transcript or scoring shows the interview moved on
 * but in-memory refs lagged (e.g. empty handoff turn skipped persistence).
 */
export function syncInterviewScenarioRefsFromTranscript(
  deps: InterviewScenarioRefSyncTarget,
  messages: ReadonlyArray<ScenarioTaggedMessage & { role: string; content?: string | null }>,
): { advanced: boolean; effectiveScenario: 1 | 2 | 3 } {
  const currentScenario =
    deps.currentScenarioRef.current === 1 ||
    deps.currentScenarioRef.current === 2 ||
    deps.currentScenarioRef.current === 3
      ? deps.currentScenarioRef.current
      : 1;
  let effectiveScenario = inferActiveScenarioFromTranscriptMessages(
    messages,
    deps.currentInterviewMomentRef.current,
    currentScenario,
  );
  if (
    deps.scoredScenariosRef?.current.has(1) &&
    effectiveScenario < 2 &&
    currentScenario <= 1
  ) {
    effectiveScenario = 2;
  }
  if (
    deps.scoredScenariosRef?.current.has(2) &&
    effectiveScenario < 3 &&
    currentScenario <= 2
  ) {
    effectiveScenario = 3;
  }

  if (effectiveScenario <= currentScenario) {
    return { advanced: false, effectiveScenario: currentScenario as 1 | 2 | 3 };
  }

  return advanceInterviewScenarioRefsTo(
    deps,
    effectiveScenario,
    '[SCENARIO_REFS_SYNCED_FROM_TRANSCRIPT]',
  );
}
