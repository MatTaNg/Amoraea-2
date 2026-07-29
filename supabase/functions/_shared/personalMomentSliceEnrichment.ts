/**
 * Edge bundle: personal-moment slice enrichment (word counts + concreteness only).
 * Mirrors `src/features/aria/personalMomentSliceEnrichment.ts` without client-only imports.
 */

export type PersonalMomentTranscriptTurn = {
  role?: string;
  content?: string;
  interviewMoment?: number;
};

function combineUserTextForPersonalMoment(
  transcript: readonly PersonalMomentTranscriptTurn[] | null | undefined,
  moment: 4 | 5,
): string {
  const parts: string[] = [];
  if (Array.isArray(transcript)) {
    for (const t of transcript) {
      if (t.role !== 'user' || t.interviewMoment !== moment) continue;
      const c = (t.content ?? '').trim();
      if (c) parts.push(c);
    }
  }
  return parts.join(' ');
}

function wordCountFromText(text: string): number | null {
  const wc = text.split(/\s+/).filter(Boolean).length;
  return wc > 0 ? wc : null;
}

function inferResponseConcretenessFromTranscriptEdge(
  transcript: readonly PersonalMomentTranscriptTurn[] | null | undefined,
  moment: 4 | 5,
  scoringSliceUserText?: string,
): string | null {
  const parts: string[] = [];
  if (Array.isArray(transcript)) {
    for (const t of transcript) {
      if (t.role !== 'user' || t.interviewMoment !== moment) continue;
      const c = (t.content ?? '').trim();
      if (c) parts.push(c);
    }
  }
  const combined = parts.length > 0 ? parts.join(' ') : (scoringSliceUserText ?? '').trim();
  if (!combined) return null;
  const wc = combined.split(/\s+/).filter(Boolean).length;
  if (wc >= 80) return 'high';
  if (wc >= 35) return 'moderate';
  if (wc >= 15) return 'low';
  return 'absent';
}

export function enrichPersonalMomentSliceForDepth(
  slice: Record<string, unknown> | null | undefined,
  transcript: readonly PersonalMomentTranscriptTurn[] | null | undefined,
  moment: 4 | 5,
  scoringSliceUserText?: string,
): Record<string, unknown> | null {
  const fromTx = wordCountFromText(combineUserTextForPersonalMoment(transcript, moment));
  const fromSliceText = scoringSliceUserText?.trim()
    ? wordCountFromText(scoringSliceUserText.trim())
    : null;
  const userSliceWordCount = fromTx ?? fromSliceText;
  const base =
    slice != null && typeof slice === 'object' && !Array.isArray(slice) ? { ...slice } : {};
  if (base.response_concreteness == null && typeof base.specificity === 'string') {
    base.response_concreteness = base.specificity;
  }
  if (base.user_slice_word_count == null && userSliceWordCount != null) {
    base.user_slice_word_count = userSliceWordCount;
  }
  if (base.response_concreteness == null) {
    const inferred = inferResponseConcretenessFromTranscriptEdge(
      transcript,
      moment,
      scoringSliceUserText,
    );
    if (inferred != null) base.response_concreteness = inferred;
  }
  if (Object.keys(base).length === 0) return null;
  return base;
}

export function depthEnrichedMarkerSlices<
  T extends {
    response_concreteness?: string | null;
    user_slice_word_count?: number | null;
  } | null | undefined,
>(slices: Array<T>, transcript: readonly PersonalMomentTranscriptTurn[] | null | undefined): Array<T> {
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
