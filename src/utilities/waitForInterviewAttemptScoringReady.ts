import type { SupabaseClient } from '@supabase/supabase-js';
import {
  attemptRowMissingRollupArtifacts,
  type InterviewRollupArtifactRow,
} from '@features/psychometrics/ensureInterviewRollupArtifacts';

type AttemptScoringRow = {
  completed_at: string | null;
  weighted_score: number | null;
  pillar_scores: unknown;
  scenario_1_scores: unknown;
  scenario_2_scores: unknown;
  scenario_3_scores: unknown;
  scenario_composites?: unknown;
  defense_patterns?: unknown;
  defense_cross_reference?: unknown;
};

function objectNonEmpty(o: unknown): boolean {
  return o != null && typeof o === 'object' && !Array.isArray(o) && Object.keys(o as object).length > 0;
}

/** Holistic pillar_scores may be flat marker map or nested; require at least one numeric score key. */
function pillarScoresMeaningful(raw: unknown): boolean {
  if (!objectNonEmpty(raw)) return false;
  const o = raw as Record<string, unknown>;
  const inner = o.pillarScores ?? o.pillar_scores;
  const source =
    inner != null && typeof inner === 'object' && !Array.isArray(inner) ? (inner as Record<string, unknown>) : o;
  return Object.values(source).some((v) => {
    if (typeof v === 'number' && Number.isFinite(v)) return true;
    if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return true;
    return false;
  });
}

/** Scenario bundle should include a non-empty pillarScores map (how interview_attempts stores scenario_*_scores). */
export function scenarioScoresMeaningful(raw: unknown): boolean {
  if (!objectNonEmpty(raw)) return false;
  const o = raw as Record<string, unknown>;
  const inner = o.pillarScores ?? o.pillar_scores;
  if (inner == null || typeof inner !== 'object' || Array.isArray(inner)) return false;
  return Object.keys(inner as object).length > 0;
}

/** Inserts use `null` when a scenario slice was missing; those rows must not block readiness forever. */
function scenarioScoresMeaningfulOrAbsent(raw: unknown): boolean {
  if (raw == null) return true;
  return scenarioScoresMeaningful(raw);
}

export function interviewAttemptRollupPersisted(row: AttemptScoringRow | null | undefined): boolean {
  return rowHasFullScoringPayload(row);
}

function rowHasFullScoringPayload(row: AttemptScoringRow | null | undefined): boolean {
  if (!row) return false;
  if (row.completed_at == null || row.completed_at === '') return false;
  const w = row.weighted_score;
  if (w != null && !Number.isFinite(Number(w))) return false;
  if (!pillarScoresMeaningful(row.pillar_scores)) return false;
  if (!scenarioScoresMeaningfulOrAbsent(row.scenario_1_scores)) return false;
  if (!scenarioScoresMeaningfulOrAbsent(row.scenario_2_scores)) return false;
  if (!scenarioScoresMeaningfulOrAbsent(row.scenario_3_scores)) return false;
  // Critical rollup artifacts must be present — otherwise readiness races ahead of rollup write.
  if (
    attemptRowMissingRollupArtifacts({
      scenario_composites: row.scenario_composites,
      defense_patterns: row.defense_patterns,
      defense_cross_reference: row.defense_cross_reference,
      scenario_1_scores: row.scenario_1_scores,
      scenario_2_scores: row.scenario_2_scores,
      scenario_3_scores: row.scenario_3_scores,
    } as InterviewRollupArtifactRow)
  ) {
    return false;
  }
  return true;
}

/**
 * Poll until the attempt row reflects a full scoring write (avoids navigating to results on stale rows).
 */
export async function waitForInterviewAttemptScoringReady(
  client: SupabaseClient,
  attemptId: string,
  opts?: { maxMs?: number; intervalMs?: number }
): Promise<boolean> {
  const maxMs = opts?.maxMs ?? 120_000;
  const intervalMs = opts?.intervalMs ?? 400;
  const deadline = Date.now() + maxMs;

  while (Date.now() < deadline) {
    const { data, error } = await client
      .from('interview_attempts')
      .select(
        'completed_at, weighted_score, pillar_scores, scenario_1_scores, scenario_2_scores, scenario_3_scores, scenario_composites, defense_patterns, defense_cross_reference',
      )
      .eq('id', attemptId)
      .maybeSingle();

    // Row gone (e.g. admin reset deleted attempts) — do not spin until maxMs.
    if (!error && data == null) {
      return false;
    }

    if (!error && rowHasFullScoringPayload(data as AttemptScoringRow)) {
      return true;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return false;
}
