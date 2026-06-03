import { transcriptHasInterviewClosingAssistantMessage } from '../features/aria/elongatingProbe';
import { SCENARIO_2_TO_3_TRANSITION_FALLBACK } from '../features/aria/interviewTransitionBundles';
import { looksLikeMoment4GrudgePrompt, looksLikeMoment4ThresholdQuestion } from '../features/aria/moment4ProbeLogic';
import { looksLikeMoment4SpecificityFollowUpEcho } from '../features/aria/moment4SpecificityFollowUp';
import { detectScenarioFromResponse } from '../features/aria/scenarioNumberDetection';
import type { StoredScenarioScores } from './storage/InterviewStorage';

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
    if (detectScenarioAnchor(m.content ?? '') === scenario) return i;
  }
  return -1;
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

  for (const scenario of [1, 2, 3] as const) {
    if (firstAssistantIndexForScenarioIntro(input.messages, scenario) >= 0 && userTurnsTotal >= 1) {
      return true;
    }
  }
  return false;
}

export function scenarioHasPersistedScores(scenario: number, scores: StoredScenarioScores | undefined): boolean {
  const s = scores?.[scenario];
  if (!s) return false;
  const ps = s.pillarScores;
  return ps != null && typeof ps === 'object' && Object.keys(ps).length > 0;
}

export function lastFullyCompletedScenario(
  scenariosCompleted: number[],
  scenarioScores: StoredScenarioScores | undefined
): number {
  let max = 0;
  for (const n of scenariosCompleted ?? []) {
    if (n >= 1 && n <= 3) max = Math.max(max, n);
  }
  for (const n of [1, 2, 3] as const) {
    if (scenarioHasPersistedScores(n, scenarioScores)) max = Math.max(max, n);
  }
  return max;
}

function coerceResumeActive(
  fromStorage: 1 | 2 | 3 | null | undefined,
  fromAttempt: number | null | undefined
): 1 | 2 | 3 | null {
  const raw = fromAttempt ?? fromStorage ?? null;
  if (raw === 1 || raw === 2 || raw === 3) return raw;
  return null;
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
};

function cloneMoments(m: Record<InterviewMomentIndex, boolean>): Record<InterviewMomentIndex, boolean> {
  return { ...m };
}

export function computeInterviewResumePlan(input: {
  scenariosCompleted: number[];
  scenarioScores: StoredScenarioScores | undefined;
  resumeActiveFromStorage: 1 | 2 | 3 | null | undefined;
  resumeActiveFromAttempt: number | null | undefined;
  syncedMoments: {
    momentsComplete: Record<InterviewMomentIndex, boolean>;
    currentMoment: InterviewMomentIndex;
    personalHandoffInjected: boolean;
  };
}): InterviewResumePlan {
  const lastC = lastFullyCompletedScenario(input.scenariosCompleted, input.scenarioScores);
  const activeRaw = coerceResumeActive(input.resumeActiveFromStorage, input.resumeActiveFromAttempt);
  const effectiveActive =
    activeRaw != null && !scenarioHasPersistedScores(activeRaw, input.scenarioScores) ? activeRaw : null;

  const partialScenarioDataWritten = Boolean(
    effectiveActive != null && !scenarioHasPersistedScores(effectiveActive, input.scenarioScores)
  );

  if (lastC >= 3) {
    return {
      lastCompletedScenario: lastC,
      resumeScenario: 3,
      effectiveMoment: input.syncedMoments.currentMoment,
      momentsComplete: cloneMoments(input.syncedMoments.momentsComplete),
      personalHandoffInjected: input.syncedMoments.personalHandoffInjected,
      mode: 'resume_post_scenarios',
      partialScenarioDataWritten,
    };
  }

  if (effectiveActive != null) {
    const mc = createMomentCompletionFromLastC(lastC);
    for (const i of [1, 2, 3] as const) {
      if (i < effectiveActive) mc[i] = true;
    }
    mc[effectiveActive] = false;
    /**
     * Transcript-derived moment (e.g. Moment 4 threshold) can be ahead of `resume_active_scenario` (still 3).
     * Previously we forced `effectiveMoment` to the scenario index, which snapped `currentInterviewMomentRef`
     * back to 3 after resume and skipped client M5 bundle inject (model streamed only the conflict line).
     */
    const syncedMoment = input.syncedMoments.currentMoment;
    const effectiveMoment = Math.max(
      effectiveActive,
      syncedMoment
    ) as InterviewMomentIndex;
    const personalHandoffInjected = input.syncedMoments.personalHandoffInjected;
    if (syncedMoment >= 4 && personalHandoffInjected) {
      mc[3] = true;
    }
    return {
      lastCompletedScenario: lastC,
      resumeScenario: effectiveActive,
      effectiveMoment,
      momentsComplete: mc,
      personalHandoffInjected,
      mode: 'replay_incomplete',
      partialScenarioDataWritten,
    };
  }

  const nextScenario = (Math.min(lastC + 1, 3) as 1 | 2 | 3) as 1 | 2 | 3;
  const mc = createMomentCompletionFromLastC(lastC);
  return {
    lastCompletedScenario: lastC,
    resumeScenario: nextScenario,
    effectiveMoment: nextScenario,
    momentsComplete: mc,
    personalHandoffInjected: false,
    mode: 'resume_next',
    partialScenarioDataWritten,
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
    (c.includes('pick up where we left off') ||
      c.includes('left off in the personal part') ||
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

export function buildResumeWelcomeMessage(params: {
  mode: InterviewResumeMode;
  resumeScenario: 1 | 2 | 3;
}): string {
  const tail =
    " If you'd like me to repeat what I said, let me know.";
  let msg: string;
  if (params.mode === 'resume_post_scenarios') {
    msg =
      `Welcome back — we left off in the personal part of the interview. Let's continue from there.` + tail;
  } else if (params.mode === 'replay_incomplete') {
    // Omit vignette ordinal — resume moment can be past "situation 3" (e.g. conflict); TTS reads this verbatim.
    msg = `Welcome back — we'll pick up where we left off.` + tail;
  } else {
    msg = `Welcome back — we'll pick up where we left off.` + tail;
  }
  return msg;
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
    if (!passedMoment4 && m.role === 'assistant') {
      const d = detectScenarioAnchor(content);
      if (d != null) cur = d;
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
