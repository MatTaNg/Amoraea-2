/**
 * Re-score Moment 5 from a stored transcript and update interview_attempts.
 *
 * Usage (repo root, Node 20+):
 *   npm run reprocess-moment5-scores -- --attempt-number=67
 *
 * (Passes through to `npx tsx --env-file=.env scripts/reprocess-moment5-scores.ts`.)
 *
 * Requires: EXPO_PUBLIC_SUPABASE_URL (or SUPABASE_URL), EXPO_PUBLIC_SUPABASE_ANON_KEY,
 * EXPO_PUBLIC_ANTHROPIC_PROXY_URL (or direct API + EXPO_PUBLIC_ANTHROPIC_API_KEY).
 * For updates under RLS, SUPABASE_SERVICE_ROLE_KEY is recommended.
 */
import { createClient } from '@supabase/supabase-js';
import { aggregatePillarScoresWithCommitmentMerge } from '../src/features/aria/aggregateMarkerScoresFromSlices';
import { sanitizePersonalMomentScoresForAggregate } from '../src/features/aria/personalMomentSliceSanitize';
import { buildPersonalMomentScoringPrompt } from '../src/features/aria/personalMomentScoringPrompt';
import { inferPersonalMomentSlices } from '../src/features/aria/personalMomentSlices';
import { normalizeScoresByEvidence } from '../src/features/aria/probeAndScoringUtils';

type TranscriptMsg = { role: string; content?: string };

type PersonalMomentScoreResult = {
  momentNumber: 4 | 5;
  momentName: string;
  pillarScores: Record<string, number | null>;
  pillarConfidence: Record<string, string>;
  keyEvidence: Record<string, string>;
  summary: string;
  specificity: string;
};

function normalizeTranscript(raw: unknown): { role: string; content: string }[] {
  if (!Array.isArray(raw)) return [];
  return (raw as TranscriptMsg[]).map((m) => ({
    role: m.role === 'user' ? 'user' : 'assistant',
    content: typeof m.content === 'string' ? m.content : '',
  }));
}

function parseArgs(argv: string[]): number {
  const arg = argv.find((a) => a.startsWith('--attempt-number='));
  const n = arg ? Number(arg.split('=')[1]) : NaN;
  if (!Number.isFinite(n) || n < 1) {
    console.error('Pass --attempt-number=<positive integer> (e.g. --attempt-number=67)');
    process.exit(1);
  }
  return n;
}

async function main(): Promise<void> {
  const attemptNumber = parseArgs(process.argv.slice(2));

  const supabaseUrl =
    process.env.SUPABASE_URL?.trim() ?? process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();
  const supabaseKey = serviceKey ?? anonKey;

  const proxyUrl = process.env.EXPO_PUBLIC_ANTHROPIC_PROXY_URL?.trim();
  const anthropicKey = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY?.trim();
  const apiUrl = proxyUrl || 'https://api.anthropic.com/v1/messages';
  const useProxy = apiUrl !== 'https://api.anthropic.com/v1/messages';

  if (!supabaseUrl || !supabaseKey) {
    console.error('Set SUPABASE_URL or EXPO_PUBLIC_SUPABASE_URL and anon or service role key');
    process.exit(1);
  }
  if (!useProxy && !anthropicKey) {
    console.error('Set EXPO_PUBLIC_ANTHROPIC_PROXY_URL or EXPO_PUBLIC_ANTHROPIC_API_KEY for direct API');
    process.exit(1);
  }

  const admin = createClient(supabaseUrl, supabaseKey);

  const { data: row, error: selErr } = await admin
    .from('interview_attempts')
    .select(
      'id, attempt_number, transcript, scenario_1_scores, scenario_2_scores, scenario_3_scores, scenario_specific_patterns, pillar_scores'
    )
    .eq('attempt_number', attemptNumber)
    .maybeSingle();

  if (selErr) {
    console.error(selErr.message);
    process.exit(1);
  }
  if (!row) {
    console.error(`No interview_attempts row with attempt_number=${attemptNumber}`);
    process.exit(1);
  }

  const transcript = normalizeTranscript(row.transcript);
  const personalSlices = inferPersonalMomentSlices(transcript);
  console.log('Slice indices', { m4Start: personalSlices.m4Start, m5Start: personalSlices.m5Start });
  console.log('Moment 5 slice turns', personalSlices.moment5.length);

  if (personalSlices.moment5.filter((m) => m.role === 'user').length < 1) {
    console.error('Moment 5 slice has no user turns — cannot score');
    process.exit(1);
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (useProxy && anonKey) {
    headers['Authorization'] = `Bearer ${anonKey}`;
  } else if (!useProxy && anthropicKey) {
    headers['x-api-key'] = anthropicKey;
    headers['anthropic-version'] = '2023-06-01';
  }

  const res = await fetch(apiUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 900,
      messages: [
        { role: 'user', content: buildPersonalMomentScoringPrompt(5, personalSlices.moment5) },
      ],
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    console.error('Anthropic error', (data as { error?: { message?: string } })?.error?.message ?? res.status);
    process.exit(1);
  }

  const raw = (data.content?.[0]?.text ?? '{}').replace(/```json|```/g, '').trim();
  const parsed = JSON.parse(raw) as PersonalMomentScoreResult;
  const appreciationBeforeNorm = parsed.pillarScores?.appreciation;
  parsed.pillarScores = normalizeScoresByEvidence(parsed.pillarScores, parsed.keyEvidence);
  if (appreciationBeforeNorm === null) {
    parsed.pillarScores = { ...parsed.pillarScores, appreciation: null };
  }

  const moment5Payload = {
    pillarScores: parsed.pillarScores,
    pillarConfidence: parsed.pillarConfidence,
    keyEvidence: parsed.keyEvidence,
    summary: parsed.summary,
    specificity: parsed.specificity,
    momentName: parsed.momentName,
  };

  const r = row as Record<string, unknown>;
  const s1 = r.scenario_1_scores as {
    pillarScores?: Record<string, number | null>;
    keyEvidence?: Record<string, string>;
  } | null;
  const s2 = r.scenario_2_scores as {
    pillarScores?: Record<string, number | null>;
    keyEvidence?: Record<string, string>;
  } | null;
  const s3 = r.scenario_3_scores as {
    pillarScores?: Record<string, number | null>;
    keyEvidence?: Record<string, string>;
  } | null;
  const m4 = (r.scenario_specific_patterns as Record<string, unknown> | null)?.moment_4_scores as
    | { pillarScores?: Record<string, number | null>; keyEvidence?: Record<string, string> }
    | null
    | undefined;
  const m4ForAgg = m4
    ? sanitizePersonalMomentScoresForAggregate(
        {
          pillarScores: m4.pillarScores ?? {},
          keyEvidence: m4.keyEvidence,
        },
        4,
      )
    : null;

  const markerSlicesForAggregate = [
    s1 ? { pillarScores: s1.pillarScores, keyEvidence: s1.keyEvidence } : null,
    s2 ? { pillarScores: s2.pillarScores, keyEvidence: s2.keyEvidence } : null,
    s3 ? { pillarScores: s3.pillarScores, keyEvidence: s3.keyEvidence } : null,
    m4ForAgg ? { pillarScores: m4ForAgg.pillarScores, keyEvidence: m4ForAgg.keyEvidence } : null,
    { pillarScores: moment5Payload.pillarScores, keyEvidence: moment5Payload.keyEvidence },
  ];

  const pillar_scores = aggregatePillarScoresWithCommitmentMerge(markerSlicesForAggregate);
  const prevPatterns = (r.scenario_specific_patterns as Record<string, unknown> | null) ?? {};
  const scenario_specific_patterns = { ...prevPatterns, moment_5_scores: moment5Payload };

  console.log('New moment_5_scores pillarScores', moment5Payload.pillarScores);
  console.log('Recomputed pillar_scores (moment-restricted aggregate + CT merge)', pillar_scores);

  const { error: upErr } = await admin
    .from('interview_attempts')
    .update({ scenario_specific_patterns, pillar_scores })
    .eq('id', row.id as string);

  if (upErr) {
    console.error('Update failed:', upErr.message);
    if (!serviceKey) {
      console.error('If RLS blocked the update, set SUPABASE_SERVICE_ROLE_KEY and retry.');
    }
    process.exit(1);
  }

  console.log(`Updated interview_attempts id=${row.id} attempt_number=${attemptNumber}`);
}

void main();
