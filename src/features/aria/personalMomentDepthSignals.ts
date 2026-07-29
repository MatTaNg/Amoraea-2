/**
 * Personal-moment depth signals (concreteness, slice word count).
 * Populated from model JSON when present; otherwise salvaged from truncated output
 * or derived from transcript / scoring slice (including after score-recovery paths).
 */

import {
  enrichPersonalMomentSliceForDepth,
  inferResponseConcretenessFromTranscript,
  personalMomentWordCountFromInterviewMoment,
  type PersonalMomentTranscriptTurn,
} from './personalMomentSliceEnrichment';
import {
  normalizeResponseConcreteness,
  normalizeMoment4Concreteness,
  reconcileMoment4Concreteness,
} from './personalMomentConcreteness';
import { salvagePersonalMomentDepthFieldsFromRawModelText } from './probeAndScoringUtils';

export type PersonalMomentDepthSlice = {
  response_concreteness?: string | null;
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

function normalizeConcretenessForMoment(raw: unknown, moment: 4 | 5): string | null {
  if (moment === 4) return normalizeMoment4Concreteness(raw);
  return normalizeResponseConcreteness(raw);
}

function applyWordCount(
  parsed: PersonalMomentDepthSlice,
  userSliceWordCount: number | null,
): void {
  if (parsed.user_slice_word_count == null && userSliceWordCount != null) {
    parsed.user_slice_word_count = userSliceWordCount;
  }
}

function applyEnrichedDepthRecord(
  parsed: PersonalMomentDepthSlice,
  enriched: Record<string, unknown>,
  moment: 4 | 5,
): void {
  const rc = normalizeConcretenessForMoment(enriched.response_concreteness, moment);
  if (parsed.response_concreteness == null && rc != null) {
    parsed.response_concreteness = rc;
  }
  applyWordCount(
    parsed,
    typeof enriched.user_slice_word_count === 'number' ? enriched.user_slice_word_count : null,
  );
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
    normalizeConcretenessForMoment(parsed.response_concreteness, opts.moment) ??
    normalizeConcretenessForMoment(parsed.specificity, opts.moment);

  if (opts.rawModelText) {
    const salvaged = salvagePersonalMomentDepthFieldsFromRawModelText(opts.rawModelText);
    if (parsed.response_concreteness == null && salvaged.response_concreteness != null) {
      parsed.response_concreteness = salvaged.response_concreteness;
    }
    applyWordCount(parsed, salvaged.user_slice_word_count);
  }

  const sliceText = scoringSliceUserText(opts.scoringSlice);
  const enriched = enrichPersonalMomentSliceForDepth(
    parsed as Record<string, unknown>,
    opts.transcript ?? null,
    opts.moment,
    sliceText,
  );
  if (enriched) applyEnrichedDepthRecord(parsed, enriched, opts.moment);

  if (parsed.user_slice_word_count == null && sliceText) {
    const wc = sliceText.split(/\s+/).filter(Boolean).length;
    if (wc > 0) parsed.user_slice_word_count = wc;
  }
  if (parsed.user_slice_word_count == null && opts.transcript?.length) {
    applyWordCount(parsed, personalMomentWordCountFromInterviewMoment(opts.transcript, opts.moment));
  }

  if (parsed.response_concreteness == null) {
    const inferred = inferResponseConcretenessFromTranscript(
      opts.transcript,
      opts.moment,
      sliceText,
    );
    if (inferred != null) parsed.response_concreteness = inferred;
  }

  if (opts.moment === 4) {
    const combined = combineUserTextForMoment4Reconcile(opts.transcript, sliceText);
    if (combined) {
      const reconciled = reconcileMoment4Concreteness(parsed.response_concreteness, combined);
      if (reconciled != null) parsed.response_concreteness = reconciled;
    }
  }
}

function combineUserTextForMoment4Reconcile(
  transcript: readonly PersonalMomentTranscriptTurn[] | undefined,
  sliceText: string,
): string {
  const parts: string[] = [];
  if (transcript?.length) {
    for (const t of transcript) {
      if (t.role !== 'user' || t.interviewMoment !== 4) continue;
      const c = (t.content ?? '').trim();
      if (c) parts.push(c);
    }
  }
  if (parts.length > 0) return parts.join(' ');
  return sliceText;
}
