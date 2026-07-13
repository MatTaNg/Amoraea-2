/**
 * Canonical marker slice aggregation + depth signals (app + edge).
 * @see src/features/aria/aggregateMarkerScoresFromSlices.ts
 */
import {
  DEFAULT_DEFENSE_PATTERNS,
  defensePatternScoreSliceFromMarkerSlice,
  detectDefensePatterns,
  normalizeDefensePatternsForPersist,
  type DefensePatternsJson,
  type DefensePatternTranscriptMsg,
} from './defensePatternsDetection.ts';
import {
  CONTEMPT_EXPRESSION_WEIGHT,
  CONTEMPT_RECOGNITION_WEIGHT,
} from '../../../src/config/scoring/pillarRollup.ts';
import {
  computePersonalMomentConcretenessModifier,
  normalizeResponseConcreteness,
  normalizeMoment4Concreteness,
  type ResponseConcretenessLevel,
} from './personalMomentConcreteness.ts';
import {
  aggregatePersonalMomentEmotionalVocab,
  depthEnrichedMarkerSlices,
} from './personalMomentEmotionalVocab.ts';
import {
  disclosureCalibrationFromMarkerSlices,
  personalMomentWordCountsForDisclosure,
  sumUserWordsForInterviewMoment,
  type DisclosureCalibration,
  type DisclosureCalibrationTurn,
} from './disclosureCalibration.ts';
import { INTERVIEW_MARKER_IDS } from './interviewMarkers.ts';
import { countMentalizingOvercertaintyInMarkerSlices } from './mentalizingOvercertaintyFromTranscript.ts';
import {
  mergeAccountabilityPillarWhenM4SituationallyExempt,
  momentUserTextFromInterviewTranscript,
  resolveMoment4AccountabilitySituationalExempt,
  scoredAccountabilityFromSlice,
  type AccountabilityReweightMeta,
} from './moment4AccountabilitySituationalExempt.ts';

export {
  disclosureCalibrationFromMarkerSlices,
  personalMomentWordCountsForDisclosure,
} from './disclosureCalibration.ts';


const SKIPPED_BY_USER_FRUSTRATION_EVIDENCE =
  'Not scored — participant chose to skip the remaining prompt in this segment after a frustration signal.';

const NOT_ASSESSED_SESSION_ENDED_TECHNICAL_EVIDENCE =
  'Not assessed — session ended due to technical difficulties before this prompt was delivered.';

function isNotAssessedDueToTechnicalInterruption(text: string | null | undefined): boolean {
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

function isNoEvidenceText(text: string | null | undefined): boolean {
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

function coerceScoreToFiniteNumber(raw: unknown): number | undefined {
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

function isIntentionallyRecoveredScoreEvidence(text: string | null | undefined): boolean {
  const t = text?.trim() ?? '';
  if (!t) return false;
  return (
    /score\s+recovered\s+from\s+model\s+output/i.test(t) ||
    /score\s+present,\s+evidence\s+not\s+returned\s+by\s+model/i.test(t)
  );
}

function normalizeScoresByEvidence(
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

function coerceMentalizingOvercertaintyFromModelJson(parsed: {
  mentalizing_overcertainty?: unknown;
  keyEvidence?: Record<string, unknown> | null;
  scoringMetadata?: Record<string, unknown> | null;
}): boolean {
  const truthy = (raw: unknown): boolean => {
    if (raw === true) return true;
    if (typeof raw === 'string') {
      const t = raw.trim().toLowerCase();
      return t === 'true' || t === 'yes' || t === '1';
    }
    return false;
  };
  if (truthy(parsed.mentalizing_overcertainty)) return true;
  const ke = parsed.keyEvidence;
  if (ke && typeof ke === 'object' && !Array.isArray(ke)) {
    if (truthy(ke.mentalizing_overcertainty)) return true;
  }
  const sm = parsed.scoringMetadata;
  if (sm && typeof sm === 'object' && !Array.isArray(sm)) {
    if (truthy(sm.mentalizing_overcertainty)) return true;
  }
  return false;
}

export { countMentalizingOvercertaintyInMarkerSlices };

export type { DefensePatternsJson, DefensePatternTranscriptMsg } from './defensePatternsDetection';
export type { ResponseConcretenessLevel } from './personalMomentConcreteness';

export type MarkerScoreSlice = {
  pillarScores?: Record<string, number | null> | null;
  keyEvidence?: Record<string, string> | null;
  /** Scenario / personal-moment scorer: definitive internal-state claims without hedging (profile signal). */
  mentalizing_overcertainty?: boolean | null;
  /** Personal moments 4–5 only: model `response_concreteness` (absent | low | moderate | high). */
  response_concreteness?: string | null;
  /** Personal moments 4–5 only: LLM emotional vocabulary audit (distinct emotion words in user turns). */
  emotional_vocab_count?: number | null;
  emotional_vocab_words?: string[] | null;
  user_slice_word_count?: number | null;
  /** Personal moment scorer metadata (exemption flags, client probes, etc.). */
  scoringMetadata?: Record<string, unknown> | null;
} | null | undefined;

/** Minimal slice from `scenario_specific_patterns.moment_*_scores` rows (disclosure + gate helpers). */
export function markerSliceFromStoredScenarioMoment(raw: unknown): MarkerScoreSlice | null {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const ps = o.pillarScores;
  if (ps == null || typeof ps !== 'object' || Array.isArray(ps)) return null;
  const ke = o.keyEvidence;
  return {
    pillarScores: ps as Record<string, number | null>,
    keyEvidence:
      ke != null && typeof ke === 'object' && !Array.isArray(ke) ? (ke as Record<string, string>) : {},
    mentalizing_overcertainty: coerceMentalizingOvercertaintyFromModelJson({
      mentalizing_overcertainty: o.mentalizing_overcertainty,
      keyEvidence: ke != null && typeof ke === 'object' && !Array.isArray(ke) ? (ke as Record<string, unknown>) : null,
      scoringMetadata:
        o.scoringMetadata != null && typeof o.scoringMetadata === 'object' && !Array.isArray(o.scoringMetadata)
          ? (o.scoringMetadata as Record<string, unknown>)
          : null,
    }),
    response_concreteness: typeof o.response_concreteness === 'string' ? o.response_concreteness : null,
    user_slice_word_count: typeof o.user_slice_word_count === 'number' ? o.user_slice_word_count : undefined,
    scoringMetadata:
      o.scoringMetadata != null && typeof o.scoringMetadata === 'object' && !Array.isArray(o.scoringMetadata)
        ? (o.scoringMetadata as Record<string, unknown>)
        : null,
  };
}

export type PillarMomentLabel =
  | 'scenario_1'
  | 'scenario_2'
  | 'scenario_3'
  | 'moment_4'
  | 'moment_5';

export type LabeledMarkerSlice = {
  moment: PillarMomentLabel;
  pillarScores?: Record<string, number | null | undefined> | null;
  keyEvidence?: Record<string, string> | null;
  mentalizing_overcertainty?: boolean | null;
  response_concreteness?: string | null;
};

const SLICE_LABELS: PillarMomentLabel[] = [
  'scenario_1',
  'scenario_2',
  'scenario_3',
  'moment_4',
  'moment_5',
];

type StandardMarkerId = Exclude<
  (typeof INTERVIEW_MARKER_IDS)[number],
  'contempt' | 'commitment_threshold'
>;

/** Bump when rollup rules change (surfaced in admin recalculation_notes). */
export const PILLAR_ROLLUP_ALGORITHM_VERSION = 'scenario_only_integers_v3_m4_exempt_accountability';

export type PillarAggregateRollupOptions = {
  /** When true (default), apply M4 situational accountability reweight on top of v3 pooling. */
  applyM4AccountabilityExempt?: boolean;
};

/** Which interview moments may contribute numeric evidence to each pillar aggregate. */
const STANDARD_MARKER_ALLOWED_MOMENTS: Record<StandardMarkerId, Set<PillarMomentLabel>> = {
  repair: new Set(['scenario_1', 'scenario_2', 'scenario_3']),
  attunement: new Set(['scenario_1', 'scenario_2', 'scenario_3']),
  regulation: new Set(['scenario_3']),
  mentalizing: new Set(['scenario_1', 'scenario_2', 'scenario_3']),
  appreciation: new Set(['scenario_1', 'scenario_2']),
  accountability: new Set(['scenario_1', 'scenario_2', 'scenario_3']),
};

/** Contempt pillar: 60% pooled expression + 40% pooled recognition. */
function evidenceSupportsNumericRollup(keyEvidence: string | null | undefined): boolean {
  const trimmed = keyEvidence?.trim() ?? '';
  if (!trimmed) return true;
  if (/^\s*Level\s*[12]\s*[—–-]/i.test(trimmed)) return true;
  if (isIntentionallyRecoveredScoreEvidence(trimmed)) return true;
  return !isNoEvidenceText(trimmed);
}

function scoredValue(
  pillarScores: Record<string, number | null | undefined> | null | undefined,
  keyEvidence: Record<string, string> | null | undefined,
  key: string,
  moment?: PillarMomentLabel,
): number | null {
  if (!pillarScores) return null;
  const raw = pillarScores[key];
  if (isNotAssessedDueToTechnicalInterruption(keyEvidence?.[key])) return null;
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return null;
  const ev = keyEvidence?.[key];
  // Scenario A appreciation is supplementary; recovered-only S1 scores must not drag holistic down.
  if (
    key === 'appreciation' &&
    moment === 'scenario_1' &&
    isIntentionallyRecoveredScoreEvidence(ev)
  ) {
    return null;
  }
  if (!evidenceSupportsNumericRollup(ev)) return null;
  return raw;
}

function contemptExpressionForRow(row: LabeledMarkerSlice): number | null {
  const explicit = scoredValue(row.pillarScores, row.keyEvidence, 'contempt_expression');
  if (explicit != null) return explicit;
  const legacy = scoredValue(row.pillarScores, row.keyEvidence, 'contempt');
  if (legacy == null) return null;
  // Legacy monolithic `contempt` on Scenario A blended recognition reads; do not treat as participant expression.
  if (row.moment === 'scenario_1') return null;
  return legacy;
}

/** Mean of scenario-level integer scores → integer pillar value (0–10). */
function averageNonNull(values: number[]): number | undefined {
  if (values.length === 0) return undefined;
  const sum = values.reduce((a, b) => a + b, 0);
  return Math.round(sum / values.length);
}

export function commitmentThresholdFromSlice(slice: MarkerScoreSlice): number | null {
  if (!slice?.pillarScores) return null;
  const filtered = normalizeScoresByEvidence(slice.pillarScores, slice.keyEvidence);
  const v = filtered.commitment_threshold;
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/**
 * Sets `commitment_threshold` on aggregated scores from **Moment 4 only** (grudge + walk-away follow-up).
 * Scenario C no longer contributes commitment_threshold.
 */
export function mergeCommitmentThresholdWeighted(
  aggregated: Record<string, number>,
  _scenario3Slice: MarkerScoreSlice,
  moment4Slice: MarkerScoreSlice
): Record<string, number> {
  const m4 = commitmentThresholdFromSlice(moment4Slice);
  if (m4 == null) return aggregated;
  return {
    ...aggregated,
    commitment_threshold: Math.round(m4),
  };
}

/**
 * Single-scenario contempt for analytics / `score_consistency`: matches aggregate pillar logic —
 * 60% expression + 40% recognition when both exist; otherwise the available sub-score or legacy
 * monolithic `contempt` (older Scenario A rows).
 */
export function combinedContemptFromScenarioPillarScores(
  pillarScores: Record<string, number | null | undefined> | null | undefined,
  keyEvidence?: Record<string, string> | null
): number | null {
  if (!pillarScores) return null;
  const numOrNull = (
    key: 'contempt_expression' | 'contempt_recognition' | 'contempt',
    raw: number | null | undefined
  ): number | null => {
    if (isNotAssessedDueToTechnicalInterruption(keyEvidence?.[key])) return null;
    return typeof raw === 'number' && Number.isFinite(raw) ? raw : null;
  };
  const expr = numOrNull('contempt_expression', pillarScores.contempt_expression);
  const rec = numOrNull('contempt_recognition', pillarScores.contempt_recognition);
  const legacy = numOrNull('contempt', pillarScores.contempt);

  if (expr != null && rec != null) {
    return Math.round(CONTEMPT_EXPRESSION_WEIGHT * expr + CONTEMPT_RECOGNITION_WEIGHT * rec);
  }
  if (expr != null) return expr;
  if (rec != null) return rec;
  if (legacy != null) return legacy;
  return null;
}

export type MomentRestrictedAggregateResult = {
  scores: Record<string, number>;
  /** Count of moment-level numeric samples averaged into each pillar (contempt: 1–2 when combined from sub-pools). */
  contributorCounts: Record<string, number>;
};

/** Optional inputs for holistic ego + cross-scenario defense heuristics on aggregate. */
export type PillarAggregateHolisticMeta = {
  egoDevelopmentLevel?: number | null;
  /** When all three scenario pillar maps exist, used with slices to populate {@link PillarAggregateWithCommitmentDetailed.defensePatterns}. */
  defensePatternTranscript?: readonly DefensePatternTranscriptMsg[] | null;
  /** Tagged turns for disclosure calibration; defaults to {@link PillarAggregateHolisticMeta.defensePatternTranscript}. */
  disclosureCalibrationTranscript?: readonly DisclosureCalibrationTurn[] | null;
  /** Scenario user-turn emotional token density (%), e.g. from {@link scenarioEmotionalVocabDensityPercentFromTranscript}. */
  scenarioEmotionalVocabDensityPercent?: number | null;
  /** Full-interview emotional vocab density (%) from communication style / `language_markers` when available. */
  communicationStyleEmotionalVocabDensityPercent?: number | null;
  /** M4 user turns — used for situational accountability exemption heuristics on recompute. */
  moment4UserText?: string | null;
};

/** Holistic-only meta; echoed on aggregate for persistence alongside slice-derived pillars. */
export type PillarAggregateWithCommitmentDetailed = MomentRestrictedAggregateResult & {
  egoDevelopmentLevel?: number | null;
  /** Number of scenario / personal moments (1–5) with overcertainty: scorer flag **or** transcript heuristic. */
  mentalizingOvercertaintyCount: number;
  defensePatterns: DefensePatternsJson;
  /** Normalized personal-moment concreteness (null when unscored / invalid). */
  moment4Concreteness: ReturnType<typeof normalizeMoment4Concreteness>;
  moment5Concreteness: ResponseConcretenessLevel | null;
  /** Non-positive adjustment applied to weighted threshold in {@link computeGateResultCore}. */
  personalMomentConcretenessModifier: number;
  /** (distinct emotion-word counts / user words) × 100 across moments 4–5 when scorer fields are present. */
  personal_moment_emotional_vocab_density: number | null;
  personal_moment_emotional_vocab_low: boolean;
  disclosureCalibration: DisclosureCalibration;
  moment4AccountabilitySituationallyExempt?: boolean;
  moment4AccountabilityExemptReason?: string | null;
  accountabilityReweightMeta?: AccountabilityReweightMeta | null;
};

function coerceHolisticEgoLevelToInt(raw: unknown): number | null {
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

/** Normalize holistic model `ego_development_level` to 1–5 or null if missing/invalid. */
export function normalizeHolisticEgoLevel(raw: unknown): number | null {
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.log('[EgoDev] normalizeHolisticEgoLevel raw input:', raw, 'type:', typeof raw);
  }
  return coerceHolisticEgoLevelToInt(raw);
}

/**
 * Holistic JSON may omit `ego_development_level`, nest it under `pillarScores`, or use camelCase.
 * Returns first valid 1–5 level found, or null.
 */
export function extractEgoDevelopmentLevel(parsed: unknown): number | null {
  if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  const o = parsed as Record<string, unknown>;
  const candidates: unknown[] = [o.ego_development_level, o.egoDevelopmentLevel];
  const pillarScores = o.pillarScores ?? o.pillar_scores;
  if (pillarScores != null && typeof pillarScores === 'object' && !Array.isArray(pillarScores)) {
    const ps = pillarScores as Record<string, unknown>;
    candidates.push(ps.ego_development_level, ps.egoDevelopmentLevel);
  }
  for (const c of candidates) {
    const n = coerceHolisticEgoLevelToInt(c);
    if (n != null) return n;
  }
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.warn('[EgoDev] ego_development_level not found or invalid in parsed holistic response');
  }
  return null;
}

export function aggregateMarkerScoresFromLabeledSlices(
  rows: LabeledMarkerSlice[]
): MomentRestrictedAggregateResult {
  const out: Record<string, number> = {};
  const contributorCounts: Record<string, number> = {};

  for (const id of INTERVIEW_MARKER_IDS) {
    if (id === 'contempt' || id === 'commitment_threshold') continue;
    const allowed = STANDARD_MARKER_ALLOWED_MOMENTS[id];
    const vals: number[] = [];
    for (const row of rows) {
      if (!allowed.has(row.moment)) continue;
      const v = scoredValue(row.pillarScores, row.keyEvidence, id, row.moment);
      if (v != null) vals.push(v);
    }
    const avg = averageNonNull(vals);
    if (avg !== undefined) {
      out[id] = avg;
      contributorCounts[id] = vals.length;
    }
  }

  const expressionVals: number[] = [];
  const recognitionVals: number[] = [];
  for (const row of rows) {
    // Pooled contempt **expression** uses fictional scenario slices only — personal moments must not
    // dilute harsh vignette framing (M4 can read as low contempt for unrelated reasons).
    if (row.moment === 'scenario_1' || row.moment === 'scenario_2' || row.moment === 'scenario_3') {
      const ex = contemptExpressionForRow(row);
      if (ex != null) expressionVals.push(ex);
    }

    if (row.moment === 'scenario_1' || row.moment === 'moment_4') {
      const recExplicit = scoredValue(row.pillarScores, row.keyEvidence, 'contempt_recognition');
      if (recExplicit != null) {
        recognitionVals.push(recExplicit);
      } else if (row.moment === 'scenario_1') {
        const legacy = scoredValue(row.pillarScores, row.keyEvidence, 'contempt');
        if (legacy != null) recognitionVals.push(legacy);
      }
    }
  }

  const eAvg = averageNonNull(expressionVals);
  const rAvg = averageNonNull(recognitionVals);
  let contemptScore: number | undefined;
  if (eAvg !== undefined && rAvg !== undefined) {
    contemptScore = Math.round(CONTEMPT_EXPRESSION_WEIGHT * eAvg + CONTEMPT_RECOGNITION_WEIGHT * rAvg);
    contributorCounts.contempt = 2;
  } else if (eAvg !== undefined) {
    contemptScore = eAvg;
    contributorCounts.contempt = 1;
  } else if (rAvg !== undefined) {
    contemptScore = rAvg;
    contributorCounts.contempt = 1;
  }
  if (contemptScore !== undefined) out.contempt = contemptScore;

  return { scores: out, contributorCounts };
}

export function aggregateMarkerScoresFromSlicesDetailed(
  slices: Array<MarkerScoreSlice | null | undefined>
): MomentRestrictedAggregateResult {
  const rows: LabeledMarkerSlice[] = SLICE_LABELS.map((moment, i) => ({
    moment,
    pillarScores: slices[i]?.pillarScores ?? undefined,
    keyEvidence: slices[i]?.keyEvidence ?? undefined,
    mentalizing_overcertainty: slices[i]?.mentalizing_overcertainty ?? null,
    response_concreteness: slices[i]?.response_concreteness ?? null,
  }));
  return aggregateMarkerScoresFromLabeledSlices(rows);
}

/** @deprecated Prefer {@link aggregateMarkerScoresFromSlicesDetailed} when counts are needed. */
export function aggregateMarkerScoresFromSlices(
  slices: Array<MarkerScoreSlice | null | undefined>
): Record<string, number> {
  return aggregateMarkerScoresFromSlicesDetailed(slices).scores;
}

export function aggregatePillarScoresWithCommitmentMergeDetailed(
  slices: Array<MarkerScoreSlice | null | undefined>,
  holisticMeta?: PillarAggregateHolisticMeta | null,
  rollupOptions?: PillarAggregateRollupOptions,
): PillarAggregateWithCommitmentDetailed {
  const applyM4AccountabilityExempt = rollupOptions?.applyM4AccountabilityExempt !== false;
  const { scores: base, contributorCounts } = aggregateMarkerScoresFromSlicesDetailed(slices);
  let merged = mergeCommitmentThresholdWeighted(base, slices[2], slices[3]);

  let reweightMeta: AccountabilityReweightMeta | null = null;
  if (applyM4AccountabilityExempt) {
    const m4Slice = slices[3];
    const m5Slice = slices[4];
    const moment4UserText =
      holisticMeta?.moment4UserText?.trim() ||
      momentUserTextFromInterviewTranscript(holisticMeta?.disclosureCalibrationTranscript, 4) ||
      momentUserTextFromInterviewTranscript(holisticMeta?.defensePatternTranscript, 4);
    const exempt = resolveMoment4AccountabilitySituationalExempt({
      scoringMetadata: m4Slice?.scoringMetadata,
      disclosureText: moment4UserText || null,
      keyEvidence: m4Slice?.keyEvidence ?? null,
    });
    const scenarioAccountabilityScores = [0, 1, 2].map((i) =>
      scoredValue(slices[i]?.pillarScores, slices[i]?.keyEvidence, 'accountability'),
    );
    const { scores: accountabilityMerged, reweightMeta: meta } =
      mergeAccountabilityPillarWhenM4SituationallyExempt({
        baseScores: merged,
        scenarioAccountabilityScores,
        m4Accountability: scoredAccountabilityFromSlice(m4Slice?.pillarScores, m4Slice?.keyEvidence),
        m5Accountability: scoredAccountabilityFromSlice(m5Slice?.pillarScores, m5Slice?.keyEvidence),
        exempt,
      });
    merged = accountabilityMerged;
    reweightMeta = meta;
    if (reweightMeta) {
      contributorCounts.accountability = reweightMeta.weights.length;
      console.log('[M4AccountabilityExempt] accountability reweighted:', reweightMeta);
    }
  }

  const m4Slice = slices[3];
  const m5Slice = slices[4];
  const ctCount = commitmentThresholdFromSlice(slices[3]) != null ? 1 : 0;
  const overcertaintyTx =
    (holisticMeta?.defensePatternTranscript ?? holisticMeta?.disclosureCalibrationTranscript) ?? undefined;
  const mentalizingOvercertaintyCount = countMentalizingOvercertaintyInMarkerSlices(slices, overcertaintyTx);
  const discTx =
    (holisticMeta?.disclosureCalibrationTranscript ??
      holisticMeta?.defensePatternTranscript) as readonly DisclosureCalibrationTurn[] | null;
  const depthSlices = depthEnrichedMarkerSlices(slices, discTx);
  const defensePatterns = normalizeDefensePatternsForPersist(
    detectDefensePatterns(
      [
        defensePatternScoreSliceFromMarkerSlice(slices[0]),
        defensePatternScoreSliceFromMarkerSlice(slices[1]),
        defensePatternScoreSliceFromMarkerSlice(slices[2]),
      ],
      defensePatternScoreSliceFromMarkerSlice(depthSlices[3]),
      defensePatternScoreSliceFromMarkerSlice(depthSlices[4]),
      holisticMeta?.defensePatternTranscript ?? null,
    ),
  );
  const moment4Concreteness = normalizeMoment4Concreteness(depthSlices[3]?.response_concreteness);
  const moment5Concreteness = normalizeResponseConcreteness(depthSlices[4]?.response_concreteness);
  const personalMomentConcretenessModifier = computePersonalMomentConcretenessModifier(
    moment4Concreteness,
    moment5Concreteness,
  );
  const evAgg = aggregatePersonalMomentEmotionalVocab(depthSlices[3], depthSlices[4], {
    scenarioEmotionalVocabDensityPercent: holisticMeta?.scenarioEmotionalVocabDensityPercent ?? null,
    communicationStyleEmotionalVocabDensityPercent: holisticMeta?.communicationStyleEmotionalVocabDensityPercent ?? null,
  });
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.log(
      '[VocabFlag] density:',
      evAgg.personal_moment_emotional_vocab_density,
      'threshold:',
      0.3,
      'flag:',
      evAgg.personal_moment_emotional_vocab_low,
    );
  }
  const txForDisc = Array.isArray(discTx) ? discTx : [];
  const s4w = sumUserWordsForInterviewMoment(txForDisc, 4);
  const s5w = sumUserWordsForInterviewMoment(txForDisc, 5);
  const sliceWordsLog = (w: unknown): number | null =>
    typeof w === 'number' && Number.isFinite(w) && w >= 0 ? w : null;
  const moment4WordCount =
    sliceWordsLog(depthSlices[3]?.user_slice_word_count) ?? (s4w > 0 ? s4w : null);
  const moment5WordCount =
    sliceWordsLog(depthSlices[4]?.user_slice_word_count) ?? (s5w > 0 ? s5w : null);
  const disclosureCalibration = disclosureCalibrationFromMarkerSlices(depthSlices, discTx);
  console.log('[Disclosure] aggregation result:', disclosureCalibration);
  console.log('[Disclosure] calibration:', disclosureCalibration, {
    moment4Words: moment4WordCount,
    moment5Words: moment5WordCount,
    vocabDensity: evAgg.personal_moment_emotional_vocab_density,
    moment4Concreteness: moment4Concreteness,
    moment5Concreteness: moment5Concreteness,
  });
  const egoIn =
    holisticMeta?.egoDevelopmentLevel !== undefined && holisticMeta?.egoDevelopmentLevel !== null
      ? coerceHolisticEgoLevelToInt(holisticMeta.egoDevelopmentLevel)
      : null;
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.log('[EgoDev] aggregation input egoDevelopmentLevel:', holisticMeta?.egoDevelopmentLevel);
  }
  const result: PillarAggregateWithCommitmentDetailed = {
    scores: merged,
    contributorCounts: {
      ...contributorCounts,
      commitment_threshold: ctCount > 0 ? ctCount : merged.commitment_threshold != null ? 1 : 0,
    },
    egoDevelopmentLevel: egoIn,
    mentalizingOvercertaintyCount,
    defensePatterns,
    moment4Concreteness,
    moment5Concreteness,
    personalMomentConcretenessModifier,
    personal_moment_emotional_vocab_density: evAgg.personal_moment_emotional_vocab_density,
    personal_moment_emotional_vocab_low: evAgg.personal_moment_emotional_vocab_low,
    disclosureCalibration,
    moment4AccountabilitySituationallyExempt: reweightMeta != null,
    moment4AccountabilityExemptReason: reweightMeta?.reason ?? null,
    accountabilityReweightMeta: reweightMeta,
  };
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.log('[EgoDev] aggregation output egoDevelopmentLevel:', result.egoDevelopmentLevel);
  }
  return result;
}

/** Pillar map after moment rules + commitment merge (live interview, reprocess scripts, admin). */
export function aggregatePillarScoresWithCommitmentMerge(
  slices: Array<MarkerScoreSlice | null | undefined>
): Record<string, number> {
  return aggregatePillarScoresWithCommitmentMergeDetailed(slices).scores;
}
