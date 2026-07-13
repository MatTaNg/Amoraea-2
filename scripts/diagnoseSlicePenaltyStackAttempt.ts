/**
 * Per-scenario slice penalty forensics for one attempt.
 *
 * Usage:
 *   npx tsx --env-file=.env scripts/diagnoseSlicePenaltyStackAttempt.ts 8d110d29-9e67-41fb-a58f-665b561a7b53
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import {
  aggregatePillarScoresWithCommitmentMergeDetailed,
  markerSliceFromStoredScenarioMoment,
} from '../src/features/aria/aggregateMarkerScoresFromSlices';
import { computeInterviewWeightedCompositeFromPillars } from '../src/features/aria/computeGateResultCore';
import { INTERVIEW_MARKER_IDS } from '../src/features/aria/interviewMarkers';

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

function loadRescoreBaseline(attemptId: string): Record<string, number> | null {
  const path = join(process.cwd(), 'scripts', 'output', 'rescore-all-users.json');
  if (!existsSync(path)) return null;
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as {
      attempts?: Array<{ attemptId: string; persisted?: { pillarScores?: Record<string, number> } }>;
    };
    return parsed.attempts?.find((r) => r.attemptId === attemptId)?.persisted?.pillarScores ?? null;
  } catch {
    return null;
  }
}

function declaredLevelFromEvidenceLocal(ev: string | undefined): 1 | 2 | null {
  if (!ev || typeof ev !== 'string') return null;
  const m = /^\s*Level\s*(1|2)\b/i.exec(ev.trim());
  return m ? (Number(m[1]) as 1 | 2) : null;
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
  const { data, error } = await sb
    .from('interview_attempts')
    .select('id, transcript, scenario_1_scores, scenario_2_scores, scenario_3_scores, scenario_specific_patterns, pillar_scores, weighted_score, original_scores')
    .eq('id', attemptId)
    .maybeSingle();
  if (error || !data) {
    console.error('Attempt not found', error?.message);
    process.exit(1);
  }

  const patterns = data.scenario_specific_patterns as Record<string, unknown> | null;
  const bundles = [
    { n: 1 as const, raw: data.scenario_1_scores },
    { n: 2 as const, raw: data.scenario_2_scores },
    { n: 3 as const, raw: data.scenario_3_scores },
  ];
  const holisticBaseline = loadRescoreBaseline(attemptId) ?? (data.original_scores as { pillar_scores?: Record<string, number> } | null)?.pillar_scores ?? null;

  console.log(`SLICE PENALTY FORENSICS — ${attemptId}`);
  console.log('DB pillar_scores weighted:', data.weighted_score);

  for (const b of bundles) {
    const slice = b.raw as Record<string, unknown> | null;
    if (!slice) {
      console.log(`\n=== S${b.n}: missing ===`);
      continue;
    }
    const ps = (slice.pillarScores ?? {}) as Record<string, number | null | undefined>;
    const ke = (slice.keyEvidence ?? {}) as Record<string, string>;
    const meta = (slice.scoringMetadata ?? {}) as Record<string, unknown>;
    const depthMeta = meta.response_depth_modifier as Record<string, unknown> | undefined;
    const levelQa = meta.level_tag_qa;
    console.log(`\n=== S${b.n} stored slice ===`);
    for (const id of ['mentalizing', 'attunement', 'accountability', 'appreciation', 'repair', 'regulation', 'contempt', 'contempt_expression', 'contempt_recognition'] as const) {
      const score = ps[id];
      if (score == null && !ke[id]) continue;
      const level = declaredLevelFromEvidenceLocal(ke[id]);
      const ceilingNote = (ke[id] ?? '').includes('Ceiling') ? ' [CEILING APPLIED]' : '';
      const depthNote = (ke[id] ?? '').includes('short-response depth') ? ' [DEPTH -1]' : '';
      console.log(`  ${id}: score=${score ?? '—'} level=${level ?? '—'}${ceilingNote}${depthNote}`);
      if (ke[id]) console.log(`    evidence: ${ke[id].slice(0, 160)}${ke[id].length > 160 ? '…' : ''}`);
    }
    if (depthMeta) {
      console.log('  response_depth_modifier:', JSON.stringify(depthMeta));
    }
    if (levelQa) {
      console.log('  level_tag_qa:', JSON.stringify(levelQa));
    }
    const evidenceLevels = meta.evidence_levels ?? meta.evidenceLevels ?? meta.holistic_evidence_levels;
    if (evidenceLevels) {
      console.log('  evidence_levels:', JSON.stringify(evidenceLevels));
    }
  }

  const slices = [
    markerSliceFromStoredScenarioMoment(data.scenario_1_scores),
    markerSliceFromStoredScenarioMoment(data.scenario_2_scores),
    markerSliceFromStoredScenarioMoment(data.scenario_3_scores),
    markerSliceFromStoredScenarioMoment(patterns?.moment_4_scores),
    markerSliceFromStoredScenarioMoment(patterns?.moment_5_scores),
  ];
  const rollup = aggregatePillarScoresWithCommitmentMergeDetailed(slices, {
    defensePatternTranscript: data.transcript as never,
    disclosureCalibrationTranscript: data.transcript as never,
  });
  const wRollup = computeInterviewWeightedCompositeFromPillars(rollup.scores);

  console.log('\n=== rollup from stored slices ===');
  console.log('pillars:', rollup.scores);
  console.log('weighted:', wRollup);

  if (holisticBaseline) {
    console.log('\n=== holistic baseline (rescore/original_scores) vs rollup ===');
    for (const id of INTERVIEW_MARKER_IDS) {
      if (id === 'commitment_threshold') continue;
      const h = holisticBaseline[id];
      const r = rollup.scores[id];
      if (typeof h === 'number' && typeof r === 'number' && h !== r) {
        console.log(`  ${id}: holistic=${h} rollup=${r} delta=${r - h}`);
      }
    }
    const wH = computeInterviewWeightedCompositeFromPillars(holisticBaseline);
    console.log(`  weighted: holistic=${wH} rollup=${wRollup} delta=${Math.round((wRollup - wH) * 10) / 10}`);
  }

  console.log('\n=== diagnosis ===');
  console.log(
    'Completion persisted holistic pillar_scores; rollup uses post-processed scenario slices only.',
  );
  console.log(
    'Mismatch drivers on this attempt: S1 attunement Level-1 ceiling (5), S3 accountability=5, appreciation S1 absent; regulation higher in rollup (S3=8).',
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
