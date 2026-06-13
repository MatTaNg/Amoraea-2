// ─── TYPES ────────────────────────────────────────────────────────────────────

import { UNCERTAINTY_ROUTING_THRESHOLD } from '@features/psychometrics/computeUncertaintyScore';
import { meanScenarioCompositeFromPillarScores } from '@features/aria/scenarioCompositeFloor';
import {
  averageFiniteMs,
  computeInterviewDurationMs,
  wallClockMsBetween,
} from './adminAttemptTiming';

export interface AttemptRecord {
  id: string;
  user_id: string;
  created_at: string;
  completed_at: string | null;
  weighted_score: number | null;
  modified_weighted_score: number | null;
  modified_weighted_score_with_psychometrics?: number | null;
  response_timings?: Array<{ latency_ms?: number; duration_ms?: number }> | null;
  scenario_specific_patterns?: Record<string, unknown> | null;
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
  interview_completed?: boolean | null;
  interview_completed_at?: string | null;
  psychometrics_completed_at: string | null;
  psychometrics_aaq2_score: number | null;
  psychometrics_rses_score: number | null;
  psychometrics_brs_score: number | null;
  psychometrics_scs_public_score: number | null;
  psychometrics_scs_private_score: number | null;
  psychometrics_anxiety_trait_score?: number | null;
  psychometrics_scs_sf_score?: number | null;
  psychometrics_gasp_score?: number | null;
  psychometrics_dweck_score?: number | null;
  psychometrics_mspss_score?: number | null;
  psychometrics_sd3_narcissism_score?: number | null;
  psychometrics_rfq_score?: number | null;
  psychometric_modifier: number | null;
  market_research_completed_at?: string | null;
  market_research_referral_source?: string | null;
  market_research_referral_other?: string | null;
  market_research_relationship_seriousness?: string | null;
  market_research_search_duration?: string | null;
  market_research_dating_status?: string | null;
  market_research_max_spend?: string | null;
  market_research_spend_context?: string | null;
}

export interface PsychometricScoreAverage {
  key: string;
  label: string;
  average: number | null;
  n: number;
}

export interface FullyCompletedCohortAnalytics {
  /** Primary cohort headcount (definition depends on which compute* function built this). */
  cohortSize: number;
  /** Users in cohort whose latest attempt has pillar_scores (score averages use this subset). */
  scoredUsers: number;
  /** Users in cohort with psychometrics_completed_at. */
  withPsychometricsUsers: number;
  scoreAverages: {
    weightedScore: number | null;
    modifiedWeightedScore: number | null;
    modifiedWeightedWithPsychometrics: number | null;
    scenario1: number | null;
    scenario2: number | null;
    scenario3: number | null;
    moment4: number | null;
    moment5: number | null;
    psychometricScores: PsychometricScoreAverage[];
  };
  timingAverages: {
    interviewMs: number | null;
    psychometricMs: number | null;
    /** Active time on dating-profile relationship questionnaires (`user_assessments.time_taken_sec`). */
    profileQuestionnaireMs: number | null;
    /** Wall clock for modal edit-profile onboarding after questionnaires finish. */
    profileEditMs: number | null;
    /** Interview attempt start → profile onboarding complete. */
    totalMs: number | null;
    /** Interview attempt start → post-interview psychometric battery complete. */
    totalProcessMs: number | null;
    interviewN: number;
    psychometricN: number;
    profileQuestionnaireN: number;
    profileEditN: number;
    totalN: number;
    totalProcessN: number;
  };
  /** Mean pillar stats per scenario / personal moment for the fully completed cohort. */
  segmentPillarDistributions: CohortSegmentPillarDistribution[];
}

export type CohortSegmentKey =
  | 'scenario1'
  | 'scenario2'
  | 'scenario3'
  | 'moment4'
  | 'moment5';

export interface CohortSegmentPillarDistribution {
  key: CohortSegmentKey;
  label: string;
  /** Attempts with at least one scored pillar in this segment. */
  n: number;
  pillars: Record<string, PillarStats>;
}

export interface MarketResearchOptionCount {
  value: string;
  count: number;
  percentage: number;
}

export interface MarketResearchQuestionAggregation {
  id: string;
  label: string;
  type: 'choice' | 'text';
  totalAnswered: number;
  options?: MarketResearchOptionCount[];
  textResponses?: string[];
}

export interface MarketResearchAggregation {
  totalResponses: number;
  questions: MarketResearchQuestionAggregation[];
}

export interface OverviewAnalytics {
  sampleSize: {
    /** Users with `interview_completed` on the account (matches admin Users tab). */
    interviewCompletedUsers: number;
    /** Completed attempt rows with `pillar_scores` (used for score distributions). */
    scoredAttempts: number;
    /** @deprecated Use `scoredAttempts` — kept for chart denominators. */
    total: number;
    /** Interview-completed users whose latest attempt has no pillar rollup yet. */
    pendingScoringUsers: number;
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
  attemptId: string | null;
  weightedScore: number | null;
  modifiedScore: number | null;
  passed: boolean | null;
  egoLevel: number | null;
  depthModifier: number | null;
  algorithmEra: string | null;
  hasRecovery: boolean;
  hasPsychometrics: boolean;
  hasScoredAttempt: boolean;
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

function roundAverage(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round(mean(values) * 100) / 100;
}

function coerceFiniteScore(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

/** Extract numeric pillar scores from a scenario or moment score bundle. */
export function extractPillarScoresFromScoreBundle(
  raw: Record<string, unknown> | null | undefined,
): Record<string, number> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const nested = raw.pillarScores ?? raw.pillar_scores;
  const source =
    nested != null && typeof nested === 'object' && !Array.isArray(nested)
      ? (nested as Record<string, unknown>)
      : raw;
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(source)) {
    if (key.startsWith('_')) continue;
    const n = coerceFiniteScore(value);
    if (n != null) out[key] = n;
  }
  return out;
}

function computePillarStatsMap(
  pillarScoreRows: Array<Record<string, number>>,
): Record<string, PillarStats> {
  const pillarNames = new Set<string>();
  for (const row of pillarScoreRows) {
    for (const key of Object.keys(row)) pillarNames.add(key);
  }

  const result: Record<string, PillarStats> = {};
  for (const pillar of [...pillarNames].sort()) {
    const values = pillarScoreRows
      .map((row) => row[pillar])
      .filter((v): v is number => v != null && Number.isFinite(v));
    if (values.length === 0) continue;

    const dist: Record<string, number> = {};
    for (let i = 1; i <= 10; i++) {
      dist[`${i}`] = values.filter((v) => v >= i - 0.5 && v < i + 0.5).length;
    }

    const v = variance(values);
    result[pillar] = {
      name: pillar,
      mean: Math.round(mean(values) * 100) / 100,
      std: Math.round(std(values) * 100) / 100,
      min: Math.min(...values),
      max: Math.max(...values),
      variance: Math.round(v * 100) / 100,
      lowVarianceWarning: v < 0.5,
      distribution: dist,
    };
  }
  return result;
}

const COHORT_SEGMENT_EXTRACTORS: Array<{
  key: CohortSegmentKey;
  label: string;
  extract: (attempt: AttemptRecord) => Record<string, number>;
}> = [
  {
    key: 'scenario1',
    label: 'Scenario 1 (Emma/Ryan)',
    extract: (a) => extractPillarScoresFromScoreBundle(a.scenario_1_scores),
  },
  {
    key: 'scenario2',
    label: 'Scenario 2 (Sarah/James)',
    extract: (a) => extractPillarScoresFromScoreBundle(a.scenario_2_scores),
  },
  {
    key: 'scenario3',
    label: 'Scenario 3 (Sophie/Daniel)',
    extract: (a) => extractPillarScoresFromScoreBundle(a.scenario_3_scores),
  },
  {
    key: 'moment4',
    label: 'Moment 4 (Grudge / threshold)',
    extract: (a) =>
      extractPillarScoresFromScoreBundle(
        (a.scenario_specific_patterns?.moment_4_scores as Record<string, unknown> | undefined) ??
          null,
      ),
  },
  {
    key: 'moment5',
    label: 'Moment 5 (Conflict / accountability)',
    extract: (a) =>
      extractPillarScoresFromScoreBundle(
        (a.scenario_specific_patterns?.moment_5_scores as Record<string, unknown> | undefined) ??
          null,
      ),
  },
];

export function computeCohortSegmentPillarDistributions(
  cohortAttempts: AttemptRecord[],
): CohortSegmentPillarDistribution[] {
  return COHORT_SEGMENT_EXTRACTORS.map(({ key, label, extract }) => {
    const rows = cohortAttempts.map(extract).filter((row) => Object.keys(row).length > 0);
    return {
      key,
      label,
      n: rows.length,
      pillars: computePillarStatsMap(rows),
    };
  });
}

function momentCompositeFromPatterns(
  patterns: Record<string, unknown> | null | undefined,
  momentKey: 'moment_4_scores' | 'moment_5_scores',
): number | null {
  if (!patterns || typeof patterns !== 'object') return null;
  const bundle = patterns[momentKey];
  if (!bundle || typeof bundle !== 'object' || Array.isArray(bundle)) return null;
  const pillarScores = (bundle as Record<string, unknown>).pillarScores ?? bundle;
  return meanScenarioCompositeFromPillarScores(pillarScores as Record<string, unknown>);
}

export function isFullyCompletedInterviewUser(user: UserRecord): boolean {
  return user.interview_completed === true && user.psychometrics_completed_at != null;
}

export function isInterviewCompletedUser(user: UserRecord): boolean {
  return user.interview_completed === true;
}

function pickLatestAttemptWithCompletedAtPerUser(
  attempts: AttemptRecord[],
): Map<string, AttemptRecord> {
  const map = new Map<string, AttemptRecord>();
  for (const a of attempts) {
    if (!a.completed_at) continue;
    const existing = map.get(a.user_id);
    if (!existing) {
      map.set(a.user_id, a);
      continue;
    }
    const existingTs = new Date(existing.completed_at!).getTime();
    const nextTs = new Date(a.completed_at).getTime();
    if (Number.isFinite(nextTs) && nextTs >= existingTs) {
      map.set(a.user_id, a);
    }
  }
  return map;
}

function pickLatestCompletedAttemptPerUser(
  attempts: AttemptRecord[],
): Map<string, AttemptRecord> {
  const map = new Map<string, AttemptRecord>();
  for (const a of attempts) {
    if (!a.completed_at || !a.pillar_scores) continue;
    const existing = map.get(a.user_id);
    if (!existing) {
      map.set(a.user_id, a);
      continue;
    }
    const existingTs = new Date(existing.completed_at!).getTime();
    const nextTs = new Date(a.completed_at).getTime();
    if (Number.isFinite(nextTs) && nextTs >= existingTs) {
      map.set(a.user_id, a);
    }
  }
  return map;
}

const PSYCHOMETRIC_AVERAGE_FIELDS: Array<{
  key: keyof UserRecord;
  label: string;
}> = [
  { key: 'psychometrics_brs_score', label: 'BRS (resilience)' },
  { key: 'psychometrics_anxiety_trait_score', label: 'Anxiety trait' },
  { key: 'psychometrics_scs_sf_score', label: 'SCS-SF (self-compassion)' },
  { key: 'psychometrics_gasp_score', label: 'GASP' },
  { key: 'psychometrics_dweck_score', label: 'Dweck mindset' },
  { key: 'psychometrics_aaq2_score', label: 'AAQ-II' },
  { key: 'psychometrics_rses_score', label: 'RSES (self-esteem)' },
  { key: 'psychometrics_scs_public_score', label: 'SCS public' },
  { key: 'psychometrics_scs_private_score', label: 'SCS private' },
  { key: 'psychometrics_mspss_score', label: 'MSPSS (social support)' },
  { key: 'psychometrics_sd3_narcissism_score', label: 'SD3 narcissism' },
  { key: 'psychometrics_rfq_score', label: 'RFQ (reflective functioning)' },
  { key: 'psychometric_modifier', label: 'Psychometric modifier' },
];

export interface ProfileTimingRecord {
  assessmentsCompletedAt: string | null;
  onboardingCompletedAt: string | null;
  /** Sum of `user_assessments.time_taken_sec` for relationship questionnaires, in ms. */
  datingAssessmentActiveMs: number | null;
}

function pickIsoTimestamp(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  return Number.isFinite(Date.parse(value)) ? value : null;
}

/** Read profile onboarding timestamps from `profiles.profile_json`. */
export function parseProfileTimingTimestamps(
  profileJson: Record<string, unknown> | null | undefined,
): Pick<ProfileTimingRecord, 'assessmentsCompletedAt' | 'onboardingCompletedAt'> {
  const json = profileJson ?? {};
  return {
    assessmentsCompletedAt: pickIsoTimestamp(
      json.assessmentsCompletedAt ?? json.assessments_completed_at,
    ),
    onboardingCompletedAt: pickIsoTimestamp(
      json.onboardingCompletedAt ?? json.onboarding_completed_at,
    ),
  };
}

export function sumUserAssessmentActiveMs(
  rows: Array<{ time_taken_sec: number | null }>,
): number | null {
  let sumSec = 0;
  let count = 0;
  for (const row of rows) {
    if (
      typeof row.time_taken_sec === 'number' &&
      Number.isFinite(row.time_taken_sec) &&
      row.time_taken_sec > 0
    ) {
      sumSec += row.time_taken_sec;
      count += 1;
    }
  }
  return count > 0 ? sumSec * 1000 : null;
}

function buildCohortAnalytics(
  cohortUsers: UserRecord[],
  scoredAttempts: AttemptRecord[],
  attemptForTiming: (user: UserRecord) => AttemptRecord | undefined,
  profileTimingByUserId: Map<string, ProfileTimingRecord> = new Map(),
): FullyCompletedCohortAnalytics {
  const weightedScores = scoredAttempts
    .map((a) => a.weighted_score)
    .filter((v): v is number => v != null && Number.isFinite(v));
  const modifiedScores = scoredAttempts
    .map((a) => a.modified_weighted_score)
    .filter((v): v is number => v != null && Number.isFinite(v));
  const modifiedWithPsych = scoredAttempts
    .map((a) => a.modified_weighted_score_with_psychometrics)
    .filter((v): v is number => v != null && Number.isFinite(v));

  const scenarioValues = (key: '1' | '2' | '3') =>
    scoredAttempts
      .map((a) => scenarioComposite(a.scenario_composites, key))
      .filter((v): v is number => v != null);

  const momentValues = (momentKey: 'moment_4_scores' | 'moment_5_scores') =>
    scoredAttempts
      .map((a) => momentCompositeFromPatterns(a.scenario_specific_patterns, momentKey))
      .filter((v): v is number => v != null);

  const psychometricScores: PsychometricScoreAverage[] = PSYCHOMETRIC_AVERAGE_FIELDS.map(
    ({ key, label }) => {
      const values = cohortUsers
        .map((u) => u[key])
        .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
      return {
        key,
        label,
        average: roundAverage(values),
        n: values.length,
      };
    },
  );

  const interviewDurations: number[] = [];
  const psychometricDurations: number[] = [];
  const throughPsychometricDurations: number[] = [];
  const profileQuestionnaireDurations: number[] = [];
  const profileEditDurations: number[] = [];
  const totalEndToEndDurations: number[] = [];

  for (const user of cohortUsers) {
    const attempt = attemptForTiming(user);
    if (!attempt) continue;

    const interviewMs = computeInterviewDurationMs(attempt);
    if (interviewMs != null) interviewDurations.push(interviewMs);

    const interviewEnd = user.interview_completed_at ?? attempt.completed_at ?? null;
    const psychEnd = user.psychometrics_completed_at ?? null;
    if (interviewEnd && psychEnd) {
      const psychMs = wallClockMsBetween(interviewEnd, psychEnd);
      if (psychMs != null) psychometricDurations.push(psychMs);
    }

    if (attempt.created_at && psychEnd) {
      const throughPsychMs = wallClockMsBetween(attempt.created_at, psychEnd);
      if (throughPsychMs != null) throughPsychometricDurations.push(throughPsychMs);
    }

    const profileTiming = profileTimingByUserId.get(user.id);
    if (profileTiming?.datingAssessmentActiveMs != null) {
      profileQuestionnaireDurations.push(profileTiming.datingAssessmentActiveMs);
    }
    if (profileTiming?.assessmentsCompletedAt && profileTiming.onboardingCompletedAt) {
      const editMs = wallClockMsBetween(
        profileTiming.assessmentsCompletedAt,
        profileTiming.onboardingCompletedAt,
      );
      if (editMs != null) profileEditDurations.push(editMs);
    }
    if (attempt.created_at && profileTiming?.onboardingCompletedAt) {
      const totalMs = wallClockMsBetween(attempt.created_at, profileTiming.onboardingCompletedAt);
      if (totalMs != null) totalEndToEndDurations.push(totalMs);
    }
  }

  return {
    cohortSize: cohortUsers.length,
    scoredUsers: scoredAttempts.length,
    withPsychometricsUsers: cohortUsers.filter((u) => u.psychometrics_completed_at != null).length,
    scoreAverages: {
      weightedScore: roundAverage(weightedScores),
      modifiedWeightedScore: roundAverage(modifiedScores),
      modifiedWeightedWithPsychometrics: roundAverage(modifiedWithPsych),
      scenario1: roundAverage(scenarioValues('1')),
      scenario2: roundAverage(scenarioValues('2')),
      scenario3: roundAverage(scenarioValues('3')),
      moment4: roundAverage(momentValues('moment_4_scores')),
      moment5: roundAverage(momentValues('moment_5_scores')),
      psychometricScores,
    },
    timingAverages: {
      interviewMs: averageFiniteMs(interviewDurations),
      psychometricMs: averageFiniteMs(psychometricDurations),
      profileQuestionnaireMs: averageFiniteMs(profileQuestionnaireDurations),
      profileEditMs: averageFiniteMs(profileEditDurations),
      totalMs: averageFiniteMs(totalEndToEndDurations),
      totalProcessMs: averageFiniteMs(throughPsychometricDurations),
      interviewN: interviewDurations.length,
      psychometricN: psychometricDurations.length,
      profileQuestionnaireN: profileQuestionnaireDurations.length,
      profileEditN: profileEditDurations.length,
      totalN: totalEndToEndDurations.length,
      totalProcessN: throughPsychometricDurations.length,
    },
    segmentPillarDistributions: computeCohortSegmentPillarDistributions(scoredAttempts),
  };
}

/** One latest scored attempt per interview-completed user — primary admin cohort. */
export function computeInterviewCompletedCohortAnalytics(
  attempts: AttemptRecord[],
  users: UserRecord[],
  profileTimingByUserId: Map<string, ProfileTimingRecord> = new Map(),
): FullyCompletedCohortAnalytics {
  const latestScoredByUser = pickLatestCompletedAttemptPerUser(attempts);
  const latestAnyByUser = pickLatestAttemptWithCompletedAtPerUser(attempts);
  const cohortUsers = users.filter(isInterviewCompletedUser);
  const scoredAttempts = cohortUsers
    .map((u) => latestScoredByUser.get(u.id))
    .filter((a): a is AttemptRecord => a != null);

  return buildCohortAnalytics(cohortUsers, scoredAttempts, (user) => {
    return latestScoredByUser.get(user.id) ?? latestAnyByUser.get(user.id);
  }, profileTimingByUserId);
}

export function computeFullyCompletedCohortAnalytics(
  attempts: AttemptRecord[],
  users: UserRecord[],
  profileTimingByUserId: Map<string, ProfileTimingRecord> = new Map(),
): FullyCompletedCohortAnalytics {
  const userMap = new Map(users.map((u) => [u.id, u]));
  const latestScoredByUser = pickLatestCompletedAttemptPerUser(attempts);
  const latestAnyByUser = pickLatestAttemptWithCompletedAtPerUser(attempts);

  const cohortUsers: UserRecord[] = [];
  const scoredAttempts: AttemptRecord[] = [];

  for (const [userId, attempt] of latestScoredByUser) {
    const user = userMap.get(userId);
    if (!user || !isFullyCompletedInterviewUser(user)) continue;
    cohortUsers.push(user);
    scoredAttempts.push(attempt);
  }

  return buildCohortAnalytics(cohortUsers, scoredAttempts, (user) => {
    return latestScoredByUser.get(user.id) ?? latestAnyByUser.get(user.id);
  }, profileTimingByUserId);
}

function countChoiceValues(
  values: Array<string | null | undefined>,
): MarketResearchOptionCount[] {
  const counts = new Map<string, number>();
  let total = 0;
  for (const raw of values) {
    if (raw == null || String(raw).trim() === '') continue;
    const v = String(raw).trim();
    counts.set(v, (counts.get(v) ?? 0) + 1);
    total++;
  }
  return [...counts.entries()]
    .map(([value, count]) => ({
      value,
      count,
      percentage: total > 0 ? Math.round((count / total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.count - a.count);
}

export function aggregateMarketResearch(
  users: UserRecord[],
  occupationsByUserId: Map<string, string>,
): MarketResearchAggregation {
  const respondents = users.filter((u) => u.market_research_completed_at != null);

  const referralDisplay = respondents.map((u) => {
    const src = u.market_research_referral_source;
    if (!src) return null;
    if (src === 'Other' && u.market_research_referral_other?.trim()) {
      return `Other: ${u.market_research_referral_other.trim()}`;
    }
    return src;
  });

  const occupations = respondents
    .map((u) => occupationsByUserId.get(u.id)?.trim())
    .filter((v): v is string => !!v && v.length > 0);

  const spendContexts = respondents
    .map((u) => u.market_research_spend_context?.trim())
    .filter((v): v is string => !!v && v.length > 0);

  return {
    totalResponses: respondents.length,
    questions: [
      {
        id: 'referral',
        label: 'How did you hear about us?',
        type: 'choice',
        totalAnswered: referralDisplay.filter(Boolean).length,
        options: countChoiceValues(referralDisplay),
      },
      {
        id: 'occupation',
        label: 'Occupation',
        type: 'text',
        totalAnswered: occupations.length,
        textResponses: occupations.sort((a, b) => a.localeCompare(b)),
      },
      {
        id: 'seriousness',
        label: 'Relationship seriousness',
        type: 'choice',
        totalAnswered: respondents.filter((u) => u.market_research_relationship_seriousness).length,
        options: countChoiceValues(respondents.map((u) => u.market_research_relationship_seriousness)),
      },
      {
        id: 'duration',
        label: 'Search duration',
        type: 'choice',
        totalAnswered: respondents.filter((u) => u.market_research_search_duration).length,
        options: countChoiceValues(respondents.map((u) => u.market_research_search_duration)),
      },
      {
        id: 'dating_status',
        label: 'Dating status',
        type: 'choice',
        totalAnswered: respondents.filter((u) => u.market_research_dating_status).length,
        options: countChoiceValues(respondents.map((u) => u.market_research_dating_status)),
      },
      {
        id: 'max_spend',
        label: 'Max spend on coaching / workshops',
        type: 'choice',
        totalAnswered: respondents.filter((u) => u.market_research_max_spend).length,
        options: countChoiceValues(respondents.map((u) => u.market_research_max_spend)),
      },
      {
        id: 'spend_context',
        label: 'Workshop / coaching context (optional)',
        type: 'text',
        totalAnswered: spendContexts.length,
        textResponses: spendContexts.sort((a, b) => a.localeCompare(b)),
      },
    ],
  };
}

// ─── MAIN COMPUTATION ─────────────────────────────────────────────────────────

function buildUserSummaryRow(
  user: UserRecord,
  attempt: AttemptRecord | null | undefined,
): UserSummaryRow {
  const hasScoredAttempt = !!(attempt?.completed_at && attempt.pillar_scores);
  return {
    userId: user.id,
    userName: user.full_name ?? user.display_name ?? null,
    attemptId: attempt?.id ?? null,
    weightedScore: hasScoredAttempt ? attempt!.weighted_score : null,
    modifiedScore: hasScoredAttempt ? attempt!.modified_weighted_score : null,
    passed: hasScoredAttempt ? attempt!.passed : null,
    egoLevel: hasScoredAttempt ? attempt!.ego_development_level : null,
    depthModifier: hasScoredAttempt ? depthModifierForAttempt(attempt!) : null,
    algorithmEra: attempt ? attempt.algorithm_era : null,
    hasRecovery: hasScoredAttempt
      ? attempt!.scenario_1_recovered ||
        attempt!.scenario_2_recovered ||
        attempt!.scenario_3_recovered
      : false,
    hasPsychometrics: user.psychometrics_completed_at != null,
    hasScoredAttempt,
  };
}

export function computeOverviewAnalytics(
  attempts: AttemptRecord[],
  users: UserRecord[],
): OverviewAnalytics {
  const userMap = new Map(users.map((u) => [u.id, u]));
  const interviewCompletedUsers = users.filter((u) => u.interview_completed === true);
  const latestCompletedByUser = pickLatestAttemptWithCompletedAtPerUser(attempts);
  const pendingScoringUsers = interviewCompletedUsers.filter((u) => {
    const latest = latestCompletedByUser.get(u.id);
    return !latest?.pillar_scores;
  }).length;

  const completed = attempts.filter((a) => a.completed_at && a.pillar_scores);

  const passed = completed.filter((a) => a.passed === true);
  const failed = completed.filter((a) => a.passed === false);
  const withDepthSignals = completed.filter((a) => a.ego_development_level !== null);
  const withPsychometrics = interviewCompletedUsers.filter(
    (u) => u.psychometrics_completed_at != null,
  ).length;
  const withRecovery = completed.filter(
    (a) => a.scenario_1_recovered || a.scenario_2_recovered || a.scenario_3_recovered,
  );

  const sampleSize = {
    interviewCompletedUsers: interviewCompletedUsers.length,
    scoredAttempts: completed.length,
    total: completed.length,
    pendingScoringUsers,
    passed: passed.length,
    failed: failed.length,
    passRate:
      completed.length > 0 ? Math.round((passed.length / completed.length) * 1000) / 10 : 0,
    withDepthSignals: withDepthSignals.length,
    withPsychometrics,
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

  const userDrilldown: UserSummaryRow[] = interviewCompletedUsers
    .map((u) => buildUserSummaryRow(u, latestCompletedByUser.get(u.id)))
    .sort((a, b) => {
      if (a.hasScoredAttempt !== b.hasScoredAttempt) {
        return a.hasScoredAttempt ? -1 : 1;
      }
      return (b.weightedScore ?? 0) - (a.weightedScore ?? 0);
    });

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
