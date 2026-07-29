/**
 * Client transcript depth heuristics for personal moments (M4/M5 probes).
 * Word counts and concreteness inference only — no lexicon-based emotional vocabulary.
 */

import {
  moment5PersonalNarrativeHasConcreteAnchor,
  moment5ResponseIsAbstract,
} from './probeAndScoringUtils';
import {
  inferMoment4ConcretenessFromText,
  type Moment4ConcretenessLevel,
} from './moment4ConcretenessClassification';
import { momentUserTextFromInterviewTranscript } from './moment4AccountabilitySituationalExempt';
import {
  looksLikeMoment4GrudgePrompt,
  looksLikeMoment4ThresholdQuestion,
} from './moment4ProbeLogic';
import { moment4UserDeclinesSpecificityReask } from './moment4SpecificityFollowUp';
import { extractLastMoment4GrudgeUserAnswer } from './moment4SpecificityFollowUp';
import { inferPersonalMomentSlices, type TranscriptTurn } from './personalMomentSlices';
import {
  normalizeResponseConcreteness,
  type ResponseConcretenessLevel,
} from './personalMomentConcreteness';

export type PersonalMomentTranscriptTurn = {
  role?: string;
  content?: string;
  interviewMoment?: number;
};

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

function extractGrudgeUserTextFromMoment4Slice(moment4: TranscriptTurn[]): string {
  if (moment4.length === 0) return '';

  let grudgeIdx = moment4.findIndex(
    (m) => m.role === 'assistant' && looksLikeMoment4GrudgePrompt(m.content ?? ''),
  );
  if (grudgeIdx < 0) {
    grudgeIdx = moment4.findIndex((m) => m.role === 'assistant');
  }
  if (grudgeIdx < 0) return '';

  const responseParts: string[] = [];
  for (let i = grudgeIdx + 1; i < moment4.length; i++) {
    const m = moment4[i];
    if (m.role === 'assistant' && looksLikeMoment4ThresholdQuestion(m.content ?? '')) break;
    if (m.role !== 'user') continue;
    const c = (m.content ?? '').trim();
    if (!c || moment4UserDeclinesSpecificityReask(c)) continue;
    responseParts.push(c);
  }
  return responseParts.join('\n\n');
}

/**
 * Resolve Moment 4 user corpus for gate concreteness reconciliation.
 * Prefer tagged `interviewMoment: 4` turns; fall back to inferred M4 slice (handles S3→M4 handoff
 * paragraphs and legacy transcripts without moment tags).
 */
export function resolveMoment4UserTextForGate(
  transcript: readonly PersonalMomentTranscriptTurn[] | null | undefined,
  scoringSliceUserText?: string,
): string {
  const tagged = momentUserTextFromInterviewTranscript(transcript, 4);
  if (tagged.trim()) return tagged;

  if (transcript?.length) {
    const { moment4 } = inferPersonalMomentSlices(transcript as TranscriptTurn[]);
    const fromSlice = extractGrudgeUserTextFromMoment4Slice(moment4);
    if (fromSlice.trim()) return fromSlice;

    const grudgeAnswer = extractLastMoment4GrudgeUserAnswer(
      transcript as ReadonlyArray<{ role: string; content?: string | null }>,
    );
    if (grudgeAnswer?.trim()) return grudgeAnswer;
  }

  return combineUserTextForPersonalMoment(transcript, 4, scoringSliceUserText);
}

function wordCountFromText(text: string): number | null {
  const wc = text.split(/\s+/).filter(Boolean).length;
  return wc > 0 ? wc : null;
}

export function personalMomentWordCountFromInterviewMoment(
  transcript: readonly PersonalMomentTranscriptTurn[] | null | undefined,
  moment: 4 | 5,
): number | null {
  return wordCountFromText(combineUserTextForPersonalMoment(transcript, moment));
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

/** Fill legacy `specificity`, word counts, and concreteness before depth aggregation. */
export function enrichPersonalMomentSliceForDepth(
  slice: Record<string, unknown> | null | undefined,
  transcript: readonly PersonalMomentTranscriptTurn[] | null | undefined,
  moment: 4 | 5,
  scoringSliceUserText?: string,
): Record<string, unknown> | null {
  const fromTx = personalMomentWordCountFromInterviewMoment(transcript, moment);
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
