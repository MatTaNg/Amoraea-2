/** Canonical labels stored in `matchPreferences.ethnicityAttraction`. */
export const ETHNICITY_ATTRACTION_OPEN_TO_ALL = 'Open to All';

export const ETHNICITY_ATTRACTION_OPTIONS = [
  'Black',
  'Asian',
  'Hispanic / Latino',
  'Middle Eastern',
  'White',
  'Mixed Race',
  'Indigenous',
  ETHNICITY_ATTRACTION_OPEN_TO_ALL,
] as const;

/** Maps legacy onboarding labels to current canonical values. */
const LEGACY_ETHNICITY_ATTRACTION_MAP: Record<string, string> = {
  'Open to all': ETHNICITY_ATTRACTION_OPEN_TO_ALL,
  'Black / African': 'Black',
  'East Asian': 'Asian',
  'South Asian': 'Asian',
  'Southeast Asian': 'Asian',
  'White / European': 'White',
  Mixed: 'Mixed Race',
};

/**
 * Normalizes stored ethnicity attraction (including legacy strings) for UI and toggling.
 */
export function normalizeEthnicityAttractionStored(raw: unknown): string[] {
  const arr = Array.isArray(raw)
    ? raw.map((item) => String(item).trim()).filter(Boolean)
    : [];
  const mapped = arr.map((s) => LEGACY_ETHNICITY_ATTRACTION_MAP[s] ?? s);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of mapped) {
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}
