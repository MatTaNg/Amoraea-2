import {
  isScenarioCToPersonalHandoffAssistantContent,
  normalizeInterviewTypography,
} from '@features/aria/probeAndScoringUtils';
import { looksLikeMoment4ThresholdQuestion } from '@features/aria/moment4ProbeLogic';

/** Bracket-style control tokens (subset) so logging/TTS text matches model-facing checks. */
function stripInterviewControlTokensLight(text: string): string {
  return text.replace(/\[[A-Z_][A-Z0-9_:]+\]/gi, '').trim();
}

export function normalizeFollowUpQuestionKey(text: string): string {
  return normalizeInterviewTypography(text ?? '')
    .replace(/\u2019/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Pulls question-shaped snippets (substring ending at `?`) from assistant TTS text for dedup tracking.
 * Min length avoids tracking "Really?" etc.
 */
export function extractFollowUpQuestionCandidatesFromAssistantText(text: string): string[] {
  const stripped = stripInterviewControlTokensLight(text).replace(/\s+/g, ' ').trim();
  if (!stripped) return [];
  const matches = stripped.match(/[^?.!\n]{12,}?\?/g) ?? [];
  const out = new Set<string>();
  for (const m of matches) {
    const t = m.trim();
    if (t.length >= 14) out.add(t);
  }
  return [...out];
}

export type FollowUpTrackingSegment = 1 | 2 | 3 | 4 | 5;

export function followUpTrackingSegment(moment: number, scenario: number): FollowUpTrackingSegment {
  if (moment >= 5) return 5;
  if (moment >= 4) return 4;
  if (scenario >= 1 && scenario <= 3) return scenario as 1 | 2 | 3;
  return 1;
}

function inferSegmentFromAssistantMessageForHydration(m: {
  role: string;
  content?: string | null;
  scenarioNumber?: number | null;
}): FollowUpTrackingSegment | null {
  if (m.role !== 'assistant' || typeof m.content !== 'string') return null;
  const c = m.content;
  const sn = m.scenarioNumber ?? 0;
  if (looksLikeMoment4ThresholdQuestion(c)) return 4;
  if (isScenarioCToPersonalHandoffAssistantContent(c)) return 4;
  const low = c.toLowerCase();
  if (low.includes('held a grudge') && (low.includes("really didn't like") || low.includes('really did not like')))
    return 4;
  if (
    /\bconflict\b/.test(low) &&
    /\bresolution\b/.test(low) &&
    (low.includes('tell me about') || low.includes('walk me through'))
  )
    return 5;
  if (sn >= 1 && sn <= 3) return sn as 1 | 2 | 3;
  return null;
}

export function mergeDeliveredFollowUpKeysFromTranscript(
  messages: ReadonlyArray<{ role: string; content?: string | null; scenarioNumber?: number | null }>,
  into: Record<number, Set<string>>,
): void {
  for (const m of messages) {
    const seg = inferSegmentFromAssistantMessageForHydration(m);
    if (seg == null) continue;
    if (!into[seg]) into[seg] = new Set();
    for (const q of extractFollowUpQuestionCandidatesFromAssistantText(m.content ?? '')) {
      into[seg]!.add(normalizeFollowUpQuestionKey(q));
    }
  }
}

export function recordDeliveredFollowUpsFromAssistantSpeech(
  text: string,
  segment: FollowUpTrackingSegment,
  into: Record<number, Set<string>>,
): void {
  if (!into[segment]) into[segment] = new Set();
  for (const q of extractFollowUpQuestionCandidatesFromAssistantText(text)) {
    into[segment]!.add(normalizeFollowUpQuestionKey(q));
  }
}

/** Drops question sentences that match an already-delivered key for this segment (longest-first). */
export function removeVerbatimPreviouslyDeliveredFollowUpQuestions(
  text: string,
  segment: FollowUpTrackingSegment,
  deliveredBySegment: Record<number, Set<string>>,
): string {
  const set = deliveredBySegment[segment];
  if (!set?.size) return text;
  const candidates = extractFollowUpQuestionCandidatesFromAssistantText(text).sort((a, b) => b.length - a.length);
  let out = text;
  for (const q of candidates) {
    const k = normalizeFollowUpQuestionKey(q);
    if (k.length < 24 || !set.has(k)) continue;
    const idx = out.indexOf(q);
    if (idx >= 0) {
      out = (out.slice(0, idx) + out.slice(idx + q.length)).replace(/\n{3,}/g, '\n\n').trim();
      continue;
    }
    const lowOut = out.toLowerCase();
    const lowQ = q.toLowerCase();
    const idx2 = lowOut.indexOf(lowQ);
    if (idx2 >= 0) {
      out = (out.slice(0, idx2) + out.slice(idx2 + q.length)).replace(/\n{3,}/g, '\n\n').trim();
    }
  }
  return out.replace(/\n{3,}/g, '\n\n').trim();
}

export function buildFollowUpsAlreadyDeliveredSystemSuffix(
  segment: FollowUpTrackingSegment,
  deliveredBySegment: Record<number, Set<string>>,
): string {
  const set = deliveredBySegment[segment];
  if (!set?.size) return '';
  const bullets = [...set]
    .slice(0, 24)
    .map((k) => `- ${k.slice(0, 320)}`)
    .join('\n');
  return `\n\nFOLLOW-UPS ALREADY DELIVERED IN THIS SEGMENT (id ${segment}; fictional Situations 1–3 = segments 1–3; personal Moment 4 = 4; Moment 5 = 5):\nThe following question wordings were already asked aloud here. **Never** output any of them again verbatim in this segment, including after a redirect or thin answer — not even as the "original active question" from the misplaced-answer rule. If the user did not answer the intent, re-engage by reframing, briefly acknowledging what they said and narrowing the focus, or asking a more specific angle (new wording).\n${bullets}\n`;
}
