// ─── TYPES ────────────────────────────────────────────────────────────────────

import { UNCERTAINTY_ROUTING_THRESHOLD } from '@features/psychometrics/computeUncertaintyScore';

export interface AttemptRecord {
  id: string;
  user_id: string;
  created_at: string;
  completed_at: string | null;
  weighted_score: number | null;
  modified_weighted_score: number | null;
  passed: boolean | null;
  final_gate_pass: boolean | null;
  pillar_scores: Record<string, number> | null;
  scenario_1_scores: Record<string, unknown> | null;
  scenario_2_scores: Record<string, unknown> | null;
  scenario_3_scores: Record<string, unknown> | null;
  scenario_composites: Record<string, number> | null;
  depth_signal_modifier: number | null;
  score_modifier: number | null;
  ego_development_level: number | null;
  disclosure_calibration: string | null;
  moment_4_concreteness: string | null;
  moment_5_concreteness: string | null;
  personal_moment_emotional_vocab_density: number | null;
  mentalizing_overcertainty_count: number | null;
  defense_patterns: Record<string, boolean> | null;
  emotion_recognition_raw_score: number | null;
  gate_fail_reasons: string[] | null;
  review_flags: string[] | null;
  reasoning_pending: boolean | null;
  scenario_1_recovered: boolean;
  scenario_2_recovered: boolean;
  scenario_3_recovered: boolean;
  algorithm_era: 'early' | 'mid' | 'current';
  uncertainty_score?: number | null;
  uncertainty_breakdown?: { activeFlags?: string[] } | null;
}

export interface UserRecord {
  id: string;
  email: string | null;
  full_name: string | null;
  display_name: string | null;
  psychometrics_completed_at: string | null;
  psychometrics_aaq2_score: number | null;
  psychometrics_rses_score: number | null;
  psychometrics_brs_score: number | null;
  psychometrics_scs_public_score: number | null;
  psychometrics_scs_private_score: number | null;
  psychometric_modifier: number | null;
}

export interface OverviewAnalytics {
  sampleSize: {
    total: number;
    passed: number;
    failed: number;
    passRate: number;
    withDepthSignals: number;
    withPsychometrics: number;
    withScoreRecovery: number;
  };
  cronbachAlpha: {
    pillars: number | null;
    scenarios: number | null;
    sufficient: boolean;
    minimumNeeded: number;
  };
  pillarDistributions: Record<string, PillarStats>;
  scenarioCorrelations: {
    s1s2: number | null;
    s1s3: number | null;
    s2s3: number | null;
  };
  thresholdAnalysis: {
    scoreDistribution: ScoreBucket[];
    borderlineCount: number;
    wouldFlipWithModifier: number;
    modifierImpactSummary: ModifierImpactRow[];
  };
  algorithmVersionAnalysis: {
    eras: EraStats[];
    alphaDrift: boolean;
  };
  scoreRecoveryAnalysis: {
    totalRecoveredAttempts: number;
    recoveryRate: number;
    alphaWithRecovery: number | null;
    alphaWithoutRecovery: number | null;
  };
  depthSignalSummary: {
    egoDistribution: Record<string, number>;
    defensePatternRates: Record<string, number>;
    disclosureDistribution: Record<string, number>;
    concretenessDistribution: Record<string, number>;
    avgModifier: number;
    modifierDistribution: ModifierBucket[];
  };
  convergentValidity: {
    sufficient: boolean;
    correlations: ConvergentCorrelation[];
  };
  uncertaintyDistribution: {
    green: number;
    amber: number;
    red: number;
    greenPct: number;
    amberPct: number;
    redPct: number;
    averageScore: number | null;
    commonFlags: { flag: string; count: number }[];
    trendByEra: { era: string; averageScore: number; count: number }[];
  };
  userDrilldown: UserSummaryRow[];
}

export interface PillarStats {
  name: string;
  mean: number;
  std: number;
  min: number;
  max: number;
  variance: number;
  lowVarianceWarning: boolean;
  distribution: Record<string, number>;
}

export interface ScoreBucket {
  range: string;
  count: number;
  percentage: number;
}

export interface ModifierImpactRow {
  attemptId: string;
  userName: string | null;
  baseScore: number;
  modifiedScore: number;
  basePass: boolean;
  modifiedPass: boolean;
  flipped: boolean;
}

export interface EraStats {
  era: string;
  count: number;
  alpha: number | null;
  meanScore: number;
  passRate: number;
}

export interface ModifierBucket {
  range: string;
  count: number;
}

export interface ConvergentCorrelation {
  pillar: string;
  psychometric: string;
  expectedDirection: 'positive' | 'negative';
  correlation: number | null;
  n: number;
  interpretation: string;
  validating: boolean | null;
}

export interface UserSummaryRow {
  userId: string;
  userName: string | null;
  attemptId: string;
  weightedScore: number | null;
  modifiedScore: number | null;
  passed: boolean | null;
  egoLevel: number | null;
  depthModifier: number | null;
  algorithmEra: string;
  hasRecovery: boolean;
  hasPsychometrics: boolean;
}

const PILLAR_NAMES = [
  'repair',
  'contempt',
  'attunement',
  'regulation',
  'mentalizing',
  'appreciation',
  'accountability',
  'commitment_threshold',
] as const;

const THRESHOLD = 6.0;
const MIN_ALPHA_SAMPLE = 30;

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function variance(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  return values.reduce((sum, v) => sum + Math.pow(v - m, 2), 0) / (values.length - 1);
}

function std(values: number[]): number {
  return Math.sqrt(variance(values));
}

function pearsonCorrelation(xs: number[], ys: number[]): number | null {
  if (xs.length !== ys.length || xs.length < 5) return null;
  const mx = mean(xs);
  const my = mean(ys);
  const num = xs.reduce((sum, x, i) => sum + (x - mx) * (ys[i] - my), 0);
  const den = Math.sqrt(
    xs.reduce((sum, x) => sum + Math.pow(x - mx, 2), 0) *
      ys.reduce((sum, y) => sum + Math.pow(y - my, 2), 0),
  );
  if (den === 0) return null;
  return Math.round((num / den) * 1000) / 1000;
}

export function computeCronbachAlpha(matrix: number[][]): number | null {
  if (matrix.length < 10) return null;
  const k = matrix[0]?.length ?? 0;
  if (k < 2) return null;

  const itemVariances = Array.from({ length: k }, (_, i) => {
    const col = matrix.map((row) => row[i]);
    return variance(col);
  });

  const totalScores = matrix.map((row) => row.reduce((a, b) => a + b, 0));
  const totalVar = variance(totalScores);

  if (totalVar === 0) return null;

  const sumItemVar = itemVariances.reduce((a, b) => a + b, 0);
  const alpha = (k / (k - 1)) * (1 - sumItemVar / totalVar);

  return Math.round(alpha * 1000) / 1000;
}

export function detectScoreRecovery(scenarioScores: Record<string, unknown> | null): boolean {
  if (!scenarioScores) return false;
  const evidence = scenarioScores.keyEvidence as Record<string, string> | null;
  if (!evidence) return false;
  return Object.values(evidence).some(
    (v) => typeof v === 'string' && v.includes('Score recovered from model output'),
  );
}

/** Era boundaries — adjust when major scoring deployments land. */
export function assignAlgorithmEra(createdAt: string): 'early' | 'mid' | 'current' {
  const date = new Date(createdAt);
  if (date < new Date('2026-04-01')) return 'early';
  if (date < new Date('2026-05-01')) return 'mid';
  return 'current';
}

function scenarioComposite(
  composites: Record<string, number> | null | undefined,
  key: '1' | '2' | '3',
): number | null {
  if (!composites) return null;
  const v = composites[key] ?? composites[`scenario_${key}`];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function depthModifierForAttempt(a: AttemptRecord): number | null {
  const v = a.depth_signal_modifier ?? a.score_modifier;
  return v != null && Number.isFinite(v) ? v : null;
}

// ─── MAIN COMPUTATION ─────────────────────────────────────────────────────────

export function computeOverviewAnalytics(
  attempts: AttemptRecord[],
  users: UserRecord[],
): OverviewAnalytics {
  const userMap = new Map(users.map((u) => [u.id, u]));
  const completed = attempts.filter((a) => a.completed_at && a.pillar_scores);

  const passed = completed.filter((a) => a.passed === true);
  const failed = completed.filter((a) => a.passed === false);
  const withDepthSignals = completed.filter((a) => a.ego_development_level !== null);
  const withPsychometrics = completed.filter((a) => {
    const u = userMap.get(a.user_id);
    return u?.psychometrics_completed_at != null;
  });
  const withRecovery = completed.filter(
    (a) => a.scenario_1_recovered || a.scenario_2_recovered || a.scenario_3_recovered,
  );

  const sampleSize = {
    total: completed.length,
    passed: passed.length,
    failed: failed.length,
    passRate:
      completed.length > 0 ? Math.round((passed.length / completed.length) * 1000) / 10 : 0,
    withDepthSignals: withDepthSignals.length,
    withPsychometrics: withPsychometrics.length,
    withScoreRecovery: withRecovery.length,
  };

  const pillarMatrix = completed
    .map((a) => PILLAR_NAMES.map((p) => a.pillar_scores?.[p] ?? null))
    .filter((row) => row.every((v) => v !== null)) as number[][];

  const scenarioMatrix = completed
    .map((a) => [
      scenarioComposite(a.scenario_composites, '1'),
      scenarioComposite(a.scenario_composites, '2'),
      scenarioComposite(a.scenario_composites, '3'),
    ])
    .filter((row) => row.every((v) => v !== null)) as number[][];

  const cronbachAlpha = {
    pillars:
      pillarMatrix.length >= MIN_ALPHA_SAMPLE ? computeCronbachAlpha(pillarMatrix) : null,
    scenarios:
      scenarioMatrix.length >= MIN_ALPHA_SAMPLE ? computeCronbachAlpha(scenarioMatrix) : null,
    sufficient: pillarMatrix.length >= MIN_ALPHA_SAMPLE,
    minimumNeeded: MIN_ALPHA_SAMPLE,
  };

  const pillarDistributions: Record<string, PillarStats> = {};
  for (const pillar of PILLAR_NAMES) {
    const values = completed
      .map((a) => a.pillar_scores?.[pillar])
      .filter((v): v is number => v != null);

    const dist: Record<string, number> = {};
    for (let i = 1; i <= 10; i++) {
      dist[`${i}`] = values.filter((v) => v >= i - 0.5 && v < i + 0.5).length;
    }

    const v = variance(values);
    pillarDistributions[pillar] = {
      name: pillar,
      mean: Math.round(mean(values) * 100) / 100,
      std: Math.round(std(values) * 100) / 100,
      min: values.length ? Math.min(...values) : 0,
      max: values.length ? Math.max(...values) : 0,
      variance: Math.round(v * 100) / 100,
      lowVarianceWarning: v < 0.5,
      distribution: dist,
    };
  }

  const s1s2pairs = completed
    .filter(
      (a) =>
        scenarioComposite(a.scenario_composites, '1') != null &&
        scenarioComposite(a.scenario_composites, '2') != null,
    )
    .map((a) => [
      scenarioComposite(a.scenario_composites, '1')!,
      scenarioComposite(a.scenario_composites, '2')!,
    ]);
  const s1s3pairs = completed
    .filter(
      (a) =>
        scenarioComposite(a.scenario_composites, '1') != null &&
        scenarioComposite(a.scenario_composites, '3') != null,
    )
    .map((a) => [
      scenarioComposite(a.scenario_composites, '1')!,
      scenarioComposite(a.scenario_composites, '3')!,
    ]);
  const s2s3pairs = completed
    .filter(
      (a) =>
        scenarioComposite(a.scenario_composites, '2') != null &&
        scenarioComposite(a.scenario_composites, '3') != null,
    )
    .map((a) => [
      scenarioComposite(a.scenario_composites, '2')!,
      scenarioComposite(a.scenario_composites, '3')!,
    ]);

  const scenarioCorrelations = {
    s1s2: pearsonCorrelation(
      s1s2pairs.map((p) => p[0]),
      s1s2pairs.map((p) => p[1]),
    ),
    s1s3: pearsonCorrelation(
      s1s3pairs.map((p) => p[0]),
      s1s3pairs.map((p) => p[1]),
    ),
    s2s3: pearsonCorrelation(
      s2s3pairs.map((p) => p[0]),
      s2s3pairs.map((p) => p[1]),
    ),
  };

  const scoreBuckets = [
    { range: '< 4.0', min: 0, max: 4 },
    { range: '4.0–4.9', min: 4, max: 5 },
    { range: '5.0–5.4', min: 5, max: 5.5 },
    { range: '5.5–5.9', min: 5.5, max: 6 },
    { range: '6.0–6.4', min: 6, max: 6.5 },
    { range: '6.5–6.9', min: 6.5, max: 7 },
    { range: '7.0–7.9', min: 7, max: 8 },
    { range: '8.0+', min: 8, max: 100 },
  ];

  const scoreDistribution: ScoreBucket[] = scoreBuckets.map((b) => {
    const count = completed.filter((a) => {
      const s = a.weighted_score ?? 0;
      return s >= b.min && s < b.max;
    }).length;
    return {
      range: b.range,
      count,
      percentage:
        completed.length > 0 ? Math.round((count / completed.length) * 1000) / 10 : 0,
    };
  });

  const borderlineCount = completed.filter((a) => {
    const s = a.weighted_score ?? 0;
    return s >= 5.5 && s <= 6.5;
  }).length;

  const modifierImpactRows: ModifierImpactRow[] = completed
    .filter((a) => depthModifierForAttempt(a) !== null && a.weighted_score !== null)
    .map((a) => {
      const baseScore = a.weighted_score!;
      const mod = depthModifierForAttempt(a)!;
      const modifiedScore = a.modified_weighted_score ?? baseScore + mod;
      const basePass = baseScore >= THRESHOLD;
      const modifiedPass = modifiedScore >= THRESHOLD;
      const user = userMap.get(a.user_id);
      return {
        attemptId: a.id,
        userName: user?.full_name ?? user?.display_name ?? null,
        baseScore,
        modifiedScore: Math.round(modifiedScore * 100) / 100,
        basePass,
        modifiedPass,
        flipped: basePass !== modifiedPass,
      };
    });

  const wouldFlipWithModifier = modifierImpactRows.filter((r) => r.flipped).length;

  const eras: EraStats[] = (['early', 'mid', 'current'] as const).map((era) => {
    const eraAttempts = completed.filter((a) => a.algorithm_era === era);
    const eraMatrix = eraAttempts
      .map((a) => PILLAR_NAMES.map((p) => a.pillar_scores?.[p] ?? null))
      .filter((row) => row.every((v) => v !== null)) as number[][];

    const eraScores = eraAttempts
      .map((a) => a.weighted_score)
      .filter((v): v is number => v != null);

    const eraPassed = eraAttempts.filter((a) => a.passed === true).length;

    return {
      era,
      count: eraAttempts.length,
      alpha: eraMatrix.length >= 10 ? computeCronbachAlpha(eraMatrix) : null,
      meanScore: Math.round(mean(eraScores) * 100) / 100,
      passRate:
        eraAttempts.length > 0 ? Math.round((eraPassed / eraAttempts.length) * 1000) / 10 : 0,
    };
  });

  const alphaValues = eras.map((e) => e.alpha).filter((v): v is number => v != null);
  const alphaDrift =
    alphaValues.length >= 2 ? Math.max(...alphaValues) - Math.min(...alphaValues) > 0.1 : false;

  const recoveryAttempts = completed.filter(
    (a) => a.scenario_1_recovered || a.scenario_2_recovered || a.scenario_3_recovered,
  );
  const cleanAttempts = completed.filter(
    (a) => !a.scenario_1_recovered && !a.scenario_2_recovered && !a.scenario_3_recovered,
  );

  const recoveryMatrix = recoveryAttempts
    .map((a) => PILLAR_NAMES.map((p) => a.pillar_scores?.[p] ?? null))
    .filter((row) => row.every((v) => v !== null)) as number[][];

  const cleanMatrix = cleanAttempts
    .map((a) => PILLAR_NAMES.map((p) => a.pillar_scores?.[p] ?? null))
    .filter((row) => row.every((v) => v !== null)) as number[][];

  const scoreRecoveryAnalysis = {
    totalRecoveredAttempts: recoveryAttempts.length,
    recoveryRate:
      completed.length > 0
        ? Math.round((recoveryAttempts.length / completed.length) * 1000) / 10
        : 0,
    alphaWithRecovery:
      recoveryMatrix.length >= 10 ? computeCronbachAlpha(recoveryMatrix) : null,
    alphaWithoutRecovery: cleanMatrix.length >= 10 ? computeCronbachAlpha(cleanMatrix) : null,
  };

  const egoDistribution: Record<string, number> = {
    '1': 0,
    '2': 0,
    '3': 0,
    '4': 0,
    '5': 0,
    null: 0,
  };
  const defensePatternRates: Record<string, number> = {
    projection: 0,
    splitting: 0,
    rationalization: 0,
    denial: 0,
  };
  const disclosureDistribution: Record<string, number> = {
    underdisclosure: 0,
    calibrated: 0,
    overdisclosure: 0,
    null: 0,
  };
  const concretenessDistribution: Record<string, number> = {
    absent: 0,
    low: 0,
    moderate: 0,
    high: 0,
    null: 0,
  };

  for (const a of completed) {
    const egoKey = a.ego_development_level?.toString() ?? 'null';
    egoDistribution[egoKey] = (egoDistribution[egoKey] ?? 0) + 1;

    if (a.defense_patterns) {
      if (a.defense_patterns.projection_detected) defensePatternRates.projection++;
      if (a.defense_patterns.splitting_detected) defensePatternRates.splitting++;
      if (a.defense_patterns.rationalization_detected) defensePatternRates.rationalization++;
      if (a.defense_patterns.denial_detected) defensePatternRates.denial++;
    }

    const disc = a.disclosure_calibration ?? 'null';
    disclosureDistribution[disc] = (disclosureDistribution[disc] ?? 0) + 1;

    const m4 = a.moment_4_concreteness ?? 'null';
    const m5 = a.moment_5_concreteness ?? 'null';
    concretenessDistribution[m4] = (concretenessDistribution[m4] ?? 0) + 1;
    concretenessDistribution[m5] = (concretenessDistribution[m5] ?? 0) + 1;
  }

  const modifierValues = completed
    .map((a) => depthModifierForAttempt(a))
    .filter((v): v is number => v != null);

  const modifierBuckets = [
    { range: '< -0.5', min: -10, max: -0.5 },
    { range: '-0.5 to -0.2', min: -0.5, max: -0.2 },
    { range: '-0.2 to 0', min: -0.2, max: 0 },
    { range: '0', min: 0, max: 0.001 },
    { range: '0 to +0.2', min: 0.001, max: 0.2 },
    { range: '> +0.2', min: 0.2, max: 10 },
  ];

  const modifierDistribution: ModifierBucket[] = modifierBuckets.map((b) => ({
    range: b.range,
    count: modifierValues.filter((v) => v >= b.min && v < b.max).length,
  }));

  const depthSignalSummary = {
    egoDistribution,
    defensePatternRates,
    disclosureDistribution,
    concretenessDistribution,
    avgModifier: Math.round(mean(modifierValues) * 1000) / 1000,
    modifierDistribution,
  };

  const psychometricPairs = completed
    .map((a) => {
      const u = userMap.get(a.user_id);
      if (!u?.psychometrics_completed_at) return null;
      return { attempt: a, user: u };
    })
    .filter(Boolean) as { attempt: AttemptRecord; user: UserRecord }[];

  const convergentTargets = [
    {
      pillar: 'attunement',
      psychometric: 'ECR-R Avoidance (SCS private)',
      getScore: (u: UserRecord) => u.psychometrics_scs_private_score,
      expectedDirection: 'positive' as const,
      interpretation:
        'Higher private self-consciousness should correlate with higher attunement',
    },
    {
      pillar: 'regulation',
      psychometric: 'BRS',
      getScore: (u: UserRecord) => u.psychometrics_brs_score,
      expectedDirection: 'positive' as const,
      interpretation: 'Higher resilience should correlate with higher emotional regulation',
    },
    {
      pillar: 'accountability',
      psychometric: 'RSES',
      getScore: (u: UserRecord) => u.psychometrics_rses_score,
      expectedDirection: 'positive' as const,
      interpretation: 'Higher self-esteem should correlate with stronger accountability',
    },
    {
      pillar: 'regulation',
      psychometric: 'AAQ-II (reversed)',
      getScore: (u: UserRecord) =>
        u.psychometrics_aaq2_score !== null ? 50 - u.psychometrics_aaq2_score : null,
      expectedDirection: 'positive' as const,
      interpretation: 'Lower experiential avoidance should correlate with better regulation',
    },
  ];

  const convergentCorrelations: ConvergentCorrelation[] = convergentTargets.map((target) => {
    const pairs = psychometricPairs
      .map((p) => ({
        pillarScore: p.attempt.pillar_scores?.[target.pillar] ?? null,
        psychScore: target.getScore(p.user),
      }))
      .filter((p) => p.pillarScore !== null && p.psychScore !== null) as {
      pillarScore: number;
      psychScore: number;
    }[];

    const corr =
      pairs.length >= 5
        ? pearsonCorrelation(
            pairs.map((p) => p.pillarScore),
            pairs.map((p) => p.psychScore),
          )
        : null;

    const validating =
      corr !== null
        ? target.expectedDirection === 'positive'
          ? corr > 0.2
          : corr < -0.2
        : null;

    return {
      pillar: target.pillar,
      psychometric: target.psychometric,
      expectedDirection: target.expectedDirection,
      correlation: corr,
      n: pairs.length,
      interpretation: target.interpretation,
      validating,
    };
  });

  const userDrilldown: UserSummaryRow[] = completed
    .map((a) => {
      const u = userMap.get(a.user_id);
      return {
        userId: a.user_id,
        userName: u?.full_name ?? u?.display_name ?? null,
        attemptId: a.id,
        weightedScore: a.weighted_score,
        modifiedScore: a.modified_weighted_score,
        passed: a.passed,
        egoLevel: a.ego_development_level,
        depthModifier: depthModifierForAttempt(a),
        algorithmEra: a.algorithm_era,
        hasRecovery:
          a.scenario_1_recovered || a.scenario_2_recovered || a.scenario_3_recovered,
        hasPsychometrics: !!u?.psychometrics_completed_at,
      };
    })
    .sort((a, b) => (b.weightedScore ?? 0) - (a.weightedScore ?? 0));

  let uncertaintyGreen = 0;
  let uncertaintyAmber = 0;
  let uncertaintyRed = 0;
  let uncertaintySum = 0;
  let uncertaintyCount = 0;
  const flagCounts = new Map<string, number>();
  const eraUncertainty = new Map<string, { sum: number; count: number }>();

  for (const a of completed) {
    const u = a.uncertainty_score;
    if (u == null || !Number.isFinite(u)) continue;
    uncertaintySum += u;
    uncertaintyCount++;
    if (u < 0.4) uncertaintyGreen++;
    else if (u < UNCERTAINTY_ROUTING_THRESHOLD) uncertaintyAmber++;
    else uncertaintyRed++;

    const flags = a.uncertainty_breakdown?.activeFlags ?? [];
    for (const flag of flags) {
      const key = flag.split(' ')[0];
      flagCounts.set(key, (flagCounts.get(key) ?? 0) + 1);
    }

    const eraKey = a.algorithm_era;
    const bucket = eraUncertainty.get(eraKey) ?? { sum: 0, count: 0 };
    bucket.sum += u;
    bucket.count++;
    eraUncertainty.set(eraKey, bucket);
  }

  const scoredTotal = uncertaintyGreen + uncertaintyAmber + uncertaintyRed;
  const commonFlags = [...flagCounts.entries()]
    .map(([flag, count]) => ({ flag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const trendByEra = (['early', 'mid', 'current'] as const)
    .map((era) => {
      const bucket = eraUncertainty.get(era);
      if (!bucket || bucket.count === 0) return null;
      return {
        era,
        averageScore: Math.round((bucket.sum / bucket.count) * 100) / 100,
        count: bucket.count,
      };
    })
    .filter((row): row is { era: string; averageScore: number; count: number } => row != null);

  return {
    sampleSize,
    cronbachAlpha,
    pillarDistributions,
    scenarioCorrelations,
    thresholdAnalysis: {
      scoreDistribution,
      borderlineCount,
      wouldFlipWithModifier,
      modifierImpactSummary: modifierImpactRows,
    },
    algorithmVersionAnalysis: { eras, alphaDrift },
    scoreRecoveryAnalysis,
    depthSignalSummary,
    convergentValidity: {
      sufficient: psychometricPairs.length >= 5,
      correlations: convergentCorrelations,
    },
    uncertaintyDistribution: {
      green: uncertaintyGreen,
      amber: uncertaintyAmber,
      red: uncertaintyRed,
      greenPct: scoredTotal > 0 ? Math.round((uncertaintyGreen / scoredTotal) * 100) : 0,
      amberPct: scoredTotal > 0 ? Math.round((uncertaintyAmber / scoredTotal) * 100) : 0,
      redPct: scoredTotal > 0 ? Math.round((uncertaintyRed / scoredTotal) * 100) : 0,
      averageScore:
        uncertaintyCount > 0 ? Math.round((uncertaintySum / uncertaintyCount) * 100) / 100 : null,
      commonFlags,
      trendByEra,
    },
    userDrilldown,
  };
}
