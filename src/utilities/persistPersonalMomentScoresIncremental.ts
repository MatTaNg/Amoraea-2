import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  PersonalMoment5SliceForSanitize,
  PersonalMomentSliceForSanitize,
} from '@features/aria/personalMomentSliceSanitize';
import {
  mergeMoment4ConcretenessForGate,
  normalizeMoment4Concreteness,
  normalizeResponseConcreteness,
} from '@features/aria/personalMomentConcreteness';

import {
  isDefensePatternsShapeIncomplete,
  normalizeDefensePatternsForPersist,
} from '@features/aria/defensePatternsDetection';
import { markScoringStageComplete } from '@features/psychometrics/ensureInterviewRollupArtifacts';
import type { DefenseCrossReferenceResult } from '@features/psychometrics/crossReferenceDefenseDetection';

export type AttemptScoringBaseline = {
  patterns: Record<string, unknown>;
  moment_4_concreteness: string | null;
  moment_5_concreteness: string | null;
  ego_development_level: number | null;
  personal_moment_emotional_vocab_low: boolean;
  personal_moment_emotional_vocab_density: number | null;
  disclosure_calibration: string | null;
  defense_patterns: Record<string, unknown> | null;
  mentalizing_overcertainty_count: number;
};

const BASELINE_SELECT =
  'scenario_specific_patterns, moment_4_concreteness, moment_5_concreteness, ego_development_level, personal_moment_emotional_vocab_low, personal_moment_emotional_vocab_density, disclosure_calibration, defense_patterns, mentalizing_overcertainty_count';

export async function fetchAttemptScoringBaseline(
  supabase: SupabaseClient,
  attemptId: string,
  userId?: string | null,
): Promise<AttemptScoringBaseline> {
  let q = supabase.from('interview_attempts').select(BASELINE_SELECT).eq('id', attemptId);
  if (userId) q = q.eq('user_id', userId);
  const { data, error } = await q.maybeSingle();
  if (error) {
    console.warn('[ScorePipeline] fetch baseline failed:', error.message);
  }
  const row = data as Record<string, unknown> | null;
  const patterns =
    row?.scenario_specific_patterns != null &&
    typeof row.scenario_specific_patterns === 'object' &&
    !Array.isArray(row.scenario_specific_patterns)
      ? { ...(row.scenario_specific_patterns as Record<string, unknown>) }
      : {};
  return {
    patterns,
    moment_4_concreteness:
      typeof row?.moment_4_concreteness === 'string' ? row.moment_4_concreteness : null,
    moment_5_concreteness:
      typeof row?.moment_5_concreteness === 'string' ? row.moment_5_concreteness : null,
    ego_development_level:
      typeof row?.ego_development_level === 'number' && Number.isFinite(row.ego_development_level)
        ? row.ego_development_level
        : null,
    personal_moment_emotional_vocab_low: row?.personal_moment_emotional_vocab_low === true,
    personal_moment_emotional_vocab_density:
      typeof row?.personal_moment_emotional_vocab_density === 'number' &&
      Number.isFinite(row.personal_moment_emotional_vocab_density)
        ? row.personal_moment_emotional_vocab_density
        : null,
    disclosure_calibration:
      typeof row?.disclosure_calibration === 'string' ? row.disclosure_calibration : null,
    defense_patterns:
      row?.defense_patterns != null &&
      typeof row.defense_patterns === 'object' &&
      !Array.isArray(row.defense_patterns) &&
      !isDefensePatternsShapeIncomplete(row.defense_patterns as Record<string, unknown>)
        ? normalizeDefensePatternsForPersist(row.defense_patterns as Record<string, unknown>)
        : null,
    mentalizing_overcertainty_count:
      typeof row?.mentalizing_overcertainty_count === 'number' &&
      Number.isFinite(row.mentalizing_overcertainty_count)
        ? row.mentalizing_overcertainty_count
        : 0,
  };
}

export function logScorePipelineBaseline(baseline: AttemptScoringBaseline): void {
  const p = baseline.patterns;
  console.log('[ScorePipeline] existing patterns before scoring:', {
    hasM4: !!p.moment_4_scores,
    hasM5: !!p.moment_5_scores,
    egoDevLevel: baseline.ego_development_level,
  });
}

export function buildMoment4ScoresRecord(
  moment4: PersonalMomentSliceForSanitize,
  specificityScoringMetadata?: unknown | null,
): Record<string, unknown> {
  return {
    pillarScores: moment4.pillarScores,
    pillarConfidence: moment4.pillarConfidence,
    keyEvidence: moment4.keyEvidence,
    summary: moment4.summary,
    specificity: moment4.specificity,
    momentName: moment4.momentName,
    mentalizing_overcertainty: moment4.mentalizing_overcertainty === true,
    response_concreteness: moment4.response_concreteness ?? null,
    emotional_vocab_count: moment4.emotional_vocab_count ?? null,
    emotional_vocab_words: moment4.emotional_vocab_words ?? [],
    user_slice_word_count: moment4.user_slice_word_count ?? null,
    ...(specificityScoringMetadata ? { specificityScoringMetadata } : {}),
    ...(moment4.scoringMetadata ? { scoringMetadata: moment4.scoringMetadata } : {}),
  };
}

export function buildMoment5ScoresRecord(
  moment5: PersonalMoment5SliceForSanitize,
  scoringMetadata: Record<string, unknown>,
): Record<string, unknown> {
  return {
    pillarScores: moment5.pillarScores,
    pillarConfidence: moment5.pillarConfidence,
    keyEvidence: moment5.keyEvidence,
    summary: moment5.summary,
    specificity: moment5.specificity,
    momentName: moment5.momentName,
    mentalizing_overcertainty: moment5.mentalizing_overcertainty === true,
    response_concreteness: moment5.response_concreteness ?? null,
    emotional_vocab_count: moment5.emotional_vocab_count ?? null,
    emotional_vocab_words: moment5.emotional_vocab_words ?? [],
    user_slice_word_count: moment5.user_slice_word_count ?? null,
    scoringMetadata,
  };
}

export function mergeScenarioSpecificPatterns(
  existing: Record<string, unknown>,
  patch: { moment_4_scores?: unknown; moment_5_scores?: unknown },
): Record<string, unknown> {
  return { ...existing, ...patch };
}

export function resolveMomentScoresForFinalPersist(
  freshRecord: Record<string, unknown> | null | undefined,
  baseline: AttemptScoringBaseline,
  key: 'moment_4_scores' | 'moment_5_scores',
  opts?: { suppressBaselineBackfill?: boolean },
): unknown {
  if (freshRecord) return freshRecord;
  if (opts?.suppressBaselineBackfill) return null;
  const existing = baseline.patterns[key];
  return existing ?? null;
}

export function coalesceConcretenessForFinalPersist(
  freshSlice: { response_concreteness?: string | null } | null | undefined,
  baselineValue: string | null,
  suppressBaselineBackfill = false,
): string | null {
  const fromFresh = normalizeResponseConcreteness(freshSlice?.response_concreteness);
  if (fromFresh != null) return fromFresh;
  if (suppressBaselineBackfill) return null;
  return baselineValue;
}

/** Moment 4 column — preserves `valid_non_applicable` from reconciled scoring slices. */
export function coalesceMoment4ConcretenessForFinalPersist(
  freshSlice: { response_concreteness?: string | null } | null | undefined,
  baselineValue: string | null,
  moment4UserText?: string | null,
  suppressBaselineBackfill = false,
): string | null {
  const fromFresh = normalizeMoment4Concreteness(freshSlice?.response_concreteness);
  const fromBaseline = suppressBaselineBackfill ? null : normalizeMoment4Concreteness(baselineValue);
  const merged = mergeMoment4ConcretenessForGate(freshSlice, fromBaseline ?? baselineValue, moment4UserText);
  if (merged != null) return merged;
  return fromFresh ?? fromBaseline;
}

export async function persistMoment4ScoresImmediate(
  supabase: SupabaseClient,
  attemptId: string,
  userId: string,
  moment4: PersonalMomentSliceForSanitize,
  baseline: AttemptScoringBaseline,
  specificityScoringMetadata?: unknown | null,
): Promise<AttemptScoringBaseline> {
  const moment_4_scores = buildMoment4ScoresRecord(moment4, specificityScoringMetadata);
  const scenario_specific_patterns = mergeScenarioSpecificPatterns(baseline.patterns, {
    moment_4_scores,
  });
  const moment_4_concreteness = coalesceMoment4ConcretenessForFinalPersist(
    moment4,
    baseline.moment_4_concreteness,
  );
  const { error } = await supabase
    .from('interview_attempts')
    .update({ scenario_specific_patterns, moment_4_concreteness })
    .eq('id', attemptId)
    .eq('user_id', userId);
  if (error) {
    console.error('[M4 Persist] failed to persist Moment 4 scores:', error);
  } else {
    console.log('[M4 Persist] Moment 4 scores persisted immediately');
    void markScoringStageComplete(supabase, attemptId, userId, 'moment4', {
      trigger: 'persistMoment4ScoresImmediate',
    }).catch((e) => {
      console.warn('[M4 Persist] gated rollup after M4 persist failed:', e);
    });
  }
  const next: AttemptScoringBaseline = {
    ...baseline,
    patterns: scenario_specific_patterns,
    moment_4_concreteness,
  };
  return next;
}

export type PersistMoment5Extras = {
  personal_moment_emotional_vocab_low?: boolean;
  personal_moment_emotional_vocab_density?: number | null;
  disclosure_calibration?: string | null;
  /** When set, written with M5 scores so probe_log is not solely dependent on final deferred persist. */
  probe_log?: unknown[] | null;
};

export async function persistMoment5ScoresImmediate(
  supabase: SupabaseClient,
  attemptId: string,
  userId: string,
  moment5: PersonalMoment5SliceForSanitize,
  baseline: AttemptScoringBaseline,
  scoringMetadata: Record<string, unknown>,
  extras?: PersistMoment5Extras,
): Promise<AttemptScoringBaseline> {
  const moment_5_scores = buildMoment5ScoresRecord(moment5, scoringMetadata);
  const scenario_specific_patterns = mergeScenarioSpecificPatterns(baseline.patterns, {
    moment_5_scores,
  });
  const moment_5_concreteness = coalesceConcretenessForFinalPersist(moment5, baseline.moment_5_concreteness);
  const update: Record<string, unknown> = {
    scenario_specific_patterns,
    moment_5_concreteness,
  };
  if (extras?.personal_moment_emotional_vocab_low !== undefined) {
    update.personal_moment_emotional_vocab_low = extras.personal_moment_emotional_vocab_low;
  }
  if (extras?.personal_moment_emotional_vocab_density !== undefined) {
    update.personal_moment_emotional_vocab_density = extras.personal_moment_emotional_vocab_density;
  }
  if (extras?.disclosure_calibration !== undefined) {
    update.disclosure_calibration = extras.disclosure_calibration;
  }
  if (extras?.probe_log !== undefined) {
    update.probe_log = extras.probe_log ?? [];
  }
  const { error } = await supabase
    .from('interview_attempts')
    .update(update)
    .eq('id', attemptId)
    .eq('user_id', userId);
  if (error) {
    console.error('[M5 Persist] failed to persist Moment 5 scores:', error);
  } else {
    console.log('[M5 Persist] Moment 5 scores persisted immediately', {
      hasProbeLog: extras?.probe_log != null,
      accountabilityProbeFired: scoringMetadata.accountabilityProbeFired === true,
    });
    void markScoringStageComplete(supabase, attemptId, userId, 'moment5', {
      trigger: 'persistMoment5ScoresImmediate',
    }).catch((e) => {
      console.warn('[M5 Persist] gated rollup after M5 persist failed:', e);
    });
  }
  const next: AttemptScoringBaseline = {
    ...baseline,
    patterns: scenario_specific_patterns,
    moment_5_concreteness,
    ...(extras?.personal_moment_emotional_vocab_low !== undefined
      ? { personal_moment_emotional_vocab_low: extras.personal_moment_emotional_vocab_low }
      : {}),
    ...(extras?.personal_moment_emotional_vocab_density !== undefined
      ? { personal_moment_emotional_vocab_density: extras.personal_moment_emotional_vocab_density }
      : {}),
    ...(extras?.disclosure_calibration !== undefined
      ? { disclosure_calibration: extras.disclosure_calibration }
      : {}),
  };
  return next;
}

export async function persistHolisticModifiersImmediate(
  supabase: SupabaseClient,
  attemptId: string,
  userId: string,
  input: {
    egoDevelopmentLevel: number | null;
    mentalizingOvercertaintyCount?: number;
    defensePatterns?: Record<string, unknown>;
    defenseCrossReference?: DefenseCrossReferenceResult;
  },
  baseline: AttemptScoringBaseline,
): Promise<AttemptScoringBaseline> {
  const update: Record<string, unknown> = {};
  if (input.egoDevelopmentLevel != null && Number.isFinite(input.egoDevelopmentLevel)) {
    update.ego_development_level = input.egoDevelopmentLevel;
  }
  if (input.mentalizingOvercertaintyCount !== undefined) {
    update.mentalizing_overcertainty_count = input.mentalizingOvercertaintyCount;
  }
  if (input.defensePatterns !== undefined) {
    update.defense_patterns = normalizeDefensePatternsForPersist(
      input.defensePatterns as Record<string, unknown>,
    );
  }
  // defense_cross_reference is written only by the gated rollup (never here — avoids partial rollup races).
  if (Object.keys(update).length === 0) return baseline;

  const { error } = await supabase
    .from('interview_attempts')
    .update(update)
    .eq('id', attemptId)
    .eq('user_id', userId);
  if (error) {
    console.error('[Holistic Persist] failed to persist holistic scores:', error);
  } else {
    console.log(
      '[Holistic Persist] holistic scores persisted immediately — ego dev:',
      input.egoDevelopmentLevel,
    );
  }
  return {
    ...baseline,
    ego_development_level:
      typeof update.ego_development_level === 'number'
        ? (update.ego_development_level as number)
        : baseline.ego_development_level,
    mentalizing_overcertainty_count:
      typeof update.mentalizing_overcertainty_count === 'number'
        ? (update.mentalizing_overcertainty_count as number)
        : baseline.mentalizing_overcertainty_count,
    defense_patterns:
      update.defense_patterns != null &&
      typeof update.defense_patterns === 'object' &&
      !Array.isArray(update.defense_patterns)
        ? (update.defense_patterns as Record<string, unknown>)
        : baseline.defense_patterns,
  };
}
