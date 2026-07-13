import { INTERVIEW_MARKER_IDS } from './interviewMarkers';

export type {
  AdminRecalculateAttemptInput,
  AdminRecalculateIncomplete,
  AdminRecalculateOptions,
  AdminRecalculateResult,
  AdminRecalculateSuccess,
} from './adminRecalculateAttemptTypes';

export { recalculateAttemptScoresFromStoredSlices } from './recalculateAttemptScoresFromStoredSlices';

/** Per-pillar deltas (new minus old), only where both exist; omit zeros to keep payload small. */
export function computePillarScoreDelta(
  oldMap: Record<string, number | null | undefined>,
  newMap: Record<string, number | null | undefined>
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const id of INTERVIEW_MARKER_IDS) {
    const o = oldMap[id];
    const n = newMap[id];
    if (typeof o === 'number' && Number.isFinite(o) && typeof n === 'number' && Number.isFinite(n)) {
      const d = Math.round((n - o) * 10) / 10;
      if (d !== 0) out[id] = d;
    }
  }
  return out;
}

export function snapshotAttemptScoresForAudit(row: {
  pillar_scores?: unknown;
  weighted_score?: unknown;
  passed?: unknown;
  final_gate_pass?: unknown;
  gate_fail_reasons?: unknown;
  gate_fail_detail?: unknown;
  scenario_composites?: unknown;
  incomplete_reason?: unknown;
  ego_development_level?: unknown;
  review_flags?: unknown;
  mentalizing_overcertainty_count?: unknown;
  defense_patterns?: unknown;
  depth_signal_modifier?: unknown;
  score_modifier?: unknown;
  modified_weighted_score?: unknown;
  disclosure_calibration?: unknown;
  ai_reasoning?: unknown;
}): Record<string, unknown> {
  const ai =
    row.ai_reasoning != null && typeof row.ai_reasoning === 'object' && !Array.isArray(row.ai_reasoning)
      ? (row.ai_reasoning as Record<string, unknown>)
      : null;
  return {
    pillar_scores: row.pillar_scores ?? null,
    weighted_score: row.weighted_score ?? null,
    passed: row.passed ?? null,
    final_gate_pass: row.final_gate_pass ?? null,
    gate_fail_reasons: row.gate_fail_reasons ?? null,
    gate_fail_detail: row.gate_fail_detail ?? null,
    scenario_composites: row.scenario_composites ?? null,
    incomplete_reason: row.incomplete_reason ?? null,
    ego_development_level: row.ego_development_level ?? null,
    review_flags: row.review_flags ?? null,
    mentalizing_overcertainty_count: row.mentalizing_overcertainty_count ?? null,
    defense_patterns: row.defense_patterns ?? null,
    depth_signal_modifier: row.depth_signal_modifier ?? null,
    score_modifier: row.score_modifier ?? null,
    modified_weighted_score: row.modified_weighted_score ?? null,
    disclosure_calibration: row.disclosure_calibration ?? null,
    ai_reasoning_verdict:
      ai != null
        ? {
            passed: ai.passed ?? null,
            weighted_score: ai.weighted_score ?? null,
          }
        : null,
    captured_at: new Date().toISOString(),
  };
}
