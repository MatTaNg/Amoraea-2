/** Evidence-line helpers shared by scenario and personal-moment scoring parsers. */

/** True when a model leaked pillarConfidence (high/moderate/low) into keyEvidence instead of substantive text. */
export function isPillarConfidenceOnlyEvidence(text: string | null | undefined): boolean {
  if (!text) return false;
  const t = text.trim().toLowerCase();
  if (t === 'high' || t === 'moderate' || t === 'medium' || t === 'low' || t === 'not_assessed') return true;
  if (/^(high|moderate|medium|low|not_assessed)\s+confidence\.?$/.test(t)) return true;
  return false;
}

/** Normalize a confidence token leaked into keyEvidence for storage in pillarConfidence. */
export function normalizePillarConfidenceToken(text: string): string {
  const t = text.trim().toLowerCase();
  if (t === 'medium') return 'moderate';
  if (t === 'high' || t === 'moderate' || t === 'low' || t === 'not_assessed') return t;
  const m = /^(high|moderate|medium|low|not_assessed)\s+confidence\.?$/.exec(t);
  if (m) return m[1] === 'medium' ? 'moderate' : m[1]!;
  return 'moderate';
}

/**
 * Move confidence-only keyEvidence into pillarConfidence so depth/level heuristics
 * do not treat metadata as missing substantive evidence.
 */
export function migratePillarConfidenceLeakedIntoKeyEvidence(
  keyEvidence: Record<string, string>,
  pillarConfidence?: Record<string, string>,
): void {
  for (const [id, raw] of Object.entries({ ...keyEvidence })) {
    if (!isPillarConfidenceOnlyEvidence(raw)) continue;
    if (pillarConfidence && !pillarConfidence[id]?.trim()) {
      pillarConfidence[id] = normalizePillarConfidenceToken(raw);
    }
    delete keyEvidence[id];
  }
}

/**
 * Confidence tokens in keyEvidence must not trigger response-depth −1 or other evidence-absence penalties.
 * When only a confidence leak is present but the slice transcript is substantive, treat evidence as present.
 */
export function keyEvidenceAbsentForResponseDepthModifier(
  text: string | null | undefined,
  userTranscript?: string | null,
  depthModifierThreshold?: number,
): boolean {
  const ev = (text ?? '').trim();
  const transcript = (userTranscript ?? '').trim();
  if (isPillarConfidenceOnlyEvidence(ev)) {
    return !transcript;
  }
  if (
    isIntentionallyRecoveredScoreEvidence(ev) &&
    depthModifierThreshold != null &&
    transcriptSubstantiveForDepthModifier(transcript, depthModifierThreshold)
  ) {
    return false;
  }
  return evidenceAbsentForResponseDepthModifier(text);
}

function transcriptWordCount(userTranscript: string): number {
  return userTranscript.trim().split(/\s+/).filter(Boolean).length;
}

function transcriptSubstantiveForDepthModifier(
  userTranscript: string,
  threshold: number,
): boolean {
  return transcriptWordCount(userTranscript) >= threshold;
}

/** Replace confidence-only keyEvidence before depth modifier / level-tag heuristics run. */
export function replaceConfidenceOnlyInKeyEvidenceRecord(
  keyEvidence: Record<string, string>,
  markerIds: readonly string[],
  userTranscript: string,
): void {
  for (const id of markerIds) {
    const ev = keyEvidence[id]?.trim();
    if (!ev || !isPillarConfidenceOnlyEvidence(ev)) continue;
    delete keyEvidence[id];
  }
}

/** User-facing; when set in keyEvidence, participant skipped the remainder of this segment after a frustration offer. */export const SKIPPED_BY_USER_FRUSTRATION_EVIDENCE =
  'Not scored — participant chose to skip the remaining prompt in this segment after a frustration signal.';

/** User-facing; when set in keyEvidence, the slice did not receive the prompt (session ended, audio, etc.). */
export const NOT_ASSESSED_SESSION_ENDED_TECHNICAL_EVIDENCE =
  'Not assessed — session ended due to technical difficulties before this prompt was delivered.';

/**
 * True when the evidence line marks missing data from technical interruption, not a scored “0” performance.
 * Per-marker keyEvidence in scenario slices.
 */
export function isNotAssessedDueToTechnicalInterruption(text: string | null | undefined): boolean {
  if (!text?.trim()) return false;
  const t = text.trim().toLowerCase();
  if (t === NOT_ASSESSED_SESSION_ENDED_TECHNICAL_EVIDENCE.trim().toLowerCase()) return true;
  return (
    /\bnot assessed\b/.test(t) &&
    (/\b(session ended|ended early)\b.*\btechnical\b/.test(t) ||
      /\btechnical (difficult|interruption|failure)\b/.test(t) ||
      /\bbefore this prompt (was )?delivered\b/.test(t) ||
      /\binterview (ended|terminated)\b.*\btechnical\b/.test(t))
  );
}

/**
 * True when programmatic response-depth −1 may apply for this marker: model/keyEvidence
 * indicates nothing substantive to score (empty, recovery line, insufficient-evidence phrasing, etc.).
 * Returns false for technical non-assessment and frustration skip so we do not stack penalties.
 */
export function evidenceAbsentForResponseDepthModifier(text: string | null | undefined): boolean {
  if (text == null || typeof text !== 'string') return true;
  const trimmed = text.trim();
  if (!trimmed) return true;
  if (isPillarConfidenceOnlyEvidence(trimmed)) return true;
  if (isNotAssessedDueToTechnicalInterruption(trimmed)) return false;
  if (trimmed === SKIPPED_BY_USER_FRUSTRATION_EVIDENCE) return false;

  const lower = trimmed.toLowerCase();
  if (/score\s+recovered\s+from\s+model\s+output/i.test(trimmed)) return true;
  if (/score\s+present,\s+evidence\s+not\s+returned\s+by\s+model/i.test(trimmed)) return true;
  if (/moment\s+4\s+incomplete\s+model\s+output/i.test(trimmed)) return true;
  if (/rubric\s+excerpt\s+omitted\s+in\s+model\s+json/i.test(trimmed)) return true;
  if (/insufficient\s+evidence/.test(lower)) return true;
  if (/no\s+assessable\s+evidence/.test(lower)) return true;
  if (/response\s+too\s+brief\s+to\s+assess/.test(lower)) return true;
  if (/too\s+brief\s+to\s+assess/.test(lower)) return true;

  if (isNoEvidenceText(trimmed)) return true;
  return false;
}

export function isNoEvidenceText(text: string | null | undefined): boolean {
  if (!text) return false;
  if (text.trim() === SKIPPED_BY_USER_FRUSTRATION_EVIDENCE) return true;
  const t = text.trim().toLowerCase();
  return (
    /no\s+[a-z_ ]+\s+content\s+in\s+this\s+(scenario|moment|interview)/i.test(t) ||
    /not\s+directly\s+assessed/i.test(t) ||
    /insufficient\s+evidence/i.test(t) ||
    /no\s+evidence\s+(was\s+)?(available|observed|surfaced)/i.test(t) ||
    /no substantive engagement with (the )?grudge/i.test(t) ||
    /moment 4[:\s]+no substantive engagement/i.test(t) ||
    /deflection, avoidance, or absent signal/i.test(t) ||
    /appreciation (was )?not assessed from this moment/i.test(t) ||
    /not assessed from this moment.*appreciation/i.test(t) ||
    /limited (close[- ]relationship|lived) (experience|opportunity)/i.test(t) ||
    /\bnot scored\b.*\bskip\b.*\bfrustration\b/i.test(t) ||
    /rubric excerpt omitted in model json/i.test(t) ||
    /moment 4 incomplete model output/i.test(t) ||
    /score present, evidence not returned by model/i.test(t)
  );
}

/**
 * Models sometimes emit pillar scores as numeric strings; `normalizeScoresByEvidence` only kept `typeof number`,
 * which dropped every pillar and left Moment 4/5 bundles unpersistable (all null + empty keyEvidence).
 */
export function coerceScoreToFiniteNumber(raw: unknown): number | undefined {
  if (raw === null || raw === undefined) return undefined;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string') {
    const t = raw.trim();
    if (t === '' || /^null$/i.test(t)) return undefined;
    const n = Number(t);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

/** Intentional fill before normalize — must not drop the paired numeric score. */
export function isIntentionallyRecoveredScoreEvidence(text: string | null | undefined): boolean {
  const t = text?.trim() ?? '';
  if (!t) return false;
  return (
    /score\s+recovered\s+from\s+model\s+output/i.test(t) ||
    /score\s+present,\s+evidence\s+not\s+returned\s+by\s+model/i.test(t)
  );
}

export function normalizeScoresByEvidence(
  scores: Record<string, unknown> | null | undefined,
  keyEvidence: Record<string, string> | null | undefined,
): Record<string, number> {
  if (!scores) return {};
  const out: Record<string, number> = {};
  Object.entries(scores).forEach(([id, raw]) => {
    const num = coerceScoreToFiniteNumber(raw);
    if (num === undefined) return;
    const ev = keyEvidence?.[id];
    if (isNoEvidenceText(ev) && !isIntentionallyRecoveredScoreEvidence(ev)) return;
    out[id] = num;
  });
  return out;
}
