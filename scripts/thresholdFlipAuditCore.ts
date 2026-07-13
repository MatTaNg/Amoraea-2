/**
 * Shared old (6.0) vs new (6.5) interview gate flip audit logic.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  recalculateAttemptScoresFromStoredSlices,
  type AdminRecalculateAttemptInput,
} from '../src/features/aria/adminRecalculateAttemptScores';
import type { GateFailCode } from '../src/features/aria/computeGateResultCore';
import {
  GATE_MARKER_FLOORS,
  GATE_PASS_WEIGHTED_MIN,
} from '../src/features/aria/computeGateResultCore';
import type { DefenseCrossReferenceResult } from '../src/features/psychometrics/crossReferenceDefenseDetection';
import {
  computeGamingCorrection,
  instrumentComponentsFromModifierResult,
} from '../src/features/psychometrics/computeGamingCorrection';
import { computePsychometricModifier } from '../src/features/psychometrics/computePsychometricModifier';
import { computeUncertaintyScore } from '../src/features/psychometrics/computeUncertaintyScore';
import { mergePsychometricFloorsIntoGateState } from '../src/features/psychometrics/psychometricFloorBreaches';
import {
  coercePsychometricScore,
  psychometricFloorScoresFromUserRow,
  sd3NarcissismResponsesFromUserRow,
  sd3NarcissismScoreFromUserRow,
  userHasPsychometricScoresForScoring,
} from '../src/features/psychometrics/usersPsychometricsSchemaFallback';
import { INTERVIEW_MARKER_IDS, type InterviewMarkerId } from '../src/features/aria/interviewMarkers';
import {
  MENTALIZING_REPAIR_LOW_SCENARIO_COUNT_FAIL,
  MENTALIZING_REPAIR_SCENARIO_PASS_MIN,
  pillarScoreAssessedInScenario,
  type ScenarioGateIndex,
} from '../src/features/aria/mentalizingRepairScenarioFloor';
import { buildScenarioCompositesTriple } from '../src/features/aria/scenarioCompositeFloor';
import { SCENARIO_COMPOSITE_PASS_MIN } from '../src/features/aria/scenarioCompositeFloor';

export const EXPECTED_OLD_PASS = 59;
export const EXPECTED_NEW_PASS = 35;

export const USER_PSYCH_SELECT = `
  id,
  psychometrics_brs_score,
  psychometrics_brs_responses,
  psychometrics_anxiety_trait_score,
  psychometrics_anxiety_trait_responses,
  psychometrics_scs_sf_score,
  psychometrics_scs_sf_responses,
  psychometrics_gasp_score,
  psychometrics_gasp_responses,
  psychometrics_dweck_score,
  psychometrics_dweck_responses,
  psychometrics_aaq2_score,
  psychometrics_rses_score,
  psychometrics_aaq2_responses,
  psychometrics_rses_responses,
  psychometrics_scs_public_score,
  psychometrics_scs_private_score,
  psychometrics_sd3_narcissism_score,
  psychometrics_sd3_narcissism_responses,
  psychometrics_npi_entitlement_score,
  psychometrics_narq_s_score,
  psychometrics_narq_s_responses,
  psychometrics_rfq_score,
  psychometrics_rfq_responses,
  psychometrics_completed_at
`;

export const OLD_WEIGHTED_PASS_MIN = 6.0;
export const OLD_MARKER_FLOORS: Partial<Record<InterviewMarkerId, number>> = {
  contempt: 5.0,
  accountability: 4.5,
  repair: 4.5,
  regulation: 4.0,
};
export const OLD_SCENARIO_COMPOSITE_MIN = 4.5;

export const NEW_WEIGHTED_PASS_MIN = GATE_PASS_WEIGHTED_MIN;
export const NEW_MARKER_FLOORS = GATE_MARKER_FLOORS;
export const NEW_SCENARIO_COMPOSITE_MIN = SCENARIO_COMPOSITE_PASS_MIN;

const INVARIANT_FAIL_CODES: GateFailCode[] = ['immature_defense_pattern', 'ego_development_floor'];

export type GateAuditConfig = {
  label: string;
  weightedPassMin: number;
  markerFloors: Partial<Record<InterviewMarkerId, number>>;
  scenarioCompositeMin: number;
};

export const OLD_CONFIG: GateAuditConfig = {
  label: 'old',
  weightedPassMin: OLD_WEIGHTED_PASS_MIN,
  markerFloors: OLD_MARKER_FLOORS,
  scenarioCompositeMin: OLD_SCENARIO_COMPOSITE_MIN,
};

export const NEW_CONFIG: GateAuditConfig = {
  label: 'new',
  weightedPassMin: NEW_WEIGHTED_PASS_MIN,
  markerFloors: NEW_MARKER_FLOORS,
  scenarioCompositeMin: NEW_SCENARIO_COMPOSITE_MIN,
};

export type ThresholdFlipAttemptRow = AdminRecalculateAttemptInput & {
  id: string;
  user_id: string;
  completed_at: string;
  passed?: boolean | null;
  final_gate_pass?: boolean | null;
};

export type FloorBreach = {
  kind: 'holistic' | 'scenario' | 'mentalizing' | 'repair';
  label: string;
  score: number;
  floor: number;
  changedBetweenConfigs: boolean;
};

export type GateEval = {
  pass: boolean;
  failCodes: GateFailCode[];
  breaches: FloorBreach[];
};

export type FlipReason = 'score_threshold_only' | 'floor_change_only' | 'both' | 'unrelated';

export type AttemptAudit = {
  attemptId: string;
  userId: string;
  modifiedScore: number;
  weightedScore: number | null;
  finalModifiedScore: number | null;
  oldGateResult: boolean;
  newGateResult: boolean;
  oldFinalGateResult: boolean;
  newFinalGateResult: boolean;
  flipped: boolean;
  flipDirection: 'pass_to_fail' | 'fail_to_pass' | null;
  flipReason: FlipReason | null;
  flipDetail: string;
  oldFailCodes: GateFailCode[];
  newFailCodes: GateFailCode[];
  oldBreaches: FloorBreach[];
  newBreaches: FloorBreach[];
  pillarScores: Record<string, number | null | undefined>;
  storedPassed: boolean | null;
  storedFinalGatePass: boolean | null;
};

function isAssessedScore(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0;
}

function parseSlicePillarScores(raw: unknown): Record<string, number | null | undefined> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  const ps = obj.pillarScores ?? obj.pillar_scores;
  if (!ps || typeof ps !== 'object' || Array.isArray(ps)) return null;
  return ps as Record<string, number | null | undefined>;
}

export function scenarioMapsFromRow(row: ThresholdFlipAttemptRow): Partial<
  Record<ScenarioGateIndex, Record<string, number | null | undefined> | null | undefined>
> {
  return {
    1: parseSlicePillarScores(row.scenario_1_scores),
    2: parseSlicePillarScores(row.scenario_2_scores),
    3: parseSlicePillarScores(row.scenario_3_scores),
  };
}

function floorChangedBetweenConfigs(kind: FloorBreach['kind'], label: string): boolean {
  if (kind === 'holistic') {
    const id = label as InterviewMarkerId;
    return OLD_MARKER_FLOORS[id] !== NEW_MARKER_FLOORS[id];
  }
  if (kind === 'scenario') return OLD_SCENARIO_COMPOSITE_MIN !== NEW_SCENARIO_COMPOSITE_MIN;
  return false;
}

function collectFloorBreaches(
  pillarScores: Record<string, number | null | undefined>,
  scenarioMaps: Partial<
    Record<ScenarioGateIndex, Record<string, number | null | undefined> | null | undefined>
  >,
  config: GateAuditConfig,
): FloorBreach[] {
  const breaches: FloorBreach[] = [];

  for (const id of INTERVIEW_MARKER_IDS) {
    const floor = config.markerFloors[id];
    if (floor === undefined) continue;
    const score = pillarScores[id];
    if (!isAssessedScore(score)) continue;
    if (score < floor) {
      breaches.push({
        kind: 'holistic',
        label: id,
        score,
        floor,
        changedBetweenConfigs: floorChangedBetweenConfigs('holistic', id),
      });
    }
  }

  const composites = buildScenarioCompositesTriple(scenarioMaps);
  for (const idx of [1, 2, 3] as const) {
    const c = composites[String(idx) as '1' | '2' | '3'];
    if (c != null && c < config.scenarioCompositeMin) {
      breaches.push({
        kind: 'scenario',
        label: `S${idx} composite`,
        score: c,
        floor: config.scenarioCompositeMin,
        changedBetweenConfigs: true,
      });
    }
  }

  for (const pillar of ['mentalizing', 'repair'] as const) {
    let lowCount = 0;
    let worst: { scenario: ScenarioGateIndex; score: number } | null = null;
    for (const n of [1, 2, 3] as const) {
      const ps = scenarioMaps[n];
      if (!ps || typeof ps !== 'object') continue;
      const v = ps[pillar];
      if (!pillarScoreAssessedInScenario(v)) continue;
      if (v < MENTALIZING_REPAIR_SCENARIO_PASS_MIN) {
        lowCount++;
        if (!worst || v < worst.score) worst = { scenario: n, score: v };
      }
    }
    if (lowCount >= MENTALIZING_REPAIR_LOW_SCENARIO_COUNT_FAIL && worst) {
      breaches.push({
        kind: pillar,
        label: `${pillar} S${worst.scenario}`,
        score: worst.score,
        floor: MENTALIZING_REPAIR_SCENARIO_PASS_MIN,
        changedBetweenConfigs: false,
      });
    }
  }

  return breaches;
}

export function evaluateInterviewGate(
  pillarScores: Record<string, number | null | undefined>,
  scenarioMaps: Partial<
    Record<ScenarioGateIndex, Record<string, number | null | undefined> | null | undefined>
  >,
  modifiedScore: number,
  invariantFailCodes: GateFailCode[],
  config: GateAuditConfig,
): GateEval {
  const breaches = collectFloorBreaches(pillarScores, scenarioMaps, config);
  const holisticBreach = breaches.some((b) => b.kind === 'holistic');
  const failCodes: GateFailCode[] = [...invariantFailCodes];

  if (!holisticBreach) {
    if (breaches.some((b) => b.kind === 'scenario')) failCodes.push('scenario_floor');
    if (breaches.some((b) => b.kind === 'mentalizing')) failCodes.push('mentalizing_floor');
    if (breaches.some((b) => b.kind === 'repair')) failCodes.push('repair_floor');
  }
  if (modifiedScore < config.weightedPassMin) failCodes.push('weighted_score');

  const unique = [...new Set(failCodes)];
  const pass = !holisticBreach && unique.length === 0 && modifiedScore >= config.weightedPassMin;
  return { pass, failCodes: unique, breaches };
}

function buildUncertaintyInput(
  attempt: Record<string, unknown>,
  user: Record<string, unknown>,
  straightLineFlags: string[],
  gamingCorrectionLevel?: number | null,
) {
  const pillars = (attempt.pillar_scores as Record<string, number> | null) ?? null;
  return {
    weighted_score: coercePsychometricScore(attempt.weighted_score),
    pillar_scores: pillars,
    scenario_composites: (attempt.scenario_composites as Record<string, number> | null) ?? null,
    mentalizing_overcertainty_count: coercePsychometricScore(attempt.mentalizing_overcertainty_count),
    defense_patterns: (attempt.defense_patterns as Record<string, boolean> | null) ?? null,
    review_flags: Array.isArray(attempt.review_flags) ? (attempt.review_flags as string[]) : null,
    personal_moment_emotional_vocab_low:
      attempt.personal_moment_emotional_vocab_low === true ? true : null,
    disclosure_calibration:
      typeof attempt.disclosure_calibration === 'string' ? attempt.disclosure_calibration : null,
    scenario_1_scores: (attempt.scenario_1_scores as Record<string, unknown> | null) ?? null,
    scenario_2_scores: (attempt.scenario_2_scores as Record<string, unknown> | null) ?? null,
    scenario_3_scores: (attempt.scenario_3_scores as Record<string, unknown> | null) ?? null,
    psychometric_straight_line_flags: straightLineFlags,
    psychometrics_gasp_externalization_score: coercePsychometricScore(user.psychometrics_gasp_score),
    psychometrics_aaq2_score: coercePsychometricScore(user.psychometrics_aaq2_score),
    psychometrics_brs_score: coercePsychometricScore(user.psychometrics_brs_score),
    psychometrics_anxiety_trait_score: coercePsychometricScore(user.psychometrics_anxiety_trait_score),
    psychometrics_rses_score: coercePsychometricScore(user.psychometrics_rses_score),
    psychometrics_scs_sf_score: coercePsychometricScore(user.psychometrics_scs_sf_score),
    psychometrics_dweck_score: coercePsychometricScore(user.psychometrics_dweck_score),
    psychometrics_sd3_narcissism_score: sd3NarcissismScoreFromUserRow(user),
    psychometrics_npi_entitlement_score: coercePsychometricScore(user.psychometrics_npi_entitlement_score),
    psychometrics_rfq_score: coercePsychometricScore(user.psychometrics_rfq_score),
    psychometrics_scs_public_score: coercePsychometricScore(user.psychometrics_scs_public_score),
    psychometrics_scs_private_score: coercePsychometricScore(user.psychometrics_scs_private_score),
    reasoning_pending: attempt.reasoning_pending === true,
    defenseCrossReference:
      (attempt.defense_cross_reference as DefenseCrossReferenceResult | null) ?? null,
    gamingCorrectionLevel,
  };
}

function computeFinalGatePass(
  interviewAttempt: Record<string, unknown>,
  user: Record<string, unknown> | null,
  interviewFailReasons: string[],
  finalPassThreshold: number,
): { pass: boolean; finalModifiedScore: number | null } {
  const modifiedWeighted =
    typeof interviewAttempt.modified_weighted_score === 'number' &&
    Number.isFinite(interviewAttempt.modified_weighted_score)
      ? interviewAttempt.modified_weighted_score
      : typeof interviewAttempt.weighted_score === 'number' &&
          Number.isFinite(interviewAttempt.weighted_score)
        ? interviewAttempt.weighted_score
        : null;

  if (!user || !userHasPsychometricScoresForScoring(user)) {
    return {
      pass:
        interviewFailReasons.length === 0 &&
        modifiedWeighted != null &&
        modifiedWeighted >= finalPassThreshold,
      finalModifiedScore: modifiedWeighted,
    };
  }

  const pillars = (interviewAttempt.pillar_scores as Record<string, number> | null) ?? {};
  const psychResult = computePsychometricModifier(
    {
      brsScore: coercePsychometricScore(user.psychometrics_brs_score),
      anxietyTraitScore: coercePsychometricScore(user.psychometrics_anxiety_trait_score),
      scsSfScore: coercePsychometricScore(user.psychometrics_scs_sf_score),
      gaspScore: coercePsychometricScore(user.psychometrics_gasp_score),
      dweckScore: coercePsychometricScore(user.psychometrics_dweck_score),
      aaq2Score: coercePsychometricScore(user.psychometrics_aaq2_score),
      rsesScore: coercePsychometricScore(user.psychometrics_rses_score),
      sd3NarcissismScore: sd3NarcissismScoreFromUserRow(user),
      npiEntitlementScore: coercePsychometricScore(user.psychometrics_npi_entitlement_score),
      rfqScore: coercePsychometricScore(user.psychometrics_rfq_score),
    },
    {
      disclosureCalibration: interviewAttempt.disclosure_calibration as string | null,
      moment5Concreteness: interviewAttempt.moment_5_concreteness as string | null,
      moment4Concreteness: interviewAttempt.moment_4_concreteness as string | null,
      personalMomentVocabDensity: coercePsychometricScore(
        interviewAttempt.personal_moment_emotional_vocab_density,
      ),
      regulationPillar: pillars.regulation ?? null,
      accountabilityPillar: pillars.accountability ?? null,
      egoDevelopmentLevel: coercePsychometricScore(interviewAttempt.ego_development_level),
      attunementPillar: pillars.attunement ?? null,
      contemptPillar: pillars.contempt ?? null,
      mentalizingPillar: pillars.mentalizing ?? null,
    },
    {
      brs: user.psychometrics_brs_responses as Record<number, number> | undefined,
      anxiety_trait: user.psychometrics_anxiety_trait_responses as Record<number, number> | undefined,
      scs_sf: user.psychometrics_scs_sf_responses as Record<number, number> | undefined,
      gasp: user.psychometrics_gasp_responses as Record<number, number> | undefined,
      dweck: user.psychometrics_dweck_responses as Record<number, number> | undefined,
      aaq2: user.psychometrics_aaq2_responses as Record<number, number> | undefined,
      rses: user.psychometrics_rses_responses as Record<number, number> | undefined,
      sd3_narcissism: sd3NarcissismResponsesFromUserRow(user) as Record<number, number> | undefined,
      rfq: user.psychometrics_rfq_responses as Record<number, number> | undefined,
    },
  );

  const uncertaintyPass1 = computeUncertaintyScore(
    buildUncertaintyInput(interviewAttempt, user, psychResult.straightLineFlags),
  );

  const gamingCorrection = computeGamingCorrection({
    instrumentComponents: instrumentComponentsFromModifierResult(psychResult),
    totalModifier: psychResult.modifier,
    straightLineFlags: psychResult.straightLineFlags,
    uncertaintyScore: uncertaintyPass1.total,
    pillarScores: {
      mentalizing: pillars.mentalizing ?? null,
      accountability: pillars.accountability ?? null,
      contempt: pillars.contempt ?? null,
      regulation: pillars.regulation ?? null,
    },
    psychometricScores: {
      rfq: coercePsychometricScore(user.psychometrics_rfq_score),
      gasp: coercePsychometricScore(user.psychometrics_gasp_score),
      brs: coercePsychometricScore(user.psychometrics_brs_score),
      scs_sf: coercePsychometricScore(user.psychometrics_scs_sf_score),
      aaq2: coercePsychometricScore(user.psychometrics_aaq2_score),
      rses: coercePsychometricScore(user.psychometrics_rses_score),
      sd3_narcissism: sd3NarcissismScoreFromUserRow(user),
      npi_entitlement: coercePsychometricScore(user.psychometrics_npi_entitlement_score),
      dweck: coercePsychometricScore(user.psychometrics_dweck_score),
    },
  });

  const depthSignalModifiedScore = modifiedWeighted ?? 0;
  const finalModifiedScore =
    Math.round((depthSignalModifiedScore + gamingCorrection.correctedModifier) * 100) / 100;

  const floorScores = psychometricFloorScoresFromUserRow(user);
  const { gateFailReasons: allFailReasons } = mergePsychometricFloorsIntoGateState({
    existingFailReasons: interviewFailReasons,
    existingDetail: null,
    scores: floorScores,
    straightLineFlags: psychResult.straightLineFlags,
    attemptId: String(interviewAttempt.id ?? ''),
    userId: String(interviewAttempt.user_id ?? ''),
  });

  return {
    pass: allFailReasons.length === 0 && finalModifiedScore >= finalPassThreshold,
    finalModifiedScore,
  };
}

function gateFailCodesToStrings(codes: GateFailCode[]): string[] {
  return codes;
}

export function formatFloorList(config: GateAuditConfig): string {
  const parts = Object.entries(config.markerFloors)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}≥${v}`);
  parts.push(`scenario_composite≥${config.scenarioCompositeMin}`);
  parts.push(
    `mentalizing/repair≥${MENTALIZING_REPAIR_SCENARIO_PASS_MIN} in ${MENTALIZING_REPAIR_LOW_SCENARIO_COUNT_FAIL}+ scenarios`,
  );
  return parts.join(', ');
}

export function categorizeFlip(a: {
  modifiedScore: number;
  oldEval: GateEval;
  newEval: GateEval;
}): { reason: FlipReason; detail: string } {
  const { modifiedScore, oldEval, newEval } = a;
  const newChangedBreaches = newEval.breaches.filter((b) => b.changedBetweenConfigs);
  const newChangedOnly = newChangedBreaches.filter(
    (nb) =>
      !oldEval.breaches.some(
        (ob) => ob.kind === nb.kind && ob.label === nb.label && ob.score === nb.score,
      ),
  );

  const inThresholdBand =
    modifiedScore >= OLD_WEIGHTED_PASS_MIN && modifiedScore < NEW_WEIGHTED_PASS_MIN;
  const passesNewScoreAlone = modifiedScore >= NEW_WEIGHTED_PASS_MIN;
  const hasNewChangedFloor = newChangedOnly.length > 0;

  if (inThresholdBand && !hasNewChangedFloor) {
    return {
      reason: 'score_threshold_only',
      detail: `score ${modifiedScore.toFixed(2)} in [6.0, 6.5); no changed-floor breach under new config`,
    };
  }
  if (passesNewScoreAlone && hasNewChangedFloor) {
    const b = newChangedOnly[0]!;
    return {
      reason: 'floor_change_only',
      detail: `${b.label} ${b.score.toFixed(2)} < ${b.floor.toFixed(1)} (was ${OLD_MARKER_FLOORS[b.label as InterviewMarkerId] ?? OLD_SCENARIO_COMPOSITE_MIN} under old config)`,
    };
  }
  if (inThresholdBand && hasNewChangedFloor) {
    const b = newChangedOnly[0]!;
    return {
      reason: 'both',
      detail: `score ${modifiedScore.toFixed(2)} in [6.0, 6.5) + ${b.label} ${b.score.toFixed(2)} < ${b.floor.toFixed(1)}`,
    };
  }

  const oldCodes = oldEval.failCodes.join(',') || 'none';
  const newCodes = newEval.failCodes.join(',') || 'none';
  return {
    reason: 'unrelated',
    detail: `score=${modifiedScore.toFixed(2)}; old fails=[${oldCodes}]; new fails=[${newCodes}]`,
  };
}

function recomputeAllSilently(rows: ThresholdFlipAttemptRow[]) {
  const prevLog = console.log;
  console.log = () => {};
  try {
    return rows.map((row) =>
      recalculateAttemptScoresFromStoredSlices(row, {
        skipScenarioTranscriptMutations: true,
        usePersistedGateContext: false,
      }),
    );
  } finally {
    console.log = prevLog;
  }
}

export async function fetchUsersByIds(
  supabase: SupabaseClient,
  userIds: string[],
): Promise<Map<string, Record<string, unknown>>> {
  const map = new Map<string, Record<string, unknown>>();
  const unique = [...new Set(userIds)];
  for (let i = 0; i < unique.length; i += 100) {
    const chunk = unique.slice(i, i + 100);
    const { data, error } = await supabase.from('users').select(USER_PSYCH_SELECT).in('id', chunk);
    if (error) throw error;
    for (const row of data ?? []) {
      map.set(String((row as { id: string }).id), row as Record<string, unknown>);
    }
  }
  return map;
}

export function computeThresholdFlipAudits(
  raw: ThresholdFlipAttemptRow[],
  usersById: Map<string, Record<string, unknown>>,
): {
  audits: AttemptAudit[];
  scorableCount: number;
  productionNewPassCount: number;
} {
  const recomputed = recomputeAllSilently(raw);
  const scorable = raw
    .map((row, i) => ({ row, result: recomputed[i]! }))
    .filter(({ result }) => result.kind === 'success');

  const audits: AttemptAudit[] = [];

  for (const { row, result } of scorable) {
    const gate = result.gate;
    const modifiedScore = gate.modifiedWeightedScore ?? gate.weightedScore ?? 0;
    const weightedScore = gate.weightedScore ?? null;
    const pillarScores = result.pillar_scores;
    const scenarioMaps = scenarioMapsFromRow(row);
    const invariantFails = (gate.failReasonCodes ?? []).filter((c) =>
      INVARIANT_FAIL_CODES.includes(c),
    );

    const oldEval = evaluateInterviewGate(
      pillarScores,
      scenarioMaps,
      modifiedScore,
      invariantFails,
      OLD_CONFIG,
    );
    const newEval = evaluateInterviewGate(
      pillarScores,
      scenarioMaps,
      modifiedScore,
      invariantFails,
      NEW_CONFIG,
    );

    const interviewAttempt: Record<string, unknown> = {
      id: row.id,
      user_id: row.user_id,
      weighted_score: gate.weightedScore ?? null,
      modified_weighted_score: modifiedScore,
      pillar_scores: pillarScores,
      gate_fail_reasons: gateFailCodesToStrings(oldEval.failCodes),
      scenario_composites: result.scenarioCompositesJson,
      mentalizing_overcertainty_count: result.mentalizingOvercertaintyCount,
      defense_patterns: result.defense_patterns,
      disclosure_calibration: result.disclosure_calibration,
      moment_4_concreteness: result.moment_4_concreteness,
      moment_5_concreteness: result.moment_5_concreteness,
      personal_moment_emotional_vocab_density: result.personal_moment_emotional_vocab_density,
      personal_moment_emotional_vocab_low: result.personal_moment_emotional_vocab_low,
      ego_development_level: result.ego_development_level,
      review_flags: row.review_flags,
      reasoning_pending: row.reasoning_pending,
      scenario_1_scores: row.scenario_1_scores,
      scenario_2_scores: row.scenario_2_scores,
      scenario_3_scores: row.scenario_3_scores,
    };

    const user = usersById.get(row.user_id) ?? null;
    const prevLog = console.log;
    console.log = () => {};
    const oldFinal = computeFinalGatePass(
      interviewAttempt,
      user,
      gateFailCodesToStrings(oldEval.failCodes),
      OLD_WEIGHTED_PASS_MIN,
    );
    const newFinal = computeFinalGatePass(
      {
        ...interviewAttempt,
        gate_fail_reasons: gateFailCodesToStrings(newEval.failCodes),
      },
      user,
      gateFailCodesToStrings(newEval.failCodes),
      NEW_WEIGHTED_PASS_MIN,
    );
    console.log = prevLog;

    const flipped = oldEval.pass !== newEval.pass;
    let flipDirection: AttemptAudit['flipDirection'] = null;
    let flipReason: FlipReason | null = null;
    let flipDetail = '';

    if (flipped) {
      flipDirection = oldEval.pass && !newEval.pass ? 'pass_to_fail' : 'fail_to_pass';
      const cat = categorizeFlip({ modifiedScore, oldEval, newEval });
      flipReason = cat.reason;
      flipDetail = cat.detail;
    }

    audits.push({
      attemptId: row.id,
      userId: row.user_id,
      modifiedScore,
      weightedScore,
      finalModifiedScore: newFinal.finalModifiedScore,
      oldGateResult: oldEval.pass,
      newGateResult: newEval.pass,
      oldFinalGateResult: oldFinal.pass,
      newFinalGateResult: newFinal.pass,
      flipped,
      flipDirection,
      flipReason,
      flipDetail,
      oldFailCodes: oldEval.failCodes,
      newFailCodes: newEval.failCodes,
      oldBreaches: oldEval.breaches,
      newBreaches: newEval.breaches,
      pillarScores,
      storedPassed: row.passed ?? null,
      storedFinalGatePass: row.final_gate_pass ?? null,
    });
  }

  return {
    audits,
    scorableCount: scorable.length,
    productionNewPassCount: scorable.filter(({ result }) => result.gate.pass === true).length,
  };
}
