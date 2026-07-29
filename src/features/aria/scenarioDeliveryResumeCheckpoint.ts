import {
  isShowScenarioCardCanonicalDeliveryText,
  type ShowScenarioCardKind,
  type ShowScenarioCardCanonicalPlaybackConfirmedKinds,
} from '@features/aria/showScenarioCardCanonicalTts';
import { buildScenarioResumeReplaySpokenBody } from '@features/aria/interviewScenarioVignetteCopy';
import { messageAnchorsScenarioIntro } from '@features/aria/scenarioNumberDetection';
import {
  isScenarioCQ1Prompt,
  isScenarioCRepairAssistantPrompt,
  looksLikeScenarioCSophiePerspectiveQuestion,
} from '@features/aria/scenarioCPromptDetection';
import { firstAssistantIndexForScenarioIntro } from '@utilities/interviewResumeCursor';
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
  const introIdx = firstAssistantIndexForScenarioIntro(msgs, scenario);
  if (introIdx < 0) return false;
  for (let i = introIdx + 1; i < msgs.length; i++) {
    const m = msgs[i];
    if (m.role !== 'user' || m.isWelcomeBack) continue;
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

/** True when the user already heard this scenario's first assessable question. */
export function transcriptHasScenarioOpeningQuestionDelivered(
  msgs: ReadonlyArray<ScenarioTaggedTranscriptTurn>,
  scenario: ScenarioOpeningDeliveredFor,
  persistedOpeningDeliveredFor?: ReadonlyArray<ScenarioOpeningDeliveredFor> | null,
): boolean {
  if (persistedOpeningDeliveredFor?.includes(scenario)) return true;
  if (transcriptHasUserTurnAfterScenarioIntroAnchor(msgs, scenario)) return true;
  if (transcriptHasAssessableUserParticipationInScenario(msgs, scenario)) return true;
  return false;
}

/** Persist scenario opening delivered after speakTextSafe confirms canonical scenario playback. */
export function maybePersistScenarioOpeningDeliveredAfterSpeakTextSafePlayback(args: {
  userId: string;
  text: string;
  audioPlaybackTruncated: boolean;
  durationMatch: boolean;
  lastQuestionText?: string | null;
  sessionAttemptId?: string | null;
  currentScenario?: 1 | 2 | 3 | null;
  resumeActiveScenario?: 1 | 2 | 3 | null;
}): Promise<void> {
  if (args.audioPlaybackTruncated || !args.durationMatch) return Promise.resolve();
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
  forceFullScenarioRestart?: boolean;
}): string | null {
  if (params.forceFullScenarioRestart) {
    return buildScenarioResumeReplaySpokenBody(params.scenario);
  }
  const openingDelivered = transcriptHasScenarioOpeningQuestionDelivered(
    params.transcriptMessages,
    params.scenario,
    params.persistedOpeningDeliveredFor,
  );
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
