/**
 * Personal-moment depth signals (concreteness, emotional vocab, slice word count).
 * Populated from model JSON when present; otherwise salvaged from truncated output
 * or derived from transcript / scoring slice (including after score-recovery paths).
 */

import {
  extractPersonalMomentEmotionalVocabFromSlice,
  enrichPersonalMomentSliceForDepth,
  personalMomentLexiconStatsFromInterviewMoment,
  personalMomentLexiconStatsFromUserText,
  inferResponseConcretenessFromTranscript,
  type PersonalMomentTranscriptTurn,
} from './personalMomentEmotionalVocab';
import {
  normalizeResponseConcreteness,
  type ResponseConcretenessLevel,
} from './personalMomentConcreteness';
import { salvagePersonalMomentDepthFieldsFromRawModelText } from './probeAndScoringUtils';

export type PersonalMomentDepthSlice = {
  response_concreteness?: string | null;
  emotional_vocab_count?: number | null;
  emotional_vocab_words?: string[];
  user_slice_word_count?: number | null;
  specificity?: string;
};

export type FinalizePersonalMomentDepthSignalsOpts = {
  rawModelText?: string;
  transcript?: readonly PersonalMomentTranscriptTurn[];
  scoringSlice?: readonly { role?: string; content?: string }[];
  moment: 4 | 5;
};

function scoringSliceUserText(
  scoringSlice: readonly { role?: string; content?: string }[] | undefined,
): string {
  if (!scoringSlice?.length) return '';
  return scoringSlice
    .filter((m) => m.role === 'user')
    .map((m) => (m.content ?? '').trim())
    .filter(Boolean)
    .join(' ')
    .trim();
}

function applyLexiconFields(
  parsed: PersonalMomentDepthSlice,
  stats: {
    emotional_vocab_count: number | null;
    emotional_vocab_words: string[];
    user_slice_word_count: number | null;
  },
): void {
  if (parsed.user_slice_word_count == null && stats.user_slice_word_count != null) {
    parsed.user_slice_word_count = stats.user_slice_word_count;
  }
  if (parsed.emotional_vocab_count == null && stats.emotional_vocab_count != null) {
    parsed.emotional_vocab_count = stats.emotional_vocab_count;
    parsed.emotional_vocab_words = stats.emotional_vocab_words;
  }
}

function applyEnrichedDepthRecord(
  parsed: PersonalMomentDepthSlice,
  enriched: Record<string, unknown>,
): void {
  const rc = normalizeResponseConcreteness(enriched.response_concreteness);
  if (parsed.response_concreteness == null && rc != null) {
    parsed.response_concreteness = rc;
  }
  applyLexiconFields(parsed, {
    emotional_vocab_count:
      typeof enriched.emotional_vocab_count === 'number' ? enriched.emotional_vocab_count : null,
    emotional_vocab_words: Array.isArray(enriched.emotional_vocab_words)
      ? enriched.emotional_vocab_words.filter((x): x is string => typeof x === 'string')
      : [],
    user_slice_word_count:
      typeof enriched.user_slice_word_count === 'number' ? enriched.user_slice_word_count : null,
  });
}

/**
 * Ensure depth signals are populated after primary or recovery scoring.
 * Operates on transcript content when model JSON omits these fields.
 */
export function finalizePersonalMomentDepthSignals(
  parsed: PersonalMomentDepthSlice,
  opts: FinalizePersonalMomentDepthSignalsOpts,
): void {
  parsed.response_concreteness =
    normalizeResponseConcreteness(parsed.response_concreteness) ??
    normalizeResponseConcreteness(parsed.specificity);

  const fromModel = extractPersonalMomentEmotionalVocabFromSlice(parsed);
  applyLexiconFields(parsed, fromModel);

  if (opts.rawModelText) {
    const salvaged = salvagePersonalMomentDepthFieldsFromRawModelText(opts.rawModelText);
    if (parsed.response_concreteness == null && salvaged.response_concreteness != null) {
      parsed.response_concreteness = salvaged.response_concreteness;
    }
    applyLexiconFields(parsed, {
      emotional_vocab_count: salvaged.emotional_vocab_count,
      emotional_vocab_words: salvaged.emotional_vocab_words,
      user_slice_word_count: salvaged.user_slice_word_count,
    });
  }

  const sliceText = scoringSliceUserText(opts.scoringSlice);
  const enriched = enrichPersonalMomentSliceForDepth(
    parsed as Record<string, unknown>,
    opts.transcript ?? null,
    opts.moment,
    sliceText,
  );
  if (enriched) applyEnrichedDepthRecord(parsed, enriched);

  if (parsed.user_slice_word_count == null && sliceText) {
    applyLexiconFields(parsed, personalMomentLexiconStatsFromUserText(sliceText));
  }
  if (
    (parsed.emotional_vocab_count == null || parsed.user_slice_word_count == null) &&
    opts.transcript?.length
  ) {
    applyLexiconFields(parsed, personalMomentLexiconStatsFromInterviewMoment(opts.transcript, opts.moment));
  }

  if (parsed.response_concreteness == null) {
    const inferred = inferResponseConcretenessFromTranscript(
      opts.transcript,
      opts.moment,
      sliceText,
    );
    if (inferred != null) parsed.response_concreteness = inferred;
  }
}

/** Simulate recovery-path scoring output then depth finalization (for tests). */
export function applyMoment5RecoveryPathDepthSignals(input: {
  rawModelText: string;
  parsed: PersonalMomentDepthSlice & {
    pillarScores?: Record<string, number | null>;
    keyEvidence?: Record<string, string>;
  };
  transcript: readonly PersonalMomentTranscriptTurn[];
  scoringSlice: readonly { role?: string; content?: string }[];
}): PersonalMomentDepthSlice {
  finalizePersonalMomentDepthSignals(input.parsed, {
    rawModelText: input.rawModelText,
    transcript: input.transcript,
    scoringSlice: input.scoringSlice,
    moment: 5,
  });
  return input.parsed;
}

export type { ResponseConcretenessLevel };
