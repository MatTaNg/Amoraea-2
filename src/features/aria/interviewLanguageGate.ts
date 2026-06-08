import { isClientOrElongatingInterviewProbeAssistant } from '@features/aria/interviewDisengagementProbes';
import {
  looksLikeMoment4GrudgePrompt,
  looksLikeMoment4ThresholdQuestion,
} from '@features/aria/moment4ProbeLogic';
import { looksLikeMoment4SpecificityFollowUpEcho } from '@features/aria/moment4SpecificityFollowUp';
import {
  spokenTextStartsMoment5PrimaryConflictQuestion,
  transcriptAssistantContainsMoment5PrimaryConflictQuestion,
} from '@features/aria/probeAndScoringUtils';

/** Fixed copy when Whisper detects a non-English language (see Aria interview flow). */
export const NON_ENGLISH_VOICE_PROMPT =
  "Sounds like you're speaking a different language. I only know English! Can you repeat that in English?";

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
  "sorry, i didn't catch",
  'can you elaborate',
  'go on',
  'tell me more',
  'what else',
  'take your time',
  'still here',
] as const;

export function countSpokenWords(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0).length;
}

/** True if Whisper's `language` field indicates English. Missing/empty => treat as English (no gate). */
export function whisperLanguageIsEnglish(language: string | null | undefined): boolean {
  if (language == null || language === '') return true;
  const l = language.trim().toLowerCase();
  if (l === 'en' || l.startsWith('en-')) return true;
  if (l === 'english') return true;
  return false;
}

/**
 * When to block interview processing: enough words for reliable language id, and explicit non-English label.
 */
export function shouldRejectVoiceForNonEnglish(
  text: string,
  language: string | null | undefined
): boolean {
  if (countSpokenWords(text) < 5) return false;
  if (language == null || language === '') return false;
  return !whisperLanguageIsEnglish(language);
}

/** Parse Whisper `verbose_json` (or compatible) transcription responses. */
export function parseWhisperTranscriptionPayload(data: unknown): {
  text: string;
  language: string | null;
  /** Best-effort from segments avg_logprob when present. */
  confidence: number | null;
} {
  if (typeof data !== 'object' || data === null) {
    return { text: '', language: null, confidence: null };
  }
  const o = data as {
    text?: unknown;
    language?: unknown;
    segments?: Array<{ avg_logprob?: number }>;
  };
  const text = typeof o.text === 'string' ? o.text.trim() : '';
  const language =
    typeof o.language === 'string' && o.language.trim() !== ''
      ? o.language.trim()
      : null;
  let confidence: number | null = null;
  const segs = Array.isArray(o.segments) ? o.segments : [];
  const logprobs = segs
    .map((s) => (typeof s?.avg_logprob === 'number' && Number.isFinite(s.avg_logprob) ? s.avg_logprob : null))
    .filter((x): x is number => x != null);
  if (logprobs.length > 0) {
    const mean = logprobs.reduce((a, b) => a + b, 0) / logprobs.length;
    confidence = Math.max(0, Math.min(1, (mean + 2) / 4));
  }
  return { text, language, confidence };
}

export type WhisperVerboseStats = {
  segment_count: number;
  /** Mean of per-segment `Math.exp(avg_logprob)` when segments carry logprobs. */
  overall_confidence: number | null;
  min_segment_confidence: number | null;
  max_segment_confidence: number | null;
  avg_segment_confidence: number | null;
};

function logprobToProb(lp: number): number {
  const p = Math.exp(lp);
  if (!Number.isFinite(p)) return 0;
  return Math.max(0, Math.min(1, p));
}

/** Segment-level stats from Whisper `verbose_json` (best-effort). */
export function parseWhisperVerboseStats(data: unknown): WhisperVerboseStats {
  if (typeof data !== 'object' || data === null) {
    return {
      segment_count: 0,
      overall_confidence: null,
      min_segment_confidence: null,
      max_segment_confidence: null,
      avg_segment_confidence: null,
    };
  }
  const o = data as { segments?: Array<{ avg_logprob?: number }> };
  const segs = Array.isArray(o.segments) ? o.segments : [];
  const confs = segs
    .map((s) => (typeof s?.avg_logprob === 'number' && Number.isFinite(s.avg_logprob) ? logprobToProb(s.avg_logprob) : null))
    .filter((x): x is number => x != null);
  if (confs.length === 0) {
    return {
      segment_count: segs.length,
      overall_confidence: null,
      min_segment_confidence: null,
      max_segment_confidence: null,
      avg_segment_confidence: null,
    };
  }
  const minC = Math.min(...confs);
  const maxC = Math.max(...confs);
  const avgC = confs.reduce((a, b) => a + b, 0) / confs.length;
  const overall = avgC;
  return {
    segment_count: segs.length,
    overall_confidence: Math.round(overall * 1000) / 1000,
    min_segment_confidence: Math.round(minC * 1000) / 1000,
    max_segment_confidence: Math.round(maxC * 1000) / 1000,
    avg_segment_confidence: Math.round(avgC * 1000) / 1000,
  };
}

/** Heuristic: moment is likely a short confirmation (yes/no / ready). */
export function isSimpleYesNoInterviewMoment(lastQuestionText: string | null | undefined): boolean {
  const q = (lastQuestionText ?? '').toLowerCase().trim();
  if (!q) return false;
  if (/are you ready\b/.test(q)) return true;
  if (/\bready to (get )?started\b/.test(q)) return true;
  if (/\bready\?\s*$/.test(q) && q.length < 80) return true;
  /** Explicit yes/no choice — not merely containing the word "yes" or "no" (scenario copy often says "no right or wrong"). */
  if (/\b(yes or no|answer yes or no|a simple yes or no|just yes or no)\b/i.test(q)) return true;
  return false;
}

/** Resume / re-entry copy — user may answer briefly (yes / repeat / continue). */
export function isResumeReentryWelcomePrompt(lastQuestionText: string | null | undefined): boolean {
  const q = (lastQuestionText ?? '').toLowerCase();
  if (/welcome back\b/.test(q) && /continue where we left off\b/.test(q)) return true;
  if (/repeat what i said\b/.test(q) && /ready for your response\b/.test(q)) return true;
  return false;
}

/** Client recovery lines must not become the "question" for ratio gating (avoids re-ask loops). */
export function isClientAudioRecoveryAssistantLine(lastQuestionText: string | null | undefined): boolean {
  const q = (lastQuestionText ?? '').trim();
  if (!q) return false;
  if (/^i only caught part of that\b/i.test(q)) return true;
  if (/^i didn't catch any speech on that try\b/i.test(q)) return true;
  if (/^i'm having a little trouble on my end\b/i.test(q)) return true;
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
  if (isClientOrElongatingInterviewProbeAssistant(raw)) return true;
  const lower = raw.toLowerCase();
  return SCENARIO_MODAL_FOLLOW_UP_PROBE_PATTERNS.some((pattern) => lower.includes(pattern));
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
    para.length <= 180 &&
    /^[\u2014\u2013\-—]?\s*(What's|What would|What do you|What if|How would|When |Good —|Can you)/i.test(
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
    if (isScenarioModalFollowUpProbe(content)) continue;
    if (isScenarioModalPureTransitionTurn(content)) continue;
    const extracted = extractScenarioModalQuestionFromAssistantText(content);
    if (!extracted) continue;
    if (!isScenarioModalEligibleScenarioQuestionPrompt(extracted)) continue;
    return extracted;
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
      const cardBodyText = moment4CardBodyQuestionFromAssistant(content);
      if (cardBodyText) return { active: true, cardBodyText };
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
  if (isScenarioModalFollowUpProbe(raw)) return false;
  if (isScenarioModalExcludedAssistantPrompt(raw)) return false;
  if (isResumeReentryWelcomePrompt(raw)) return false;
  if (isNamePromptInterviewMoment(raw)) return false;
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

/** Name / identity prompts — one or two words are valid. */
export function isNamePromptInterviewMoment(lastQuestionText: string | null | undefined): boolean {
  const q = (lastQuestionText ?? '').toLowerCase();
  /** Opening line: "Hi, I'm Amoraea. What can I call you?" — must match or whisper ratio gate re-asks one-word names. */
  if (/\bwhat\s+(can|should)\s+i\s+call\s+you\b/.test(q)) return true;
  if (/what('?s|\s+is)\s+your\s+name\b/.test(q)) return true;
  if (/\bhow\s+(do\s+you|should\s+i)\s+(call\s+you|address\s+you)\b/.test(q)) return true;
  if (/\bhi,?\s+i'?m\s+amoraea\b/.test(q) && /\bwhat\s+(can|should)\s+i\s+call\s+you\b/.test(q)) return true;
  /** Name re-ask lines must stay in name-collection mode (ratio gate, whisper retry copy). */
  if (/\bwhat\s+name\s+would\s+you\s+like\s+me\s+to\s+use\b/.test(q)) return true;
  if (/\bdidn'?t\s+quite\s+catch\s+that\b/.test(q) && /\bname\b/.test(q)) return true;
  return false;
}

/** Post-name briefing (five parts, readiness) — not substantive interview response timing. */
export function isInterviewPreambleBriefingMoment(lastQuestionText: string | null | undefined): boolean {
  const q = (lastQuestionText ?? '').toLowerCase();
  if (/the way this works is/i.test(q)) return true;
  if (
    /good to meet you/i.test(q) &&
    (/the way this works|five parts|three short|are you ready/i.test(q))
  ) {
    return true;
  }
  return false;
}

const READINESS_AFFIRMATION_PATTERNS: RegExp[] = [
  /^yes\b/i,
  /^yeah\b/i,
  /^yep\b/i,
  /^yup\b/i,
  /^sure\b/i,
  /^ok(?:ay)?\b/i,
  /^ready\b/i,
  /^i'?m ready\b/i,
  /^let'?s (?:go|do it|start|begin)\b/i,
  /^go ahead\b/i,
  /^sounds good\b/i,
  /^absolutely\b/i,
  /^definitely\b/i,
  /^of course\b/i,
];

/** Short procedural assent to "Are you ready?" — not a substantive scenario answer. */
export function looksLikeReadinessAffirmation(text: string | null | undefined): boolean {
  const raw = (text ?? '').trim();
  if (!raw || raw.length > 48) return false;
  const t = raw.replace(/[.!?,…]+$/g, '').trim();
  if (!t) return false;
  if (/^\bno\b/i.test(t)) return false;
  if (/^(not yet|not ready|wait|hold on|one sec)/i.test(t)) return false;
  return READINESS_AFFIRMATION_PATTERNS.some((re) => re.test(t));
}

/** True when the participant is answering a readiness / preamble briefing prompt (not Scenario A Q1). */
export function userIsAnsweringInterviewReadinessPrompt(
  lastQuestionTexts: Array<string | null | undefined>,
): boolean {
  return lastQuestionTexts.some(
    (t) => isSimpleYesNoInterviewMoment(t) || isInterviewPreambleBriefingMoment(t),
  );
}

/** Only log `response_timings` for substantive scenario / personal-moment questions. */
export function shouldRecordInterviewResponseTiming(lastQuestionText: string | null | undefined): boolean {
  if (isNamePromptInterviewMoment(lastQuestionText)) return false;
  if (isInterviewPreambleBriefingMoment(lastQuestionText)) return false;
  if (isSimpleYesNoInterviewMoment(lastQuestionText)) return false;
  return true;
}

/** Use for whisper ratio re-ask: short answers are OK (do not require a full sentence). */
export function isShortAnswerOkForWhisperRatioGate(lastQuestionText: string | null | undefined): boolean {
  return (
    isSimpleYesNoInterviewMoment(lastQuestionText) ||
    isInterviewPreambleBriefingMoment(lastQuestionText) ||
    isResumeReentryWelcomePrompt(lastQuestionText) ||
    isClientAudioRecoveryAssistantLine(lastQuestionText) ||
    isNamePromptInterviewMoment(lastQuestionText)
  );
}

export type WhisperReaskTurnContext =
  | 'name_collection'
  | 'readiness_confirmation'
  | 'substantive';

/** Turn context for Whisper re-ask gating. */
export function getWhisperReaskTurnContext(
  lastQuestionText: string | null | undefined
): WhisperReaskTurnContext {
  if (isNamePromptInterviewMoment(lastQuestionText)) return 'name_collection';
  if (
    isSimpleYesNoInterviewMoment(lastQuestionText) ||
    isInterviewPreambleBriefingMoment(lastQuestionText)
  ) {
    return 'readiness_confirmation';
  }
  return 'substantive';
}

export type WhisperReaskEvaluationInput = {
  turnContext: WhisperReaskTurnContext;
  transcriptText: string;
  wordCount: number;
  wordsPerSecond: number;
  shortAnswerOk: boolean;
};

/** Max ratio-style re-asks per assistant question before accepting the transcript and advancing. */
export const WHISPER_RATIO_REASK_MAX_ATTEMPTS_PER_QUESTION = 3;

const MULTIWORD_HARD_STOP_TRANSCRIPTS_NORMALIZED = new Set([
  "i don't know",
  'i dont know',
  "i can't",
  'i cant',
  'i cannot',
  'i do not know',
]);

function normalizeTranscriptForHardStopMatch(raw: string): string {
  let s = raw.trim().toLowerCase();
  s = s.replace(/\u2019/g, "'").replace(/\u2018/g, "'");
  s = s.replace(/\s+/g, ' ');
  s = s.replace(/[.,!?;:…]+$/g, '').trim();
  return s;
}

/** Procedural one-word assent/refusal — not scenario-substance, but complete for ratio gate purposes. */
const SINGLE_WORD_HARD_STOP_NORMALIZED = new Set([
  'no',
  'nope',
  'nah',
  'never',
  'stop',
  'skip',
  'pass',
  'yes',
  'yeah',
  'yep',
  'yup',
  'sure',
  'ok',
  'okay',
  'ready',
]);

/** One-word Whisper tails that usually mean the clip cut off mid-sentence — allow ratio re-ask. */
const SINGLE_WORD_FRAGMENT_NORMALIZED = new Set([
  "that's",
  'thats',
  "it's",
  'its',
  'this',
  'that',
  'so',
  'well',
  'and',
  'but',
  'like',
  'um',
  'uh',
  'er',
]);

/**
 * Single-word successful Whisper turns and short refusal / hard-stop phrases must not trigger the
 * ratio re-ask ("answer again in a full sentence"). Obvious fragments (e.g. "That's") may re-ask.
 */
export function getWhisperRatioReaskSuppressionReason(
  transcriptText: string,
  wordCount: number,
): 'valid_hard_stop' | null {
  const trimmed = transcriptText.trim();
  if (!trimmed || wordCount < 1) return null;
  const n = normalizeTranscriptForHardStopMatch(trimmed);
  if (wordCount === 1) {
    if (SINGLE_WORD_FRAGMENT_NORMALIZED.has(n)) return null;
    if (SINGLE_WORD_HARD_STOP_NORMALIZED.has(n)) return 'valid_hard_stop';
    if (looksLikeReadinessAffirmation(trimmed)) return 'valid_hard_stop';
    return 'valid_hard_stop';
  }
  if (MULTIWORD_HARD_STOP_TRANSCRIPTS_NORMALIZED.has(n)) return 'valid_hard_stop';
  if (looksLikeReadinessAffirmation(trimmed)) return 'valid_hard_stop';
  return null;
}

export type WhisperRatioReaskState = {
  /** True when the client should play the ratio re-ask prompt (subject to per-question attempt cap in AriaScreen). */
  shouldFire: boolean;
  /** Log when non-null: a ratio re-ask would have fired without hard-stop / single-word suppression. */
  logSuppressedReason: 'valid_hard_stop' | null;
};

/**
 * Whisper ratio re-ask: substantive turns with suspicious words/sec or very short answers — unless
 * Whisper already returned a valid single-word answer or a recognized hard-stop phrase.
 */
export function computeWhisperRatioReaskState(input: WhisperReaskEvaluationInput): WhisperRatioReaskState {
  const { turnContext, transcriptText, wordCount, wordsPerSecond, shortAnswerOk } = input;
  const hasNonEmptyTranscript = transcriptText.trim().length > 0;
  if (!hasNonEmptyTranscript) {
    return { shouldFire: true, logSuppressedReason: null };
  }
  if (turnContext === 'name_collection' || turnContext === 'readiness_confirmation') {
    return { shouldFire: false, logSuppressedReason: null };
  }

  const ratioFlag = wordsPerSecond < 0.3 || (!shortAnswerOk && wordCount < 3);
  const wouldFireRatioOnly = ratioFlag && wordCount < 3 && !shortAnswerOk;
  const suppression = getWhisperRatioReaskSuppressionReason(transcriptText, wordCount);
  if (suppression && wouldFireRatioOnly) {
    return { shouldFire: false, logSuppressedReason: 'valid_hard_stop' };
  }
  if (suppression) {
    return { shouldFire: false, logSuppressedReason: null };
  }
  return { shouldFire: wouldFireRatioOnly, logSuppressedReason: null };
}

/**
 * Re-ask trigger for Whisper ratio gate.
 * Exempt contexts (name/readiness): accept any non-empty transcript, regardless of ratio/word-count/confidence.
 */
export function shouldFireWhisperRatioReask(input: WhisperReaskEvaluationInput): boolean {
  return computeWhisperRatioReaskState(input).shouldFire;
}
