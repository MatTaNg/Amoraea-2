import { looksLikeMoment4GrudgePrompt, looksLikeMoment4ThresholdQuestion } from './moment4ProbeLogic';
import {
  isMoment5ReadyForInterviewClose,
  moment5AnswerIncludesResolutionOutcome,
} from './elongatingProbe';
import {
  combineMoment5UserTurnText,
  evaluateMoment5AccountabilityProbe,
  looksLikeMoment5AccountabilityProbeAssistantPrompt,
  looksLikeMoment5SpecificityRedirectPrompt,
  transcriptAssistantContainsMoment5PrimaryConflictQuestion,
  transcriptHasMoment5ResolutionFollowUpAsked,
} from './probeAndScoringUtils';
import { assistantTextBlocksMoment4ProgressInference } from './scenarioCProbeLogic';
import { transcriptAwaitingUserAnswerAfterMoment5ResolutionFollowUp } from './moment5SpecificityRedirect';
import type { InterviewMomentIndex } from './interviewScenarioScoringSlice';

export type { InterviewMomentIndex };

export function createInitialMomentCompletion(): Record<InterviewMomentIndex, boolean> {
  return { 1: false, 2: false, 3: false, 4: false, 5: false };
}

export function buildInterviewProgressSystemSuffix(opts: {
  momentsComplete: Record<InterviewMomentIndex, boolean>;
  currentMoment: InterviewMomentIndex;
  personalHandoffInjected: boolean;
}): string {
  const lines: string[] = [
    '',
    'PROGRESS LOCKS (internal metadata — obey strictly; never read aloud):',
    `Current interview moment index (1–5): ${opts.currentMoment}. 1–3 = scenarios A–C; 4 = first personal segment (grudge/dislike + optional specificity follow-up + commitment-threshold follow-up — all still Moment 4); 5 = conflict/resolution personal question (+ at most one scripted accountability probe); after the user completes Moment 5 (and any probe), final closing only.`,
  ];
  if (opts.momentsComplete[1]) lines.push('Moment 1 COMPLETE — do not re-open Scenario A.');
  if (opts.momentsComplete[2]) lines.push('Moment 2 COMPLETE — do not re-open Scenario B.');
  if (opts.momentsComplete[3]) lines.push('Moment 3 COMPLETE — do not re-open Scenario C.');
  if (opts.personalHandoffInjected) {
    lines.push('The transition into the personal (grudge) question was already delivered. Never repeat that full handoff.');
  }
  if (opts.momentsComplete[5]) {
    lines.push(
      'Interview COMPLETE — deliver anchored closing + thanks + [INTERVIEW_COMPLETE] only; do not ask further questions.'
    );
  }
  return lines.join('\n');
}

/** Resume / recovery: infer flags from stored messages + scenarios completed. */
export function syncInterviewMomentsFromTranscript(
  msgs: Array<{ role: string; content?: string }>,
  scenariosCompleted: number[]
): {
  momentsComplete: Record<InterviewMomentIndex, boolean>;
  currentMoment: InterviewMomentIndex;
  personalHandoffInjected: boolean;
} {
  if (
    msgs.some(
      (m) => m.role === 'assistant' && typeof m.content === 'string' && m.content.includes('[INTERVIEW_COMPLETE]')
    )
  ) {
    return {
      momentsComplete: { 1: true, 2: true, 3: true, 4: true, 5: true },
      currentMoment: 5,
      personalHandoffInjected: true,
    };
  }
  const momentsComplete = createInitialMomentCompletion();
  let personalHandoffInjected = false;
  for (const n of scenariosCompleted) {
    if (n === 1) momentsComplete[1] = true;
    if (n === 2) momentsComplete[2] = true;
    if (n === 3) momentsComplete[3] = true;
  }
  let currentMoment: InterviewMomentIndex = 1;
  if (momentsComplete[3]) currentMoment = 4;
  if (momentsComplete[2] && !momentsComplete[3]) currentMoment = 3;
  if (momentsComplete[1] && !momentsComplete[2]) currentMoment = 2;

  for (let i = msgs.length - 1; i >= 0; i--) {
    const m = msgs[i];
    if (m.role !== 'assistant' || !m.content) continue;
    if ((m as { isWelcomeBack?: boolean }).isWelcomeBack) continue;
    const c = m.content.toLowerCase();
    if (looksLikeMoment5AccountabilityProbeAssistantPrompt(m.content)) {
      personalHandoffInjected = true;
      momentsComplete[3] = true;
      currentMoment = 5;
      break;
    }
    if (
      transcriptAssistantContainsMoment5PrimaryConflictQuestion(m.content) &&
      !looksLikeMoment4ThresholdQuestion(m.content)
    ) {
      personalHandoffInjected = true;
      momentsComplete[3] = true;
      currentMoment = 5;
      break;
    }
    /** Scripted client redirect after an abstract M5 answer — still Moment 5 (must run before vignette anchors). */
    if (looksLikeMoment5SpecificityRedirectPrompt(m.content)) {
      personalHandoffInjected = true;
      momentsComplete[3] = true;
      currentMoment = 5;
      break;
    }
    if (combinedScenarioCToMoment4Handoff(m.content) || grudgeIntroSignalsMoment4Entry(m.content)) {
      personalHandoffInjected = true;
      momentsComplete[3] = true;
      currentMoment = 4;
      break;
    }
    /**
     * Scenario vignette intros stay in the transcript after those scenarios are scored. When resuming
     * mid–Moment 5, scanning newest→oldest must not snap `currentMoment` back to 3 (or 2/1) on those
     * stale anchors — otherwise user turns are tagged `interviewMoment: 3` and Moment 5 scoring slices
     * the wrong corpus (see persisted attempts with welcome-back + M5 redirects).
     */
    if (!momentsComplete[3] && c.includes('sophie and daniel') && c.includes('i need ten minutes')) {
      currentMoment = 3;
      break;
    }
    if (!momentsComplete[2] && c.includes('sarah has been job hunting')) {
      currentMoment = 2;
      break;
    }
    if (!momentsComplete[1] && (c.includes('emma and ryan') || c.includes('ryan takes a call'))) {
      currentMoment = 1;
      break;
    }
  }

  return { momentsComplete, currentMoment, personalHandoffInjected };
}

/** User turns after the last scripted Moment 5 primary prompt (for resume + closing gate). */
export function countUserTurnsAfterLastMoment5PrimaryAnchor(
  msgs: ReadonlyArray<{ role: string; content?: string; isWelcomeBack?: boolean }>,
  sessionM5PrimaryAnchorMarked?: boolean
): number {
  let anchorIdx = -1;
  for (let i = msgs.length - 1; i >= 0; i--) {
    if (msgs[i].role !== 'assistant') continue;
    if (msgs[i].isWelcomeBack) continue;
    const content = msgs[i].content ?? '';
    if (transcriptAssistantContainsMoment5PrimaryConflictQuestion(content)) {
      anchorIdx = i;
      break;
    }
  }
  if (anchorIdx < 0 && sessionM5PrimaryAnchorMarked) {
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].role !== 'assistant') continue;
      if (msgs[i].isWelcomeBack) continue;
      const raw = msgs[i].content ?? '';
      if (looksLikeMoment5AccountabilityProbeAssistantPrompt(raw)) continue;
      const lower = raw.toLowerCase();
      if (lower.includes('conflict with someone important')) {
        anchorIdx = i;
        break;
      }
    }
  }
  if (anchorIdx < 0) return 0;
  let n = 0;
  for (let i = anchorIdx + 1; i < msgs.length; i++) {
    if (msgs[i].role === 'user' && !msgs[i].isWelcomeBack) n += 1;
  }
  return n;
}

export type Moment5CloseGateSnapshot = {
  postM5UserTurns: number;
  hasMoment5PrimaryAnchorInTranscript: boolean;
  accountabilityProbeStillRequired: boolean;
  resolutionFollowUpDelivered: boolean;
  resolutionFollowUpAwaitingAnswer: boolean;
  resolutionFollowUpStillRequired: boolean;
  moment5CloseAllowed: boolean;
  moment5CombinedForCloseGate: string;
};

export function computeMoment5ResolutionFollowUpGateState(args: {
  transcriptSlice: ReadonlyArray<{ role: string; content?: string; isWelcomeBack?: boolean }>;
  moment5CombinedForCloseGate: string;
  hasMoment5PrimaryAnchorInTranscript: boolean;
  moment5ResolutionDelivered: boolean;
}): Pick<
  Moment5CloseGateSnapshot,
  'resolutionFollowUpDelivered' | 'resolutionFollowUpAwaitingAnswer' | 'resolutionFollowUpStillRequired'
> {
  const resolutionFollowUpDelivered =
    args.moment5ResolutionDelivered ||
    transcriptHasMoment5ResolutionFollowUpAsked(args.transcriptSlice);
  const resolutionFollowUpAwaitingAnswer =
    transcriptAwaitingUserAnswerAfterMoment5ResolutionFollowUp(args.transcriptSlice);
  const resolutionFollowUpStillRequired =
    resolutionFollowUpAwaitingAnswer ||
    (args.hasMoment5PrimaryAnchorInTranscript &&
      !moment5AnswerIncludesResolutionOutcome(args.moment5CombinedForCloseGate) &&
      !resolutionFollowUpDelivered);
  return {
    resolutionFollowUpDelivered,
    resolutionFollowUpAwaitingAnswer,
    resolutionFollowUpStillRequired,
  };
}

export function computeMoment5InterviewCloseGate(
  msgs: ReadonlyArray<{
    role: string;
    content?: string;
    isWelcomeBack?: boolean;
    interviewMoment?: number;
  }>,
  refs: {
    moment5QuestionDelivered: boolean;
    moment5PrimaryAnchorSession: boolean;
    postM5UserTurnsRef: number;
    accountabilityProbeFired: boolean;
    currentInterviewMoment: number;
    moment5ResolutionDelivered?: boolean;
  },
): Moment5CloseGateSnapshot {
  const transcriptSlice = msgs.map((m) => ({
    role: m.role,
    content: m.content ?? '',
    isWelcomeBack: m.isWelcomeBack,
  }));
  const postM5UserTurnsFromTranscript = countUserTurnsAfterLastMoment5PrimaryAnchor(
    transcriptSlice,
    refs.moment5PrimaryAnchorSession,
  );
  const hasMoment5PrimaryAnchorInTranscript =
    refs.moment5PrimaryAnchorSession ||
    transcriptSlice.some(
      (m) =>
        m.role === 'assistant' &&
        !m.isWelcomeBack &&
        transcriptAssistantContainsMoment5PrimaryConflictQuestion(m.content),
    );
  const postM5UserTurns = Math.max(refs.postM5UserTurnsRef, postM5UserTurnsFromTranscript);
  const nonWelcome = msgs.filter((m) => !m.isWelcomeBack) as Array<{
    role: string;
    content?: string;
    interviewMoment?: number;
  }>;
  let moment5CombinedForCloseGate = combineMoment5UserTurnText(nonWelcome);
  /** Resume / remount paths can omit `interviewMoment: 5` on user rows — still use post-anchor user text. */
  if (!moment5CombinedForCloseGate.trim() && hasMoment5PrimaryAnchorInTranscript) {
    const postAnchorParts: string[] = [];
    let sawAnchor = false;
    for (const m of nonWelcome) {
      if (m.role === 'assistant' && transcriptAssistantContainsMoment5PrimaryConflictQuestion(m.content ?? '')) {
        sawAnchor = true;
        continue;
      }
      if (sawAnchor && m.role === 'user') {
        const c = (m.content ?? '').trim();
        if (c) postAnchorParts.push(c);
      }
    }
    moment5CombinedForCloseGate = postAnchorParts.join(' ');
  }
  const accountabilityProbeStillRequired =
    (refs.moment5QuestionDelivered || hasMoment5PrimaryAnchorInTranscript) &&
    !refs.accountabilityProbeFired &&
    evaluateMoment5AccountabilityProbe(moment5CombinedForCloseGate).shouldProbe;
  const {
    resolutionFollowUpDelivered,
    resolutionFollowUpAwaitingAnswer,
    resolutionFollowUpStillRequired,
  } = computeMoment5ResolutionFollowUpGateState({
    transcriptSlice,
    moment5CombinedForCloseGate,
    hasMoment5PrimaryAnchorInTranscript,
    moment5ResolutionDelivered: refs.moment5ResolutionDelivered === true,
  });
  const moment5CloseAllowed = isMoment5ReadyForInterviewClose({
    currentInterviewMoment: refs.currentInterviewMoment,
    moment5QuestionDelivered: refs.moment5QuestionDelivered,
    postM5UserTurns,
    accountabilityProbeFired: refs.accountabilityProbeFired,
    hasMoment5PrimaryAnchorInTranscript,
    moment5CombinedUserText: moment5CombinedForCloseGate,
    accountabilityProbeStillRequired,
    resolutionFollowUpStillRequired,
  });
  return {
    postM5UserTurns,
    hasMoment5PrimaryAnchorInTranscript,
    accountabilityProbeStillRequired,
    resolutionFollowUpDelivered,
    resolutionFollowUpAwaitingAnswer,
    resolutionFollowUpStillRequired,
    moment5CloseAllowed,
    moment5CombinedForCloseGate,
  };
}

export type InterviewProgressRefs = {
  interviewMomentsCompleteRef: { current: Record<InterviewMomentIndex, boolean> };
  currentInterviewMomentRef: { current: InterviewMomentIndex };
  personalHandoffInjectedRef: { current: boolean };
};

/** Segment-close from Scenario C → personal (framework wording evolves; keep legacy substrings too). */
export function assistantTextLooksLikeScenarioCToMoment4Handoff(rawDisplayText: string): boolean {
  const dt = (rawDisplayText ?? '').toLowerCase();
  return (
    dt.includes("we've covered those three") ||
    dt.includes('three situations') ||
    dt.includes('three described situations') ||
    dt.includes('end of the three described') ||
    dt.includes('last of the three described') ||
    dt.includes('done with those three scenarios') ||
    dt.includes("we're done with those three scenarios") ||
    dt.includes('done with those three described situations')
  );
}

export function combinedScenarioCToMoment4Handoff(raw: string): boolean {
  if (assistantTextBlocksMoment4ProgressInference(raw)) return false;
  const dt = (raw ?? '').toLowerCase();
  return (
    assistantTextLooksLikeScenarioCToMoment4Handoff(raw) &&
    (dt.includes('held a grudge') || looksLikeMoment4GrudgePrompt(raw))
  );
}

/** Grudge / personal-opening card alone (after a separate boundary message) — still Moment 4 entry. */
export function grudgeIntroSignalsMoment4Entry(raw: string): boolean {
  if (assistantTextBlocksMoment4ProgressInference(raw)) return false;
  return looksLikeMoment4GrudgePrompt(raw) && !looksLikeMoment4ThresholdQuestion(raw);
}

/** Infer M3→M4 progression from assistant visible text (model outputs). */
export function applyInterviewProgressFromAssistantText(rawDisplayText: string, refs: InterviewProgressRefs) {
  const raw = rawDisplayText ?? '';
  const combinedHandoff = combinedScenarioCToMoment4Handoff(raw);
  const grudgeOnlyAfterScenarioC =
    refs.currentInterviewMomentRef.current <= 3 && grudgeIntroSignalsMoment4Entry(raw);
  if (combinedHandoff || grudgeOnlyAfterScenarioC) {
    refs.personalHandoffInjectedRef.current = true;
    refs.interviewMomentsCompleteRef.current[3] = true;
    refs.currentInterviewMomentRef.current = 4;
  }
}
