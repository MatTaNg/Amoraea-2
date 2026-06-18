/**
 * Compare interview gate pass/fail under old (6.0) vs new (6.5) threshold + floor configs.
 *
 * Usage: npx tsx --env-file=.env scripts/auditThresholdFlips.ts
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  recalculateAttemptScoresFromStoredSlices,
  type AdminRecalculateAttemptInput,
} from '../src/features/aria/adminRecalculateAttemptScores';
import type { GateFailCode } from '../src/features/aria/computeGateResultCore';
import {
  computeGateResultCore,
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

/** Manual baseline from prior admin review (reconcile in BASELINE RECONCILIATION section). */
const EXPECTED_OLD_PASS = 59;
const EXPECTED_NEW_PASS = 35;

const USER_PSYCH_SELECT = `
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

/** Pre d7e49d5 "New floors and modifiers" (parent commit). */
const OLD_WEIGHTED_PASS_MIN = 6.0;
const OLD_MARKER_FLOORS: Partial<Record<InterviewMarkerId, number>> = {
  contempt: 5.0,
  accountability: 4.5,
  repair: 4.5,
  regulation: 4.0,
};
const OLD_SCENARIO_COMPOSITE_MIN = 4.5;

const NEW_WEIGHTED_PASS_MIN = GATE_PASS_WEIGHTED_MIN;
const NEW_MARKER_FLOORS = GATE_MARKER_FLOORS;
const NEW_SCENARIO_COMPOSITE_MIN = SCENARIO_COMPOSITE_PASS_MIN;

const INVARIANT_FAIL_CODES: GateFailCode[] = ['immature_defense_pattern', 'ego_development_floor'];

type GateAuditConfig = {
  label: string;
  weightedPassMin: number;
  markerFloors: Partial<Record<InterviewMarkerId, number>>;
  scenarioCompositeMin: number;
};

const OLD_CONFIG: GateAuditConfig = {
  label: 'old',
  weightedPassMin: OLD_WEIGHTED_PASS_MIN,
  markerFloors: OLD_MARKER_FLOORS,
  scenarioCompositeMin: OLD_SCENARIO_COMPOSITE_MIN,
};

const NEW_CONFIG: GateAuditConfig = {
  label: 'new',
  weightedPassMin: NEW_WEIGHTED_PASS_MIN,
  markerFloors: NEW_MARKER_FLOORS,
  scenarioCompositeMin: NEW_SCENARIO_COMPOSITE_MIN,
};

const ATTEMPT_SELECT = `
  id,
  user_id,
  completed_at,
  is_phantom,
  transcript,
  scenario_1_scores,
  scenario_2_scores,
  scenario_3_scores,
  scenario_specific_patterns,
  ego_development_level,
  language_markers,
  skip_count,
  skip_penalty_total,
  auto_failed,
  defense_patterns,
  mentalizing_overcertainty_count,
  personal_moment_emotional_vocab_density,
  personal_moment_emotional_vocab_low,
  review_flags,
  reasoning_pending,
  probe_log,
  passed,
  final_gate_pass
`;

type RawRow = AdminRecalculateAttemptInput & {
  id: string;
  user_id: string;
  completed_at: string;
  passed?: boolean | null;
  final_gate_pass?: boolean | null;
};

type FloorBreach = {
  kind: 'holistic' | 'scenario' | 'mentalizing' | 'repair';
  label: string;
  score: number;
  floor: number;
  changedBetweenConfigs: boolean;
};

type GateEval = {
  pass: boolean;
  failCodes: GateFailCode[];
  breaches: FloorBreach[];
};

type FlipReason = 'score_threshold_only' | 'floor_change_only' | 'both' | 'unrelated';

type AttemptAudit = {
  userId: string;
  modifiedScore: number;
  finalModifiedScore: number | null;
  oldGateResult: boolean;
  newGateResult: boolean;
  oldFinalGateResult: boolean;
  newFinalGateResult: boolean;
  flipped: boolean;
  flipDirection: 'pass_to_fail' | 'fail_to_pass' | null;
  flipReason: FlipReason | null;
  flipDetail: string;
  oldBreaches: FloorBreach[];
  newBreaches: FloorBreach[];
  storedPassed: boolean | null;
  storedFinalGatePass: boolean | null;
};

function mergeEnvFromDotenvFile(): void {
  try {
    const path = join(process.cwd(), '.env');
    if (!existsSync(path)) return;
    const txt = readFileSync(path, 'utf8');
    for (const line of txt.split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const eq = t.indexOf('=');
      if (eq < 1) continue;
      const k = t.slice(0, eq).trim();
      let v = t.slice(eq + 1).trim();
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      if (process.env[k] === undefined) process.env[k] = v;
    }
  } catch {
    /* ignore */
  }
}

function createAdminClient(): SupabaseClient {
  const supabaseUrl =
    process.env.SUPABASE_URL?.trim() ?? process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ??
    process.env.EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!supabaseUrl || !serviceKey) {
    console.error('Missing Supabase env (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)');
    process.exit(1);
  }
  return createClient(supabaseUrl, serviceKey);
}

function shortUserId(userId: string): string {
  return userId.slice(0, 8);
}

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

function scenarioMapsFromRow(row: RawRow): Partial<
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
    const oldF = OLD_MARKER_FLOORS[id];
    const newF = NEW_MARKER_FLOORS[id];
    return oldF !== newF;
  }
  if (kind === 'scenario') return OLD_SCENARIO_COMPOSITE_MIN !== NEW_SCENARIO_COMPOSITE_MIN;
  return false; // mentalizing/repair scenario floors unchanged (4.0 in 2+ scenarios)
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

function evaluateInterviewGate(
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

async function fetchUsersByIds(
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
      pass: interviewFailReasons.length === 0 && modifiedWeighted != null && modifiedWeighted >= finalPassThreshold,
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

function formatFloorList(config: GateAuditConfig): string {
  const parts = Object.entries(config.markerFloors)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}≥${v}`);
  parts.push(`scenario_composite≥${config.scenarioCompositeMin}`);
  parts.push(
    `mentalizing/repair≥${MENTALIZING_REPAIR_SCENARIO_PASS_MIN} in ${MENTALIZING_REPAIR_LOW_SCENARIO_COUNT_FAIL}+ scenarios`,
  );
  return parts.join(', ');
}

function categorizeFlip(a: {
  modifiedScore: number;
  oldEval: GateEval;
  newEval: GateEval;
}): { reason: FlipReason; detail: string } {
  const { modifiedScore, oldEval, newEval } = a;
  const oldChangedBreaches = oldEval.breaches.filter((b) => b.changedBetweenConfigs);
  const newChangedBreaches = newEval.breaches.filter((b) => b.changedBetweenConfigs);
  const newChangedOnly = newChangedBreaches.filter(
    (nb) =>
      !oldEval.breaches.some(
        (ob) => ob.kind === nb.kind && ob.label === nb.label && ob.score === nb.score,
      ),
  );

  const inThresholdBand = modifiedScore >= OLD_WEIGHTED_PASS_MIN && modifiedScore < NEW_WEIGHTED_PASS_MIN;
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

function recomputeAllSilently(rows: RawRow[]) {
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

async function fetchCompletedAttempts(supabase: SupabaseClient): Promise<RawRow[]> {
  const pageSize = 1000;
  const all: RawRow[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('interview_attempts')
      .select(ATTEMPT_SELECT)
      .not('completed_at', 'is', null)
      .or('is_phantom.eq.false,is_phantom.is.null')
      .order('completed_at', { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    const batch = (data ?? []) as RawRow[];
    all.push(...batch);
    if (batch.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

function printFlipList(
  title: string,
  items: AttemptAudit[],
  formatter: (a: AttemptAudit) => string,
): void {
  console.log(`${title}: ${items.length} attempts`);
  if (items.length === 0) {
    console.log('  (none)');
    return;
  }
  for (const a of items) {
    console.log(`  ${formatter(a)}`);
  }
  console.log('');
}

async function main(): Promise<void> {
  mergeEnvFromDotenvFile();
  const supabase = createAdminClient();
  const raw = await fetchCompletedAttempts(supabase);
  const usersById = await fetchUsersByIds(
    supabase,
    raw.map((r) => r.user_id),
  );
  const recomputed = recomputeAllSilently(raw);
  const scorable = raw
    .map((row, i) => ({ row, result: recomputed[i]! }))
    .filter(({ result }) => result.kind === 'success');

  const audits: AttemptAudit[] = [];
  let thresholdOnlyOldPass = 0;

  for (const { row, result } of scorable) {
    const gate = result.gate;
    const modifiedScore = gate.modifiedWeightedScore ?? gate.weightedScore ?? 0;
    const pillarScores = result.pillar_scores;
    const scenarioMaps = scenarioMapsFromRow(row);
    const invariantFails = (gate.failReasonCodes ?? []).filter((c) => INVARIANT_FAIL_CODES.includes(c));

    const oldEval = evaluateInterviewGate(pillarScores, scenarioMaps, modifiedScore, invariantFails, OLD_CONFIG);
    const newEval = evaluateInterviewGate(pillarScores, scenarioMaps, modifiedScore, invariantFails, NEW_CONFIG);

    if (
      computeGateResultCore(pillarScores, null, {
        scenarioPillarScoresByScenario: scenarioMaps,
        weightedPassMin: OLD_WEIGHTED_PASS_MIN,
        egoDevelopmentLevel: result.ego_development_level,
        defensePatterns: result.defense_patterns,
        moment4Concreteness: result.moment_4_concreteness,
        moment5Concreteness: result.moment_5_concreteness,
        disclosureCalibration: result.disclosure_calibration,
        mentalizingOvercertaintyCount: result.mentalizingOvercertaintyCount,
        personalMomentEmotionalVocabDensity: result.personal_moment_emotional_vocab_density,
        personalMomentEmotionalVocabLow: result.personal_moment_emotional_vocab_low,
        skipPenaltyTotal:
          typeof row.skip_penalty_total === 'number' ? row.skip_penalty_total : undefined,
        skipAutoFail: row.auto_failed === true,
      }).pass
    ) {
      thresholdOnlyOldPass++;
    }

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
      userId: row.user_id,
      modifiedScore,
      finalModifiedScore: newFinal.finalModifiedScore,
      oldGateResult: oldEval.pass,
      newGateResult: newEval.pass,
      oldFinalGateResult: oldFinal.pass,
      newFinalGateResult: newFinal.pass,
      flipped,
      flipDirection,
      flipReason,
      flipDetail,
      oldBreaches: oldEval.breaches,
      newBreaches: newEval.breaches,
      storedPassed: row.passed ?? null,
      storedFinalGatePass: row.final_gate_pass ?? null,
    });
  }

  const oldPassCount = audits.filter((a) => a.oldGateResult).length;
  const newPassCount = audits.filter((a) => a.newGateResult).length;
  const oldFinalPassCount = audits.filter((a) => a.oldFinalGateResult).length;
  const newFinalPassCount = audits.filter((a) => a.newFinalGateResult).length;
  const productionNewPassCount = scorable.filter(({ result }) => result.gate.pass === true).length;
  const storedPassedCount = audits.filter((a) => a.storedPassed === true).length;
  const storedPassedAllCompleted = raw.filter((r) => r.passed === true).length;
  const storedFinalCount = audits.filter((a) => a.storedFinalGatePass === true).length;
  const passToFail = audits.filter((a) => a.flipDirection === 'pass_to_fail');
  const failToPass = audits.filter((a) => a.flipDirection === 'fail_to_pass');

  const oldMatches = oldPassCount === EXPECTED_OLD_PASS ? 'Y' : 'N';
  const newMatches = newPassCount === EXPECTED_NEW_PASS ? 'Y' : 'N';
  const oldFinalMatches = oldFinalPassCount === EXPECTED_OLD_PASS ? 'Y' : 'N';
  const newFinalMatches = newFinalPassCount === EXPECTED_NEW_PASS ? 'Y' : 'N';
  const storedPassedMatches = storedPassedCount === EXPECTED_OLD_PASS ? 'Y' : 'N';

  console.log('THRESHOLD/FLOOR FLIP AUDIT');
  console.log('=============================');
  console.log(`Old config: threshold ${OLD_WEIGHTED_PASS_MIN}, floors [${formatFloorList(OLD_CONFIG)}]`);
  console.log(`New config: threshold ${NEW_WEIGHTED_PASS_MIN}, floors [${formatFloorList(NEW_CONFIG)}]`);
  console.log('');
  console.log(`Total attempts analyzed: ${audits.length}`);
  console.log('');
  console.log('BASELINE RECONCILIATION (scorable cohort, N=75)');
  console.log('------------------------------------------------');
  console.log(`Interview gate — old config:              ${oldPassCount} (expected ${EXPECTED_OLD_PASS}: ${oldMatches})`);
  console.log(`Interview gate — new config:              ${newPassCount} (expected ${EXPECTED_NEW_PASS}: ${newMatches})`);
  console.log(`Interview gate — production recompute:  ${productionNewPassCount}`);
  console.log(`Final gate (psych+6.0) — old interview:   ${oldFinalPassCount} (expected ${EXPECTED_OLD_PASS}: ${oldFinalMatches})`);
  console.log(`Final gate (psych+6.5) — new interview:   ${newFinalPassCount} (expected ${EXPECTED_NEW_PASS}: ${newFinalMatches})`);
  console.log(`Threshold-only old (6.0, current floors): ${thresholdOnlyOldPass}`);
  console.log(`Stored DB passed (scorable / all ${raw.length}): ${storedPassedCount} / ${storedPassedAllCompleted} (expected ${EXPECTED_OLD_PASS}: ${storedPassedMatches})`);
  console.log(`Stored DB final_gate_pass:                ${storedFinalCount}`);
  console.log('');

  const baselineOk =
    (oldPassCount === EXPECTED_OLD_PASS && newPassCount === EXPECTED_NEW_PASS) ||
    (oldFinalPassCount === EXPECTED_OLD_PASS && newFinalPassCount === EXPECTED_NEW_PASS);

  if (!baselineOk) {
    console.log('*** COUNT MISMATCH — interview-only baselines do not match 59/35 ***');
    console.log(
      'Likely causes: (1) manual 59 used stored DB `passed` at persist-time, (2) final_gate_pass baseline differs from interview-only,',
    );
    console.log(
      'or (3) scores shifted since manual check (disclosure-calibration / rollup). Flip breakdown below uses recomputed interview gate.',
    );
    console.log('');
  } else if (oldFinalPassCount === EXPECTED_OLD_PASS && newFinalPassCount === EXPECTED_NEW_PASS) {
    console.log('Note: 59/35 baseline matches FINAL gate (interview floors + psychometric overlay + threshold).');
    console.log('');
  }

  console.log(`Total flipped interview pass (pass→fail): ${passToFail.length}`);
  console.log(`Total flipped interview pass (fail→pass): ${failToPass.length}${failToPass.length > 0 ? ' — investigate (config tightened)' : ''}`);
  console.log('');

  const byReason = (reason: FlipReason) => passToFail.filter((a) => a.flipReason === reason);

  console.log('FLIP REASON BREAKDOWN');
  console.log('========================');

  printFlipList(
    'score_threshold_only',
    byReason('score_threshold_only'),
    (a) =>
      `${shortUserId(a.userId)}, modified=${a.modifiedScore.toFixed(2)}, old=${a.oldGateResult ? 'PASS' : 'FAIL'}, new=${a.newGateResult ? 'PASS' : 'FAIL'}`,
  );

  printFlipList(
    'floor_change_only',
    byReason('floor_change_only'),
    (a) => {
      const b = a.newBreaches.find((x) => x.changedBetweenConfigs) ?? a.newBreaches[0];
      const oldFloor =
        b?.kind === 'holistic'
          ? (OLD_MARKER_FLOORS[b.label as InterviewMarkerId] ?? '?')
          : OLD_SCENARIO_COMPOSITE_MIN;
      return `${shortUserId(a.userId)}, modified=${a.modifiedScore.toFixed(2)}, ${b?.label ?? '?'} ${b?.score.toFixed(2) ?? '?'} (floor ${b?.floor.toFixed(1) ?? '?'}, was ${oldFloor})`;
    },
  );

  printFlipList(
    'both',
    byReason('both'),
    (a) => `${shortUserId(a.userId)}, modified=${a.modifiedScore.toFixed(2)}, ${a.flipDetail}`,
  );

  printFlipList(
    'unrelated',
    byReason('unrelated'),
    (a) => `${shortUserId(a.userId)}, modified=${a.modifiedScore.toFixed(2)}, ${a.flipDetail}`,
  );

  console.log('RECOMMENDED REVIEW PRIORITY');
  console.log('==============================');

  const thresholdFlips = byReason('score_threshold_only')
    .slice()
    .sort((a, b) => Math.abs(a.modifiedScore - NEW_WEIGHTED_PASS_MIN) - Math.abs(b.modifiedScore - NEW_WEIGHTED_PASS_MIN));
  console.log('score_threshold_only — closest to 6.5 first:');
  if (thresholdFlips.length === 0) {
    console.log('  (none)');
  } else {
    for (const a of thresholdFlips) {
      const dist = Math.abs(a.modifiedScore - NEW_WEIGHTED_PASS_MIN);
      console.log(
        `  ${shortUserId(a.userId)}, modified=${a.modifiedScore.toFixed(2)}, distance from 6.5=${dist.toFixed(2)}`,
      );
    }
  }
  console.log('');

  const floorFlips = byReason('floor_change_only')
    .slice()
    .sort((a, b) => {
      const ba = a.newBreaches.find((x) => x.changedBetweenConfigs);
      const bb = b.newBreaches.find((x) => x.changedBetweenConfigs);
      const da = ba ? ba.floor - ba.score : 99;
      const db = bb ? bb.floor - bb.score : 99;
      return da - db;
    });
  console.log('floor_change_only — closest to breaching floor first:');
  if (floorFlips.length === 0) {
    console.log('  (none)');
  } else {
    for (const a of floorFlips) {
      const b = a.newBreaches.find((x) => x.changedBetweenConfigs) ?? a.newBreaches[0]!;
      const dist = b.floor - b.score;
      console.log(
        `  ${shortUserId(a.userId)}, ${b.label}, score=${b.score.toFixed(2)}, floor=${b.floor.toFixed(1)}, distance=${dist.toFixed(2)}`,
      );
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
