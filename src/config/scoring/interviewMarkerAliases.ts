/**
 * Back-compat aliases: historical stored pillars → current canonical ids.
 * Slices stay experimental; final pillars are the conservative set.
 */

export const LEGACY_TO_CANONICAL_INTERVIEW_MARKER: Record<string, string> = {
  contempt: 'destructive_conflict',
  attunement: 'responsiveness_support',
  commitment_threshold: 'commitment_persistence',
};

export const CANONICAL_TO_LEGACY_INTERVIEW_MARKER: Record<string, string> = {
  destructive_conflict: 'contempt',
  responsiveness_support: 'attunement',
  commitment_persistence: 'commitment_threshold',
};

/** Remap a stored pillar map onto current ids without dropping unknown keys. */
export function normalizeInterviewPillarScoreMap(
  raw: Record<string, number | null | undefined> | null | undefined,
): Record<string, number> {
  if (!raw) return {};
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value !== 'number' || !Number.isFinite(value)) continue;
    if (key in LEGACY_TO_CANONICAL_INTERVIEW_MARKER) continue;
    if (out[key] == null) out[key] = value;
  }
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value !== 'number' || !Number.isFinite(value)) continue;
    const canonical = LEGACY_TO_CANONICAL_INTERVIEW_MARKER[key];
    if (!canonical) continue;
    if (out[canonical] == null) out[canonical] = value;
  }
  return out;
}

/** Dual-write helper so older admin/report readers still see legacy keys. */
export function withLegacyInterviewPillarAliases(
  canonical: Record<string, number | null | undefined>,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(canonical)) {
    if (typeof value !== 'number' || !Number.isFinite(value)) continue;
    out[key] = value;
    const legacy = CANONICAL_TO_LEGACY_INTERVIEW_MARKER[key];
    if (legacy) out[legacy] = value;
  }
  return out;
}
