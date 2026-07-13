import type { ActiveScenario } from '@app/screens/UserInterviewLayout';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import { looksLikeScenarioHandoffOrVignetteBundle } from '@features/aria/computeParallelStreamTabRestoreText';
import { stripControlTokens } from '@features/aria/interviewControlTokens';
import {
  extractScenarioModalQuestionFromAssistantText,
  getLastSubstantiveScenarioModalQuestion,
  resolveMoment4ShowScenarioReferenceCard,
} from '@features/aria/interviewLanguageGate';
import {
  detectActiveScenarioFromMessage,
  getSituationOpeningQuestion,
  normalizeScenarioOpeningForCompare,
} from '@features/aria/interviewScenarioOpeningStreamGate';
import { isLockedShowScenarioExactTtsText } from '@features/aria/showScenarioCardCanonicalTts';
import { MOMENT_4_GRUDGE_QUESTION_TEXT } from '@features/aria/moment4ProbeLogic';
import { MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT, transcriptAssistantContainsMoment5PrimaryConflictQuestion } from '@features/aria/moment5ProbeLogic';
import { getTtsExpectedDurationMsFromCharCount } from '@utilities/sessionLogging/ttsDurationCalibration';

const MOMENT_4_PERSONAL_LABEL = 'Personal reflection';

/** True when the assistant line is a scripted scenario handoff or locked show-scenario vignette bundle. */
export function isGenuineScenarioTransitionSignal(text: string): boolean {
  const cleaned = stripControlTokens(text).trim();
  if (!cleaned) return false;
  return (
    looksLikeScenarioHandoffOrVignetteBundle(cleaned) || isLockedShowScenarioExactTtsText(cleaned)
  );
}

export type RestoreReferenceCardFromTranscriptDeps = {
  messages: ReadonlyArray<{ role: string; content?: string }>;
  committedScenarioRef: MutableRefObject<ActiveScenario | null>;
  isAssistantBubbleForTranscript: (m: { role: string; content?: string }) => boolean;
  setInterviewUiPhase: Dispatch<
    SetStateAction<'pre_scenario' | 'scenario_transitioning' | 'scenario_active'>
  >;
  setReferenceCardPrompt: Dispatch<SetStateAction<string | null>>;
  setReferenceCardScenario: Dispatch<SetStateAction<ActiveScenario | null>>;
};

/** Re-sync show-scenario UI after tab return when transition logic cleared the card mid-scenario. */
export function runRestoreReferenceCardFromTranscriptIfNeeded(
  deps: RestoreReferenceCardFromTranscriptDeps,
): void {
  const bubbleFilter =
    typeof deps.isAssistantBubbleForTranscript === 'function'
      ? deps.isAssistantBubbleForTranscript
      : isAssistantBubbleForTranscript;
  const assistantOnly = deps.messages.filter(
    (m) => m.role === 'assistant' && bubbleFilter(m),
  );
  const synced = syncReferenceCardStateFromAssistantMessages(assistantOnly);
  if (synced.phase !== 'scenario_active' || !synced.scenario) return;

  const committed = deps.committedScenarioRef.current;
  if (committed?.label === synced.scenario.label) {
    deps.setReferenceCardScenario(synced.scenario);
    deps.setReferenceCardPrompt(synced.prompt);
    deps.setInterviewUiPhase('scenario_active');
    return;
  }

  if (!committed || committed.label !== synced.scenario.label) {
    deps.committedScenarioRef.current = synced.scenario;
    deps.setReferenceCardScenario(synced.scenario);
    deps.setReferenceCardPrompt(synced.prompt);
    deps.setInterviewUiPhase('scenario_active');
  }
}

const MOMENT_5_REFERENCE_SCENARIO: ActiveScenario = {
  label: MOMENT_4_PERSONAL_LABEL,
  text: MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT.trim(),
};

export function isAssistantBubbleForTranscript(
  m: { role: string; content?: string; isScoreCard?: boolean; isWelcomeBack?: boolean }
): boolean {
  return (
    m.role === 'assistant' &&
    !(m as { isScoreCard?: boolean }).isScoreCard &&
    !(m as { isWelcomeBack?: boolean }).isWelcomeBack
  );
}

/**
 * Brief breath between split vignette and opening question after segment 1 playback completes.
 * `speakWithElevenLabs` already awaits segment 1 finish — a long fixed gap sounded like dead air.
 */



/**
 * Long fictional scenario intros only: split vignette vs opening question when estimate &gt; 30s.
 * Both segments are intended to be prefetched before playback (see `speak`).
 */
export function trySplitFictionalScenarioIntroLongDelivery(text: string): {
  seg1: string;
  seg2: string;
  segment1_expected_duration_ms: number;
  segment2_expected_duration_ms: number;
} | null {
  const cleaned = stripControlTokens(text ?? '').trim();
  if (!cleaned) return null;
  if (isLockedShowScenarioExactTtsText(cleaned)) return null;
  const withoutSituationLead = cleaned.replace(/^here's the first situation:\s*/i, '').trim();
  if (isLockedShowScenarioExactTtsText(withoutSituationLead)) return null;
  const scenario = detectActiveScenarioFromMessage(cleaned);
  if (!scenario) return null;
  const opening = getSituationOpeningQuestion(scenario);
  if (!opening) return null;
  const { expectedMs: fullExpected } = getTtsExpectedDurationMsFromCharCount(cleaned.length);
  if (fullExpected <= 30_000) return null;
  const lastQ = extractScenarioModalQuestionFromAssistantText(cleaned);
  if (!lastQ) return null;
  const nOpen = normalizeScenarioOpeningForCompare(opening);
  const nLast = normalizeScenarioOpeningForCompare(lastQ);
  if (
    nOpen !== nLast &&
    !nLast.includes(nOpen.slice(0, Math.min(24, nOpen.length))) &&
    !nOpen.includes(nLast.slice(0, Math.min(24, nLast.length)))
  ) {
    return null;
  }
  const idx = cleaned.lastIndexOf(lastQ);
  if (idx < 0) return null;
  const seg1 = cleaned.slice(0, idx).trimEnd();
  const seg2 = lastQ.trim();
  if (seg1.length < 20 || seg2.length < 8) return null;
  const { expectedMs: segment1_expected_duration_ms } = getTtsExpectedDurationMsFromCharCount(seg1.length);
  const { expectedMs: segment2_expected_duration_ms } = getTtsExpectedDurationMsFromCharCount(seg2.length);
  return { seg1, seg2, segment1_expected_duration_ms, segment2_expected_duration_ms };
}

/** Restore scenario reference card after storage resume (no TTS replay). */
export function syncReferenceCardStateFromAssistantMessages(
  assistantMessages: Array<{ role: string; content?: string; isScoreCard?: boolean; isWelcomeBack?: boolean }>
): {
  scenario: ActiveScenario | null;
  prompt: string | null;
  phase: 'pre_scenario' | 'scenario_transitioning' | 'scenario_active';
} {
  if (assistantMessages.length === 0) {
    return { scenario: null, prompt: null, phase: 'pre_scenario' };
  }
  for (let i = assistantMessages.length - 1; i >= 0; i--) {
    const raw = stripControlTokens(assistantMessages[i].content ?? '').trim();
    if (transcriptAssistantContainsMoment5PrimaryConflictQuestion(raw)) {
      return { scenario: MOMENT_5_REFERENCE_SCENARIO, prompt: null, phase: 'scenario_active' };
    }
  }
  const m4Modal = resolveMoment4ShowScenarioReferenceCard(
    assistantMessages.map((m) => ({
      role: m.role,
      content: stripControlTokens(m.content ?? '').trim(),
    })),
    { grudgeCardBody: MOMENT_4_GRUDGE_QUESTION_TEXT },
  );
  if (m4Modal.active) {
    return {
      scenario: { label: MOMENT_4_PERSONAL_LABEL, text: m4Modal.cardBodyText },
      prompt: null,
      phase: 'scenario_active',
    };
  }
  let anchorIdx = -1;
  let anchorScenario: ActiveScenario | null = null;
  for (let i = assistantMessages.length - 1; i >= 0; i--) {
    const cleaned = stripControlTokens(assistantMessages[i].content ?? '').trim();
    const d = detectActiveScenarioFromMessage(cleaned);
    if (d) {
      anchorIdx = i;
      anchorScenario = d;
      break;
    }
  }
  if (!anchorScenario || anchorIdx < 0) {
    return { scenario: null, prompt: null, phase: 'pre_scenario' };
  }
  const lastIdx = assistantMessages.length - 1;
  let prompt: string | null = null;
  if (lastIdx > anchorIdx) {
    const scoped = assistantMessages.slice(anchorIdx).map((m) => ({
      role: m.role,
      content: stripControlTokens(m.content ?? '').trim(),
    }));
    prompt = getLastSubstantiveScenarioModalQuestion(scoped);
    if (prompt && isResumeOrScenarioReplayUiPrompt(prompt)) {
      prompt = null;
    }
    if (prompt === null) {
      prompt = getSituationOpeningQuestion(anchorScenario);
    }
  } else {
    prompt = getSituationOpeningQuestion(anchorScenario);
  }
  return { scenario: anchorScenario, prompt, phase: 'scenario_active' };
}

export function isResumeOrScenarioReplayUiPrompt(content: string): boolean {
  const t = content.trim().toLowerCase();
  if (!t) return false;
  return (
    /\b(would it help to (hear|repeat|go over)\s+(the\s+)?scenario\s+again)\b/.test(t) ||
    /\b(would you like me to repeat|if you'd like me to repeat what i said)\b/.test(t) ||
    /\b(i can repeat it or continue|feel free to respond whenever you're ready)\b/.test(t)
  );
}

/** Returns the last real assistant message before the session ended, excluding score cards (for resume welcome). */
export function extractLastInterviewerMessage(messages: Array<{ role: string; content: string; isScoreCard?: boolean; isWelcomeBack?: boolean }> | null): string | null {
  if (!messages || messages.length === 0) return null;
  const assistantMessages = messages
    .filter((m) => m.role === 'assistant' && !(m as { isScoreCard?: boolean }).isScoreCard && !(m as { isWelcomeBack?: boolean }).isWelcomeBack)
    .reverse();
  for (const msg of assistantMessages) {
    const content = (msg.content ?? '').trim();
    if (!content) continue;
    if (isResumeOrScenarioReplayUiPrompt(content)) continue;
    return content;
  }
  return null;
}
