import { isClientOrElongatingInterviewProbeAssistant } from '@features/aria/interviewDisengagementProbes';
import { isMisplacedScenarioMetaRedirectText } from '@features/aria/misplacedScenarioAnswerLogic';
import {
  isClientAudioRecoveryAssistantLine,
  isInterviewPreambleBriefingMoment,
  isNamePromptInterviewMoment,
  isResumeReentryWelcomePrompt,
  isSimpleYesNoInterviewMoment,
} from '@features/aria/interviewProceduralMoments';
import { isIntroBriefingReadinessOnlySentence } from '@features/aria/interviewPreambleBriefing';
import {
  looksLikeMoment4GrudgePrompt,
  looksLikeMoment4ThresholdQuestion,
  MOMENT_4_COMMITMENT_THRESHOLD_QUESTION_CARD_BODY,
  isIncompleteMoment4ThresholdLeadSentence,
  looksLikeMoment4ThresholdParaphraseInProgress,
} from '@features/aria/moment4ProbeLogic';
import { looksLikeMoment4SpecificityFollowUpEcho } from '@features/aria/moment4SpecificityFollowUp';
import {
  looksLikeScenarioAContemptProbeQuestion,
  spokenTextStartsMoment5PrimaryConflictQuestion,
  transcriptAssistantContainsMoment5PrimaryConflictQuestion,
} from '@features/aria/probeAndScoringUtils';
import {
  coerceExactScenarioModalQuestionDisplay,
  isScenarioANonScriptedModalParaphrase,
  resolveSituation1ExactModalPrompt,
} from '@features/aria/situation1ExactModalPrompt';
import { resolveSituation2ExactModalPrompt } from '@features/aria/situation2ExactModalPrompt';
import { resolveSituation3ExactModalPrompt } from '@features/aria/situation3ExactModalPrompt';
import {
  isForbiddenScenarioCSophiePrescriptiveFollowUpQuestion,
  isScenarioCRepairAssistantPrompt,
  looksLikeScenarioCRepairAsDanielQuestion,
  looksLikeScenarioCSophiePerspectiveQuestion,
} from '@features/aria/scenarioCPromptDetection';
import { looksLikeScenarioARepairQuestion } from '@features/aria/scenarioARepairQuestionHelpers';
import {
  looksLikeScenarioBJamesDifferentlyQuestion,
  looksLikeScenarioBRepairAsJamesQuestion,
} from '@features/aria/scenarioBProbeLogic';

/** Clarification / elongating probes — never the "current question" in Show scenario modal. */
const SCENARIO_MODAL_FOLLOW_UP_PROBE_PATTERNS = [
  'can you say more about that',
  'just say whatever comes to mind',
  'say whatever comes to mind',
  'could you say more',
  'can you tell me more',
  "i didn't quite catch that",
  'could you say it again',
  'would you mind repeating that',
  'seems like an interruption happened',
  'cut you off',
  'give that one another try',
  'pick up wherever feels natural',
  "that's situation 2",
  "that's situation 3",
  "haven't quite gotten there",
  "we're still with emma",
  "we're still with",
  "sorry, i didn't catch",
  'can you elaborate',
  'go on',
  'tell me more',
  'what else',
  'take your time',
  'still here',
] as const;

/**
 * Scripted construct probes that ARE the current Show scenario question (not thin follow-ups).
 * Sophie is also listed under client elongating helpers for disengagement chaining — carve it out here.
 */
function isScriptedScenarioConstructProbeForModal(text: string): boolean {
  if (looksLikeScenarioCSophiePerspectiveQuestion(text)) return true;
  if (isScenarioCRepairAssistantPrompt(text) || looksLikeScenarioCRepairAsDanielQuestion(text)) {
    return true;
  }
  if (looksLikeScenarioAContemptProbeQuestion(text)) return true;
  if (looksLikeScenarioARepairQuestion(text)) return true;
  if (
    looksLikeScenarioBJamesDifferentlyQuestion(text) ||
    looksLikeScenarioBRepairAsJamesQuestion(text)
  ) {
    return true;
  }
  return false;
}

/**
 * Reference-card ("Show scenario") modal: bottom line must be a real scenario question, never
 * infra / retry / mic / connectivity copy from AriaScreen. Display layer uses this with a
 * last-known-good fallback.
 */
/** True when assistant text is a thin follow-up / elongating probe, not the substantive scenario question. */
export function isScenarioModalFollowUpProbe(text: string | null | undefined): boolean {
  const raw = (text ?? '').trim();
  if (!raw) return false;
  if (isScriptedScenarioConstructProbeForModal(raw)) return false;
  if (isForbiddenScenarioCSophiePrescriptiveFollowUpQuestion(raw)) return true;
  if (isMisplacedScenarioMetaRedirectText(raw)) return true;
  if (isClientOrElongatingInterviewProbeAssistant(raw)) return true;
  const lower = raw.toLowerCase();
  return SCENARIO_MODAL_FOLLOW_UP_PROBE_PATTERNS.some((pattern) => lower.includes(pattern));
}

/** Remove thin follow-up / elongating probe paragraphs from a multi-paragraph assistant draft. */
export function stripScenarioModalFollowUpProbeParagraphs(text: string): string {
  if (!text?.trim()) return text;
  const kept = text
    .split(/\n\n+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && !isScenarioModalFollowUpProbe(part));
  return kept.join('\n\n').trim();
}

/**
 * Scenario-wrap / closing lines with no real question — skip for modal "last question".
 * Compound turns that also introduce the next scenario question (contain `?` + substantive cues) are kept.
 */
export function isScenarioModalPureTransitionTurn(text: string | null | undefined): boolean {
  const raw = (text ?? '').trim();
  if (!raw) return false;
  const lower = raw.toLowerCase();
  const hasTransitionPhrase =
    lower.includes("that's the end of this scenario") ||
    lower.includes("that's a wrap on this situation") ||
    lower.includes("that's a wrap") ||
    lower.includes('great work getting through all of this') ||
    lower.includes('good work getting through all of this') ||
    lower.includes("now we'll shift to something more personal") ||
    lower.includes('now for the first of two personal questions') ||
    lower.includes("here's one more question about you");
  if (!hasTransitionPhrase) return false;
  if (raw.includes('?')) {
    const hasSubstantiveQuestionCue =
      lower.includes("what's going on") ||
      lower.includes('what do you think') ||
      lower.includes('think of a time') ||
      lower.includes('have you ever') ||
      lower.includes('how would you') ||
      lower.includes('what do you make') ||
      lower.includes('what would you') ||
      lower.includes('if you were') ||
      lower.includes("here's the next situation") ||
      lower.includes("here's the third situation");
    if (hasSubstantiveQuestionCue) return false;
  }
  return (
    !raw.includes('?') &&
    !lower.includes("what's going on") &&
    !lower.includes('what do you think') &&
    !lower.includes('think of a time') &&
    !lower.includes('have you ever')
  );
}

/**
 * Show scenario modal: last interrogative sentence in an assistant turn (reflection stripped).
 * Ignores vignette dialogue lines (e.g. "Emma says '…'.") that precede the interviewer question.
 */
function isScenarioModalFooterQuestionParagraph(para: string): boolean {
  if (/\b(Emma|Ryan|Sarah|James|Sophie|Daniel)\s+says\b/i.test(para)) return false;
  const qIdx = para.indexOf('?');
  if (qIdx < 0) return false;
  const beforeQ = para.slice(0, qIdx);
  if (qIdx === para.length - 1 && !/[.!]\s/.test(beforeQ)) return true;
  if (
    para.length <= 220 &&
    /^[\u2014\u2013\-—]?\s*(What's|What would|What do you|What if|How would|When |Good —|Can you|And if you|Before things blew up)/i.test(
      para
    )
  ) {
    return true;
  }
  return false;
}

export function extractScenarioModalQuestionFromAssistantText(text: string): string | null {
  const t = text.trim();
  if (!t.includes('?')) return null;
  const lastQ = t.lastIndexOf('?');

  const lastParaBreak = t.lastIndexOf('\n\n', lastQ);
  if (lastParaBreak >= 0) {
    const para = t.slice(lastParaBreak + 2, lastQ + 1).trim();
    if (para.includes('?') && isScenarioModalFooterQuestionParagraph(para)) return para;
  }

  const prefix = t.slice(0, lastQ);
  const quoteThenQuestion = /['"]\s+(?=[A-Z])/g;
  let startAfterQuote = -1;
  let m: RegExpExecArray | null;
  while ((m = quoteThenQuestion.exec(prefix)) !== null) {
    startAfterQuote = m.index + m[0].length;
  }
  if (startAfterQuote >= 0) {
    const candidate = t.slice(startAfterQuote, lastQ + 1).trim();
    if (candidate.includes('?')) return candidate;
  }

  const beforeClose = prefix;
  let start = 0;
  const re = /[.!?]\s+/g;
  while ((m = re.exec(beforeClose)) !== null) {
    const afterBoundary = t.slice(m.index + m[0].length, m.index + m[0].length + 24);
    if (/^(Emma|Ryan|Sarah|James|Sophie|Daniel)\s+says\b/i.test(afterBoundary)) {
      continue;
    }
    start = m.index + m[0].length;
  }
  const out = t.slice(start, lastQ + 1).trim();
  return out.length > 0 ? out : null;
}

/** Footer should show the interviewer question only — never repeated vignette dialogue. */
export function sanitizeScenarioModalFooterQuestion(text: string): string {
  const cleaned = (text ?? '').trim();
  if (!cleaned) return cleaned;
  if (!/\b(Emma|Ryan|Sarah|James|Sophie|Daniel)\s+says\b/i.test(cleaned)) {
    return cleaned;
  }
  const reExtracted = extractScenarioModalQuestionFromAssistantText(cleaned);
  if (reExtracted && !/\b(Emma|Ryan|Sarah|James|Sophie|Daniel)\s+says\b/i.test(reExtracted)) {
    return reExtracted;
  }
  const lastQ = cleaned.lastIndexOf('?');
  if (lastQ < 0) return cleaned;
  const prefix = cleaned.slice(0, lastQ);
  for (const marker of [".' ", '." ', ".'", '."']) {
    const idx = prefix.lastIndexOf(marker);
    if (idx >= 0) {
      const tail = cleaned.slice(idx + marker.length).trim();
      if (tail.includes('?')) return tail;
    }
  }
  return cleaned;
}

export type ScenarioModalTranscriptTurn = { role: string; content?: string | null };

/**
 * Walk backwards through assistant turns and return the last substantive scenario question
 * (skips elongating probes, pure transitions, and infra copy).
 */
export function getLastSubstantiveScenarioModalQuestion(
  transcript: ScenarioModalTranscriptTurn[]
): string | null {
  for (let i = transcript.length - 1; i >= 0; i--) {
    const turn = transcript[i];
    if (turn.role !== 'assistant') continue;
    const content = (turn.content ?? '').trim();
    if (!content) continue;
    if (isInterviewPreambleBriefingMoment(content)) continue;
    if (isScenarioModalFollowUpProbe(content)) continue;
    if (isScenarioModalPureTransitionTurn(content)) continue;
    const extracted = extractScenarioModalQuestionFromAssistantText(content);
    if (!extracted) continue;
    if (isScenarioANonScriptedModalParaphrase(extracted)) continue;
    if (!isScenarioModalEligibleScenarioQuestionPrompt(extracted)) continue;
    const exact = coerceExactScenarioModalQuestionDisplay(extracted);
    if (!exact) continue;
    return exact;
  }
  return null;
}

export type ResolveScenarioModalPromptInScopeOptions = {
  /** Active situation label (e.g. Situation 2) — limits search to turns on/after that vignette intro. */
  scenarioLabel: string | null;
  detectScenarioFromContent: (content: string) => { label: string } | null;
  openingQuestionForLabel: (label: string) => string | null;
  /** Prefer a question extracted from the line that just finished speaking (scenario transition TTS). */
  currentSpokenContent?: string | null;
};

/**
 * Show-scenario footer: last substantive question within the current situation only.
 * Prevents prior-scenario repair/follow-up lines from leaking after S1→S2 (etc.) transitions.
 */
export type Moment4ShowScenarioReferenceResolution =
  | { active: false }
  | { active: true; cardBodyText: string };

function moment4CardBodyQuestionFromAssistant(content: string): string | null {
  const extracted = extractScenarioModalQuestionFromAssistantText(content);
  if (extracted) return extracted;
  const trimmed = content.trim();
  return trimmed.includes('?') ? trimmed : null;
}

/**
 * Moment 4 Show scenario: one question in the card body only (no footer).
 * Commitment threshold / specificity lines replace the grudge copy in the card.
 */
export function resolveMoment4ShowScenarioReferenceCard(
  transcript: ScenarioModalTranscriptTurn[],
  options: { grudgeCardBody: string; currentSpokenContent?: string | null }
): Moment4ShowScenarioReferenceResolution {
  const assistantContents: string[] = [];
  for (const t of transcript) {
    if (t.role !== 'assistant') continue;
    const c = (t.content ?? '').trim();
    if (c) assistantContents.push(c);
  }
  const spoken = (options.currentSpokenContent ?? '').trim();
  if (spoken) assistantContents.push(spoken);
  const grudgeCardBody = options.grudgeCardBody.trim();

  for (let i = assistantContents.length - 1; i >= 0; i--) {
    const content = assistantContents[i]!;
    if (transcriptAssistantContainsMoment5PrimaryConflictQuestion(content)) {
      return { active: false };
    }
    if (looksLikeMoment4ThresholdQuestion(content)) {
      return { active: true, cardBodyText: MOMENT_4_COMMITMENT_THRESHOLD_QUESTION_CARD_BODY };
    }
    if (
      isIncompleteMoment4ThresholdLeadSentence(content) ||
      looksLikeMoment4ThresholdParaphraseInProgress(content)
    ) {
      return { active: true, cardBodyText: MOMENT_4_COMMITMENT_THRESHOLD_QUESTION_CARD_BODY };
    }
    if (looksLikeMoment4SpecificityFollowUpEcho(content)) {
      const cardBodyText = moment4CardBodyQuestionFromAssistant(content);
      if (cardBodyText) return { active: true, cardBodyText };
    }
    if (looksLikeMoment4GrudgePrompt(content)) {
      return { active: true, cardBodyText: grudgeCardBody };
    }
  }
  return { active: false };
}

/** Refresh Show scenario footer when substantive scenario questions begin (not only vignette intros). */
export function assistantSpeechShouldRefreshScenarioModalPrompt(
  content: string | null | undefined
): boolean {
  const cleaned = (content ?? '').trim();
  if (!cleaned) return false;
  return getLastSubstantiveScenarioModalQuestion([{ role: 'assistant', content: cleaned }]) != null;
}

export function resolveScenarioModalPromptInScope(
  transcript: ScenarioModalTranscriptTurn[],
  options: ResolveScenarioModalPromptInScopeOptions
): string | null {
  const { scenarioLabel, detectScenarioFromContent, openingQuestionForLabel, currentSpokenContent } =
    options;
  const spoken = (currentSpokenContent ?? '').trim();
  if (spoken) {
    if (scenarioLabel === 'Situation 1') {
      return resolveSituation1ExactModalPrompt(transcript, spoken);
    }
    if (scenarioLabel === 'Situation 2') {
      return resolveSituation2ExactModalPrompt(transcript, spoken);
    }
    if (scenarioLabel === 'Situation 3') {
      return resolveSituation3ExactModalPrompt(transcript, spoken);
    }
    const fromSpoken = getLastSubstantiveScenarioModalQuestion([{ role: 'assistant', content: spoken }]);
    if (fromSpoken) return fromSpoken;
  }
  let scoped = transcript;
  if (scenarioLabel) {
    let anchorIdx = -1;
    for (let i = transcript.length - 1; i >= 0; i--) {
      if (transcript[i]?.role !== 'assistant') continue;
      const detected = detectScenarioFromContent((transcript[i]?.content ?? '').trim());
      if (detected?.label === scenarioLabel) {
        anchorIdx = i;
        break;
      }
    }
    if (anchorIdx >= 0) scoped = transcript.slice(anchorIdx);
  }
  if (scenarioLabel === 'Situation 1') {
    return resolveSituation1ExactModalPrompt(scoped);
  }
  if (scenarioLabel === 'Situation 2') {
    return resolveSituation2ExactModalPrompt(scoped);
  }
  if (scenarioLabel === 'Situation 3') {
    return resolveSituation3ExactModalPrompt(scoped);
  }
  const q = getLastSubstantiveScenarioModalQuestion(scoped);
  if (q) return q;
  if (scenarioLabel) return openingQuestionForLabel(scenarioLabel);
  return null;
}

export function isScenarioModalExcludedAssistantPrompt(text: string | null | undefined): boolean {
  const raw = (text ?? '').trim();
  if (!raw) return false;
  if (isScenarioModalFollowUpProbe(raw)) return true;
  if (isClientAudioRecoveryAssistantLine(raw)) return true;
  const q = raw.toLowerCase();
  const needles = [
    "i'm having trouble starting the microphone",
    "i'm having trouble connecting right now",
    "having trouble reaching the server",
    "i'm still having trouble hearing you",
    'it sounds like i might be having trouble hearing you clearly',
    "sounds like you're speaking a different language",
    'i only know english',
    'could you repeat that in english',
    'the mic did not start cleanly',
    "i didn't catch that — tap the mic",
    'tap the mic and try again',
    'give it another go',
    'something went wrong on our end',
    'something went wrong with that request',
    "there's an authentication issue",
    "i couldn't hear you",
    "i couldnt hear you",
    'please repeat that',
    'could you repeat that',
    'would you mind repeating',
    "sorry, i didn't hear",
    "i didn't hear you",
  ];
  for (const n of needles) {
    if (q.includes(n)) return true;
  }
  return false;
}

/**
 * True when the string is suitable as the scenario reference modal's "last question" line:
 * must read as an interrogative (contains `?`), must not be infra/recovery/error copy, and must
 * not be onboarding / resume / name-collection prompts unrelated to the vignette.
 */
export function isScenarioModalEligibleScenarioQuestionPrompt(text: string | null | undefined): boolean {
  const raw = (text ?? '').trim();
  if (!raw || !raw.includes('?')) return false;
  if (looksLikeScenarioCSophiePerspectiveQuestion(raw)) return true;
  if (isScenarioModalFollowUpProbe(raw)) return false;
  if (isScenarioModalExcludedAssistantPrompt(raw)) return false;
  if (isResumeReentryWelcomePrompt(raw)) return false;
  if (isNamePromptInterviewMoment(raw)) return false;
  // Opening briefing / "Are you ready?" must never become the Show scenario footer.
  if (isInterviewPreambleBriefingMoment(raw)) return false;
  if (isIntroBriefingReadinessOnlySentence(raw)) return false;
  if (/^are you ready\b/i.test(raw)) return false;
  if (isSimpleYesNoInterviewMoment(raw) && /\bready\b/i.test(raw)) return false;
  return true;
}

function normalizeScenarioModalQuestionSuffixForCompare(text: string): string {
  return text
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[‘'’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\?+$/, '')
    .toLowerCase();
}

/** Remove a trailing scenario question from vignette body when it will render in the modal footer. */
export function stripScenarioModalQuestionFromVignetteBody(
  body: string,
  question: string
): string {
  const b = (body ?? '').trim();
  const q = (question ?? '').trim();
  if (!b || !q) return b;
  if (b.endsWith(q)) {
    return b.slice(0, -q.length).replace(/[\s\n]+$/, '').trim();
  }
  const withGap = `\n\n${q}`;
  if (b.endsWith(withGap)) {
    return b.slice(0, -withGap.length).trim();
  }
  const nBody = normalizeScenarioModalQuestionSuffixForCompare(b);
  const nQ = normalizeScenarioModalQuestionSuffixForCompare(q);
  if (nBody.endsWith(nQ)) {
    const idx = b.toLowerCase().lastIndexOf(q.toLowerCase());
    if (idx >= 0) {
      return b.slice(0, idx).replace(/[\s\n]+$/, '').trim();
    }
  }
  return b;
}

export type ScenarioModalDisplayParts = {
  transcript: string;
  footerQuestion: string | null;
};

/**
 * Show scenario modal layout: fiction transcript in the scroll body; current question only in the footer.
 * When the body is question-only (Moment 4/5), keep a single block with no footer.
 */
export function resolveScenarioModalDisplayParts(
  body: string,
  prompt: string | null | undefined
): ScenarioModalDisplayParts {
  const rawBody = (body ?? '').trim();
  if (!rawBody) {
    return { transcript: '', footerQuestion: null };
  }

  const explicitPrompt = (prompt ?? '').trim();
  let footerQuestion: string | null =
    explicitPrompt && isScenarioModalEligibleScenarioQuestionPrompt(explicitPrompt)
      ? explicitPrompt
      : null;

  const extractedFromBody = extractScenarioModalQuestionFromAssistantText(rawBody);
  const bodyEndsWithQuestion =
    extractedFromBody != null &&
    isScenarioModalEligibleScenarioQuestionPrompt(extractedFromBody) &&
    normalizeScenarioModalQuestionSuffixForCompare(rawBody).endsWith(
      normalizeScenarioModalQuestionSuffixForCompare(extractedFromBody)
    );

  if (!footerQuestion && bodyEndsWithQuestion && extractedFromBody) {
    footerQuestion = extractedFromBody;
  }

  if (!footerQuestion) {
    return { transcript: rawBody, footerQuestion: null };
  }

  footerQuestion = sanitizeScenarioModalFooterQuestion(footerQuestion);

  const transcript = stripScenarioModalQuestionFromVignetteBody(rawBody, footerQuestion);
  if (!transcript) {
    return { transcript: rawBody, footerQuestion: null };
  }

  return { transcript, footerQuestion };
}
