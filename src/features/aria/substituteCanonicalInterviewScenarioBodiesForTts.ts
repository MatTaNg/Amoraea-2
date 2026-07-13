import { SCENARIO_B_VIGNETTE } from '@/constants/scenarioBVignette';
import {
  textContainsScenarioBVignetteBody,
  textContainsScenarioCVignetteBody as textContainsScenarioCVignetteBodyStrict,
} from '@features/aria/emotionScenarioTransitionInference';
import { extractScenarioModalQuestionFromAssistantText } from '@features/aria/interviewScenarioModalPrompt';
import {
  SCENARIO_1_OPENING,
  SCENARIO_2_OPENING,
  SCENARIO_3_OPENING,
  detectActiveScenarioFromMessage,
  getSituationOpeningQuestion,
  looksLikeCanonicalScenarioOpeningQuestion,
} from '@features/aria/interviewScenarioOpeningStreamGate';
import { SCENARIO_1_VIGNETTE, SCENARIO_3_VIGNETTE } from '@features/aria/interviewScenarioVignetteCopy';
import { looksLikeMoment4GrudgePrompt, MOMENT_4_GRUDGE_QUESTION_TEXT } from '@features/aria/moment4ProbeLogic';
import { MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT } from '@features/aria/moment5ProbeCopy';
import {
  spokenTextStartsMoment5PrimaryConflictQuestion,
  transcriptAssistantContainsMoment5PrimaryConflictQuestion,
} from '@features/aria/probeAndScoringUtils';
import {
  looksLikeScenarioBRepairAsJamesQuestion,
  looksLikeScenarioBJamesDifferentlyQuestion,
} from '@features/aria/scenarioBProbeLogic';
import {
  buildCanonicalShowScenarioCardTtsBody,
  buildCanonicalShowScenarioCardTtsFromStream,
  detectShowScenarioCardKind,
  extractShowScenarioCardTransitionPrefix,
} from '@features/aria/showScenarioCardCanonicalTts';

const SCENARIO_OPENING_PATTERNS: RegExp[] = [
  /\bwhat's going on between these two\b/i,
  /\bwhat do you think is going on here\b/i,
  /\bwhat do you think is happening here\b/i,
  /\bwhen daniel comes back and says\b/i,
  /\bwhat do you make of that\b/i,
  /\bwhat(?:'s| is) your read\b/i,
];

function normalizeForCanonicalCompare(text: string): string {
  return (text ?? '')
    .replace(/\u2019/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function textContainsScenarioAVignetteBody(text: string): boolean {
  const t = (text ?? '').trim().toLowerCase();
  if (!t) return false;
  return t.includes('emma and ryan') || t.includes('ryan takes a call from his mother');
}

function textContainsScenarioCVignetteBody(text: string): boolean {
  if (textContainsScenarioCVignetteBodyStrict(text)) return true;
  const t = (text ?? '').trim().toLowerCase();
  if (!t) return false;
  if (!/\bsophie and daniel\b/.test(t)) return false;
  if (
    (/\bten minutes\b/.test(t) || /\bi need ten minutes\b/.test(t)) &&
    (/\bdidn'?t know what to say\b/.test(t) ||
      /\bdidn'?t know how to respond\b/.test(t) ||
      /\bstill (?:upset|angry)\b/.test(t))
  ) {
    return true;
  }
  /** Model fiction that borrows S2 "together for two years" framing for Sophie/Daniel. */
  if (
    /\bhave been together for two years\b/.test(t) ||
    (/\bwhen they fight\b/.test(t) && /\b(leave the room|goes quiet|feels abandoned|needs space)\b/.test(t)) ||
    (/\bfeels abandoned\b/.test(t) && /\b(leave|quiet|space)\b/.test(t))
  ) {
    return true;
  }
  return false;
}

function locateSpan(text: string, startRe: RegExp, endRe: RegExp): { start: number; end: number } | null {
  const startMatch = startRe.exec(text);
  if (!startMatch) return null;
  const start = startMatch.index;
  const after = text.slice(start);
  const endMatch = endRe.exec(after);
  if (!endMatch) return null;
  return { start, end: start + endMatch.index + endMatch[0].length };
}

function findEarliestScenarioOpeningIndex(text: string): number | null {
  let earliest: number | null = null;
  for (const re of SCENARIO_OPENING_PATTERNS) {
    const m = re.exec(text);
    if (!m) continue;
    if (m.index < 20) continue;
    if (earliest == null || m.index < earliest) earliest = m.index;
  }
  const extracted = extractScenarioModalQuestionFromAssistantText(text);
  if (extracted) {
    const idx = text.lastIndexOf(extracted);
    if (idx >= 20 && (earliest == null || idx < earliest)) earliest = idx;
  }
  return earliest;
}

function replaceSpan(text: string, span: { start: number; end: number }, canonical: string): string {
  const current = text.slice(span.start, span.end).trim();
  if (normalizeForCanonicalCompare(current) === normalizeForCanonicalCompare(canonical)) {
    return text;
  }
  const before = text.slice(0, span.start);
  const after = text.slice(span.end);
  const needsSpaceBefore = before.length > 0 && !/\s$/.test(before) && !canonical.startsWith('\n');
  const needsSpaceAfter = after.length > 0 && !/^\s/.test(after) && !after.startsWith('\n');
  return `${before}${needsSpaceBefore ? ' ' : ''}${canonical}${needsSpaceAfter ? ' ' : ''}${after}`.replace(
    /\n{3,}/g,
    '\n\n',
  );
}

function replaceVignetteBody(
  text: string,
  contains: (t: string) => boolean,
  canonical: string,
  canonicalOpening: string,
  startRes: RegExp[],
  endRes: RegExp[],
): string {
  if (!contains(text)) return text;
  if (text.includes(canonical)) {
    if (canonical === SCENARIO_B_VIGNETTE) {
      return stripLeadingNonCanonicalScenario2BeforeCanonical(text);
    }
    return text;
  }

  for (const startRe of startRes) {
    for (const endRe of endRes) {
      const span = locateSpan(text, startRe, endRe);
      if (span) return replaceSpan(text, span, canonical);
    }
  }

  for (const startRe of startRes) {
    const startMatch = startRe.exec(text);
    if (!startMatch) continue;
    const openingIdx = findVignetteEndIndexBeforeOpening(text, startMatch.index, canonicalOpening);
    if (openingIdx != null && openingIdx > startMatch.index + 20) {
      return replaceSpan(text, { start: startMatch.index, end: openingIdx }, canonical);
    }
  }

  return text;
}

function findVignetteEndIndexBeforeOpening(text: string, startIndex: number, canonicalOpening: string): number | null {
  const canonicalOpeningIdx = text.lastIndexOf(canonicalOpening);
  if (canonicalOpeningIdx > startIndex) return canonicalOpeningIdx;
  const relativeOpeningIdx = findEarliestScenarioOpeningIndex(text.slice(startIndex));
  if (relativeOpeningIdx == null || relativeOpeningIdx <= 0) return null;
  return startIndex + relativeOpeningIdx;
}

function ensureFullCanonicalVignetteBeforeOpening(
  text: string,
  contains: (t: string) => boolean,
  canonicalVignette: string,
  canonicalOpening: string,
  vignetteStartRes: RegExp,
): string {
  if (!contains(text)) return text;
  if (text.includes(canonicalVignette)) return text;
  const startMatch = vignetteStartRes.exec(text);
  if (!startMatch) return text;
  const openingIdx = findVignetteEndIndexBeforeOpening(text, startMatch.index, canonicalOpening);
  if (openingIdx == null || openingIdx <= startMatch.index) return text;
  return replaceSpan(text, { start: startMatch.index, end: openingIdx }, canonicalVignette);
}

const SCENARIO_VIGNETTE_START: Record<string, RegExp> = {
  'Situation 1': /\bEmma and Ryan\b/i,
  'Situation 2': /\bSarah (?:and James|has been)\b/i,
  'Situation 3': /\bSophie and Daniel\b/i,
};

function findScenario2FictionStartIndex(text: string): number {
  const patterns = [
    /\bSarah has been job hunting\b/i,
    /\bSarah has been looking for work\b/i,
    /\bSarah was looking for work\b/i,
    /\bSarah has been planning a birthday\b/i,
    /\bSarah and James have been together\b/i,
    /\bSarah and James\b/i,
    /\bSarah has been feeling underappreciated\b/i,
    /\bSarah has been working late\b/i,
  ];
  let earliest = -1;
  for (const re of patterns) {
    const m = re.exec(text);
    if (!m) continue;
    if (earliest < 0 || m.index < earliest) earliest = m.index;
  }
  return earliest;
}

/** When the model concatenates duplicate S2 fiction before the canonical vignette, keep transition + canonical only. */
function stripLeadingNonCanonicalScenario2BeforeCanonical(text: string): string {
  const canonicalIdx = text.indexOf(SCENARIO_B_VIGNETTE);
  if (canonicalIdx <= 0) return text;
  const prefix = text.slice(0, canonicalIdx);
  const fictionStart = findScenario2FictionStartIndex(prefix);
  if (fictionStart < 0) return text;
  const transition = prefix.slice(0, fictionStart).trimEnd();
  const rest = text.slice(canonicalIdx).trimStart();
  return transition ? `${transition}\n\n${rest}`.trim() : rest;
}

function rewriteDetectedScenarioFictionForTts(text: string): string {
  const scenario = detectActiveScenarioFromMessage(text);
  if (!scenario || scenario.label === 'Personal reflection') return text;
  const canonicalVignette = scenario.text.trim();
  const canonicalOpening = getSituationOpeningQuestion(scenario);
  if (!canonicalVignette) return text;

  if (text.includes(canonicalVignette) && (!canonicalOpening || text.includes(canonicalOpening))) {
    if (scenario.label === 'Situation 2') {
      return stripLeadingNonCanonicalScenario2BeforeCanonical(text);
    }
    return text;
  }

  const startRe = SCENARIO_VIGNETTE_START[scenario.label];
  if (!startRe) return text;
  const startMatch = startRe.exec(text);
  // Reflections that name Sarah/James without a vignette opener must not become the full card.
  if (!startMatch) return text;

  let openingIdx = canonicalOpening ? text.lastIndexOf(canonicalOpening) : -1;
  if (openingIdx < startMatch.index) {
    const relativeOpeningIdx = canonicalOpening
      ? findVignetteEndIndexBeforeOpening(text, startMatch.index, canonicalOpening)
      : null;
    openingIdx = relativeOpeningIdx ?? -1;
  }

  const prefix = text.slice(0, startMatch.index).trimEnd();
  if (openingIdx > startMatch.index && canonicalOpening) {
    const suffix = text.slice(openingIdx + canonicalOpening.length).trimStart();
    const body = `${canonicalVignette}\n\n${canonicalOpening}`;
    return suffix ? `${prefix}${prefix ? '\n\n' : ''}${body}\n\n${suffix}`.trim() : `${prefix}${prefix ? '\n\n' : ''}${body}`.trim();
  }

  return `${prefix}${prefix ? '\n\n' : ''}${canonicalVignette}`.trim();
}

function substituteCanonicalScenarioOpeningQuestionForTts(text: string): string {
  const scenario = detectActiveScenarioFromMessage(text);
  if (!scenario) return text;
  const canonicalOpening = getSituationOpeningQuestion(scenario);
  if (!canonicalOpening) return text;
  const extracted = extractScenarioModalQuestionFromAssistantText(text);
  if (!extracted || looksLikeCanonicalScenarioOpeningQuestion(extracted)) return text;
  if (
    looksLikeScenarioBJamesDifferentlyQuestion(extracted) ||
    looksLikeScenarioBRepairAsJamesQuestion(extracted)
  ) {
    return text;
  }
  const idx = text.lastIndexOf(extracted);
  if (idx < 0) return text;
  return text.slice(0, idx) + canonicalOpening + text.slice(idx + extracted.length);
}

function looksLikeMoment4GrudgePromptForTts(text: string): boolean {
  if (looksLikeMoment4GrudgePrompt(text)) return true;
  const t = (text ?? '').toLowerCase();
  return (
    (t.includes("really didn't like") && t.includes('someone')) ||
    (t.includes('held a grudge') && t.includes('someone')) ||
    (t.includes('hard time with') && t.includes('someone'))
  );
}

function findMoment4GrudgePromptStartIndex(text: string): number {
  const patterns = [
    /\bThink of someone you(?:'ve| have) had a really hard time with\b/i,
    /\bThink about someone you(?:'ve| have) had a really hard time with\b/i,
    /\bHave you ever held a grudge\b/i,
    /\bThink of someone you(?:'ve| have) really didn't like\b/i,
    /\bThink about someone you really didn't like\b/i,
    /\bThink of someone who got under your skin\b/i,
    /\bIs there someone in your life\b/i,
    /\bsomeone from your past\b/i,
    /\bNow I want to ask you about something\b/i,
  ];
  for (const re of patterns) {
    const m = re.exec(text);
    if (m) return m.index;
  }
  return -1;
}

function substituteMoment4GrudgeCardForTts(text: string): string {
  if (!looksLikeMoment4GrudgePromptForTts(text)) return text;
  const canonical = MOMENT_4_GRUDGE_QUESTION_TEXT;
  if (normalizeForCanonicalCompare(text) === normalizeForCanonicalCompare(canonical)) return text;
  if (text.includes(canonical)) return text;

  const grudgeStart = findMoment4GrudgePromptStartIndex(text);
  if (grudgeStart >= 0) {
    const prefix = text.slice(0, grudgeStart).trimEnd();
    return prefix ? `${prefix}\n\n${canonical}` : canonical;
  }

  const prefixFromStream = extractShowScenarioCardTransitionPrefix(text, 'moment_4');
  if (prefixFromStream) {
    return `${prefixFromStream}\n\n${canonical}`;
  }

  if (text.length <= 220) return canonical;
  return text;
}

function findMoment5ConflictQuestionStartIndex(text: string): number {
  const patterns = [
    /\bThink of a time when you had a conflict with someone important to you\b/i,
    /\bThink of a time when you had a conflict with someone important\b/i,
    /\bTell me about a specific conflict with someone important\b/i,
    /\bTell me about a time you had a conflict\b/i,
  ];
  for (const re of patterns) {
    const m = re.exec(text);
    if (m) return m.index;
  }
  return -1;
}

function substituteMoment5ConflictQuestionForTts(text: string): string {
  const isMoment5Conflict =
    spokenTextStartsMoment5PrimaryConflictQuestion(text) ||
    transcriptAssistantContainsMoment5PrimaryConflictQuestion(text);
  if (!isMoment5Conflict) return text;

  const canonical = MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT;
  if (normalizeForCanonicalCompare(text) === normalizeForCanonicalCompare(canonical)) return text;
  if (text.includes(canonical)) return text;

  const conflictStart = findMoment5ConflictQuestionStartIndex(text);
  if (conflictStart >= 0) {
    const prefix = text.slice(0, conflictStart).trimEnd();
    return prefix ? `${prefix}\n\n${canonical}` : canonical;
  }

  const prefixFromStream = extractShowScenarioCardTransitionPrefix(text, 'moment_5');
  if (prefixFromStream) {
    return `${prefixFromStream}\n\n${canonical}`;
  }

  if (text.length <= 220) return canonical;
  return text;
}

/**
 * Replace paraphrased scenario vignettes and scripted personal prompts with canonical copy
 * (same strings as the Show Scenario reference card) before ElevenLabs TTS.
 */
export function substituteCanonicalInterviewScenarioBodiesForTts(text: string): string {
  if (!text.trim()) return text;

  let out = text;

  out = replaceVignetteBody(
    out,
    textContainsScenarioAVignetteBody,
    SCENARIO_1_VIGNETTE,
    SCENARIO_1_OPENING,
    [/\bEmma and Ryan\b/i, /\bRyan takes a call from his mother\b/i],
    [/(?:you(?:'ve| have)|he has|she has) made that very clear\.?/i],
  );
  out = ensureFullCanonicalVignetteBeforeOpening(
    out,
    textContainsScenarioAVignetteBody,
    SCENARIO_1_VIGNETTE,
    SCENARIO_1_OPENING,
    /\bEmma and Ryan\b/i,
  );

  out = replaceVignetteBody(
    out,
    textContainsScenarioBVignetteBody,
    SCENARIO_B_VIGNETTE,
    SCENARIO_2_OPENING,
    [/\bSarah and James\b/i, /\bSarah has been\b/i, /\bShe gets an offer\b/i],
    [
      /(?:A )?fight starts\.?/i,
      /fight starts\.?/i,
      /hey don't cry[^.?!]*[.?!]/i,
      /Sarah tears up\.?/i,
      /What do you think is going on here\??/i,
    ],
  );
  out = ensureFullCanonicalVignetteBeforeOpening(
    out,
    textContainsScenarioBVignetteBody,
    SCENARIO_B_VIGNETTE,
    SCENARIO_2_OPENING,
    /\bSarah (?:and James|has been)\b/i,
  );

  out = replaceVignetteBody(
    out,
    textContainsScenarioCVignetteBody,
    SCENARIO_3_VIGNETTE,
    SCENARIO_3_OPENING,
    [
      /\bSophie and Daniel\b/i,
      /\bSophie and Daniel keep\b/i,
      /\bSophie and Daniel have been together\b/i,
    ],
    [
      /Sophie is still upset\.?/i,
      /Sophie is still angry\.?/i,
      /didn'?t know how[^.?!]*[.?!]/i,
      /didn'?t know what to say[^.?!]*[.?!]/i,
      /needs space to[^.?!]*[.?!]/i,
      /feels abandoned[^.?!]*[.?!]/i,
      /What do you make of that\??/i,
      /What(?:'s| is) going on (?:here|between them)\??/i,
    ],
  );
  out = ensureFullCanonicalVignetteBeforeOpening(
    out,
    textContainsScenarioCVignetteBody,
    SCENARIO_3_VIGNETTE,
    SCENARIO_3_OPENING,
    /\bSophie and Daniel\b/i,
  );

  out = substituteCanonicalScenarioOpeningQuestionForTts(out);
  out = rewriteDetectedScenarioFictionForTts(out);
  out = substituteMoment4GrudgeCardForTts(out);
  out = substituteMoment5ConflictQuestionForTts(out);

  const showScenarioKind = detectShowScenarioCardKind(out);
  if (showScenarioKind) {
    const canonicalBody = buildCanonicalShowScenarioCardTtsBody(showScenarioKind);
    if (!out.includes(canonicalBody)) {
      const rebuilt = buildCanonicalShowScenarioCardTtsFromStream(out);
      if (rebuilt) out = rebuilt;
    }
  }

  return out;
}

/** @internal test hooks */
export const __substituteCanonicalInterviewScenarioBodiesForTtsTest = {
  textContainsScenarioAVignetteBody,
  substituteCanonicalScenarioOpeningQuestionForTts,
  substituteMoment4GrudgeCardForTts,
  substituteMoment5ConflictQuestionForTts,
  stripLeadingNonCanonicalScenario2BeforeCanonical,
  SCENARIO_1_OPENING,
  SCENARIO_2_OPENING,
  SCENARIO_3_OPENING,
};
