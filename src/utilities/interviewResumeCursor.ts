import { isGreetingOnly } from '../features/aria/interviewLocalPersistence';
import { isRepeatableMainInterviewQuestionLine } from '../features/aria/interviewDisengagementProbes';
import { transcriptHasInterviewClosingAssistantMessage } from '../features/aria/elongatingProbe';
import { SCENARIO_2_TO_3_TRANSITION_FALLBACK } from '../features/aria/interviewTransitionBundles';
import { looksLikeMoment4GrudgePrompt, looksLikeMoment4ThresholdQuestion } from '../features/aria/moment4ProbeLogic';
import { looksLikeMoment4SpecificityFollowUpEcho } from '../features/aria/moment4SpecificityFollowUp';
import { transcriptAssistantContainsMoment5PrimaryConflictQuestion } from '../features/aria/moment5TranscriptHelpers';
import {
  detectScenarioFromResponse,
  messageAnchorsScenarioIntro,
} from '../features/aria/scenarioNumberDetection';
import {
  isScenarioCRepairAssistantPrompt,
  isScenarioCQ1Prompt,
  looksLikeScenarioCSophiePerspectiveQuestion,
  scenarioCRepairConstructStillPending,
} from '../features/aria/scenarioCPromptDetection';
import {
  textContainsScenarioBVignetteBody,
  textContainsScenarioCVignetteBody,
} from '../features/aria/scenarioVignetteBodyDetection';
import type { MessageWithScenario } from '../features/aria/interviewScenarioScoringSlice';
import { pillarScoresHaveNumericAssessment } from '../features/aria/interviewCompletionGate';
import type { StoredInterviewData, StoredScenarioScores } from './storage/InterviewStorage';

export type InterviewMomentIndex = 1 | 2 | 3 | 4 | 5;

/** Same heuristics as AriaScreen `assistantTextBlocksMoment4ProgressInference` — keep retag from jumping to Moment 4 on S2→S3 copy. */
function looksLikeSituationTwoToThreeNotMomentFourHandoff(content: string): boolean {
  const t = (content ?? '').toLowerCase();
  if (t.includes(SCENARIO_2_TO_3_TRANSITION_FALLBACK.toLowerCase())) return true;
  if (t.includes("here's the third situation") || t.includes('here the third situation')) return true;
  if (t.includes('third situation') && (t.includes('more personal') || t.includes('two questions'))) return true;
  return (
    /\bsophie and daniel\b/.test(t) &&
    /i need ten minutes/.test(t) &&
    (/i didn'?t know what to say|did not know what to say|i didn'?t know how|did not know how/.test(t) ||
      /\bstill upset\b/.test(t))
  );
}

/** Align with AriaScreen `assistantTextLooksLikeScenarioCToMoment4Handoff` for resume retagging. */
function assistantResumeLooksLikeScenarioCToMoment4Handoff(content: string): boolean {
  const c = (content ?? '').toLowerCase();
  return (
    c.includes("we've covered those three") ||
    c.includes('three situations') ||
    c.includes('three described situations') ||
    c.includes('end of the three described') ||
    c.includes('last of the three described') ||
    c.includes('done with those three scenarios') ||
    c.includes("we're done with those three scenarios") ||
    c.includes('done with those three described situations')
  );
}

function resumeTranscriptCrossedMoment4Boundary(content: string): boolean {
  if (looksLikeSituationTwoToThreeNotMomentFourHandoff(content)) return false;
  const raw = content ?? '';
  const dt = raw.toLowerCase();
  const combined =
    assistantResumeLooksLikeScenarioCToMoment4Handoff(raw) &&
    (dt.includes('held a grudge') || looksLikeMoment4GrudgePrompt(raw));
  const grudgeOnly = looksLikeMoment4GrudgePrompt(raw) && !looksLikeMoment4ThresholdQuestion(raw);
  return combined || grudgeOnly;
}

/** Mirrors AriaScreen `detectScenarioFromResponse` for transcript retagging without importing the screen. */
export function detectScenarioAnchor(content: string): 1 | 2 | 3 | null {
  return detectScenarioFromResponse(content);
}

/** Index of the first assistant message that opens this scenario (vignette lead-in). */
export function firstAssistantIndexForScenarioIntro(
  msgs: ReadonlyArray<{ role: string; content?: string }>,
  scenario: 1 | 2 | 3
): number {
  for (let i = 0; i < msgs.length; i++) {
    const m = msgs[i];
    if (m.role !== 'assistant') continue;
    if (messageAnchorsScenarioIntro(m.content ?? '') === scenario) return i;
  }
  return -1;
}

/**
 * True when the user is already mid-scenario (answered, asked Q1/probes, skip confirm, etc.)
 * even if the vignette intro anchor is missing from the stored transcript.
 * Used to avoid replaying the full scenario opening on resume.
 */
export function transcriptHasInScenarioProgressPastOpening(
  msgs: ReadonlyArray<{
    role: string;
    content?: string | null;
    scenarioNumber?: number;
    interviewMoment?: number;
    isWelcomeBack?: boolean;
    isScoreCard?: boolean;
  }>,
  scenario: 1 | 2 | 3,
): boolean {
  for (const m of msgs) {
    if (m.isWelcomeBack || m.isScoreCard) continue;
    const moment =
      typeof m.interviewMoment === 'number' && m.interviewMoment >= 1 && m.interviewMoment <= 5
        ? m.interviewMoment
        : undefined;
    if (m.role === 'user') {
      if (m.scenarioNumber === scenario || moment === scenario) return true;
      continue;
    }
    if (m.role !== 'assistant') continue;
    const c = (m.content ?? '').trim();
    if (!c) continue;
    if (messageAnchorsScenarioIntro(c) === scenario) continue;
    if (
      (m.scenarioNumber === scenario || moment === scenario) &&
      (/\?/.test(c) || c.length >= 24)
    ) {
      return true;
    }
    if (scenario === 1 && /\bwhat(?:'s| is) going on between these two\b/i.test(c)) return true;
    if (scenario === 2 && /\bwhat do you think is going on here\b/i.test(c)) return true;
    if (scenario === 3) {
      if (isScenarioCQ1Prompt(c)) return true;
      if (looksLikeScenarioCSophiePerspectiveQuestion(c)) return true;
      if (isScenarioCRepairAssistantPrompt(c)) return true;
      if (
        /\bwhen daniel comes back\b/i.test(c) ||
        (/\bsophie\b/i.test(c) && /\?/.test(c)) ||
        /\bhow do you think this situation could be repaired\b/i.test(c)
      ) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Drop any partial turns for `scenario` (and later) so we can re-deliver the scenario from its opening.
 * Keeps messages before the first assistant line that anchors this scenario.
 */
export function sliceMessagesBeforeScenarioIntro<T extends { role: string; content?: string }>(
  msgs: T[],
  scenario: 1 | 2 | 3
): T[] {
  const idx = firstAssistantIndexForScenarioIntro(msgs, scenario);
  if (idx < 0) return msgs;
  return msgs.slice(0, idx);
}

/** Index of the first assistant message that opens Moment 4 (grudge / S3→M4 handoff). */
export function firstAssistantIndexForMoment4Intro(
  msgs: ReadonlyArray<{ role: string; content?: string }>,
): number {
  for (let i = 0; i < msgs.length; i++) {
    const m = msgs[i];
    if (m.role !== 'assistant') continue;
    if (resumeTranscriptCrossedMoment4Boundary(m.content ?? '')) return i;
  }
  return -1;
}

/** Drop Moment 4+ turns so we can re-deliver the personal-moment opening. */
export function sliceMessagesBeforeMoment4Intro<T extends { role: string; content?: string }>(
  msgs: T[],
): T[] {
  const idx = firstAssistantIndexForMoment4Intro(msgs);
  if (idx < 0) return msgs;
  return msgs.slice(0, idx);
}

/**
 * True when a stored scenario score bundle is assessable (finite numeric pillar scores).
 * Thin shells (`{}`, null-only pillars) and missing bundles are not intact.
 */
export function scenarioScoreBundleIntact(
  scenario: number,
  scores: StoredScenarioScores | undefined,
): boolean {
  const s = scores?.[scenario];
  if (!s) return false;
  return pillarScoresHaveNumericAssessment(s.pillarScores);
}

/**
 * True when local/DB scenario scores are present and assessable.
 * Prefer this over treating `scenariosCompleted` alone as completion (parallel scoring can mark
 * complete before persist finishes).
 */
export function scenarioHasPersistedScores(
  scenario: number,
  scores: StoredScenarioScores | undefined,
): boolean {
  return scenarioScoreBundleIntact(scenario, scores);
}

/**
 * Scenario was claimed complete (optimistic `scenariosCompleted`, scoringFailed, or a score shell)
 * but the score bundle is missing or not assessable — typical after interrupted parallel scoring.
 */
export function scenarioScoringCorruptOrInterrupted(
  scenario: 1 | 2 | 3,
  scenariosCompleted: number[],
  scenarioScores: StoredScenarioScores | undefined,
  scoringFailed?: ReadonlyArray<{ scenario: number }> | null,
): boolean {
  if (scenarioScoreBundleIntact(scenario, scenarioScores)) return false;
  if (scoringFailed?.some((f) => f.scenario === scenario)) return true;
  if ((scenariosCompleted ?? []).includes(scenario)) return true;
  const shell = scenarioScores?.[scenario];
  if (shell != null && typeof shell === 'object') {
    const ps = shell.pillarScores;
    if (ps != null && typeof ps === 'object' && !Array.isArray(ps)) return true;
  }
  return false;
}

/** Earliest scenario 1–3 with interrupted/corrupt parallel scoring, if any. */
export function earliestCorruptOrInterruptedScenarioScore(
  scenariosCompleted: number[],
  scenarioScores: StoredScenarioScores | undefined,
  scoringFailed?: ReadonlyArray<{ scenario: number }> | null,
): 1 | 2 | 3 | null {
  for (const n of [1, 2, 3] as const) {
    if (scenarioScoringCorruptOrInterrupted(n, scenariosCompleted, scenarioScores, scoringFailed)) {
      return n;
    }
  }
  return null;
}

/**
 * Strip score shells / completed markers from `fromScenario` onward after a corrupt-score rewind.
 */
export function clearScenarioScoresFromCorruptRewind(
  scenarioScores: StoredScenarioScores | undefined,
  scenariosCompleted: number[],
  fromScenario: 1 | 2 | 3,
): { scenarioScores: StoredScenarioScores; scenariosCompleted: number[] } {
  const nextScores: StoredScenarioScores = { ...(scenarioScores ?? {}) };
  for (const n of [1, 2, 3] as const) {
    if (n >= fromScenario) delete nextScores[n];
  }
  return {
    scenarioScores: nextScores,
    scenariosCompleted: (scenariosCompleted ?? []).filter((n) => n >= 1 && n < fromScenario),
  };
}

export function lastFullyCompletedScenario(
  scenariosCompleted: number[],
  scenarioScores: StoredScenarioScores | undefined
): number {
  // Only intact score bundles count. Optimistic `scenariosCompleted` entries (added when parallel
  // scoring starts) must not advance the resume cursor past an unfinished score.
  void scenariosCompleted;
  let max = 0;
  for (const n of [1, 2, 3] as const) {
    if (scenarioScoreBundleIntact(n, scenarioScores)) max = n;
  }
  return max;
}

/**
 * Saved local state is resumable only after a scenario vignette anchor exists (or a scenario was fully scored),
 * not after pre-scenario intro turns alone (name + "Are you ready?" + "Yes").
 */
export function storedInterviewHasResumableScenarioProgress(input: {
  messages: ReadonlyArray<{ role: string; content?: string }>;
  scenariosCompleted?: number[];
  scenarioScores?: StoredScenarioScores;
  resumeActiveScenario?: 1 | 2 | 3 | null;
  currentScenario?: number;
}): boolean {
  const userTurnsTotal = input.messages.filter((m) => m.role === 'user').length;
  const lastCompleted = lastFullyCompletedScenario(input.scenariosCompleted ?? [], input.scenarioScores);
  if (lastCompleted > 0 && userTurnsTotal >= 1) return true;

  const activeScenario = input.resumeActiveScenario ?? input.currentScenario ?? null;
  if (activeScenario != null && activeScenario >= 2 && activeScenario <= 3 && userTurnsTotal >= 1) {
    return true;
  }

  for (const scenario of [1, 2, 3] as const) {
    if (firstAssistantIndexForScenarioIntro(input.messages, scenario) >= 0 && userTurnsTotal >= 1) {
      return true;
    }
  }
  return false;
}

/** True when local storage holds an in-progress interview that should hydrate on refresh (not closing / greeting-only). */
export function shouldResumeMidInterviewFromSaved(
  saved: Pick<
    StoredInterviewData,
    | 'messages'
    | 'scenariosCompleted'
    | 'scenarioScores'
    | 'resumeActiveScenario'
    | 'currentScenario'
    | 'pendingCompletion'
  >,
): boolean {
  if (!saved.messages?.length) return false;
  if (savedInterviewReachedClosingState(saved)) return false;
  if (isGreetingOnly(saved.messages)) return false;
  const hasScenarioProgress = storedInterviewHasResumableScenarioProgress({
    messages: saved.messages,
    scenariosCompleted: saved.scenariosCompleted,
    scenarioScores: saved.scenarioScores,
    resumeActiveScenario: saved.resumeActiveScenario ?? null,
    currentScenario: saved.currentScenario ?? undefined,
  });
  const hasCompletedScenario =
    (saved.scenariosCompleted?.length ?? 0) > 0 ||
    lastFullyCompletedScenario(saved.scenariosCompleted ?? [], saved.scenarioScores) > 0;
  if (!hasScenarioProgress && !hasCompletedScenario) return false;
  const completedCount = saved.scenariosCompleted?.length ?? 0;
  const allScenarioVignettesScored =
    completedCount >= 3 ||
    lastFullyCompletedScenario(saved.scenariosCompleted ?? [], saved.scenarioScores) >= 3;
  if (allScenarioVignettesScored) {
    return !saved.pendingCompletion;
  }
  return completedCount < 3;
}

function coerceResumeActive(
  fromStorage: 1 | 2 | 3 | null | undefined,
  fromAttempt: number | null | undefined
): 1 | 2 | 3 | null {
  const raw = fromAttempt ?? fromStorage ?? null;
  if (raw === 1 || raw === 2 || raw === 3) return raw;
  return null;
}

/** Latest scenario vignette anchor in transcript order — used when resume_active_scenario lags behind. */
export function inferLatestScenarioIntroFromTranscript(
  messages: ReadonlyArray<{ role: string; content?: string }>,
): 1 | 2 | 3 | null {
  let last: 1 | 2 | 3 | null = null;
  for (const m of messages) {
    if (m.role !== 'assistant') continue;
    const anchor = detectScenarioAnchor(m.content ?? '');
    if (anchor != null) last = anchor;
  }
  return last;
}

export type InterviewResumeMode = 'replay_incomplete' | 'resume_next' | 'resume_post_scenarios';

export type InterviewResumePlan = {
  lastCompletedScenario: number;
  resumeScenario: 1 | 2 | 3;
  effectiveMoment: InterviewMomentIndex;
  momentsComplete: Record<InterviewMomentIndex, boolean>;
  personalHandoffInjected: boolean;
  mode: InterviewResumeMode;
  /** True when the active scenario had no full score bundle yet (mid-scenario dropout). */
  partialScenarioDataWritten: boolean;
  /**
   * Parallel scoring was interrupted / left a corrupt shell — rewind transcript to this scenario's
   * (or Moment 4) opening instead of picking up mid-vignette.
   */
  rewindDueToCorruptScoring: boolean;
  /** When set, rewind to Moment 4 opening (S1–S3 scores intact but M4 score interrupted). */
  rewindToMoment4DueToCorruptScoring: boolean;
};

function cloneMoments(m: Record<InterviewMomentIndex, boolean>): Record<InterviewMomentIndex, boolean> {
  return { ...m };
}

/**
 * Resume at Moment 4+ when S3 repair is satisfied or personal part already started —
 * including when parallel scoring never persisted (`lastCompletedScenario` < 3).
 */
function tryBuildResumePostScenariosPersonalPartPlan(input: {
  lastC: number;
  partialScenarioDataWritten: boolean;
  transcriptMessages?: ReadonlyArray<{ role: string; content?: string }>;
  syncedMoments: {
    momentsComplete: Record<InterviewMomentIndex, boolean>;
    currentMoment: InterviewMomentIndex;
    personalHandoffInjected: boolean;
  };
}): InterviewResumePlan | null {
  const transcriptForRepair = (input.transcriptMessages ?? []) as MessageWithScenario[];
  const hasS3TranscriptProgress = transcriptHasInScenarioProgressPastOpening(
    input.transcriptMessages ?? [],
    3,
  );

  const personalPartActive = resumeTranscriptIndicatesPersonalPartActive(
    input.transcriptMessages,
    input.syncedMoments,
  );
  if (personalPartActive) {
    return {
      lastCompletedScenario: input.lastC,
      resumeScenario: 3,
      effectiveMoment: Math.max(input.syncedMoments.currentMoment, 4) as InterviewMomentIndex,
      momentsComplete: cloneMoments(input.syncedMoments.momentsComplete),
      personalHandoffInjected: input.syncedMoments.personalHandoffInjected,
      mode: 'resume_post_scenarios',
      partialScenarioDataWritten: input.partialScenarioDataWritten,
      rewindDueToCorruptScoring: false,
      rewindToMoment4DueToCorruptScoring: false,
    };
  }

  if (!hasS3TranscriptProgress && input.lastC < 3) {
    return null;
  }

  const personalPartMarkersInTranscript =
    resumeTranscriptAlreadyDeliveredMoment4Question(input.transcriptMessages ?? []) ||
    transcriptHasPersistedPersonalPartProgress(input.transcriptMessages ?? []);
  const s3RepairConstructStillPending =
    transcriptForRepair.length > 0 &&
    scenarioCRepairConstructStillPending(transcriptForRepair);

  /** S3 repair Q2 satisfied but app closed before/during M4 handoff — resume at Moment 4, not S3 replay. */
  if (!s3RepairConstructStillPending || personalPartMarkersInTranscript) {
    const mc = createMomentCompletionFromLastC(input.lastC);
    mc[3] = true;
    return {
      lastCompletedScenario: input.lastC,
      resumeScenario: 3,
      effectiveMoment: 4,
      momentsComplete: mc,
      personalHandoffInjected: false,
      mode: 'resume_post_scenarios',
      partialScenarioDataWritten: input.partialScenarioDataWritten,
      rewindDueToCorruptScoring: false,
      rewindToMoment4DueToCorruptScoring: false,
    };
  }

  /** Mid-S3 replay only applies once all scenario score bundles exist (legacy scored path). */
  if (input.lastC < 3) {
    return null;
  }

  const mc = createMomentCompletionFromLastC(input.lastC);
  mc[3] = false;
  const stillMidScenario3 = hasS3TranscriptProgress;
  const effectiveMoment = (
    stillMidScenario3 ? 3 : Math.min(input.syncedMoments.currentMoment, 3)
  ) as InterviewMomentIndex;
  return {
    lastCompletedScenario: input.lastC,
    resumeScenario: 3,
    effectiveMoment,
    momentsComplete: mc,
    personalHandoffInjected: false,
    mode: stillMidScenario3 ? 'replay_incomplete' : 'resume_next',
    partialScenarioDataWritten: input.partialScenarioDataWritten,
    rewindDueToCorruptScoring: false,
    rewindToMoment4DueToCorruptScoring: false,
  };
}

export function computeInterviewResumePlan(input: {
  scenariosCompleted: number[];
  scenarioScores: StoredScenarioScores | undefined;
  resumeActiveFromStorage: 1 | 2 | 3 | null | undefined;
  resumeActiveFromAttempt: number | null | undefined;
  transcriptMessages?: ReadonlyArray<{ role: string; content?: string }>;
  syncedMoments: {
    momentsComplete: Record<InterviewMomentIndex, boolean>;
    currentMoment: InterviewMomentIndex;
    personalHandoffInjected: boolean;
  };
  scoringFailed?: ReadonlyArray<{ scenario: number }> | null;
  /** When known from DB `scenario_specific_patterns.moment_4_scores` (null = unknown / not fetched). */
  moment4ScoresIntact?: boolean | null;
}): InterviewResumePlan {
  const lastC = lastFullyCompletedScenario(input.scenariosCompleted, input.scenarioScores);
  const earliestCorrupt = earliestCorruptOrInterruptedScenarioScore(
    input.scenariosCompleted,
    input.scenarioScores,
    input.scoringFailed,
  );

  if (earliestCorrupt != null) {
    const activeRaw = coerceResumeActive(input.resumeActiveFromStorage, input.resumeActiveFromAttempt);
    const inferredFromTranscript = input.transcriptMessages
      ? inferLatestScenarioIntroFromTranscript(input.transcriptMessages)
      : null;
    const syncedMoment = input.syncedMoments.currentMoment;
    const candidateProgress = Math.max(
      activeRaw ?? 0,
      inferredFromTranscript ?? 0,
      syncedMoment >= 1 && syncedMoment <= 3 ? syncedMoment : 0,
    ) as 1 | 2 | 3;
    const hasTranscriptProgressAtCandidate =
      transcriptHasInScenarioProgressPastOpening(input.transcriptMessages ?? [], candidateProgress) ||
      (inferredFromTranscript != null &&
        inferredFromTranscript >= candidateProgress &&
        inferredFromTranscript > earliestCorrupt);
    const canResumePastCorrupt =
      candidateProgress > earliestCorrupt &&
      input.transcriptMessages != null &&
      hasTranscriptProgressAtCandidate;

    /** Gameplay moved past a scenario whose parallel score never finished — resume mid-scenario, not replay. */
    if (canResumePastCorrupt) {
      const mc = createMomentCompletionFromLastC(lastC);
      for (const i of [1, 2, 3] as const) {
        if (i < candidateProgress) mc[i] = true;
      }
      mc[candidateProgress] = false;
      const effectiveMoment = Math.max(candidateProgress, syncedMoment) as InterviewMomentIndex;
      const personalHandoffInjected = input.syncedMoments.personalHandoffInjected;
      if (syncedMoment >= 4 && personalHandoffInjected) {
        mc[3] = true;
      }
      return {
        lastCompletedScenario: lastC,
        resumeScenario: candidateProgress,
        effectiveMoment,
        momentsComplete: mc,
        personalHandoffInjected,
        mode: 'replay_incomplete',
        partialScenarioDataWritten: !scenarioHasPersistedScores(
          candidateProgress,
          input.scenarioScores,
        ),
        rewindDueToCorruptScoring: false,
        rewindToMoment4DueToCorruptScoring: false,
      };
    }

    const mc = createMomentCompletionFromLastC(lastC);
    for (const i of [1, 2, 3] as const) {
      if (i < earliestCorrupt) mc[i] = true;
      else mc[i] = false;
    }
    return {
      lastCompletedScenario: lastC,
      resumeScenario: earliestCorrupt,
      effectiveMoment: earliestCorrupt,
      momentsComplete: mc,
      personalHandoffInjected: false,
      mode: 'replay_incomplete',
      partialScenarioDataWritten: true,
      rewindDueToCorruptScoring: true,
      rewindToMoment4DueToCorruptScoring: false,
    };
  }

  let activeRaw = coerceResumeActive(input.resumeActiveFromStorage, input.resumeActiveFromAttempt);
  const inferredFromTranscript = input.transcriptMessages
    ? inferLatestScenarioIntroFromTranscript(input.transcriptMessages)
    : null;
  if (inferredFromTranscript != null && (activeRaw == null || inferredFromTranscript > activeRaw)) {
    activeRaw = inferredFromTranscript;
  }
  const effectiveActive =
    activeRaw != null && !scenarioHasPersistedScores(activeRaw, input.scenarioScores) ? activeRaw : null;

  const partialScenarioDataWritten = Boolean(
    effectiveActive != null && !scenarioHasPersistedScores(effectiveActive, input.scenarioScores)
  );

  const transcriptReachedM5 =
    input.syncedMoments.currentMoment >= 5 ||
    (input.transcriptMessages != null &&
      input.transcriptMessages.some(
        (m) =>
          m.role === 'assistant' &&
          typeof m.content === 'string' &&
          /conflict with someone important/i.test(m.content),
      ));
  /** Live M4 scoring starts at M5 entry — only then is a missing M4 bundle "interrupted". */
  const m4CorruptInterrupted =
    lastC >= 3 &&
    transcriptReachedM5 &&
    input.moment4ScoresIntact === false;

  if (lastC >= 3 && m4CorruptInterrupted) {
    const mc = createMomentCompletionFromLastC(3);
    return {
      lastCompletedScenario: 3,
      resumeScenario: 3,
      effectiveMoment: 4,
      momentsComplete: mc,
      personalHandoffInjected: false,
      mode: 'resume_post_scenarios',
      partialScenarioDataWritten: true,
      rewindDueToCorruptScoring: true,
      rewindToMoment4DueToCorruptScoring: true,
    };
  }

  const postScenariosPlan = tryBuildResumePostScenariosPersonalPartPlan({
    lastC,
    partialScenarioDataWritten,
    transcriptMessages: input.transcriptMessages,
    syncedMoments: input.syncedMoments,
  });
  if (postScenariosPlan) {
    return postScenariosPlan;
  }

  if (effectiveActive != null) {
    const syncedMoment = input.syncedMoments.currentMoment;
    const progressHint = Math.max(
      inferredFromTranscript ?? 0,
      syncedMoment >= 1 && syncedMoment <= 3 ? syncedMoment : 0,
    );
    let resumeAt = effectiveActive;
    if (
      progressHint > effectiveActive &&
      progressHint <= 3 &&
      !scenarioHasPersistedScores(progressHint, input.scenarioScores)
    ) {
      resumeAt = progressHint as 1 | 2 | 3;
    }
    const mc = createMomentCompletionFromLastC(lastC);
    for (const i of [1, 2, 3] as const) {
      if (i < resumeAt) mc[i] = true;
    }
    mc[resumeAt] = false;
    /**
     * Transcript-derived moment (e.g. Moment 4 threshold) can be ahead of `resume_active_scenario` (still 3).
     * Previously we forced `effectiveMoment` to the scenario index, which snapped `currentInterviewMomentRef`
     * back to 3 after resume and skipped client M5 bundle inject (model streamed only the conflict line).
     */
    const effectiveMoment = Math.max(
      resumeAt,
      syncedMoment
    ) as InterviewMomentIndex;
    const personalHandoffInjected = input.syncedMoments.personalHandoffInjected;
    if (syncedMoment >= 4 && personalHandoffInjected) {
      mc[3] = true;
    }
    return {
      lastCompletedScenario: lastC,
      resumeScenario: resumeAt,
      effectiveMoment,
      momentsComplete: mc,
      personalHandoffInjected,
      mode: 'replay_incomplete',
      partialScenarioDataWritten,
      rewindDueToCorruptScoring: false,
      rewindToMoment4DueToCorruptScoring: false,
    };
  }

  /**
   * Unscored S1→S2 transitions can leave no `resume_active_scenario` while synced moment is already 2.
   * Only bump ahead of the default `lastCompleted + 1` cursor — not when S1 is fully scored and S2 is next.
   */
  const syncedMoment = input.syncedMoments.currentMoment;
  const progressHint = Math.max(
    inferredFromTranscript ?? 0,
    syncedMoment >= 1 && syncedMoment <= 3 ? syncedMoment : 0,
    activeRaw ?? 0,
  );
  const nextScenario = (Math.min(lastC + 1, 3) as 1 | 2 | 3) as 1 | 2 | 3;
  if (progressHint > nextScenario && progressHint <= 3) {
    const candidate = progressHint as 1 | 2 | 3;
    if (!scenarioHasPersistedScores(candidate, input.scenarioScores)) {
      const mc = createMomentCompletionFromLastC(lastC);
      for (const i of [1, 2, 3] as const) {
        if (i < candidate) mc[i] = true;
      }
      mc[candidate] = false;
      const effectiveMoment = Math.max(candidate, syncedMoment) as InterviewMomentIndex;
      const personalHandoffInjected = input.syncedMoments.personalHandoffInjected;
      if (syncedMoment >= 4 && personalHandoffInjected) {
        mc[3] = true;
      }
      return {
        lastCompletedScenario: lastC,
        resumeScenario: candidate,
        effectiveMoment,
        momentsComplete: mc,
        personalHandoffInjected,
        mode: 'replay_incomplete',
        partialScenarioDataWritten: true,
        rewindDueToCorruptScoring: false,
        rewindToMoment4DueToCorruptScoring: false,
      };
    }
  }

  const mc = createMomentCompletionFromLastC(lastC);
  return {
    lastCompletedScenario: lastC,
    resumeScenario: nextScenario,
    effectiveMoment: nextScenario,
    momentsComplete: mc,
    personalHandoffInjected: false,
    mode: 'resume_next',
    partialScenarioDataWritten,
    rewindDueToCorruptScoring: false,
    rewindToMoment4DueToCorruptScoring: false,
  };
}

export function createMomentCompletionFromLastC(lastC: number): Record<InterviewMomentIndex, boolean> {
  return {
    1: lastC >= 1,
    2: lastC >= 2,
    3: lastC >= 3,
    4: false,
    5: false,
  };
}

/** Resume welcome-back copy (TTS + transcript bubble) — used to block duplicate gesture-flush playback. */
export function isResumeWelcomeBackAssistantText(text: string | null | undefined): boolean {
  const c = (text ?? '').toLowerCase().replace(/\s+/g, ' ');
  return (
    c.includes('welcome back') &&
    (c.includes('we were in scenario') ||
      c.includes("you're on situation") ||
      c.includes('left off in the personal part') ||
      c.includes('pick up where we left off') ||
      c.includes('i just said') ||
      c.includes('i just asked you') ||
      c.includes('repeat the scenario') ||
      c.includes('repeat what i said'))
  );
}

/** Drop ephemeral resume welcome lines so refresh does not stack duplicate bubbles. */
export function stripEphemeralWelcomeBackMessages<
  T extends { role: string; content?: string; isWelcomeBack?: boolean },
>(msgs: T[]): T[] {
  return msgs.filter((m) => {
    if ((m as { isWelcomeBack?: boolean }).isWelcomeBack) return false;
    if (m.role !== 'assistant') return true;
    return !isResumeWelcomeBackAssistantText(m.content);
  });
}

/** After scenario N is fully complete, emotion modals 0..N−1 should have been shown. */
export function emotionModalCatchUpThroughScenario(lastCompletedScenario: number): 1 | 2 | 3 | null {
  if (lastCompletedScenario < 1) return null;
  return Math.min(3, lastCompletedScenario) as 1 | 2 | 3;
}

/**
 * Score bundles can lag transcript progress (e.g. Moment 4 grudge after S3 vignette while `lastCompletedScenario` is still 2).
 * Use moment + transcript handoff so the post–S3 emotion modal (index 2) is not skipped on resume.
 */
export type EmotionModalCatchUpFromResume = {
  through: 1 | 2 | 3 | null;
  /** Why `through` was raised above `lastCompletedScenario` (for resume debug). */
  bumpReason: string | null;
};

export function emotionModalCatchUpThroughScenarioFromResume(params: {
  lastCompletedScenario: number;
  effectiveMoment: InterviewMomentIndex;
  transcriptMessages: ReadonlyArray<{ role: string; content?: string }>;
}): EmotionModalCatchUpFromResume {
  let through = params.lastCompletedScenario;
  let bumpReason: string | null = null;
  if (params.effectiveMoment >= 4) {
    if (through < 3) bumpReason = 'effectiveMoment>=4';
    through = Math.max(through, 3);
  } else if (params.effectiveMoment === 3) {
    if (through < 2) bumpReason = 'effectiveMoment===3';
    through = Math.max(through, 2);
  } else if (params.effectiveMoment === 2) {
    if (through < 1) bumpReason = 'effectiveMoment===2';
    through = Math.max(through, 1);
  }
  for (let i = 0; i < params.transcriptMessages.length; i++) {
    const m = params.transcriptMessages[i];
    if (m.role !== 'assistant') continue;
    const content = m.content ?? '';
    if (resumeTranscriptCrossedMoment4Boundary(content)) {
      if (through < 3) bumpReason = `transcript_m4_boundary@${i}`;
      through = Math.max(through, 3);
      break;
    }
    if (textContainsScenarioCVignetteBody(content)) {
      if (through < 2) bumpReason = `transcript_s3_vignette@${i}`;
      through = Math.max(through, 2);
    } else if (textContainsScenarioBVignetteBody(content)) {
      if (through < 1) bumpReason = `transcript_s2_vignette@${i}`;
      through = Math.max(through, 1);
    }
  }
  return {
    through: emotionModalCatchUpThroughScenario(through),
    bumpReason,
  };
}

/** True when the saved session finished (closing delivered) or is awaiting post-interview scoring. */
export function savedInterviewReachedClosingState(input: {
  pendingCompletion?: boolean;
  messages?: ReadonlyArray<{
    role: string;
    content?: string;
    isWelcomeBack?: boolean;
    isScoreCard?: boolean;
  }>;
}): boolean {
  if (input.pendingCompletion === true) return true;
  return transcriptHasInterviewClosingAssistantMessage(input.messages ?? []);
}

/** Offer welcome-back TTS on mid-interview resume only — never after the closing turn. */
export function shouldOfferResumeWelcomeTts(params: {
  mode: InterviewResumeMode;
  transcriptMessages: ReadonlyArray<{
    role: string;
    content?: string;
    isWelcomeBack?: boolean;
    isScoreCard?: boolean;
  }>;
}): boolean {
  if (transcriptHasInterviewClosingAssistantMessage(params.transcriptMessages)) return false;
  return true;
}

function resumeScenarioLabel(scenario: 1 | 2 | 3): string {
  if (scenario === 1) return 'Scenario one';
  if (scenario === 2) return 'Scenario two';
  return 'Scenario three';
}

function normalizeResumeWelcomeLastQuestionText(text: string | null | undefined): string | null {
  const cleaned = (text ?? '').replace(/\s+/g, ' ').trim();
  return cleaned || null;
}

export function resumeWelcomeMessageEmbedsLastQuestion(welcomeMessage: string): boolean {
  return /\bi just (?:said|asked you)\b/i.test(welcomeMessage);
}

type PersonalPartTranscriptTurn = {
  role: string;
  content?: string;
  interviewMoment?: number;
};

/** Persisted `interviewMoment: 4+` on any turn — grudge may be card/TTS-only without a full assistant row. */
export function transcriptHasPersistedPersonalPartProgress(
  transcriptMessages: ReadonlyArray<PersonalPartTranscriptTurn> | undefined,
): boolean {
  return (transcriptMessages ?? []).some(
    (m) => typeof m.interviewMoment === 'number' && m.interviewMoment >= 4,
  );
}

/** True when Moment 4+ personal segment has actually started — not merely S1–S3 scored. */
export function resumeTranscriptIndicatesPersonalPartActive(
  transcriptMessages: ReadonlyArray<PersonalPartTranscriptTurn> | undefined,
  synced: {
    currentMoment: InterviewMomentIndex;
    personalHandoffInjected: boolean;
  },
): boolean {
  if (synced.personalHandoffInjected) return true;
  const msgs = transcriptMessages ?? [];
  if (transcriptHasPersistedPersonalPartProgress(msgs)) return true;
  if (resumeTranscriptAlreadyDeliveredMoment4Question(msgs)) return true;
  if (synced.currentMoment >= 5) return true;
  return msgs.some(
    (m) =>
      m.role === 'assistant' &&
      typeof m.content === 'string' &&
      transcriptAssistantContainsMoment5PrimaryConflictQuestion(m.content),
  );
}

export function buildResumeWelcomeMessage(params: {
  mode: InterviewResumeMode;
  resumeScenario: 1 | 2 | 3;
  lastQuestionText?: string | null;
}): string {
  const lastQuestion = normalizeResumeWelcomeLastQuestionText(params.lastQuestionText);
  const questionTail =
    lastQuestion && isRepeatableMainInterviewQuestionLine(lastQuestion)
      ? ` and I just said ${lastQuestion}`
      : '';
  if (params.mode === 'resume_post_scenarios') {
    const base = `Welcome back, we'll pick up where we left off, we were in the personal part of the interview`;
    return questionTail ? `${base}${questionTail}.` : `${base}.`;
  }
  const base = `Welcome back, we'll pick up where we left off, we were in ${resumeScenarioLabel(params.resumeScenario)}`;
  return questionTail ? `${base}${questionTail}.` : `${base}.`;
}

/** True when any assistant turn already delivered the grudge or a later Moment 4 question. */
export function resumeTranscriptAlreadyDeliveredMoment4Question(
  transcriptMessages: ReadonlyArray<{ role: string; content?: string }>
): boolean {
  for (let i = transcriptMessages.length - 1; i >= 0; i--) {
    const m = transcriptMessages[i];
    if (m.role !== 'assistant') continue;
    const content = (m.content ?? '').trim();
    if (!content) continue;
    if (looksLikeMoment4SpecificityFollowUpEcho(content)) return true;
    if (looksLikeMoment4ThresholdQuestion(content)) return true;
    if (resumeTranscriptCrossedMoment4Boundary(content)) return true;
    if (looksLikeMoment4GrudgePrompt(content)) return true;
  }
  return false;
}

/**
 * After emotion-modal catch-up on resume, only auto-speak the post-modal grudge segment when the user
 * has not already heard it. Otherwise welcome-back ends silently (user can ask to repeat).
 */
export function resumeShouldSpeakEmotionCatchUpAfterModal(
  transcriptMessages: ReadonlyArray<{ role: string; content?: string }>,
  afterModal: string | null | undefined
): boolean {
  if (!afterModal?.trim()) return false;
  return !resumeTranscriptAlreadyDeliveredMoment4Question(transcriptMessages);
}

type ScenarioTaggedTranscriptTurn = {
  role: string;
  content?: string;
  scenarioNumber?: number;
  interviewMoment?: number;
};

function isEphemeralOrNonScoringTranscriptTurn(m: ScenarioTaggedTranscriptTurn): boolean {
  return (
    (m as { isScoreCard?: boolean }).isScoreCard === true ||
    (m as { isWelcomeBack?: boolean }).isWelcomeBack === true
  );
}

/**
 * Assign scenarioNumber on every user/assistant turn:
 * - Scenarios A–C follow vignette / transition anchors (1 → 2 → 3).
 * - Moment 4+ personal segments stay tagged as scenario 3 for scoring/admin display.
 */
export function assignScenarioNumbersToTranscript<T extends ScenarioTaggedTranscriptTurn>(msgs: T[]): T[] {
  let cur: 1 | 2 | 3 = 1;
  let passedMoment4 = false;
  return msgs.map((m) => {
    if (isEphemeralOrNonScoringTranscriptTurn(m)) return m;
    const content = m.content ?? '';
    const moment =
      typeof m.interviewMoment === 'number' && m.interviewMoment >= 1 && m.interviewMoment <= 5
        ? m.interviewMoment
        : undefined;
    if (resumeTranscriptCrossedMoment4Boundary(content) || (moment != null && moment >= 4)) {
      passedMoment4 = true;
    }
    if (!passedMoment4 && moment != null && moment >= 1 && moment <= 3) {
      cur = Math.max(cur, moment) as 1 | 2 | 3;
    }
    if (!passedMoment4 && m.role === 'assistant') {
      const d = detectScenarioAnchor(content);
      if (d != null) cur = d;
      if (isScenarioCQ1Prompt(content)) cur = 3;
    }
    if (m.role === 'user' || m.role === 'assistant') {
      const scenarioNumber: 1 | 2 | 3 = passedMoment4 ? 3 : cur;
      if (m.scenarioNumber === scenarioNumber) return m;
      return { ...m, scenarioNumber } as T;
    }
    return m;
  });
}

/** True when any scored turn's scenarioNumber differs from {@link assignScenarioNumbersToTranscript}. */
export function transcriptNeedsScenarioNumberPatch(
  msgs: ReadonlyArray<ScenarioTaggedTranscriptTurn>,
): boolean {
  if (msgs.length === 0) return false;
  const tagged = assignScenarioNumbersToTranscript([...msgs]);
  for (let i = 0; i < msgs.length; i++) {
    const m = msgs[i];
    if (m.role !== 'user' && m.role !== 'assistant') continue;
    if (isEphemeralOrNonScoringTranscriptTurn(m)) continue;
    if (m.scenarioNumber !== tagged[i]?.scenarioNumber) return true;
  }
  return false;
}

/**
 * Reassign scenario numbers from scenario-intro anchors through Moment 4 boundary so stored tags match the segment.
 * @deprecated Prefer {@link assignScenarioNumbersToTranscript} for full-transcript tagging including Moment 4+.
 */
export function retagScenarioNumbersBeforeMomentFour<T extends { role: string; content?: string; scenarioNumber?: number }>(
  msgs: T[]
): T[] {
  let cur: 1 | 2 | 3 = 1;
  let passedMoment4 = false;
  return msgs.map((m) => {
    if ((m as { isScoreCard?: boolean }).isScoreCard) return m;
    if ((m as { isWelcomeBack?: boolean }).isWelcomeBack) return m;
    if (resumeTranscriptCrossedMoment4Boundary(m.content ?? '')) {
      passedMoment4 = true;
    }
    if (passedMoment4) return m;
    if (m.role === 'assistant') {
      const d = detectScenarioAnchor(m.content ?? '');
      if (d != null) cur = d;
    }
    if (m.role === 'user' || m.role === 'assistant') {
      return { ...m, scenarioNumber: cur } as T;
    }
    return m;
  });
}
