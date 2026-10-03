import { textContainsScenarioBVignetteBody } from './emotionScenarioTransitionInference';
import { isInterviewCanonicalProbeRetired } from './interviewCanonicalProbeRegistry';
import { normalizeApostrophes } from './disengagementProbeNormalize';
import { looksLikeUnassessableScenarioAnswer } from './interviewAnswerRelevance';
import { scenarioARepairAnswerAlreadySatisfiedInTranscript } from './interviewRepairRefusalDetection';
import {
  stripSkipAcceptedNextQuestionBridge,
  withSkipAcceptedNextQuestionBridgePreserved,
} from './skipAcceptedNextQuestionBridge';
import {
  SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY,
  SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY,
} from './scenarioAContemptProbeCopy';
import {
  transcriptContainsScenarioAContemptProbe,
  transcriptHasUserResponseAfterScenarioAContemptProbe,
  userIsAnsweringAfterStreamDeliveredScenarioAContemptProbe,
  type ScenarioFollowUpTranscriptMessage,
} from './scenarioFollowUpTranscriptGuard';
import { SCENARIO_C_SOPHIE_PERSPECTIVE_PROBE } from './interviewDisengagementProbeCopy';
import { coerceScenarioCBoundaryHandoffForTts, SCENARIO_C_REPAIR_QUESTION_CANONICAL } from './scenarioCPromptDetection';
import { coerceMoment4ThresholdQuestionForTts } from './moment4ProbeLogic';
import { coerceScenarioCRepairQuestionForTts, isScenarioCRepairAssistantPrompt } from './scenarioCPromptDetection';
import { coerceIncompleteInterviewClosingForTts } from './elongatingProbe';
import { looksLikeScenarioAContemptProbeQuestion } from './scenarioAContemptProbeTextMatch';
import {
  coerceScenarioBJamesRepairQuestionForTts,
  isIncompleteScenarioBJamesRepairLeadSentence,
  looksLikeScenarioBJamesDifferentlyQuestion,
  looksLikeScenarioBLegacyThirdPersonJamesRepairQuestion,
  looksLikeScenarioBRepairAsJamesQuestion,
  SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL,
  SCENARIO_B_Q1_CANONICAL,
} from './scenarioBProbeLogic';
import { stripBriefInterviewAcknowledgmentPrefixForRepeat } from './interviewRepeatRequestTarget';

const DANGLING_INTERVIEW_REPEAT_LEAD_RE =
  /\b(?:of course|got it|no problem),?\s+i said\s*[—–-]\s*(?:this)?\??\s*$/i;

/** Incomplete "Of course, I said — this?" tail after repair-question dedup strips the repeat body. */
export function isDanglingInterviewRepeatLeadFragment(text: string): boolean {
  const t = (text ?? '').replace(/\s+/g, ' ').trim();
  if (!t) return false;
  if (looksLikeScenarioARepairQuestion(t)) return false;
  return DANGLING_INTERVIEW_REPEAT_LEAD_RE.test(t);
}

export function stripDanglingInterviewRepeatLeadFragment(text: string): string {
  const t0 = (text ?? '').replace(/\s+/g, ' ').trim();
  if (!t0) return text;
  const stripped = t0.replace(DANGLING_INTERVIEW_REPEAT_LEAD_RE, '').trim();
  return cleanupScenarioWrapAfterRepairStrip(stripped);
}

/** After repair dedup removed the embedded ask, restore a complete redirect + canonical repair question. */
export function repairAssistantDraftAfterDanglingRepeatLead(text: string): string {
  if (!isDanglingInterviewRepeatLeadFragment(text)) return text;
  const before = text;
  const cleaned = stripDanglingInterviewRepeatLeadFragment(text).trim();
  const repaired = !cleaned
    ? SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY
    : looksLikeScenarioARepairQuestion(cleaned) || /\?\s*$/.test(cleaned)
      ? cleaned
      : `${cleaned.replace(/[.!?…]+\s*$/, '').trim()}. ${SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY}`.trim();
  return repaired;
}

/** Scenario A repair-as-Ryan (canonical + paraphrases aligned with interviewerFrameworkPrompt). */
export function looksLikeScenarioARepairQuestion(text: string): boolean {
  const t = normalizeApostrophes(text).toLowerCase();
  const hasRyanPerspective = /\b(what if you were ryan|so if you were ryan|and if you were ryan|if you were ryan|you were ryan|as ryan)\b/.test(
    t,
  );
  const hasRepairVerb = /\brepair(?:ing|ed)?\b/.test(t) || /\bgo about repair(?:ing|ed)?\b/.test(t);
  const ryanRepair =
    hasRyanPerspective &&
    hasRepairVerb &&
    (/\b(situation|relationship|this|off)\b/.test(t) || t.length < 120);
  /** Retired repair-as-Ryan paraphrases that omit the word "repair" (e.g. "As Ryan, how would you respond…"). */
  const ryanRoleplayRespond =
    hasRyanPerspective &&
    /\bhow would you\b/.test(t) &&
    /\b(respond|reply|answer|react|handle|say)\b/.test(t);
  return (
    t.includes('how would you repair this relationship if you were ryan') ||
    t.includes('how would you repair this as ryan') ||
    t.includes('how would you repair things as ryan') ||
    t.includes('repair things as ryan') ||
    t.includes('if you were ryan, how would you repair') ||
    (t.includes('if you were ryan') && t.includes('repair this relationship')) ||
    (hasRyanPerspective && /\bhow would you go about repair(?:ing|ed)?\b/.test(t)) ||
    ryanRepair ||
    ryanRoleplayRespond
  );
}

/**
 * Retired Ryan repair asks must not play during Scenario B.
 * A normal Situation 2 answer is not a jump ahead — continue to James-differently.
 * Returns '' to drop the leak when Q2 is already asked, or null when this is not that leak.
 */
export function coerceRetiredScenarioARepairLeakDuringScenarioB(args: {
  spoken: string;
  scenario: number | null | undefined;
  moment: number;
  messages: readonly { role: string; content?: string | null }[];
}): string | null {
  if ((args.scenario ?? 0) < 2 || args.moment !== 2) return null;
  const spoken = (args.spoken ?? '').replace(/\s+/g, ' ').trim();
  if (
    !looksLikeScenarioARepairQuestion(spoken) &&
    !looksLikeScenarioARepairStreamFragment(spoken)
  ) {
    return null;
  }
  const corpus = args.messages.map((m) => m.content ?? '').join('\n');
  // Refs can jump to scenario 2 while the participant is still answering the contempt probe.
  if (!textContainsScenarioBVignetteBody(corpus)) return null;
  const jamesDifferentlyAsked = args.messages.some(
    (m) => m.role === 'assistant' && looksLikeScenarioBJamesDifferentlyQuestion(m.content ?? ''),
  );
  if (jamesDifferentlyAsked) return '';
  return `Got it. ${SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL}`;
}

/** TTS + Show scenario modal copy for the Ryan repair ask (matches {@link SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY}). */
export function coerceScenarioARepairQuestionForTts(text: string): string {
  return withSkipAcceptedNextQuestionBridgePreserved(text, (raw) => {
  const t = (raw ?? '').replace(/\s+/g, ' ').trim();
  if (!t) return raw;
  // Retired probe: never reintroduce the Ryan repair ask — drop fragments entirely.
  if (isInterviewCanonicalProbeRetired('s1_repair')) {
    if (
      looksLikeScenarioARepairQuestion(t) ||
      looksLikeScenarioARepairStreamFragment(t) ||
      looksLikeScenarioARepairReAskQuestion(t) ||
      isIncompleteScenarioARepairLeadSentence(t) ||
      isTruncatedScenarioRepairQuestion(t) ||
      isOrphanScenarioARepairEmmaTailFragment(t) ||
      /\bthis with emma\?/i.test(t) ||
      /\brepair this with emma\b/i.test(t)
    ) {
      return '';
    }
    return raw;
  }
  // Preserve the second repair re-ask — coercing to the canonical first ask triggers duplicate_consecutive TTS suppression.
  if (looksLikeScenarioARepairReAskQuestion(t)) {
    return raw;
  }
  if (
    looksLikeScenarioARepairQuestion(t) ||
    isIncompleteScenarioARepairLeadSentence(t) ||
    isTruncatedScenarioRepairQuestion(t) ||
    looksLikeScenarioARepairStreamFragment(t) ||
    isOrphanScenarioARepairEmmaTailFragment(t)
  ) {
    return SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY;
  }
  const low = normalizeApostrophes(t).toLowerCase();
  if (/\b(as ryan|if you were ryan)\b/.test(low) && /\brepair\b/.test(low)) {
    return SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY;
  }
  if (/\bhow would you repair this with\b/.test(low) && /\bryan\b/.test(low)) {
    return SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY;
  }
  return raw;
  });
}

/** S1→S2 boundary reflections often include "makes sense" + Emma — not repair asks. */
export function shouldSkipScenarioARepairDraftNormalization(draft: string): boolean {
  const t = (draft ?? '').replace(/\s+/g, ' ').trim();
  if (!t) return true;
  const low = normalizeApostrophes(t).toLowerCase();
  if (textContainsScenarioBVignetteBody(t)) return true;
  if (/\b(next situation|here'?s the next|third situation|two more situations)\b/.test(low)) {
    return true;
  }
  if (/\b(that'?s a wrap|wrap on (?:that|this) (?:one|situation))\b/.test(low)) {
    return true;
  }
  if (/\b(good work|nice work)\b/.test(low) && /\b(next situation|here'?s the next)\b/.test(low)) {
    return true;
  }
  return false;
}

/** Coerce truncated S1 repair fragments in assistant draft/transcript text before persist. */
export function normalizeScenarioARepairQuestionInAssistantDraft(draft: string): string {
  const t = (draft ?? '').replace(/\s+/g, ' ').trim();
  if (!t) return draft;
  if (isInterviewCanonicalProbeRetired('s1_repair')) {
    if (
      looksLikeScenarioARepairStreamFragment(t) ||
      looksLikeScenarioARepairQuestion(t) ||
      looksLikeScenarioARepairReAskQuestion(t) ||
      isIncompleteScenarioARepairLeadSentence(t) ||
      isTruncatedScenarioRepairQuestion(t) ||
      isOrphanScenarioARepairEmmaTailFragment(t) ||
      /\bthis with emma\?/i.test(t) ||
      /\bwith emma\?/i.test(t) ||
      /\brepair this with emma\b/i.test(t) ||
      isDanglingInterviewRepeatLeadFragment(t)
    ) {
      const stripped = cleanupScenarioWrapAfterRepairStrip(
        stripEmbeddedScenarioARepairQuestionAsk(stripScenarioARepairQuestion(t)),
      );
      if (
        !stripped ||
        looksLikeScenarioARepairQuestion(stripped) ||
        looksLikeScenarioARepairStreamFragment(stripped) ||
        looksLikeScenarioARepairReAskQuestion(stripped) ||
        isIncompleteScenarioARepairLeadSentence(stripped) ||
        isTruncatedScenarioRepairQuestion(stripped) ||
        isOrphanScenarioARepairEmmaTailFragment(stripped) ||
        /\bthis with emma\?/i.test(stripped) ||
        /\bwith emma\?/i.test(stripped) ||
        isDanglingInterviewRepeatLeadFragment(stripped)
      ) {
        return '';
      }
      return stripped;
    }
    return draft;
  }
  if (shouldSkipScenarioARepairDraftNormalization(t)) return draft;
  if (looksLikeScenarioARepairReAskQuestion(t)) return draft;
  if (
    looksLikeScenarioARepairStreamFragment(t) ||
    looksLikeScenarioARepairQuestion(t) ||
    isIncompleteScenarioARepairLeadSentence(t) ||
    isTruncatedScenarioRepairQuestion(t)
  ) {
    return coerceScenarioARepairQuestionForTts(t);
  }
  if (/\bthis with emma\?/i.test(t) || /\brepair this with emma\b/i.test(t)) {
    return coerceScenarioARepairQuestionForTts(t);
  }
  if (isDanglingInterviewRepeatLeadFragment(t)) {
    return repairAssistantDraftAfterDanglingRepeatLead(t);
  }
  return draft;
}

/** Scenario A second repair ask after the canonical Ryan repair question (model paraphrase). */
export function looksLikeScenarioARepairReAskQuestion(text: string): boolean {
  const t = normalizeApostrophes(text).toLowerCase();
  if (/\bhow would you make that repair actually happen\b/.test(t)) return true;
  if (/\bwhat would that repair look like\b/.test(t) && /\bryan\b/.test(t)) return true;
  if (/\bmake that repair actually happen\b/.test(t) && /\bryan\b/.test(t)) return true;
  if (/\bwhat would you (actually )?do\b/.test(t) && /\bryan\b/.test(t) && /\brepair\b/.test(t)) {
    return true;
  }
  return false;
}

/** Orphan Emma-tail left when a repair stem is stripped mid-phrase (e.g. "Got it. with Emma?"). */
export function isOrphanScenarioARepairEmmaTailFragment(text: string): boolean {
  const t = (text ?? '').replace(/\s+/g, ' ').trim();
  if (!t) return false;
  const low = normalizeApostrophes(t).toLowerCase();
  if (/^with emma\??$/i.test(low)) return true;
  if (
    /^(?:got it|okay|ok|makes sense|fair|right|understood|alright|i hear you)\.?\s+with emma\??$/i.test(
      low,
    )
  ) {
    return true;
  }
  return false;
}

/** Remove a glued Scenario A repair ask from a longer paragraph (model echo / stacked asks). */
export function stripEmbeddedScenarioARepairQuestionAsk(draft: string): string {
  const t0 = (draft ?? '').trim();
  if (!t0) return draft;
  let t = t0;
  const patterns: RegExp[] = [
    // Include optional "with Emma" / "things with Emma" — otherwise strip leaves "Got it. things".
    /\bIf you were Ryan, how would you repair this(?:\s+with\s+Emma)?\??\s*/gi,
    /\bIf you were Ryan, how would you (?:actually )?repair things with Emma(?:\s+after this)?\??\s*/gi,
    /\bHow would you repair this relationship if you were Ryan\??\s*/gi,
    /\bWhat if you were Ryan\??\s*How would you repair this (?:situation|relationship)\??\s*/gi,
    // Greedy to the ask terminator so "repair things with Emma?" is not left as "things".
    /\bIf you were Ryan[^.!?\n]*\brepair(?:ing|ed)?[^.!?\n]*[?.!]?\s*/gi,
    /\bHow would you repair this (?:situation|relationship)?(?:\s+with\s+Emma)?\??\s*/gi,
    /\bHow would you (?:actually )?repair things with Emma(?:\s+after this)?\??\s*/gi,
    /\bHow would you repair things as Ryan\??\s*/gi,
    /\b(?:As|If you were) Ryan,?\s+how would you (?:respond|reply|answer|react|handle|say)\b[^.!?\n]*\??\s*/gi,
  ];
  let prev = '';
  while (prev !== t) {
    prev = t;
    for (const re of patterns) {
      t = t.replace(re, '').replace(/\s{2,}/g, ' ').trim();
    }
  }
  t = t
    .replace(/^\s*[.,;—–\-–]\s*/g, '')
    .replace(/\s+[.,;—–\-–]\s*$/g, '')
    .trim();
  // Drop orphan Emma tails left when a longer stem matched incompletely.
  if (isOrphanScenarioARepairEmmaTailFragment(t)) {
    return '';
  }
  t = t.replace(/\bwith emma\??\s*$/i, '').replace(/\s{2,}/g, ' ').trim();
  return t.replace(/\s+[.,;—–\-–]\s*$/g, '').trim();
}

/** After stripping a glued repair ask from a scenario wrap, remove dangling "and" / dash tails. */
export function cleanupScenarioWrapAfterRepairStrip(text: string): string {
  return (text ?? '')
    .replace(/\s+\band\s*$/i, '')
    .replace(/\s+[—–-]\s*$/g, '')
    .trim();
}

/** Strip Scenario A repair-as-Ryan blocks so a forced contempt probe is the only substantive assistant line. */
export function stripScenarioARepairQuestion(text: string): string {
  let cleaned = text
    .replace(/(?:^|\n)\s*How would you repair this relationship if you were Ryan\?\s*/gi, '\n')
    .replace(
      /(?:^|\n)\s*What if you were Ryan\?[^\n]*How would you repair this (?:situation|relationship)\??\s*/gi,
      '\n',
    )
    .replace(
      /(?:^|\n)\s*If you were Ryan[^.!?\n]*\brepair(?:ing|ed)?[^.!?\n]*(?:\s+with\s+Emma)?[?.!]?\s*/gi,
      '\n',
    )
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  cleaned = stripEmbeddedScenarioARepairQuestionAsk(cleaned);
  if (isOrphanScenarioARepairEmmaTailFragment(cleaned)) {
    return '';
  }
  return cleaned.replace(/\n{3,}/g, '\n\n').trim();
}

const RETIRED_REPAIR_BRIEF_ACK_ONLY =
  /^(?:got it|okay|ok|makes sense|fair|right|understood|alright|i hear you)\.?$/i;

/**
 * Retired s1_repair must not be spoken or stored.
 * "Got it. How would you repair things as Ryan?" becomes empty (ack-only remainder dropped).
 */
export function omitRetiredScenarioARepairAsk(text: string): string {
  const original = text ?? '';
  const t = original.replace(/\s+/g, ' ').trim();
  if (!t || !isInterviewCanonicalProbeRetired('s1_repair')) return original;
  if (
    !looksLikeScenarioARepairQuestion(t) &&
    !looksLikeScenarioARepairStreamFragment(t) &&
    !looksLikeScenarioARepairReAskQuestion(t)
  ) {
    return original;
  }
  const stripped = stripEmbeddedScenarioARepairQuestionAsk(stripScenarioARepairQuestion(t))
    .replace(/\s+/g, ' ')
    .trim();
  if (!stripped || RETIRED_REPAIR_BRIEF_ACK_ONLY.test(stripped)) return '';
  return stripped;
}

/**
 * Streaming TTS often splits on the `?` after "What if you were Ryan?" before the repair tail arrives.
 * Hold the Ryan lead clause until the next flushed sentence can complete the repair ask.
 */
export function isIncompleteScenarioARepairLeadSentence(text: string): boolean {
  const t = normalizeApostrophes(text).trim().toLowerCase();
  if (!t || looksLikeScenarioARepairQuestion(text)) return false;
  const hasRyanLead = /\b(what if you were ryan|so if you were ryan|and if you were ryan|if you were ryan)\b/.test(
    t,
  );
  if (!hasRyanLead) return false;
  if (/\brepair(?:ing|ed)?\b/.test(t) || /\bgo about repair(?:ing|ed)?\b/.test(t)) return false;
  return true;
}

/**
 * Streaming may flush after "repair" but before the ask finishes — no `?`, dangling preposition tail.
 */
export function isTruncatedScenarioRepairQuestion(text: string): boolean {
  const t = (text ?? '').replace(/\s+/g, ' ').trim();
  if (!t || /\?\s*$/.test(t)) return false;
  const low = normalizeApostrophes(t).toLowerCase();
  if (!/\brepair(?:ing|ed)?\b/.test(low)) return false;
  const hasRepairPerspectiveCue =
    (/\bryan\b/.test(low) && /\b(if you were|you were|as ryan)\b/.test(low)) ||
    (/\bjames\b/.test(low) && /\b(if you were|you were|as james)\b/.test(low));
  if (!hasRepairPerspectiveCue) return false;
  if (looksLikeScenarioARepairQuestion(text) || looksLikeScenarioBRepairAsJamesQuestion(text)) {
    return true;
  }
  return /\b(in|and|with|to|for|that|the|a|an|actually|things|now that)\s*$/i.test(t);
}

/** Brief ack glued before a truncated repair ask (Ryan or James). */
export function extractBriefAckBeforeTruncatedRepairProbe(text: string): string | null {
  const t = (text ?? '').replace(/\s+/g, ' ').trim();
  const m = t.match(
    /^((?:got it|that'?s (?:a )?real read on it|good read|great read|nice work|that makes sense|you(?:'re| are) seeing that|i hear you|makes sense)[^.!?]{0,80})[\.,!]?\s+(?:and\s+)?(?:if you were (?:ryan|james)|how would you)\b/i,
  );
  const ack = m?.[1]?.trim();
  return ack ? ack.replace(/\.$/, '') : null;
}

function isScenarioAConstructProbeContext(
  currentScenario: number | null | undefined,
  currentMoment: number,
): boolean {
  if (currentScenario === 1) return true;
  return currentMoment === 1 && (currentScenario == null || currentScenario <= 1);
}

/** Truncated repair tail from parallel streaming (may omit "Ryan"/"repair" after sentence split). */
export function looksLikeScenarioARepairStreamFragment(text: string): boolean {
  const t = (text ?? '').replace(/\s+/g, ' ').trim();
  if (!t) return false;
  if (
    looksLikeScenarioARepairQuestion(t) ||
    isIncompleteScenarioARepairLeadSentence(t) ||
    isTruncatedScenarioRepairQuestion(t)
  ) {
    return true;
  }
  const low = normalizeApostrophes(t).toLowerCase();
  if (
    /\b(things with emma(?:\s+after this)?|repair things with emma|with emma after this)\b/.test(
      low,
    )
  ) {
    return true;
  }
  if (/^(?:now,?\s+)?things with emma\??$/i.test(t)) {
    return true;
  }
  if (/\bmakes sense\b/.test(low) && /\bemma\b/.test(low)) {
    return !shouldSkipScenarioARepairDraftNormalization(t);
  }
  if (/\bthis with emma\b/.test(low) || /\brepair this with emma\b/.test(low)) {
    return true;
  }
  if (isOrphanScenarioARepairEmmaTailFragment(t)) {
    return true;
  }
  if (/\bhow would you\b/.test(low) && /\bemma\b/.test(low) && /\?\s*$/.test(t)) {
    return true;
  }
  /** Sentence-boundary split after "Got it." — tail may be only "this?" with no Ryan/repair verbs. */
  if (/^this\??$/i.test(low)) {
    return true;
  }
  if (/^(?:got it|okay|ok|makes sense|fair|right|understood|alright)\.\s*this\??$/i.test(low)) {
    return true;
  }
  if (/^how would you (?:go about )?repair(?:ing|ed)? this\??$/i.test(low)) {
    return true;
  }
  if (/\bhow would you\b/.test(low) && /\bryan\b/.test(low) && /\brepair\b/.test(low)) {
    return true;
  }
  if (/\brepair this as ryan\b/.test(low)) {
    return true;
  }
  return false;
}

/** True when parallel-stream or respeak logic already delivered any Scenario A repair ask (canonical or paraphrase). */
export function spokenTextContainsScenarioARepairQuestion(text: string): boolean {
  const t = (text ?? '').replace(/\s+/g, ' ').trim();
  if (!t) return false;
  if (looksLikeScenarioARepairStreamFragment(t) || looksLikeScenarioARepairQuestion(t)) {
    return true;
  }
  const segments = t.split(/(?<=[.!?])\s+/);
  if (segments.length <= 1) return false;
  return segments.some((segment) => {
    const s = segment.trim();
    return s.length > 0 && (looksLikeScenarioARepairStreamFragment(s) || looksLikeScenarioARepairQuestion(s));
  });
}

/** Drop parallel-stream batch text that leaked repair copy before the contempt probe is satisfied. */
export function clearParallelTtsBatchIfScenarioARepairLeakBeforeContempt(args: {
  batchText: string;
  suppressRepairBeforeContempt: boolean;
  streamContemptProbeMuteArmedFromStart: boolean;
}): { discarded: boolean; remaining: string } {
  const text = (args.batchText ?? '').replace(/\s+/g, ' ').trim();
  if (!text) {
    return { discarded: false, remaining: '' };
  }
  const shouldDiscard =
    args.streamContemptProbeMuteArmedFromStart ||
    (args.suppressRepairBeforeContempt &&
      (looksLikeScenarioARepairStreamFragment(text) ||
        (/\bmakes sense\b/i.test(text) && /\bemma\b/i.test(text)) ||
        /\b(if you were ryan|how would you repair|how would you go about repair)\b/i.test(text)));
  if (!shouldDiscard) {
    return { discarded: false, remaining: text };
  }
  return { discarded: true, remaining: '' };
}

/** Speak the Ryan repair probe after contempt is covered, and not before. */
export function shouldAllowScenarioARepairAfterContemptAnswer(params: {
  currentScenario: number | null | undefined;
  currentMoment: number;
  scenarioAContemptProbeAsked: boolean;
  scenarioARepairQuestionAsked: boolean;
  replyingToScenarioAQ1: boolean;
  specificEmmaLineAlreadyAddressed: boolean;
  shouldForceScenarioAContemptProbe: boolean;
  messagesToUse: readonly ScenarioFollowUpTranscriptMessage[];
  lastDeliveredQuestionText?: string | null;
  /** Latest user turn — when unassessable/off-topic, do not advance to repair. */
  userAnswer?: string | null;
}): boolean {
  if (isInterviewCanonicalProbeRetired('s1_repair')) return false;
  if (!isScenarioAConstructProbeContext(params.currentScenario, params.currentMoment)) return false;
  if (params.scenarioARepairQuestionAsked) return false;
  if (params.shouldForceScenarioAContemptProbe) return false;
  if (params.userAnswer && looksLikeUnassessableScenarioAnswer(params.userAnswer)) return false;
  const repairAlreadySpoken = params.messagesToUse.some(
    (m) => m.role === 'assistant' && looksLikeScenarioARepairQuestion(m.content ?? ''),
  );
  if (repairAlreadySpoken) return false;
  if (scenarioARepairAnswerAlreadySatisfiedInTranscript(params.messagesToUse)) return false;
  if (params.specificEmmaLineAlreadyAddressed) return true;
  return params.scenarioAContemptProbeAsked && !params.replyingToScenarioAQ1;
}

/** Block Ryan repair TTS until contempt is satisfied or the user already covered Emma's line in Q1. */
export function shouldSuppressScenarioARepairBeforeContemptAnswer(params: {
  currentScenario: number | null | undefined;
  currentMoment: number;
  shouldForceScenarioAContemptProbe: boolean;
  scenarioAContemptProbeSpokenThisStream: boolean;
  scenarioAContemptProbeAsked: boolean;
  specificEmmaLineAlreadyAddressed: boolean;
  scenarioARepairQuestionAsked: boolean;
  allowScenarioARepairAfterContemptAnswer?: boolean;
}): boolean {
  if (!isScenarioAConstructProbeContext(params.currentScenario, params.currentMoment)) {
    return false;
  }
  if (params.scenarioARepairQuestionAsked) return false;
  if (params.allowScenarioARepairAfterContemptAnswer) return false;
  if (params.shouldForceScenarioAContemptProbe || params.scenarioAContemptProbeSpokenThisStream) {
    return true;
  }
  if (params.scenarioAContemptProbeAsked && !params.specificEmmaLineAlreadyAddressed) {
    return true;
  }
  return false;
}

/** Scenario B resume/repeat must not replay a Scenario A Ryan repair bleed from a truncated stream chunk. */
function coerceRepeatQuestionForActiveScenario(
  resolvedText: string,
  storedText: string,
  activeScenario?: number,
): string {
  if (activeScenario === 3) {
    if (isInterviewCanonicalProbeRetired('s3_repair')) {
      return resolvedText;
    }
    if (
      looksLikeScenarioARepairQuestion(resolvedText) ||
      looksLikeScenarioBRepairAsJamesQuestion(resolvedText) ||
      looksLikeScenarioBJamesDifferentlyQuestion(resolvedText)
    ) {
      return SCENARIO_C_REPAIR_QUESTION_CANONICAL;
    }
    return resolvedText;
  }
  if (activeScenario !== 2) return resolvedText;
  if (looksLikeScenarioAContemptProbeQuestion(resolvedText)) {
    return SCENARIO_B_Q1_CANONICAL;
  }
  const low = normalizeApostrophes(resolvedText).toLowerCase();
  const isScenarioARepairResolved =
    resolvedText === SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY ||
    looksLikeScenarioARepairQuestion(resolvedText) ||
    (/\bryan\b/.test(low) && /\brepair\b/.test(low));
  if (looksLikeScenarioBRepairAsJamesQuestion(resolvedText)) {
    return SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL;
  }
  if (!isScenarioARepairResolved) {
    return resolvedText;
  }
  const ack = extractBriefAckBeforeTruncatedRepairProbe(storedText);
  return ack ? `${ack}. ${SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL}` : SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL;
}

/** Expand truncated Ryan repair lead-ins and S3→M4 boundary wraps for repeat TTS. */
export function resolveInterviewQuestionRepeatTtsText(
  storedText: string,
  options?: {
    firstName?: string;
    lastUserAnswer?: string | null;
    activeScenario?: number;
  },
): string {
  const t = stripSkipAcceptedNextQuestionBridge((storedText ?? '').trim());
  if (!t) return t;
  // Check the original stored text before coerce strips/remaps retired probes.
  if (
    looksLikeScenarioBRepairAsJamesQuestion(t) ||
    isIncompleteScenarioBJamesRepairLeadSentence(t) ||
    looksLikeScenarioBLegacyThirdPersonJamesRepairQuestion(t)
  ) {
    if (options?.activeScenario === 3) {
      if (isInterviewCanonicalProbeRetired('s3_repair')) {
        return SCENARIO_C_SOPHIE_PERSPECTIVE_PROBE;
      }
      return SCENARIO_C_REPAIR_QUESTION_CANONICAL;
    }
    return SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL;
  }
  // Retired S1 repair: never re-speak the Ryan ask — remap bleed to contempt (S1) or active-scenario probe.
  if (
    isInterviewCanonicalProbeRetired('s1_repair') &&
    (looksLikeScenarioARepairQuestion(t) ||
      looksLikeScenarioARepairStreamFragment(t) ||
      looksLikeScenarioARepairReAskQuestion(t) ||
      isIncompleteScenarioARepairLeadSentence(t) ||
      isTruncatedScenarioRepairQuestion(t) ||
      isOrphanScenarioARepairEmmaTailFragment(t))
  ) {
    if (options?.activeScenario === 2 || options?.activeScenario === 3) {
      const remapped = coerceRepeatQuestionForActiveScenario(
        SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY,
        t,
        options?.activeScenario,
      );
      return stripBriefInterviewAcknowledgmentPrefixForRepeat(remapped);
    }
    return stripBriefInterviewAcknowledgmentPrefixForRepeat(SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY);
  }
  let resolved: string;
  if (isIncompleteScenarioARepairLeadSentence(t)) {
    resolved = coerceRepeatQuestionForActiveScenario(
      SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY,
      t,
      options?.activeScenario,
    );
  } else {
    resolved = coerceIncompleteInterviewClosingForTts(
      coerceMoment4ThresholdQuestionForTts(
        coerceScenarioCBoundaryHandoffForTts(t, options?.firstName ?? '', options?.lastUserAnswer),
      ),
      options?.firstName ?? '',
    );
    resolved = coerceScenarioARepairQuestionForTts(resolved);
    resolved = coerceScenarioBJamesRepairQuestionForTts(resolved);
    resolved = coerceScenarioCRepairQuestionForTts(resolved);
    resolved = coerceRepeatQuestionForActiveScenario(resolved, t, options?.activeScenario);
  }
  if (
    !resolved.trim() &&
    isInterviewCanonicalProbeRetired('s3_repair') &&
    (options?.activeScenario === 3 ||
      (options?.activeScenario == null && isScenarioCRepairAssistantPrompt(t)))
  ) {
    return SCENARIO_C_SOPHIE_PERSPECTIVE_PROBE;
  }
  // Repeat should re-ask the question only — not re-speak the prior answer acknowledgment.
  return stripBriefInterviewAcknowledgmentPrefixForRepeat(resolved);
}

/**
 * Parallel streaming TTS flushes by sentence before duplicate stripping on the full assistant turn.
 * When the Scenario A repair ask was already spoken, suppress model echoes in a flushed chunk.
 */
export function stripScenarioARepairQuestionStreamingEcho(
  spoken: string,
  repairAlreadyAsked: boolean,
): string | null {
  const t0 = (spoken ?? '').trim();
  if (!repairAlreadyAsked || !t0) {
    return t0;
  }
  if (looksLikeScenarioBRepairAsJamesQuestion(t0)) {
    return t0;
  }
  if (looksLikeScenarioARepairQuestion(t0)) {
    return null;
  }
  const stripped = stripEmbeddedScenarioARepairQuestionAsk(t0).trim();
  if (!stripped) {
    return null;
  }
  if (stripped !== t0) {
    return stripped;
  }
  const low = t0.toLowerCase();
  if (/\b(if you were ryan|what if you were ryan|so if you were ryan)\b/.test(low) && /\brepair(?:ing|ed)?\b/.test(low)) {
    return null;
  }
  if (
    /\bhow would you (?:go about )?repair(?:ing|ed)?\b/.test(low) &&
    /\b(situation|relationship|this|off)\b/.test(low)
  ) {
    return null;
  }
  return t0;
}
