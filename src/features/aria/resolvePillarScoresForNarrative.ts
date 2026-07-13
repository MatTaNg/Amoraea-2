import { recalculateAttemptScoresFromStoredSlices } from './adminRecalculateAttemptScores';
import { interviewModifierFieldsFromGateResult } from './interviewModifierPersist';

export type NarrativeAttemptRowInput = {
  transcript?: unknown;
  scenario_1_scores?: unknown;
  scenario_2_scores?: unknown;
  scenario_3_scores?: unknown;
  scenario_specific_patterns?: unknown;
  pillar_scores?: unknown;
  weighted_score?: number | null;
  skip_count?: number | string | null;
  ego_development_level?: unknown;
  language_markers?: unknown;
  defense_patterns?: unknown;
  disclosure_calibration?: unknown;
  mentalizing_overcertainty_count?: number | null;
  skip_penalty_total?: number | null;
  auto_failed?: boolean | null;
  moment_4_concreteness?: unknown;
  moment_5_concreteness?: unknown;
  personal_moment_emotional_vocab_density?: number | null;
  personal_moment_emotional_vocab_low?: boolean | null;
};

export type NarrativePillarResolution = {
  pillar_scores: Record<string, number>;
  weighted_score: number | null;
  passed: boolean | null;
  fromRollup: boolean;
  rollupNotes?: string[];
  depth_signal_modifier?: number;
  score_modifier?: number;
  modified_weighted_score?: number | null;
};

function pillarScoresRecord(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
  }
  return out;
}

/** Use stored pillar_scores when present; otherwise rollup from scenario/moment slices. */
export function resolvePillarScoresForNarrativeFromAttempt(
  row: NarrativeAttemptRowInput,
  gatePass?: boolean | null,
): NarrativePillarResolution | null {
  const stored = pillarScoresRecord(row.pillar_scores);
  if (Object.keys(stored).length > 0) {
    return {
      pillar_scores: stored,
      weighted_score:
        typeof row.weighted_score === 'number' && Number.isFinite(row.weighted_score)
          ? row.weighted_score
          : null,
      passed: gatePass ?? null,
      fromRollup: false,
    };
  }

  const result = recalculateAttemptScoresFromStoredSlices(
    {
      transcript: row.transcript,
      scenario_1_scores: row.scenario_1_scores,
      scenario_2_scores: row.scenario_2_scores,
      scenario_3_scores: row.scenario_3_scores,
      scenario_specific_patterns: row.scenario_specific_patterns,
      skip_count: row.skip_count,
      ego_development_level: row.ego_development_level,
      language_markers: row.language_markers,
      defense_patterns: row.defense_patterns,
      disclosure_calibration: row.disclosure_calibration,
      mentalizing_overcertainty_count: row.mentalizing_overcertainty_count,
      skip_penalty_total: row.skip_penalty_total,
      auto_failed: row.auto_failed,
      moment_4_concreteness: row.moment_4_concreteness,
      moment_5_concreteness: row.moment_5_concreteness,
      personal_moment_emotional_vocab_density: row.personal_moment_emotional_vocab_density,
      personal_moment_emotional_vocab_low: row.personal_moment_emotional_vocab_low,
    },
    { skipScenarioTranscriptMutations: true, usePersistedGateContext: true },
  );

  if (result.kind !== 'success') return null;

  const modifierFields = interviewModifierFieldsFromGateResult(result.gate);

  return {
    pillar_scores: result.pillar_scores,
    weighted_score: result.gate.weightedScore ?? null,
    passed: result.gate.pass,
    fromRollup: true,
    rollupNotes: result.notes,
    ...modifierFields,
  };
}
