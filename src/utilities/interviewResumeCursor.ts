import { SCENARIO_2_TO_3_TRANSITION_FALLBACK } from '../features/aria/interviewTransitionBundles';
import { looksLikeMoment4GrudgePrompt, looksLikeMoment4ThresholdQuestion } from '../features/aria/moment4ProbeLogic';
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
  if (!content?.trim()) return null;
  const c = content.toLowerCase();
  if (/emma and ryan|ryan takes a call|first situation|here's the first/.test(c)) return 1;
  if (/sarah has been job hunting|second situation|on to the second|here's the next situation/.test(c)) return 2;
  if (/sophie and daniel|daniel.*didn't know what to say|daniel.*didn't know how|here's the third situation|third situation|last one.*situation three|situation three/.test(c)) {
    return 3;
  }
  return null;
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

export function buildResumeWelcomeMessage(params: {
  mode: InterviewResumeMode;
  resumeScenario: 1 | 2 | 3;
}): string {
  const tail =
    " If you'd like me to repeat what I said, let me know. Otherwise, I'm ready for your response.";
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
  // #region agent log
  fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'ca824c' },
    body: JSON.stringify({
      sessionId: 'ca824c',
      hypothesisId: 'H_msg',
      location: 'interviewResumeCursor.ts:buildResumeWelcomeMessage',
      message: 'resume_welcome_built',
      data: {
        runId: 'post-copy-fix',
        mode: params.mode,
        resumeScenario: params.resumeScenario,
        preview: msg.slice(0, 140),
        hasOrdinalSituation: /\b(the first|the second|the third) situation\b/i.test(msg),
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion
  return msg;
}

/**
 * Reassign scenario numbers from scenario-intro anchors through Moment 4 boundary so stored tags match the segment.
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
