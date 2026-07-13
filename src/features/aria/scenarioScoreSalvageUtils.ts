import { coerceScoreToFiniteNumber } from '@features/aria/probeEvidenceUtils';

export function ensureNumericScoreMap(
  markerIds: readonly string[],
  candidate: unknown,
): Record<string, number | null> {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return {};
  const out: Record<string, number | null> = {};
  for (const markerId of markerIds) {
    const n = coerceScoreToFiniteNumber((candidate as Record<string, unknown>)[markerId]);
    if (n !== undefined) out[markerId] = n;
  }
  return out;
}

export function ensureNumericScoreMapDeep(
  markerIds: readonly string[],
  candidate: unknown,
  depth = 0,
): Record<string, number | null> {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate) || depth > 5) return {};
  const direct = ensureNumericScoreMap(markerIds, candidate);
  if (Object.keys(direct).length > 0) return direct;
  for (const value of Object.values(candidate as Record<string, unknown>)) {
    if (!value || typeof value !== 'object') continue;
    const nested = ensureNumericScoreMapDeep(markerIds, value, depth + 1);
    if (Object.keys(nested).length > 0) return nested;
  }
  return {};
}

export function extractNumericScoresFromRawModelText(
  markerIds: readonly string[],
  rawText: string,
): Record<string, number | null> {
  const out: Record<string, number | null> = {};
  for (const markerId of markerIds) {
    const escaped = markerId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const keyValuePattern = new RegExp(`["']?${escaped}["']?\\s*[:=]\\s*(-?\\d+(?:\\.\\d+)?)`, 'i');
    const slashTenPattern = new RegExp(`["']?${escaped}["']?[^\\d\\n]{0,20}(\\d+(?:\\.\\d+)?)\\s*\\/\\s*10`, 'i');
    const m = rawText.match(keyValuePattern) ?? rawText.match(slashTenPattern);
    if (!m) continue;
    const n = Number(m[1]);
    if (Number.isFinite(n)) out[markerId] = n;
  }
  return out;
}
