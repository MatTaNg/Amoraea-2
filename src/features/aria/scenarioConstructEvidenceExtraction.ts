/**
 * Per-construct evidence snippets when the model omits keyEvidence for a scored marker.
 * Never reuse one undifferentiated scenario slice for every pillar.
 */

const CONSTRUCT_EVIDENCE_CUES: Record<string, RegExp[]> = {
  repair: [/\b(sorry|apolog\w*|repair|make up|acknowledge|rupture)\b/i, /\bmy part\b/i],
  accountability: [/\b(my part|I should have|I could have|contributed|responsibility|own my|I was wrong)\b/i],
  mentalizing: [
    /\b(feel|felt|thinking|overwhelm\w*|internal|perspective|might be|wondering|in their shoes)\b/i,
    /\bwhat.*going on for\b/i,
    /\b(difference in priorities|frustrated|assuming)\b/i,
  ],
  attunement: [
    /\b(frustrated|dismissed|upset|hurt)\b/i,
    /\b(heard|listen|emotion|priority|second|unseen)\b/i,
  ],
  appreciation: [
    /\b(appreciat\w*|grateful|thank)\b/i,
    /\b(matters to me|tell her she matters|show her|positive regard)\b/i,
  ],
  contempt_expression: [
    /\b(weak|wrong|rude|disrespect|contempt|judge|nightmare|enmeshed|should leave|can't fake)\b/i,
  ],
  contempt_recognition: [/\b(contempt|disrespect|dismissive|harsh|cruel|demean|belittl\w*|enmeshed|nightmare)\b/i],
  regulation: [/\b(calm|regulat\w*|overwhelm\w*|flooded|pause|reactive|shut down|withdraw)\b/i],
};

function splitTranscriptSentences(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')
    .trim()
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function scoreSentenceForMarker(sentence: string, markerId: string): number {
  const patterns = CONSTRUCT_EVIDENCE_CUES[markerId] ?? [];
  let score = 0;
  for (const pattern of patterns) {
    if (pattern.test(sentence)) score += 10;
  }
  return score;
}

/** True when evidence is our legacy homogenized backfill (same blob assigned to every pillar). */
export function isScenarioSliceHomogenizedBackfill(text: string | null | undefined): boolean {
  return /^User \(scenario slice\):/i.test((text ?? '').trim());
}

/**
 * True when keyEvidence is only a transcript quote with no analytical scoring rationale.
 * Matches model output and legacy programmatic backfill (`User: "…"`).
 */
export function isQuoteOnlyKeyEvidence(text: string | null | undefined): boolean {
  const t = (text ?? '').trim();
  if (!t) return false;
  const withoutLevel = t.replace(/^\s*Level\s*[12]\s*[—–-]\s*/i, '').trim();
  if (/^User:\s*"[^"]*"\s*\.?$/i.test(withoutLevel)) return true;
  if (/^User\s*\(scenario slice\):\s*"/i.test(withoutLevel)) return true;
  if (/^"[^"]{12,}"\s*\.?$/i.test(withoutLevel)) return true;
  return false;
}

/** Format a construct-specific participant quote for keyEvidence storage. */
export function formatConstructEvidenceQuote(snippet: string): string {
  const t = snippet.replace(/\s+/g, ' ').trim();
  const clipped = t.length > 220 ? `${t.slice(0, 220)}…` : t;
  return `User: "${clipped}"`;
}

/** Programmatic per-marker quote backfill — not model-authored holistic evidence. */
export function isProgrammaticConstructUserQuoteBackfill(text: string | null | undefined): boolean {
  return /^User:\s*"/i.test((text ?? '').trim());
}

/**
 * Pick the best single sentence from the scenario user text for one construct.
 * Prefers the highest-scoring cue match; falls back to the longest substantive sentence.
 */
export function extractConstructEvidenceSnippet(
  userTranscript: string,
  markerId: string,
): string | null {
  const transcript = (userTranscript ?? '').replace(/\s+/g, ' ').trim();
  if (!transcript) return null;

  const sentences = splitTranscriptSentences(transcript);
  if (sentences.length === 0) return null;

  let best: { sentence: string; score: number } | null = null;
  for (const sentence of sentences) {
    const score = scoreSentenceForMarker(sentence, markerId);
    if (score <= 0) continue;
    if (!best || score > best.score || (score === best.score && sentence.length > best.sentence.length)) {
      best = { sentence, score };
    }
  }
  if (best) return best.sentence;

  const substantive = sentences.filter((s) => s.split(/\s+/).length >= 4);
  return substantive[substantive.length - 1] ?? sentences[sentences.length - 1] ?? null;
}

/** If every marker shares the same homogenized scenario-slice backfill, clear it for recovery. */
export function stripHomogenizedScenarioSliceBackfill(
  keyEvidence: Record<string, string>,
  markerIds: readonly string[],
): void {
  const trimmed = markerIds
    .map((id) => keyEvidence[id]?.trim())
    .filter((v): v is string => !!v);
  if (trimmed.length < 2) return;
  const first = trimmed[0]!;
  if (!isScenarioSliceHomogenizedBackfill(first)) return;
  if (!trimmed.every((v) => v === first)) return;
  for (const id of markerIds) {
    if (keyEvidence[id]?.trim() === first) {
      delete keyEvidence[id];
    }
  }
}
