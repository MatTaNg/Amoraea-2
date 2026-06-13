/**
 * Dry-run: recompute interview gate from stored slices for legacy users (interview done,
 * psychometrics not) and compare to persisted scores. Does not write to the database.
 *
 * Usage:
 *   npm run audit-legacy-interview-rescore
 *   npm run audit-legacy-interview-rescore -- --flips-only
 *   npm run audit-legacy-interview-rescore -- --user-id=<uuid>
 *   npm run audit-legacy-interview-rescore -- --attempt-id=<uuid>
 *   npm run audit-legacy-interview-rescore -- --limit=50
 *
 * Requires .env with EXPO_PUBLIC_SUPABASE_URL (or SUPABASE_URL) and
 * SUPABASE_SERVICE_ROLE_KEY (or dev fallback EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY).
 */
import { createClient } from '@supabase/supabase-js';
import { PILLAR_ROLLUP_ALGORITHM_VERSION } from '../src/features/aria/aggregateMarkerScoresFromSlices';
import {
  computePillarScoreDelta,
  recalculateAttemptScoresFromStoredSlices,
} from '../src/features/aria/adminRecalculateAttemptScores';

type Args = {
  flipsOnly: boolean;
  userId?: string;
  attemptId?: string;
  limit?: number;
};

type AttemptRow = {
  id: string;
  user_id: string;
  attempt_number: number;
  completed_at: string | null;
  transcript: unknown;
  scenario_1_scores: unknown;
  scenario_2_scores: unknown;
  scenario_3_scores: unknown;
  scenario_specific_patterns: unknown;
  ego_development_level: unknown;
  language_markers: unknown;
  skip_count: number | string | null;
  pillar_scores: Record<string, number> | null;
  weighted_score: number | null;
  modified_weighted_score: number | null;
  passed: boolean | null;
  gate_fail_reasons: string[] | null;
};

type UserRow = {
  id: string;
  email: string | null;
  latest_attempt_id: string | null;
};

type AuditRow = {
  userId: string;
  email: string | null;
  attemptId: string;
  attemptNumber: number;
  completedAt: string | null;
  old: {
    passed: boolean | null;
    weightedScore: number | null;
    modifiedWeightedScore: number | null;
    gateFailReasons: string[];
  };
  new: {
    passed: boolean | null;
    weightedScore: number | null;
    modifiedWeightedScore: number | null;
    gateFailReasons: string[];
    incomplete: boolean;
    notes: string[];
  };
  passFlipped: boolean;
  passFlipDirection: 'pass_to_fail' | 'fail_to_pass' | null;
  weightedDelta: number | null;
  modifiedWeightedDelta: number | null;
  pillarDelta: Record<string, number>;
};

function parseArgs(argv: string[]): Args {
  const flipsOnly = argv.includes('--flips-only');
  const userArg = argv.find((a) => a.startsWith('--user-id='));
  const attemptArg = argv.find((a) => a.startsWith('--attempt-id='));
  const limitArg = argv.find((a) => a.startsWith('--limit='));
  const userId = userArg?.split('=')[1]?.trim();
  const attemptId = attemptArg?.split('=')[1]?.trim();
  const limitRaw = limitArg ? Number(limitArg.split('=')[1]) : NaN;
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : undefined;
  return { flipsOnly, userId, attemptId, limit };
}

function normalizePillarMap(raw: unknown): Record<string, number | null | undefined> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return raw as Record<string, number | null | undefined>;
}

function gateReasonsArray(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : [];
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

async function loadAttempt(
  admin: ReturnType<typeof createClient>,
  args: Args,
): Promise<Array<{ user: UserRow; attempt: AttemptRow }>> {
  const attemptSelect =
    'id, user_id, attempt_number, completed_at, transcript, scenario_1_scores, scenario_2_scores, scenario_3_scores, scenario_specific_patterns, ego_development_level, language_markers, skip_count, pillar_scores, weighted_score, modified_weighted_score, passed, gate_fail_reasons';

  if (args.attemptId) {
    const { data: attempt, error } = await admin
      .from('interview_attempts')
      .select(attemptSelect)
      .eq('id', args.attemptId)
      .maybeSingle();
    if (error) throw error;
    if (!attempt) return [];
    const { data: user, error: userErr } = await admin
      .from('users')
      .select('id, email, latest_attempt_id')
      .eq('id', (attempt as AttemptRow).user_id)
      .maybeSingle();
    if (userErr) throw userErr;
    if (!user) return [];
    return [{ user: user as UserRow, attempt: attempt as AttemptRow }];
  }

  if (args.userId) {
    const { data: user, error: userErr } = await admin
      .from('users')
      .select('id, email, latest_attempt_id, interview_completed, psychometrics_completed_at')
      .eq('id', args.userId)
      .maybeSingle();
    if (userErr) throw userErr;
    if (!user?.latest_attempt_id) return [];
    const { data: attempt, error: attErr } = await admin
      .from('interview_attempts')
      .select(attemptSelect)
      .eq('id', user.latest_attempt_id)
      .maybeSingle();
    if (attErr) throw attErr;
    if (!attempt) return [];
    return [
      {
        user: user as UserRow,
        attempt: attempt as AttemptRow,
      },
    ];
  }

  const pageSize = 200;
  let offset = 0;
  const pairs: Array<{ user: UserRow; attempt: AttemptRow }> = [];

  for (;;) {
    let query = admin
      .from('users')
      .select('id, email, latest_attempt_id')
      .eq('interview_completed', true)
      .is('psychometrics_completed_at', null)
      .not('latest_attempt_id', 'is', null)
      .order('created_at', { ascending: true })
      .range(offset, offset + pageSize - 1);

    const { data: users, error: usersErr } = await query;
    if (usersErr) throw usersErr;
    const batch = (users ?? []) as UserRow[];
    if (batch.length === 0) break;

    const attemptIds = batch.map((u) => u.latest_attempt_id).filter((id): id is string => typeof id === 'string');
    const { data: attempts, error: attErr } = await admin
      .from('interview_attempts')
      .select(attemptSelect)
      .in('id', attemptIds)
      .not('completed_at', 'is', null);
    if (attErr) throw attErr;

    const attemptById = new Map(
      ((attempts ?? []) as AttemptRow[]).map((a) => [a.id, a] as const),
    );

    for (const user of batch) {
      if (!user.latest_attempt_id) continue;
      const attempt = attemptById.get(user.latest_attempt_id);
      if (!attempt) continue;
      pairs.push({ user, attempt });
      if (args.limit != null && pairs.length >= args.limit) {
        return pairs;
      }
    }

    offset += pageSize;
    if (batch.length < pageSize) break;
  }

  return pairs;
}

async function auditOne(
  user: UserRow,
  attempt: AttemptRow,
): Promise<AuditRow> {
  const oldPillars = normalizePillarMap(attempt.pillar_scores);
  const oldPassed = attempt.passed;
  const oldWeighted = attempt.weighted_score;
  const oldModified = attempt.modified_weighted_score;
  const oldGateReasons = gateReasonsArray(attempt.gate_fail_reasons);

  const result = recalculateAttemptScoresFromStoredSlices({
    transcript: attempt.transcript,
    scenario_1_scores: attempt.scenario_1_scores,
    scenario_2_scores: attempt.scenario_2_scores,
    scenario_3_scores: attempt.scenario_3_scores,
    scenario_specific_patterns: attempt.scenario_specific_patterns,
    ego_development_level: attempt.ego_development_level,
    language_markers: attempt.language_markers,
    skip_count: attempt.skip_count,
  });

  let newPassed: boolean | null = null;
  let newWeighted: number | null = null;
  let newModified: number | null = null;
  let newGateReasons: string[] = [];
  let notes: string[] = [];
  let incomplete = false;
  let pillarDelta: Record<string, number> = {};

  if (result.kind === 'success') {
    pillarDelta = computePillarScoreDelta(oldPillars, result.pillar_scores);
    newWeighted = result.gate.weightedScore;
    newModified = result.gate.modifiedWeightedScore ?? result.gate.weightedScore;
    notes = result.notes;
    newGateReasons = result.gate.failReasonCodes ?? [];
    newPassed = result.gate.pass;
  } else {
    incomplete = true;
    notes = result.notes;
    newPassed = false;
    newWeighted = result.gate.weightedScore;
    newModified = result.gate.modifiedWeightedScore ?? result.gate.weightedScore;
    newGateReasons = result.gate.failReasonCodes ?? [];
  }

  const passFlipped = oldPassed !== newPassed;
  let passFlipDirection: AuditRow['passFlipDirection'] = null;
  if (passFlipped) {
    passFlipDirection = oldPassed === true && newPassed !== true ? 'pass_to_fail' : 'fail_to_pass';
  }

  const weightedDelta =
    typeof oldWeighted === 'number' && typeof newWeighted === 'number'
      ? round1(newWeighted - oldWeighted)
      : null;
  const modifiedWeightedDelta =
    typeof oldModified === 'number' && typeof newModified === 'number'
      ? round1(newModified - oldModified)
      : null;

  return {
    userId: user.id,
    email: user.email,
    attemptId: attempt.id,
    attemptNumber: attempt.attempt_number,
    completedAt: attempt.completed_at,
    old: {
      passed: oldPassed,
      weightedScore: oldWeighted,
      modifiedWeightedScore: oldModified,
      gateFailReasons: oldGateReasons,
    },
    new: {
      passed: newPassed,
      weightedScore: newWeighted,
      modifiedWeightedScore: newModified,
      gateFailReasons: newGateReasons,
      incomplete,
      notes,
    },
    passFlipped,
    passFlipDirection,
    weightedDelta,
    modifiedWeightedDelta,
    pillarDelta,
  };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const supabaseUrl =
    process.env.SUPABASE_URL?.trim() ?? process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ??
    process.env.EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!supabaseUrl || !serviceKey) {
    console.error(
      'Set in .env:\n' +
        '  - SUPABASE_URL or EXPO_PUBLIC_SUPABASE_URL\n' +
        '  - SUPABASE_SERVICE_ROLE_KEY (or EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY)',
    );
    process.exit(1);
  }

  const admin = createClient(supabaseUrl, serviceKey);
  const pairs = await loadAttempt(admin, args);

  if (pairs.length === 0) {
    console.log(
      JSON.stringify(
        {
          dryRun: true,
          rollupAlgorithm: PILLAR_ROLLUP_ALGORITHM_VERSION,
          cohort: 'interview_completed + psychometrics_completed_at null',
          scanned: 0,
          message: 'No matching users/attempts found',
          rows: [],
        },
        null,
        2,
      ),
    );
    return;
  }

  const rows: AuditRow[] = [];
  for (const { user, attempt } of pairs) {
    rows.push(await auditOne(user, attempt));
  }

  const filtered = args.flipsOnly ? rows.filter((r) => r.passFlipped) : rows;
  const passToFail = rows.filter((r) => r.passFlipDirection === 'pass_to_fail').length;
  const failToPass = rows.filter((r) => r.passFlipDirection === 'fail_to_pass').length;
  const incomplete = rows.filter((r) => r.new.incomplete).length;

  console.log(
    JSON.stringify(
      {
        dryRun: true,
        wroteToDatabase: false,
        rollupAlgorithm: PILLAR_ROLLUP_ALGORITHM_VERSION,
        cohort: 'interview_completed + psychometrics_completed_at null + latest completed attempt',
        note:
          'Interview gate only — psychometric floors and gaming correction are not simulated (cohort has no psychometrics).',
        filters: {
          flipsOnly: args.flipsOnly,
          userId: args.userId ?? null,
          attemptId: args.attemptId ?? null,
          limit: args.limit ?? null,
        },
        summary: {
          scanned: rows.length,
          reported: filtered.length,
          passFlipped: rows.filter((r) => r.passFlipped).length,
          passToFail,
          failToPass,
          unchanged: rows.length - passToFail - failToPass,
          incomplete,
        },
        rows: filtered,
      },
      null,
      2,
    ),
  );
}

void main().catch((e) => {
  console.error(e);
  process.exit(1);
});
