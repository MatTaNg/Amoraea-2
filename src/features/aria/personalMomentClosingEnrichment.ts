import {
  buildTwoSentenceClosingWithoutObservation,
  closingAttributesUnsupportedAccountability,
  closingObservationFailsPillarGate,
  isVagueOrWeakClosingObservation,
  type ClosingPillarContext,
} from './closingReflectionGrounding';
import {
  coerceIncompleteInterviewClosingForTts,
  isIncompleteInterviewClosingForSpeak,
  isTruncatedPersonalMomentClosingReflection,
  looksLikeInterviewClosingAssistantMessage,
} from './elongatingProbe';
import {
  looksLikeInternalReflectionSchemaLeak,
  stripInternalReflectionSchemaLeak,
} from './interviewReflectionTextStrips';
import { dedupeDuplicateParticipantNameInClosing } from './interviewClosingLanguageSanitize';
import { INCLUDE_SCENARIO_BOUNDARY_REFLECTIONS } from './interviewTransitionBundles';
import {
  assembleClosingWithOptionalReflection,
  buildPersonalMomentHandoffReflection,
} from './personalMomentHandoffReflection';

const CLOSING_REFLECTION_STOPWORDS = new Set([
  'about',
  'after',
  'before',
  'being',
  'between',
  'carefully',
  'could',
  'focusing',
  'happened',
  'having',
  'really',
  'relationship',
  'something',
  'their',
  'there',
  'these',
  'those',
  'through',
  'turning',
  'which',
  'working',
  'would',
  'yourself',
]);

function normalizeClosingCompare(text: string): string {
  return (text ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
}

/**
 * True when a model closing reflection names content words the user never said
 * (e.g. "catching" when the user said "carrying" or neither).
 */
export function closingReflectionEchoesUngroundedUserWord(
  closing: string,
  userAnswer: string,
): boolean {
  const u = normalizeClosingCompare(userAnswer);
  if (!u || u.split(/\s+/).filter(Boolean).length < 5) return false;
  const c = normalizeClosingCompare(closing);
  if (!c) return false;
  if (/^\s*catching\?\s*$/i.test(c)) return true;
  const reflectiveSegment =
    c.match(
      /(?:what (?:i heard|i got|came through|landed for me) was that|it sounds like you)\s+([^]+?)(?:\.\s*(?:thank you|good work)|$)/i,
    )?.[1] ?? c;
  const words = reflectiveSegment.match(/\b[a-z]{5,}\b/g) ?? [];
  const contentWords = words.filter((w) => !CLOSING_REFLECTION_STOPWORDS.has(w));
  if (contentWords.length === 0) return false;
  const ungrounded = contentWords.filter((w) => !u.includes(w));
  if (ungrounded.some((w) => w.length >= 7)) return true;
  return ungrounded.length >= Math.max(2, Math.ceil(contentWords.length * 0.35));
}

function stripIncompleteClosingReflectionTail(ack: string): string {
  return ack
    .replace(/\s+what stuck\b.*$/i, '')
    .replace(/\s+what (?:stood|stands) out\b.*$/i, '')
    .replace(/\s+what you[.!?…]+\s*$/i, '')
    .replace(/\s+what you\s*$/i, '')
    .trim();
}

/** True when the closing is only task-ack + thanks with no substantive remembered detail. */
export function personalMomentClosingLacksConcreteAnchor(text: string): boolean {
  const raw = (text ?? '').replace(/\s+/g, ' ').trim();
  if (!raw) return true;
  if (
    /\b(stuck with me|stood out to me|landed for me|what i heard|what i got|came through|it sounds like you)\b/i.test(
      raw,
    )
  ) {
    return isVagueOrWeakClosingObservation(raw);
  }
  const t = raw.toLowerCase();
  const withoutThanks = t
    .replace(/\bthank you for being so open with me[^.?!]*[.?!]?/gi, '')
    .replace(/\bthanks for sticking with[^.?!]*[.?!]?/gi, '')
    .trim();
  const middle = stripIncompleteClosingReflectionTail(withoutThanks)
    .replace(/\bgood work getting through all of this[^.?!]*[.?!]?/gi, '')
    .replace(/\bgood work on sticking with[^.?!]*[.?!]?/gi, '')
    .replace(/\bthanks for walking through[^.?!]*[.?!]?/gi, '')
    .trim();
  if (!middle || /^what you\.?$/.test(middle)) return true;
  if (isTruncatedPersonalMomentClosingReflection(raw)) return true;
  if (middle.length < 24) return true;
  if (/\b(stuck with me|stood out|landed for me|heard was|came through|it sounds like you)\b/i.test(middle)) {
    return false;
  }
  if (/\byou (?:focused on|named|framed|pointed to|highlighted)\b/i.test(middle)) {
    return false;
  }
  return middle.split(/\s+/).filter(Boolean).length < 6;
}

/**
 * Expand truncated closings and inject a client reflection when the model only produced
 * "Good work… What you." + thanks (streaming cutoff) or a generic sign-off.
 */
function closingObservationMeetsQualityBar(
  closing: string,
  userAnswer: string,
  pillarContext?: ClosingPillarContext | null,
  opts?: { skipUngroundedEchoCheck?: boolean },
): boolean {
  if (personalMomentClosingLacksConcreteAnchor(closing)) return false;
  if (isVagueOrWeakClosingObservation(closing)) return false;
  if (
    !opts?.skipUngroundedEchoCheck &&
    userAnswer.length > 0 &&
    closingReflectionEchoesUngroundedUserWord(closing, userAnswer)
  ) {
    return false;
  }
  if (userAnswer.length > 0 && closingAttributesUnsupportedAccountability(closing, userAnswer)) {
    return false;
  }
  if (closingObservationFailsPillarGate(closing, pillarContext)) return false;
  return true;
}

export function enrichPersonalMomentClosingForTts(
  text: string,
  participantFirstName: string,
  lastUserAnswer?: string | null,
  pillarContext?: ClosingPillarContext | null,
): string {
  const neutralClosing = buildTwoSentenceClosingWithoutObservation(participantFirstName);

  const sanitized = stripInternalReflectionSchemaLeak(text);
  const source = sanitized || (looksLikeInternalReflectionSchemaLeak(text) ? '' : text);
  const base = coerceIncompleteInterviewClosingForTts(source, participantFirstName);
  const userAnswer = (lastUserAnswer ?? '').trim();

  /** Mirror scenario boundaries: ack + thanks only — no content reflection at M5 close. */
  if (!INCLUDE_SCENARIO_BOUNDARY_REFLECTIONS) {
    return dedupeDuplicateParticipantNameInClosing(neutralClosing, participantFirstName);
  }

  const ungroundedEcho =
    userAnswer.length > 0 && closingReflectionEchoesUngroundedUserWord(base, userAnswer);
  const unsupportedAccountability =
    userAnswer.length > 0 && closingAttributesUnsupportedAccountability(base, userAnswer);
  const lowScoringRun =
    pillarContext?.averagePillar != null && pillarContext.averagePillar < 4;

  if (
    looksLikeInterviewClosingAssistantMessage(base) &&
    closingObservationMeetsQualityBar(base, userAnswer, pillarContext)
  ) {
    return dedupeDuplicateParticipantNameInClosing(base, participantFirstName);
  }

  if (!lowScoringRun) {
    const reflection = buildPersonalMomentHandoffReflection(userAnswer, { context: 'closing' });
    if (
      reflection &&
      closingObservationMeetsQualityBar(reflection, userAnswer, pillarContext, {
        skipUngroundedEchoCheck: true,
      })
    ) {
      const ack = neutralClosing.replace(/\s*thank you\b.*$/i, '').trim();
      const thanks = neutralClosing.match(/\bthank you\b.*$/i)?.[0] ?? '';
      return dedupeDuplicateParticipantNameInClosing(
        assembleClosingWithOptionalReflection(`${ack} ${thanks}`.replace(/\s+/g, ' ').trim(), reflection),
        participantFirstName,
      );
    }
  }

  if (
    lowScoringRun ||
    unsupportedAccountability ||
    ungroundedEcho ||
    isIncompleteInterviewClosingForSpeak(source) ||
    personalMomentClosingLacksConcreteAnchor(base) ||
    isVagueOrWeakClosingObservation(base)
  ) {
    return dedupeDuplicateParticipantNameInClosing(neutralClosing, participantFirstName);
  }
  return dedupeDuplicateParticipantNameInClosing(base, participantFirstName);
}

/**
 * Canonical Moment 5 interview closing: task ack + thanks
 * (content reflection omitted while {@link INCLUDE_SCENARIO_BOUNDARY_REFLECTIONS} is false).
 */
export function buildMoment5InterviewClosingBundle(
  participantFirstName: string,
  lastUserAnswer?: string | null,
  pillarContext?: ClosingPillarContext | null,
  options?: { includeCompleteToken?: boolean },
): string {
  const enriched = enrichPersonalMomentClosingForTts(
    buildTwoSentenceClosingWithoutObservation(participantFirstName),
    participantFirstName,
    lastUserAnswer,
    pillarContext,
  );
  if (options?.includeCompleteToken) {
    return `${enriched} [INTERVIEW_COMPLETE]`.trim();
  }
  return enriched;
}
