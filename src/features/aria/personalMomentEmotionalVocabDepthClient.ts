/**
 * Client transcript depth heuristics for personal moments (M4/M5 probes).
 * Kept on the client because they depend on moment4/moment5 classification modules.
 */

import {
  moment5PersonalNarrativeHasConcreteAnchor,
  moment5ResponseIsAbstract,
} from './probeAndScoringUtils';
import {
  inferMoment4ConcretenessFromText,
  type Moment4ConcretenessLevel,
} from './moment4ConcretenessClassification';
import {
  normalizeResponseConcreteness,
  type ResponseConcretenessLevel,
} from './personalMomentConcreteness';
import {
  personalMomentLexiconStatsFromInterviewMoment,
  personalMomentLexiconStatsFromUserText,
  type PersonalMomentTranscriptTurn,
} from '../../../supabase/functions/_shared/personalMomentEmotionalVocab';

export function combineUserTextForPersonalMoment(
  transcript: readonly PersonalMomentTranscriptTurn[] | null | undefined,
  moment: 4 | 5,
  scoringSliceUserText?: string,
): string {
  const parts: string[] = [];
  if (Array.isArray(transcript)) {
    for (const t of transcript) {
      if (t.role !== 'user' || t.interviewMoment !== moment) continue;
      const c = (t.content ?? '').trim();
      if (c) parts.push(c);
    }
  }
  if (parts.length > 0) return parts.join(' ');
  return (scoringSliceUserText ?? '').trim();
}

/** Heuristic concreteness from transcript when the scorer JSON omits `response_concreteness`. */
export function inferResponseConcretenessFromTranscript(
  transcript: readonly PersonalMomentTranscriptTurn[] | null | undefined,
  moment: 4 | 5,
  scoringSliceUserText?: string,
): ResponseConcretenessLevel | Moment4ConcretenessLevel | null {
  const combined = combineUserTextForPersonalMoment(transcript, moment, scoringSliceUserText);
  if (!combined) return null;

  if (moment === 4) {
    return inferMoment4ConcretenessFromText(combined);
  }

  const wc = combined.split(/\s+/).filter(Boolean).length;
  if (wc === 0) return null;
  const lower = combined.toLowerCase();

  if (moment5ResponseIsAbstract(combined) && wc < 50) return 'low';
  if (moment5PersonalNarrativeHasConcreteAnchor(combined)) {
    const hasEmotion = /\b(felt|feel|angry|hurt|frustrated|upset|scared|ashamed|tense|anxious|resentful)\b/i.test(
      lower,
    );
    if (wc >= 60 && hasEmotion) return 'high';
    return 'moderate';
  }
  if (wc >= 80) return 'moderate';
  if (wc >= 25) return 'low';
  return 'low';
}

/** Fill legacy `specificity`, word counts, lexicon, and concreteness before depth aggregation. */
export function enrichPersonalMomentSliceForDepth(
  slice: Record<string, unknown> | null | undefined,
  transcript: readonly PersonalMomentTranscriptTurn[] | null | undefined,
  moment: 4 | 5,
  scoringSliceUserText?: string,
): Record<string, unknown> | null {
  const fromTx = personalMomentLexiconStatsFromInterviewMoment(transcript, moment);
  const fromSliceText = scoringSliceUserText?.trim()
    ? personalMomentLexiconStatsFromUserText(scoringSliceUserText)
    : null;
  const lexicon =
    fromTx.user_slice_word_count != null
      ? fromTx
      : fromSliceText?.user_slice_word_count != null
        ? fromSliceText
        : fromTx;
  const base =
    slice != null && typeof slice === 'object' && !Array.isArray(slice) ? { ...slice } : {};
  if (base.response_concreteness == null && typeof base.specificity === 'string') {
    base.response_concreteness = base.specificity;
  }
  if (base.user_slice_word_count == null && lexicon.user_slice_word_count != null) {
    base.user_slice_word_count = lexicon.user_slice_word_count;
  }
  if (base.emotional_vocab_count == null && lexicon.emotional_vocab_count != null) {
    base.emotional_vocab_count = lexicon.emotional_vocab_count;
    base.emotional_vocab_words = lexicon.emotional_vocab_words;
  }
  if (base.response_concreteness == null) {
    const inferred = inferResponseConcretenessFromTranscript(
      transcript,
      moment,
      scoringSliceUserText,
    );
    if (inferred != null) base.response_concreteness = inferred;
  }
  if (Object.keys(base).length === 0) return null;
  return base;
}

export function depthEnrichedMarkerSlices<T extends {
  response_concreteness?: string | null;
  user_slice_word_count?: number | null;
  emotional_vocab_count?: number | null;
  emotional_vocab_words?: string[] | null;
} | null | undefined>(
  slices: Array<T>,
  transcript: readonly PersonalMomentTranscriptTurn[] | null | undefined,
): Array<T> {
  const out = [...slices] as Array<T>;
  for (const moment of [4, 5] as const) {
    const i = moment - 1;
    const enriched = enrichPersonalMomentSliceForDepth(
      out[i] as Record<string, unknown> | null | undefined,
      transcript,
      moment,
    );
    if (!enriched) continue;
    out[i] = { ...(out[i] ?? {}), ...enriched } as T;
  }
  return out;
}
