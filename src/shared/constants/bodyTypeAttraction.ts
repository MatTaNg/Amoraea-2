export const BODY_TYPE_ATTRACTION_IDS = ['Slim', 'Athletic', 'Average', 'Curvy', 'Heavyset'] as const;

export type BodyTypeAttractionId = (typeof BODY_TYPE_ATTRACTION_IDS)[number];

export const BODY_TYPE_ATTRACTION_OPTIONS = BODY_TYPE_ATTRACTION_IDS.map((label) => ({
  label,
  value: label,
}));

const CANONICAL_BY_LOWER = new Map<string, BodyTypeAttractionId>(
  BODY_TYPE_ATTRACTION_IDS.map((id) => [id.toLowerCase(), id]),
);

/**
 * Normalizes stored match-pref values (array, comma-separated string, or legacy shapes)
 * into canonical body-type ids.
 */
export function parseBodyTypeAttraction(raw: unknown): BodyTypeAttractionId[] {
  if (raw == null) return [];

  const pieces: string[] = Array.isArray(raw)
    ? raw.filter((x): x is string => typeof x === 'string').map((x) => x.trim())
    : typeof raw === 'string'
      ? raw
          .split(/[,;]+/)
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

  const out: BodyTypeAttractionId[] = [];
  const seen = new Set<BodyTypeAttractionId>();
  for (const item of pieces) {
    const canon = CANONICAL_BY_LOWER.get(item.toLowerCase());
    if (canon && !seen.has(canon)) {
      seen.add(canon);
      out.push(canon);
    }
  }
  return out;
}
