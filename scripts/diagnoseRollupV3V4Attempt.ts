/**
 * Step-by-step rollup comparison for one attempt (v3 pooling vs v3+M4 exempt vs stored).
 *
 * Usage:
 *   npx tsx --env-file=.env scripts/diagnoseRollupV3V4Attempt.ts 8d110d29-9e67-41fb-a58f-665b561a7b53
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { createClient } from '@supabase/supabase-js';
import {
  aggregateMarkerScoresFromSlicesDetailed,
  aggregatePillarScoresWithCommitmentMergeDetailed,
  markerSliceFromStoredScenarioMoment,
  PILLAR_ROLLUP_ALGORITHM_VERSION,
  type LabeledMarkerSlice,
  type PillarMomentLabel,
} from '../src/features/aria/aggregateMarkerScoresFromSlices';
import { INTERVIEW_MARKER_IDS } from '../src/features/aria/interviewMarkers';
import { computeInterviewWeightedCompositeFromPillars, computeGateResultCore } from '../src/features/aria/computeGateResultCore';
import { recalculateAttemptScoresFromStoredSlices } from '../src/features/aria/adminRecalculateAttemptScores';
import { isNoEvidenceText, isNotAssessedDueToTechnicalInterruption } from '../src/features/aria/probeEvidenceUtils';
import { sanitizeScenarioKeyEvidenceRecord } from '../src/features/aria/sanitizeScenarioKeyEvidenceForPersist';

function mergeEnv(): void {
  try {
    const path = join(process.cwd(), '.env');
    if (!existsSync(path)) return;
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const eq = t.indexOf('=');
      if (eq < 1) continue;
      const k = t.slice(0, eq).trim();
      let v = t.slice(eq + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      if (process.env[k] === undefined) process.env[k] = v;
    }
  } catch {
    /* ignore */
  }
}

const STANDARD_MARKER_ALLOWED_MOMENTS: Record<string, Set<PillarMomentLabel>> = {
  repair: new Set(['scenario_1', 'scenario_2', 'scenario_3']),
  attunement: new Set(['scenario_1', 'scenario_2', 'scenario_3']),
  regulation: new Set(['scenario_3']),
  mentalizing: new Set(['scenario_1', 'scenario_2', 'scenario_3']),
  appreciation: new Set(['scenario_1', 'scenario_2']),
  accountability: new Set(['scenario_1', 'scenario_2', 'scenario_3']),
};

function sliceScoredValue(
  ps: Record<string, number | null | undefined> | null | undefined,
  ke: Record<string, string> | null | undefined,
  key: string,
): { score: number | null; reason: string } {
  if (!ps) return { score: null, reason: 'no pillarScores' };
  const raw = ps[key];
  if (isNotAssessedDueToTechnicalInterruption(ke?.[key])) return { score: null, reason: 'technical not assessed' };
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return { score: null, reason: 'non-numeric' };
  const ev = ke?.[key]?.trim() ?? '';
  if (/^\s*Level\s*[12]\s*[—–-]/i.test(ev)) return { score: raw, reason: 'level-tagged evidence' };
  if (isNoEvidenceText(ev)) return { score: null, reason: `isNoEvidenceText: ${ev.slice(0, 80)}` };
  return { score: raw, reason: ev ? 'substantive evidence' : 'empty evidence (counted)' };
}

function logMarkerPooling(rows: LabeledMarkerSlice[], label: string): Record<string, number> {
  console.log(`\n=== ${label}: per-slice pooling ===`);
  const out: Record<string, number> = {};
  for (const id of INTERVIEW_MARKER_IDS) {
    if (id === 'contempt' || id === 'commitment_threshold') continue;
    const allowed = STANDARD_MARKER_ALLOWED_MOMENTS[id];
    if (!allowed) continue;
    const samples: Array<{ moment: string; score: number; reason: string }> = [];
    for (const row of rows) {
      if (!allowed.has(row.moment)) continue;
      const { score, reason } = sliceScoredValue(row.pillarScores ?? null, row.keyEvidence ?? null, id);
      console.log(
        `  ${id} @ ${row.moment}: raw=${(row.pillarScores as Record<string, unknown>)?.[id] ?? '—'} pooled=${score ?? '—'} (${reason})`,
      );
      if (score != null) samples.push({ moment: row.moment, score, reason });
    }
    if (samples.length > 0) {
      const avg = Math.round(samples.reduce((a, b) => a + b.score, 0) / samples.length);
      out[id] = avg;
      console.log(`  => ${id} aggregate = round(mean(${samples.map((s) => s.score).join(',')})) = ${avg}`);
    }
  }
  return out;
}

function loadRescorePersistedBaseline(attemptId: string): {
  weightedScore: number;
  pillarScores: Record<string, number>;
} | null {
  const path = join(process.cwd(), 'scripts', 'output', 'rescore-all-users.json');
  if (!existsSync(path)) return null;
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as {
      attempts?: Array<{ attemptId: string; persisted?: { weightedScore?: number; pillarScores?: Record<string, number> } }>;
    };
    const row = parsed.attempts?.find((r) => r.attemptId === attemptId);
    if (!row?.persisted?.pillarScores || typeof row.persisted.weightedScore !== 'number') return null;
    return { weightedScore: row.persisted.weightedScore, pillarScores: row.persisted.pillarScores };
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  mergeEnv();
  const attemptId = process.argv[2] ?? '8d110d29-9e67-41fb-a58f-665b561a7b53';
  const url = process.env.SUPABASE_URL?.trim() ?? process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    console.error('Missing Supabase env');
    process.exit(1);
  }
  const sb = createClient(url, key);
  const { data, error } = await sb.from('interview_attempts').select('*').eq('id', attemptId).maybeSingle();
  if (error || !data) {
    console.error('Attempt not found', error?.message);
    process.exit(1);
  }

  const patterns = data.scenario_specific_patterns as Record<string, unknown> | null;
  const m4 = patterns?.moment_4_scores;
  const m5 = patterns?.moment_5_scores;
  const sliceBundles = [
    { label: 'S1', raw: data.scenario_1_scores },
    { label: 'S2', raw: data.scenario_2_scores },
    { label: 'S3', raw: data.scenario_3_scores },
    { label: 'M4', raw: m4 },
    { label: 'M5', raw: m5 },
  ];

  const labeled: LabeledMarkerSlice[] = [
    { moment: 'scenario_1', ...(markerSliceFromStoredScenarioMoment(data.scenario_1_scores) ?? {}) },
    { moment: 'scenario_2', ...(markerSliceFromStoredScenarioMoment(data.scenario_2_scores) ?? {}) },
    { moment: 'scenario_3', ...(markerSliceFromStoredScenarioMoment(data.scenario_3_scores) ?? {}) },
    { moment: 'moment_4', ...(markerSliceFromStoredScenarioMoment(m4) ?? {}) },
    { moment: 'moment_5', ...(markerSliceFromStoredScenarioMoment(m5) ?? {}) },
  ];

  const sanitizedLabeled: LabeledMarkerSlice[] = labeled.map((row) => ({
    ...row,
    keyEvidence: sanitizeScenarioKeyEvidenceRecord(row.keyEvidence ?? {}),
  }));

  console.log(`ROLLUP DIAGNOSTIC — attempt ${attemptId}`);
  console.log(`Algorithm version: ${PILLAR_ROLLUP_ALGORITHM_VERSION}`);
  console.log('STORED weighted:', data.weighted_score, 'modified:', data.modified_weighted_score);
  console.log('STORED pillar_scores:', data.pillar_scores);

  for (const b of sliceBundles) {
    const ke = (b.raw as { keyEvidence?: Record<string, string> } | null)?.keyEvidence ?? {};
    for (const marker of ['mentalizing', 'attunement'] as const) {
      const ev = ke[marker];
      if (typeof ev === 'string' && /Level tag missing/i.test(ev)) {
        console.log(`STORED LEAK: ${b.label} ${marker}: ${ev.slice(0, 120)}`);
      }
    }
  }

  const v3Pool = logMarkerPooling(labeled, 'v3 pooling (raw stored keyEvidence)');
  const v3PoolSanitized = logMarkerPooling(sanitizedLabeled, 'v3 pooling (sanitized keyEvidence)');

  const slices = labeled.map((row) => ({
    pillarScores: row.pillarScores ?? null,
    keyEvidence: sanitizeScenarioKeyEvidenceRecord(row.keyEvidence ?? {}),
  }));

  const v3Only = aggregatePillarScoresWithCommitmentMergeDetailed(slices, {
    defensePatternTranscript: data.transcript as never,
    disclosureCalibrationTranscript: data.transcript as never,
    egoDevelopmentLevel: data.ego_development_level,
    moment4UserText: null,
  }, { applyM4AccountabilityExempt: false });

  const v3PlusM4 = aggregatePillarScoresWithCommitmentMergeDetailed(slices, {
    defensePatternTranscript: data.transcript as never,
    disclosureCalibrationTranscript: data.transcript as never,
    egoDevelopmentLevel: data.ego_development_level,
  }, { applyM4AccountabilityExempt: true });

  const detailed = aggregateMarkerScoresFromSlicesDetailed(slices);

  console.log('\n=== aggregate outputs ===');
  console.log('v3-only pillars:', v3Only.scores);
  console.log('v3+M4 exempt pillars:', v3PlusM4.scores);
  console.log('contributorCounts:', detailed.contributorCounts);
  if (v3PlusM4.accountabilityReweightMeta) {
    console.log('M4 accountability reweight:', v3PlusM4.accountabilityReweightMeta);
  }

  const rec = recalculateAttemptScoresFromStoredSlices({
    transcript: data.transcript,
    scenario_1_scores: data.scenario_1_scores,
    scenario_2_scores: data.scenario_2_scores,
    scenario_3_scores: data.scenario_3_scores,
    scenario_specific_patterns: patterns,
    ego_development_level: data.ego_development_level,
    language_markers: data.language_markers,
    skip_count: data.skip_count,
    skip_penalty_total: data.skip_penalty_total,
    auto_failed: data.auto_failed,
    defense_patterns: data.defense_patterns,
    mentalizing_overcertainty_count: data.mentalizing_overcertainty_count,
    moment_4_concreteness: data.moment_4_concreteness,
    moment_5_concreteness: data.moment_5_concreteness,
    disclosure_calibration: data.disclosure_calibration,
  });

  if (rec.kind === 'success') {
    console.log('\n=== full recalculate path ===');
    console.log('pillar_scores:', rec.pillar_scores);
    console.log('weighted:', rec.gate.weightedScore);
    console.log('modified_weighted:', rec.gate.modifiedWeightedScore);
    console.log('depth_signal_modifier:', rec.gate.depthSignalModifier);
    console.log('moment4Concreteness:', rec.moment_4_concreteness, '(stored:', data.moment_4_concreteness, ')');
    console.log('notes:', rec.notes.join('; '));

    const wV3 = computeInterviewWeightedCompositeFromPillars(v3Only.scores);
    const wM4 = computeInterviewWeightedCompositeFromPillars(v3PlusM4.scores);
    console.log('\n=== weighted composite (markers only) ===');
    console.log('v3-only weighted:', wV3);
    console.log('v3+M4 weighted:', wM4);
    console.log('stored weighted:', data.weighted_score);
    console.log('recalculate weighted:', rec.gate.weightedScore);
  }

  console.log('\n=== divergence summary (stored vs v3+M4) ===');
  const stored = (data.pillar_scores ?? {}) as Record<string, number>;
  for (const id of INTERVIEW_MARKER_IDS) {
    if (id === 'commitment_threshold') continue;
    const s = stored[id];
    const n = v3PlusM4.scores[id];
    if (typeof s === 'number' && typeof n === 'number' && s !== n) {
      console.log(`  ${id}: stored=${s} recomputed=${n} delta=${n - s}`);
    }
  }

  const originalSnap = data.original_scores as {
    weighted_score?: number;
    pillar_scores?: Record<string, number>;
  } | null;
  const aiPillars = (data.ai_reasoning as { pillar_scores?: Record<string, number> } | null)?.pillar_scores;
  const atCompletion = originalSnap?.pillar_scores ?? aiPillars ?? null;
  const atCompletionWeighted =
    typeof originalSnap?.weighted_score === 'number'
      ? originalSnap.weighted_score
      : atCompletion
        ? computeInterviewWeightedCompositeFromPillars(atCompletion)
        : null;

  if (atCompletion) {
    console.log('\n=== at-completion pillars (original_scores or ai_reasoning) ===');
    console.log('weighted:', atCompletionWeighted);
    console.log('pillars:', atCompletion);
    console.log('\n=== per-pillar root cause (completion vs slice rollup) ===');
    for (const id of INTERVIEW_MARKER_IDS) {
      if (id === 'commitment_threshold') continue;
      const completion = atCompletion[id];
      const rollup = v3PlusM4.scores[id];
      const v3only = v3Only.scores[id];
      const m4Delta =
        typeof v3only === 'number' && typeof rollup === 'number' ? rollup - v3only : 0;
      if (typeof completion === 'number' && typeof rollup === 'number' && completion !== rollup) {
        const rule =
          m4Delta !== 0
            ? `M4 accountability reweight (${m4Delta > 0 ? '+' : ''}${m4Delta})`
            : 'slice rollup differs from holistic-at-completion (not v4-only rule)';
        console.log(
          `  ${id}: completion=${completion} rollup=${rollup} delta=${rollup - completion} — ${rule}`,
        );
      }
    }
    if (atCompletionWeighted != null) {
      const wDelta = (v3PlusM4.scores ? computeInterviewWeightedCompositeFromPillars(v3PlusM4.scores) : 0) - atCompletionWeighted;
      console.log(
        `\nWeighted: completion=${atCompletionWeighted} slice-rollup=${computeInterviewWeightedCompositeFromPillars(v3PlusM4.scores)} delta=${Math.round(wDelta * 10) / 10}`,
      );
      if (Math.abs(wDelta) >= 0.1 && m4DeltaIsZero(v3Only.scores, v3PlusM4.scores)) {
        console.log(
          'NOTE: v3-only and v3+M4 produce identical pillars for this attempt — deflation is NOT from M4 exempt bundling.',
        );
      }
    }
  }

  const rescoreBaseline = loadRescorePersistedBaseline(attemptId);
  if (rescoreBaseline) {
    console.log('\n=== rescore export baseline (pre-recompute persisted) ===');
    console.log('weighted:', rescoreBaseline.weightedScore);
    console.log('pillars:', rescoreBaseline.pillarScores);
    console.log('\n=== per-pillar: rescore baseline vs slice rollup ===');
    for (const id of INTERVIEW_MARKER_IDS) {
      if (id === 'commitment_threshold') continue;
      const baseline = rescoreBaseline.pillarScores[id];
      const rollup = v3PlusM4.scores[id];
      const v3only = v3Only.scores[id];
      if (typeof baseline === 'number' && typeof rollup === 'number' && baseline !== rollup) {
        const m4Delta = typeof v3only === 'number' ? rollup - v3only : 0;
        console.log(
          `  ${id}: baseline=${baseline} rollup=${rollup} delta=${rollup - baseline}` +
            (m4Delta !== 0 ? ` (M4 reweight ${m4Delta > 0 ? '+' : ''}${m4Delta})` : ''),
        );
      }
    }
    const wRollup = computeInterviewWeightedCompositeFromPillars(v3PlusM4.scores);
    console.log(
      `\nWeighted: baseline=${rescoreBaseline.weightedScore} rollup=${wRollup} delta=${Math.round((wRollup - rescoreBaseline.weightedScore) * 10) / 10}`,
    );
    if (m4DeltaIsZero(v3Only.scores, v3PlusM4.scores)) {
      console.log('v3-only === v3+M4 for this attempt — M4 exempt bundling did not change any pillar.');
    }
  }
}

function m4DeltaIsZero(a: Record<string, number>, b: Record<string, number>): boolean {
  for (const id of INTERVIEW_MARKER_IDS) {
    if (id === 'commitment_threshold') continue;
    if (a[id] !== b[id]) return false;
  }
  return true;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
