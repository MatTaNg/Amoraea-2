/**
 * Normalize common holistic JSON key variants (`pillar_scores`, `egoDevelopmentLevel`, etc.)
 * Duplicated from `src/utilities/parseHolisticModelJson.ts` — keep in sync with client scoring.
 */
function normalizeHolisticEgoIntForCoerce(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  const n =
    typeof raw === 'number'
      ? raw
      : typeof raw === 'string' && String(raw).trim() !== ''
        ? Number(String(raw).trim())
        : NaN;
  if (!Number.isFinite(n)) return null;
  const r = Math.round(n);
  if (r < 1 || r > 5) return null;
  return r;
}

export function coerceHolisticInterviewModelObject(parsed: unknown): Record<string, unknown> {
  if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { pillarScores: {} };
  }
  const o = parsed as Record<string, unknown>;
  const base = { ...o };
  delete base.ego_development_level;
  delete base.egoDevelopmentLevel;
  const pillarScores = o.pillarScores ?? o.pillar_scores;
  const keyEvidence = o.keyEvidence ?? o.key_evidence;
  const pillarConfidence = o.pillarConfidence ?? o.pillar_confidence;
  const egoFromNested =
    pillarScores != null && typeof pillarScores === 'object' && !Array.isArray(pillarScores)
      ? (pillarScores as Record<string, unknown>).ego_development_level ??
        (pillarScores as Record<string, unknown>).egoDevelopmentLevel
      : undefined;
  const egoNorm = normalizeHolisticEgoIntForCoerce(o.ego_development_level ?? o.egoDevelopmentLevel ?? egoFromNested);
  const skepticismModifier = o.skepticismModifier ?? o.skepticism_modifier;
  const communicationQuality = o.communicationQuality ?? o.communication_quality;
  const narrativeCoherence = o.narrativeCoherence ?? o.narrative_coherence;
  const behavioralSpecificity = o.behavioralSpecificity ?? o.behavioral_specificity;
  const notableInconsistencies = o.notableInconsistencies ?? o.notable_inconsistencies;
  const interviewSummary = o.interviewSummary ?? o.interview_summary;
  return {
    ...base,
    pillarScores: (pillarScores ?? {}) as Record<string, unknown>,
    ...(keyEvidence !== undefined ? { keyEvidence } : {}),
    ...(pillarConfidence !== undefined ? { pillarConfidence } : {}),
    ...(egoNorm != null ? { ego_development_level: egoNorm } : {}),
    ...(skepticismModifier !== undefined ? { skepticismModifier } : {}),
    ...(communicationQuality !== undefined ? { communicationQuality } : {}),
    ...(narrativeCoherence !== undefined ? { narrativeCoherence } : {}),
    ...(behavioralSpecificity !== undefined ? { behavioralSpecificity } : {}),
    ...(notableInconsistencies !== undefined ? { notableInconsistencies } : {}),
    ...(interviewSummary !== undefined ? { interviewSummary } : {}),
  };
}
