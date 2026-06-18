/** Per-slice mentalizing scores and scorer notes used for report narrative calibration only. */
export type PersonalReportMentalizingProfile = {
  scenario1: number | null;
  scenario2: number | null;
  scenario3: number | null;
  moment4: number | null;
  holisticPillar: number | null;
  scenarioAverage: number | null;
  moment4GapFromScenarioAverage: number | null;
  keyEvidence: {
    scenario1: string | null;
    scenario2: string | null;
    scenario3: string | null;
    moment4: string | null;
  };
};

export type UnderdisclosureNarrativeTier = 'none' | 'mild' | 'strong';

const SUBSTANTIVE_CONCRETENESS = new Set(['high', 'valid_non_applicable']);
const THIN_CONCRETENESS = new Set(['low', 'absent']);

export function isSubstantivePersonalMomentConcreteness(
  value: string | null | undefined,
): boolean {
  if (!value) return false;
  return SUBSTANTIVE_CONCRETENESS.has(value.trim().toLowerCase());
}

export function isThinPersonalMomentConcreteness(value: string | null | undefined): boolean {
  if (!value) return true;
  return THIN_CONCRETENESS.has(value.trim().toLowerCase());
}

/**
 * underdisclosure (word-count ratio vs scenario responses) is a weaker signal on its own
 * than it appears — it can fire for naturally concise communicators who are still
 * substantive. Only generate strong "you are hard to know" narrative when underdisclosure
 * co-occurs with low/absent concreteness on the SAME moments. If concreteness is high or
 * valid_non_applicable, underdisclosure alone should produce at most a mild, low-stakes note.
 */
export function resolveUnderdisclosureNarrativeTier(input: {
  disclosureCalibration: string | null | undefined;
  moment4Concreteness: string | null | undefined;
  moment5Concreteness: string | null | undefined;
}): UnderdisclosureNarrativeTier {
  if ((input.disclosureCalibration ?? '').toLowerCase() !== 'underdisclosure') {
    return 'none';
  }
  if (
    isSubstantivePersonalMomentConcreteness(input.moment4Concreteness) ||
    isSubstantivePersonalMomentConcreteness(input.moment5Concreteness)
  ) {
    return 'mild';
  }
  if (
    isThinPersonalMomentConcreteness(input.moment4Concreteness) &&
    isThinPersonalMomentConcreteness(input.moment5Concreteness)
  ) {
    return 'strong';
  }
  return 'mild';
}

export function averageNonNull(values: Array<number | null | undefined>): number | null {
  const nums = values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export function buildMentalizingAsymmetryNote(profile: PersonalReportMentalizingProfile): string | null {
  const gap = profile.moment4GapFromScenarioAverage;
  if (gap == null || gap < 2) return null;
  const scenarioAvg =
    profile.scenarioAverage != null ? profile.scenarioAverage.toFixed(1).replace(/\.0$/, '') : 'higher';
  const m4 =
    profile.moment4 != null ? profile.moment4.toFixed(0) : 'lower on self-directed reflection';
  const m4Evidence = profile.keyEvidence.moment4?.trim();
  const evidenceHint = m4Evidence ? ` Scorer note on your self-reflection moment: "${m4Evidence.slice(0, 220)}".` : '';
  return (
    `Other-directed mentalizing (reading fictional scenarios) averaged ~${scenarioAvg} across scenarios, ` +
    `while self-directed mentalizing on your personal grudge/reflection moment scored ${m4} — a gap of ${gap.toFixed(0)}+ points.${evidenceHint} ` +
    `When this gap is present, name it explicitly: you read others' inner worlds with real precision, ` +
    `but turn that same quality of attention toward your own experience less often — without averaging the gap away into uniform praise.`
  );
}

export type StoredSliceKeyEvidence = Record<string, string>;

export type PersonalReportMoment5Profile = {
  pillarScores: Record<string, number | null> | null;
  keyEvidence: StoredSliceKeyEvidence | null;
};

export type PersonalReportScenarioKeyEvidence = {
  scenario1: StoredSliceKeyEvidence | null;
  scenario2: StoredSliceKeyEvidence | null;
  scenario3: StoredSliceKeyEvidence | null;
};

function parseStoredSliceRecord(raw: unknown): Record<string, unknown> | null {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  return raw as Record<string, unknown>;
}

export function parsePillarScoresFromStoredSlice(
  raw: unknown,
): Record<string, number | null> | null {
  const o = parseStoredSliceRecord(raw);
  const ps = o?.pillarScores;
  if (ps == null || typeof ps !== 'object' || Array.isArray(ps)) return null;
  const out: Record<string, number | null> = {};
  for (const [k, v] of Object.entries(ps as Record<string, unknown>)) {
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
    else if (v === null) out[k] = null;
  }
  return Object.keys(out).length > 0 ? out : null;
}

export function parseKeyEvidenceFromStoredSlice(raw: unknown): StoredSliceKeyEvidence | null {
  const o = parseStoredSliceRecord(raw);
  const ke = o?.keyEvidence;
  if (ke == null || typeof ke !== 'object' || Array.isArray(ke)) return null;
  const out: StoredSliceKeyEvidence = {};
  for (const [k, v] of Object.entries(ke as Record<string, unknown>)) {
    if (typeof v === 'string' && v.trim()) out[k] = v.trim();
  }
  return Object.keys(out).length > 0 ? out : null;
}

export function parseMoment5ProfileFromStoredPatterns(
  patterns: Record<string, unknown> | null | undefined,
): PersonalReportMoment5Profile | null {
  const m5Raw = patterns?.moment_5_scores;
  if (m5Raw == null) return null;
  const pillarScores = parsePillarScoresFromStoredSlice(m5Raw);
  const keyEvidence = parseKeyEvidenceFromStoredSlice(m5Raw);
  if (!pillarScores && !keyEvidence) return null;
  return { pillarScores, keyEvidence };
}

export function parseMentalizingFromStoredSlice(raw: unknown): {
  mentalizing: number | null;
  keyEvidenceMentalizing: string | null;
} {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { mentalizing: null, keyEvidenceMentalizing: null };
  }
  const o = raw as Record<string, unknown>;
  const ps = o.pillarScores;
  const ke = o.keyEvidence;
  const pillarScores =
    ps != null && typeof ps === 'object' && !Array.isArray(ps)
      ? (ps as Record<string, unknown>)
      : null;
  const keyEvidence =
    ke != null && typeof ke === 'object' && !Array.isArray(ke)
      ? (ke as Record<string, unknown>)
      : null;
  const mentalizing =
    typeof pillarScores?.mentalizing === 'number' && Number.isFinite(pillarScores.mentalizing)
      ? pillarScores.mentalizing
      : null;
  const keyEvidenceMentalizing =
    typeof keyEvidence?.mentalizing === 'string' ? keyEvidence.mentalizing.trim() : null;
  return { mentalizing, keyEvidenceMentalizing };
}
