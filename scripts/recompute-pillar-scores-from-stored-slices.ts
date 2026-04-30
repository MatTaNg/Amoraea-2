/**
 * Recompute interview_attempts.pillar_scores (moment-restricted aggregate + CT merge) and gate fields
 * from existing scenario_1/2/3 and moment_4/5 JSON — no LLM calls.
 *
 * Usage: npm run recompute-pillar-scores -- --attempt-number=119
 */
import { createClient } from '@supabase/supabase-js';
import { aggregatePillarScoresWithCommitmentMerge } from '../src/features/aria/aggregateMarkerScoresFromSlices';
import { enrichScenarioSliceWithContemptHeuristic } from '../src/features/aria/contemptExpressionScenarioHeuristic';
import { computeGateResultCore } from '../src/features/aria/computeGateResultCore';
import { sanitizePersonalMomentScoresForAggregate } from '../src/features/aria/personalMomentSliceSanitize';
import { fullScenarioReconciliation } from '../src/features/aria/reconcileScenarioScoresTranscript';

function parseArgs(argv: string[]): number {
  const arg = argv.find((a) => a.startsWith('--attempt-number='));
  const n = arg ? Number(arg.split('=')[1]) : NaN;
  if (!Number.isFinite(n) || n < 1) {
    console.error('Pass --attempt-number=<positive integer>');
    process.exit(1);
  }
  return n;
}

function parseObject(raw: unknown): Record<string, unknown> | null {
  if (raw == null) return null;
  if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw);
      return typeof p === 'object' && p != null && !Array.isArray(p) ? (p as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  }
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>;
  return null;
}

type TranscriptMsg = { role?: string; content?: string; scenarioNumber?: number };

function userTextForScenario(transcript: unknown, scenarioNum: 1 | 2 | 3): string {
  if (!Array.isArray(transcript)) return '';
  return (transcript as TranscriptMsg[])
    .filter(
      (m) =>
        m.role === 'user' &&
        m.scenarioNumber === scenarioNum &&
        typeof m.content === 'string',
    )
    .map((m) => String(m.content).trim())
    .filter(Boolean)
    .join(' ');
}

function extractSlice(raw: unknown): {
  pillarScores?: Record<string, number | null>;
  keyEvidence?: Record<string, string>;
} | null {
  const obj = parseObject(raw);
  if (!obj) return null;
  const ps = obj.pillarScores;
  const ke = obj.keyEvidence;
  if (ps == null && ke == null) return null;
  return {
    pillarScores:
      typeof ps === 'object' && ps != null && !Array.isArray(ps)
        ? (ps as Record<string, number | null>)
        : undefined,
    keyEvidence:
      typeof ke === 'object' && ke != null && !Array.isArray(ke)
        ? (ke as Record<string, string>)
        : undefined,
  };
}

async function main(): Promise<void> {
  const attemptNumber = parseArgs(process.argv.slice(2));
  const supabaseUrl =
    process.env.SUPABASE_URL?.trim() ?? process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();
  const supabaseKey = serviceKey ?? anonKey;
  if (!supabaseUrl || !supabaseKey) {
    console.error('Set SUPABASE_URL or EXPO_PUBLIC_SUPABASE_URL and anon or service role key');
    process.exit(1);
  }
  const admin = createClient(supabaseUrl, supabaseKey);
  const { data: row, error: selErr } = await admin
    .from('interview_attempts')
    .select(
      'id, attempt_number, transcript, scenario_1_scores, scenario_2_scores, scenario_3_scores, scenario_specific_patterns',
    )
    .eq('attempt_number', attemptNumber)
    .maybeSingle();
  if (selErr) {
    console.error(selErr.message);
    process.exit(1);
  }
  if (!row) {
    console.error(`No row for attempt_number=${attemptNumber}`);
    process.exit(1);
  }
  const patterns = parseObject(row.scenario_specific_patterns);
  const m4 = parseObject(patterns?.moment_4_scores);
  const tx = row.transcript;
  const raw1 = extractSlice(row.scenario_1_scores);
  const raw2 = extractSlice(row.scenario_2_scores);
  const raw3 = extractSlice(row.scenario_3_scores);
  const txArr = (Array.isArray(tx) ? tx : []) as TranscriptMsg[];
  const reco1 = raw1
    ? fullScenarioReconciliation(
        { scenarioNumber: 1, pillarScores: raw1.pillarScores ?? {}, pillarConfidence: {}, keyEvidence: raw1.keyEvidence ?? {} },
        txArr,
      )
    : null;
  const reco2 = raw2
    ? fullScenarioReconciliation(
        { scenarioNumber: 2, pillarScores: raw2.pillarScores ?? {}, pillarConfidence: {}, keyEvidence: raw2.keyEvidence ?? {} },
        txArr,
      )
    : null;
  const reco3 = raw3
    ? fullScenarioReconciliation(
        { scenarioNumber: 3, pillarScores: raw3.pillarScores ?? {}, pillarConfidence: {}, keyEvidence: raw3.keyEvidence ?? {} },
        txArr,
      )
    : null;
  const s1 = enrichScenarioSliceWithContemptHeuristic(
    reco1
      ? { pillarScores: reco1.pillarScores, keyEvidence: reco1.keyEvidence }
      : raw1
        ? { pillarScores: raw1.pillarScores, keyEvidence: raw1.keyEvidence }
        : null,
    userTextForScenario(tx, 1),
  );
  const s2 = enrichScenarioSliceWithContemptHeuristic(
    reco2
      ? { pillarScores: reco2.pillarScores, keyEvidence: reco2.keyEvidence }
      : raw2
        ? { pillarScores: raw2.pillarScores, keyEvidence: raw2.keyEvidence }
        : null,
    userTextForScenario(tx, 2),
  );
  const s3 = enrichScenarioSliceWithContemptHeuristic(
    reco3
      ? { pillarScores: reco3.pillarScores, keyEvidence: reco3.keyEvidence }
      : raw3
        ? { pillarScores: raw3.pillarScores, keyEvidence: raw3.keyEvidence }
        : null,
    userTextForScenario(tx, 3),
  );
  const m4San = m4
    ? sanitizePersonalMomentScoresForAggregate({
        pillarScores: (m4.pillarScores as Record<string, number | null>) ?? {},
        keyEvidence:
          typeof m4.keyEvidence === 'object' && m4.keyEvidence != null && !Array.isArray(m4.keyEvidence)
            ? (m4.keyEvidence as Record<string, string>)
            : undefined,
      })
    : null;
  const slices = [s1, s2, s3, extractSlice(m4San)];
  const pillar_scores = aggregatePillarScoresWithCommitmentMerge(slices);
  const gate = computeGateResultCore(pillar_scores, null);
  console.log('Recomputed pillar_scores', pillar_scores);
  console.log('Gate', { pass: gate.pass, weightedScore: gate.weightedScore, failReason: gate.failReason });
  const { error: upErr } = await admin
    .from('interview_attempts')
    .update({
      pillar_scores,
      weighted_score: gate.weightedScore,
      passed: gate.pass,
      gate_fail_reason: gate.failReason,
    })
    .eq('id', row.id as string);
  if (upErr) {
    console.error('Update failed:', upErr.message);
    if (!serviceKey) console.error('If RLS blocked, set SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }
  console.log(`Updated interview_attempts id=${row.id} attempt_number=${attemptNumber}`);
}

void main();
