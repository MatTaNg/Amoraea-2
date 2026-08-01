import {
  isShowScenarioCardCanonicalDeliveryText,
  type ShowScenarioCardKind,
  type ShowScenarioCardCanonicalPlaybackConfirmedKinds,
} from '@features/aria/showScenarioCardCanonicalTts';
import { buildScenarioResumeReplaySpokenBody } from '@features/aria/interviewScenarioVignetteCopy';
import { messageAnchorsScenarioIntro } from '@features/aria/scenarioNumberDetection';
import { isScenarioAQ1Prompt } from '@features/aria/scenarioAContemptProbeCoverage';
import {
  isScenarioCQ1Prompt,
  isScenarioCRepairAssistantPrompt,
  looksLikeScenarioCSophiePerspectiveQuestion,
} from '@features/aria/scenarioCPromptDetection';
import { isTtsPlaybackCompleteForScenarioOpeningCheckpoint } from '@features/aria/utils/interviewTtsDurationMatch';
import {
  loadInterviewFromStorage,
  mergeInterviewStoragePayload,
  saveInterviewToStorage,
} from '@utilities/storage/InterviewStorage';

export type ScenarioOpeningDeliveredFor = 1 | 2 | 3;

const READINESS_ASSENT = /^(yes|yeah|yep|sure|ok|okay|ready|i'?m ready)\.?$/i;

type ScenarioTaggedTranscriptTurn = {
  role: string;
  content?: string | null;
  scenarioNumber?: number;
  interviewMoment?: number;
  isWelcomeBack?: boolean;
};

function assistantContentLooksLikeScenarioOpeningQuestion(
  content: string,
  scenario: ScenarioOpeningDeliveredFor,
): boolean {
  const c = content.trim();
  if (!c) return false;
  if (messageAnchorsScenarioIntro(c) === scenario) return true;
  if (scenario === 1 && /\bwhat(?:'s| is) going on between these two\b/i.test(c)) return true;
  if (scenario === 2 && /\bwhat do you think is going on here\b/i.test(c)) return true;
  if (scenario === 3) {
    if (isScenarioCQ1Prompt(c)) return true;
    if (looksLikeScenarioCSophiePerspectiveQuestion(c)) return true;
    if (isScenarioCRepairAssistantPrompt(c)) return true;
  }
  return false;
}

function lastAssistantIndexForScenarioIntro(
  msgs: ReadonlyArray<ScenarioTaggedTranscriptTurn>,
  scenario: ScenarioOpeningDeliveredFor,
): number {
  let lastIdx = -1;
  for (let i = 0; i < msgs.length; i++) {
    const m = msgs[i];
    if (m.role !== 'assistant') continue;
    if (messageAnchorsScenarioIntro(m.content ?? '') === scenario) lastIdx = i;
  }
  return lastIdx;
}

function transcriptHasScenarioOpeningMarkerBeforeIndex(
  msgs: ReadonlyArray<ScenarioTaggedTranscriptTurn>,
  scenario: ScenarioOpeningDeliveredFor,
  beforeIndex: number,
): boolean {
  for (let i = 0; i < beforeIndex && i < msgs.length; i++) {
    const m = msgs[i];
    if (m.role !== 'assistant') continue;
    if (assistantContentLooksLikeScenarioOpeningQuestion(m.content ?? '', scenario)) return true;
  }
  return false;
}

function isLikelyPreScenarioNameCapture(content: string): boolean {
  const c = content.trim();
  return c.length > 0 && c.length <= 24 && !/\s/.test(c) && !/\?/.test(c);
}

/**
 * Mid-scenario user participation when the stored transcript lacks the vignette anchor
 * (parallel stream / pre-commit close) — excludes readiness assent and pre-scenario name capture.
 */
function transcriptHasAssessableUserParticipationInScenario(
  msgs: ReadonlyArray<ScenarioTaggedTranscriptTurn>,
  scenario: ScenarioOpeningDeliveredFor,
): boolean {
  for (let i = 0; i < msgs.length; i++) {
    const m = msgs[i];
    if (m.role !== 'user' || m.isWelcomeBack) continue;
    const moment =
      typeof m.interviewMoment === 'number' && m.interviewMoment >= 1 && m.interviewMoment <= 5
        ? m.interviewMoment
        : undefined;
    if (m.scenarioNumber !== scenario && moment !== scenario) continue;
    const c = (m.content ?? '').trim();
    if (!c || READINESS_ASSENT.test(c)) continue;
    if (
      isLikelyPreScenarioNameCapture(c) &&
      !transcriptHasScenarioOpeningMarkerBeforeIndex(msgs, scenario, i)
    ) {
      continue;
    }
    return true;
  }
  return false;
}

/** User answered after the scenario vignette anchor — excludes preamble/name/readiness turns tagged scenario 1. */
function transcriptHasUserTurnAfterScenarioIntroAnchor(
  msgs: ReadonlyArray<{
    role: string;
    content?: string | null;
    scenarioNumber?: number;
    interviewMoment?: number;
    isWelcomeBack?: boolean;
  }>,
  scenario: ScenarioOpeningDeliveredFor,
): boolean {
  const introIdx = lastAssistantIndexForScenarioIntro(msgs, scenario);
  if (introIdx < 0) return false;
  for (let i = introIdx + 1; i < msgs.length; i++) {
    const m = msgs[i];
    if (m.role !== 'user' || m.isWelcomeBack) continue;
    const c = (m.content ?? '').trim();
    if (!c || READINESS_ASSENT.test(c)) continue;
    if (
      isLikelyPreScenarioNameCapture(c) &&
      !transcriptHasScenarioOpeningMarkerBeforeIndex(msgs, scenario, i)
    ) {
      continue;
    }
    return true;
  }
  return false;
}

function scenarioFromShowScenarioCardKind(
  kind: ShowScenarioCardKind,
): ScenarioOpeningDeliveredFor | null {
  if (kind === 'situation_1') return 1;
  if (kind === 'situation_2') return 2;
  if (kind === 'situation_3') return 3;
  return null;
}

export function mergeScenarioOpeningDeliveredFor(
  prior: ReadonlyArray<ScenarioOpeningDeliveredFor> | null | undefined,
  scenario: ScenarioOpeningDeliveredFor,
): ScenarioOpeningDeliveredFor[] {
  const merged = new Set<ScenarioOpeningDeliveredFor>(prior ?? []);
  merged.add(scenario);
  return Array.from(merged).sort((a, b) => a - b) as ScenarioOpeningDeliveredFor[];
}

export function mergeScenarioOpeningDeliveredFromPlaybackConfirmed(
  prior: ReadonlyArray<ScenarioOpeningDeliveredFor> | null | undefined,
  confirmed: ShowScenarioCardCanonicalPlaybackConfirmedKinds | null | undefined,
): ScenarioOpeningDeliveredFor[] {
  let merged = [...(prior ?? [])] as ScenarioOpeningDeliveredFor[];
  if (confirmed?.situation_1) merged = mergeScenarioOpeningDeliveredFor(merged, 1);
  if (confirmed?.situation_2) merged = mergeScenarioOpeningDeliveredFor(merged, 2);
  if (confirmed?.situation_3) merged = mergeScenarioOpeningDeliveredFor(merged, 3);
  return merged;
}

/**
 * Opening question committed in transcript after the vignette anchor (separate assistant turn).
 * Distinguishes post-delivery close (Q1 line present) from mid-vignette interrupt (vignette only).
 */
/** Persisted lastQuestionText proves the user already heard this scenario's first assessable question. */
export function lastQuestionTextIndicatesScenarioOpeningDelivered(
  lastQuestionText: string | null | undefined,
  scenario: ScenarioOpeningDeliveredFor,
): boolean {
  const q = (lastQuestionText ?? '').trim();
  if (!q) return false;
  return assistantContentLooksLikeScenarioOpeningQuestion(q, scenario);
}

export function transcriptHasCommittedScenarioOpeningQuestionAfterIntro(
  msgs: ReadonlyArray<ScenarioTaggedTranscriptTurn>,
  scenario: ScenarioOpeningDeliveredFor,
): boolean {
  const introIdx = lastAssistantIndexForScenarioIntro(msgs, scenario);
  if (introIdx < 0) return false;
  for (let i = introIdx + 1; i < msgs.length; i++) {
    const m = msgs[i];
    if (m.role !== 'assistant') continue;
    const c = (m.content ?? '').trim();
    if (!c) continue;
    if (messageAnchorsScenarioIntro(c) === scenario) continue;
    if (scenario === 1 && isScenarioAQ1Prompt(c)) return true;
    if (scenario === 2 && /\bwhat do you think is going on here\b/i.test(c)) return true;
    if (scenario === 3) {
      if (isScenarioCQ1Prompt(c)) return true;
      if (looksLikeScenarioCSophiePerspectiveQuestion(c)) return true;
      if (isScenarioCRepairAssistantPrompt(c)) return true;
    }
  }
  return false;
}

/** User answered or Q1 committed after vignette — not inferred from welcome / lastQuestionText alone. */
function transcriptHasStrongScenarioOpeningDeliveryEvidence(
  msgs: ReadonlyArray<ScenarioTaggedTranscriptTurn>,
  scenario: ScenarioOpeningDeliveredFor,
): boolean {
  if (transcriptHasCommittedScenarioOpeningQuestionAfterIntro(msgs, scenario)) return true;
  if (transcriptHasUserTurnAfterScenarioIntroAnchor(msgs, scenario)) return true;
  if (transcriptHasAssessableUserParticipationInScenario(msgs, scenario)) return true;
  return false;
}

/** True when the user already heard this scenario's first assessable question. */
export function transcriptHasScenarioOpeningQuestionDelivered(
  msgs: ReadonlyArray<ScenarioTaggedTranscriptTurn>,
  scenario: ScenarioOpeningDeliveredFor,
  persistedOpeningDeliveredFor?: ReadonlyArray<ScenarioOpeningDeliveredFor> | null,
  lastQuestionText?: string | null,
): boolean {
  if (transcriptHasStrongScenarioOpeningDeliveryEvidence(msgs, scenario)) return true;

  const hasVignetteAnchor = lastAssistantIndexForScenarioIntro(msgs, scenario) >= 0;
  if (!hasVignetteAnchor) {
    if (persistedOpeningDeliveredFor?.includes(scenario)) return true;
    if (lastQuestionTextIndicatesScenarioOpeningDelivered(lastQuestionText, scenario)) return true;
    return false;
  }

  // Vignette is in transcript but the user has not answered yet: do not treat welcome-back /
  // lastQuestionText alone as proof they heard the opening (e.g. Android back mid scenario card).
  if (persistedOpeningDeliveredFor?.includes(scenario)) return true;
  return false;
}

export type NavigationAwayAudioInterrupt = 'recording' | 'tts';

/**
 * Resume routing: user heard the scenario opening before exit when playback was confirmed,
 * transcript proves it, or they closed idle / while recording after question_delivered saved
 * the opening prompt — but not when navigation away interrupted scenario-card TTS.
 */
export function resumeScenarioOpeningWasHeardBeforeExit(params: {
  transcriptMessages: ReadonlyArray<ScenarioTaggedTranscriptTurn>;
  scenario: ScenarioOpeningDeliveredFor;
  persistedOpeningDeliveredFor?: ReadonlyArray<ScenarioOpeningDeliveredFor> | null;
  lastQuestionText?: string | null;
  navigationAwayAudioInterrupt?: NavigationAwayAudioInterrupt | null;
}): boolean {
  if (
    transcriptHasScenarioOpeningQuestionDelivered(
      params.transcriptMessages,
      params.scenario,
      params.persistedOpeningDeliveredFor,
      params.lastQuestionText,
    )
  ) {
    return true;
  }
  if (params.navigationAwayAudioInterrupt === 'tts') return false;
  if (lastAssistantIndexForScenarioIntro(params.transcriptMessages, params.scenario) < 0) {
    return false;
  }
  return lastQuestionTextIndicatesScenarioOpeningDelivered(params.lastQuestionText, params.scenario);
}

/** Persist scenario opening delivered after speakTextSafe confirms canonical scenario playback. */
/** Persist opening-question checkpoint when question_delivered fires (covers vignette-only transcript). */
export async function maybePersistScenarioOpeningDeliveredAfterQuestionDelivered(args: {
  userId: string;
  deliveredQuestionText: string;
  currentScenario: 1 | 2 | 3;
  sessionAttemptId?: string | null;
  resumeActiveScenario?: 1 | 2 | 3 | null;
}): Promise<void> {
  if (
    !lastQuestionTextIndicatesScenarioOpeningDelivered(
      args.deliveredQuestionText,
      args.currentScenario,
    )
  ) {
    return;
  }
  await persistScenarioOpeningDeliveredAfterPlayback({
    userId: args.userId,
    kind:
      args.currentScenario === 1
        ? 'situation_1'
        : args.currentScenario === 2
          ? 'situation_2'
          : 'situation_3',
    lastQuestionText: args.deliveredQuestionText,
    sessionAttemptId: args.sessionAttemptId ?? null,
    currentScenario: args.currentScenario,
    resumeActiveScenario: args.resumeActiveScenario ?? args.currentScenario,
  });
}

export function maybePersistScenarioOpeningDeliveredAfterSpeakTextSafePlayback(args: {
  userId: string;
  text: string;
  audioPlaybackTruncated: boolean;
  durationMatch: boolean;
  actualDurationMs?: number | null;
  expectedDurationMs?: number | null;
  lastQuestionText?: string | null;
  sessionAttemptId?: string | null;
  currentScenario?: 1 | 2 | 3 | null;
  resumeActiveScenario?: 1 | 2 | 3 | null;
}): Promise<void> {
  const playbackCompleteForOpeningCheckpoint =
    typeof args.actualDurationMs === 'number' &&
    typeof args.expectedDurationMs === 'number' &&
    Number.isFinite(args.actualDurationMs) &&
    Number.isFinite(args.expectedDurationMs)
      ? isTtsPlaybackCompleteForScenarioOpeningCheckpoint(
          args.actualDurationMs,
          args.expectedDurationMs,
          args.audioPlaybackTruncated,
        )
      : !args.audioPlaybackTruncated && args.durationMatch;
  if (!playbackCompleteForOpeningCheckpoint) return Promise.resolve();
  const kind = isShowScenarioCardCanonicalDeliveryText(args.text);
  if (kind !== 'situation_1' && kind !== 'situation_2' && kind !== 'situation_3') return Promise.resolve();
  return persistScenarioOpeningDeliveredAfterPlayback({
    userId: args.userId,
    kind,
    lastQuestionText: args.lastQuestionText ?? null,
    sessionAttemptId: args.sessionAttemptId ?? null,
    currentScenario: args.currentScenario ?? null,
    resumeActiveScenario: args.resumeActiveScenario ?? null,
  });
}

export function hydrateShowScenarioCardPlaybackConfirmedFromStorage(
  openingDeliveredFor: ReadonlyArray<ScenarioOpeningDeliveredFor> | null | undefined,
): ShowScenarioCardCanonicalPlaybackConfirmedKinds {
  const confirmed: ShowScenarioCardCanonicalPlaybackConfirmedKinds = {};
  if (openingDeliveredFor?.includes(1)) confirmed.situation_1 = true;
  if (openingDeliveredFor?.includes(2)) confirmed.situation_2 = true;
  if (openingDeliveredFor?.includes(3)) confirmed.situation_3 = true;
  return confirmed;
}

/**
 * Resume TTS body after app close:
 * - opening playback confirmed (or user already mid-scenario) → null (welcome + question-only replay)
 * - otherwise → full scenario intro (transcript may exist from a turn saved before TTS finished)
 */
export function resolveScenarioResumeIntroBodyForReplay(params: {
  scenario: ScenarioOpeningDeliveredFor;
  transcriptMessages: ReadonlyArray<{ role: string; content?: string | null }>;
  persistedOpeningDeliveredFor?: ReadonlyArray<ScenarioOpeningDeliveredFor> | null;
  lastQuestionText?: string | null;
  navigationAwayAudioInterrupt?: NavigationAwayAudioInterrupt | null;
  forceFullScenarioRestart?: boolean;
}): string | null {
  if (params.forceFullScenarioRestart) {
    return buildScenarioResumeReplaySpokenBody(params.scenario);
  }
  const openingDelivered = resumeScenarioOpeningWasHeardBeforeExit({
    transcriptMessages: params.transcriptMessages,
    scenario: params.scenario,
    persistedOpeningDeliveredFor: params.persistedOpeningDeliveredFor,
    lastQuestionText: params.lastQuestionText,
    navigationAwayAudioInterrupt: params.navigationAwayAudioInterrupt,
  });
  if (openingDelivered) return null;
  return buildScenarioResumeReplaySpokenBody(params.scenario);
}

export async function persistScenarioOpeningDeliveredAfterPlayback(args: {
  userId: string;
  kind: ShowScenarioCardKind;
  lastQuestionText?: string | null;
  messages?: Array<{ role: string; content: string; scenarioNumber?: number; interviewMoment?: number }>;
  currentScenario?: 1 | 2 | 3 | null;
  resumeActiveScenario?: 1 | 2 | 3 | null;
  scenariosCompleted?: number[];
  scenarioScores?: Record<string, unknown>;
  sessionAttemptId?: string | null;
}): Promise<void> {
  const scenario = scenarioFromShowScenarioCardKind(args.kind);
  if (!scenario) return;
  const prior = await loadInterviewFromStorage(args.userId);
  const scenarioOpeningDeliveredFor = mergeScenarioOpeningDeliveredFor(
    prior?.scenarioOpeningDeliveredFor,
    scenario,
  );
  await saveInterviewToStorage(
    args.userId,
    mergeInterviewStoragePayload(prior, {
      messages: args.messages ?? prior?.messages ?? [],
      scenariosCompleted: args.scenariosCompleted ?? prior?.scenariosCompleted ?? [],
      scenarioScores: args.scenarioScores ?? prior?.scenarioScores ?? {},
      currentScenario: args.currentScenario ?? prior?.currentScenario ?? scenario,
      resumeActiveScenario: args.resumeActiveScenario ?? prior?.resumeActiveScenario ?? scenario,
      sessionAttemptId: args.sessionAttemptId ?? prior?.sessionAttemptId,
      scenarioOpeningDeliveredFor,
      lastQuestionText: args.lastQuestionText ?? prior?.lastQuestionText ?? null,
    }),
  );
}
