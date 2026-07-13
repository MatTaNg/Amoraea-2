import {
  buildDefenseCrossReferenceForAttempt,
  EMPTY_DEFENSE_CROSS_REFERENCE_RESULT,
  type DefenseCrossReferenceResult,
} from './crossReferenceDefenseDetection.ts';
import {
  DEFAULT_DEFENSE_PATTERNS,
  isDefensePatternsShapeIncomplete,
  normalizeDefensePatternsForPersist,
} from './defensePatternsDetection.ts';
import {
  personalMomentBundleWasScored,
  pillarScoresHaveNumericAssessment,
  transcriptReachedMoment5ForRollup,
} from './interviewCompletionGate.ts';
import {
  buildScenarioCompositesTriple,
  buildScenarioPillarMapsFromStoredBundles,
  readPillarScoresFromScenarioBundle,
  scenarioCompositesToStorageJson,
} from './scenarioCompositeFloor.ts';

export type InterviewRollupArtifactRow = {
  scenario_composites?: unknown;
  defense_cross_reference?: unknown;
  defense_patterns?: unknown;
  scenario_1_scores?: unknown;
  scenario_2_scores?: unknown;
  scenario_3_scores?: unknown;
  depth_signal_modifier?: unknown;
  score_modifier?: unknown;
  modified_weighted_score?: unknown;
  weighted_score?: unknown;
  gate_fail_reasons?: unknown;
  ego_development_level?: unknown;
  disclosure_calibration?: unknown;
  personal_moment_emotional_vocab_density?: unknown;
  personal_moment_emotional_vocab_low?: unknown;
  transcript?: unknown;
  scenario_specific_patterns?: unknown;
  pillar_scores?: unknown;
};

/** Per-attempt scoring stages that must finish before rollup may write critical artifacts. */
export type ScoringCompletionState = {
  scenario1Complete: boolean;
  scenario2Complete: boolean;
  scenario3Complete: boolean;
  moment4Complete: boolean;
  /** True when M5 is scored, or when the transcript never reached an assessable M5 turn. */
  moment5Complete: boolean;
};

function scenarioBundleHasNumericPillars(bundle: unknown): boolean {
  const ps = readPillarScoresFromScenarioBundle(bundle);
  return pillarScoresHaveNumericAssessment(ps);
}

function readMomentScoresFromPatterns(
  patterns: unknown,
  key: 'moment_4_scores' | 'moment_5_scores',
): unknown {
  if (patterns == null || typeof patterns !== 'object' || Array.isArray(patterns)) return null;
  return (patterns as Record<string, unknown>)[key] ?? null;
}

/**
 * @deprecated Import from `./interviewCompletionGate.ts` — re-exported for backward compatibility.
 */
export { transcriptReachedMoment5ForRollup } from './interviewCompletionGate.ts';

/**
 * True when scenario slices S1–S3 are present with numeric pillars (partial rollup may run).
 */
export function evaluateScoringStagesReadyForScenarioRollup(
  row: InterviewRollupArtifactRow | null | undefined,
): { ready: boolean; missing: string[] } {
  const missing: string[] = [];
  if (!scenarioBundleHasNumericPillars(row?.scenario_1_scores)) missing.push('scenario1');
  if (!scenarioBundleHasNumericPillars(row?.scenario_2_scores)) missing.push('scenario2');
  if (!scenarioBundleHasNumericPillars(row?.scenario_3_scores)) missing.push('scenario3');
  return { ready: missing.length === 0, missing };
}

/**
 * Build scenario-level rollup artifacts that do not require Moment 5 scoring.
 * Used when M5 is still pending so composites/defense are not left null indefinitely.
 */
export function buildPartialInterviewRollupPatchFromAttemptRow(
  row: InterviewRollupArtifactRow,
  userPsychometrics?: Record<string, unknown> | null,
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  if (attemptRowMissingScenarioComposites(row)) {
    const composites = buildScenarioCompositesBackfillFromAttemptRow(row);
    if (composites != null) {
      patch.scenario_composites = composites;
    }
  }
  if (attemptRowMissingDefensePatterns(row)) {
    patch.defense_patterns = normalizeDefensePatternsForPersist(
      row.defense_patterns != null && typeof row.defense_patterns === 'object'
        ? (row.defense_patterns as Record<string, unknown>)
        : { ...DEFAULT_DEFENSE_PATTERNS },
    );
  }
  const rowForCrossRef: InterviewRollupArtifactRow = {
    ...row,
    defense_patterns: patch.defense_patterns ?? row.defense_patterns,
    depth_signal_modifier: patch.depth_signal_modifier ?? row.depth_signal_modifier,
    score_modifier: patch.score_modifier ?? row.score_modifier,
  };
  if (attemptRowMissingDefenseCrossReference(row)) {
    patch.defense_cross_reference = buildDefenseCrossReferenceBackfillFromAttemptRow(
      rowForCrossRef,
      userPsychometrics,
    );
  }
  return patch;
}

/**
 * Gate: rollup must not run until all scoring stages that apply to this attempt are present.
 * This is the root-cause fix for intermittent null rollup fields — early triggers (psychometric
 * backfill, interview-only gate, incomplete holistic) previously wrote partial artifacts.
 */
export function evaluateScoringStagesReadyForRollup(
  row: InterviewRollupArtifactRow | null | undefined,
): { ready: boolean; state: ScoringCompletionState; missing: string[] } {
  const state: ScoringCompletionState = {
    scenario1Complete: scenarioBundleHasNumericPillars(row?.scenario_1_scores),
    scenario2Complete: scenarioBundleHasNumericPillars(row?.scenario_2_scores),
    scenario3Complete: scenarioBundleHasNumericPillars(row?.scenario_3_scores),
    moment4Complete: personalMomentBundleWasScored(
      readMomentScoresFromPatterns(row?.scenario_specific_patterns, 'moment_4_scores'),
    ),
    moment5Complete: false,
  };

  const m5Bundle = readMomentScoresFromPatterns(row?.scenario_specific_patterns, 'moment_5_scores');
  if (personalMomentBundleWasScored(m5Bundle)) {
    state.moment5Complete = true;
  } else if (!transcriptReachedMoment5ForRollup(row?.transcript)) {
    // Interview ended before M5 — do not block rollup forever.
    state.moment5Complete = true;
  }

  const missing: string[] = [];
  if (!state.scenario1Complete) missing.push('scenario1');
  if (!state.scenario2Complete) missing.push('scenario2');
  if (!state.scenario3Complete) missing.push('scenario3');
  if (!state.moment4Complete) missing.push('moment4');
  if (!state.moment5Complete) missing.push('moment5');

  return { ready: missing.length === 0, state, missing };
}

function objectNonEmpty(o: unknown): boolean {
  return o != null && typeof o === 'object' && !Array.isArray(o);
}

function finiteNumber(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/**
 * True when composites are missing or incomplete.
 * Requires a finite composite for every scenario that has stored numeric pillar scores —
 * a single non-null composite must NOT count as "complete" (that caused intermittent lock-in
 * of partial rollups).
 */
export function attemptRowMissingScenarioComposites(row: InterviewRollupArtifactRow | null | undefined): boolean {
  if (!row) return true;
  if (row.scenario_composites == null || !objectNonEmpty(row.scenario_composites)) return true;
  const c = row.scenario_composites as Record<string, unknown>;
  const readComposite = (n: 1 | 2 | 3): number | null => {
    const v = c[`scenario_${n}`] ?? c[String(n)];
    return typeof v === 'number' && Number.isFinite(v) ? v : null;
  };
  const expected: Array<1 | 2 | 3> = [];
  if (scenarioBundleHasNumericPillars(row.scenario_1_scores)) expected.push(1);
  if (scenarioBundleHasNumericPillars(row.scenario_2_scores)) expected.push(2);
  if (scenarioBundleHasNumericPillars(row.scenario_3_scores)) expected.push(3);
  if (expected.length === 0) {
    // No scenario scores yet — composites are not applicable (insert-gap / pre-score rows).
    // Stage gate still blocks rollup writes until S1–S3 exist.
    return false;
  }
  return expected.some((n) => readComposite(n) == null);
}

export function attemptRowMissingDefenseCrossReference(row: InterviewRollupArtifactRow | null | undefined): boolean {
  if (!row) return true;
  return row.defense_cross_reference == null || !objectNonEmpty(row.defense_cross_reference);
}

export function attemptRowMissingDefensePatterns(row: InterviewRollupArtifactRow | null | undefined): boolean {
  if (!row) return true;
  return isDefensePatternsShapeIncomplete(
    row.defense_patterns != null && typeof row.defense_patterns === 'object' && !Array.isArray(row.defense_patterns)
      ? (row.defense_patterns as Record<string, unknown>)
      : null,
  );
}

export function attemptRowMissingEgoDevelopmentLevel(row: InterviewRollupArtifactRow | null | undefined): boolean {
  if (!row) return true;
  return finiteNumber(row.ego_development_level) == null;
}

export function attemptRowMissingDisclosureCalibration(row: InterviewRollupArtifactRow | null | undefined): boolean {
  if (!row) return true;
  return typeof row.disclosure_calibration !== 'string' || row.disclosure_calibration.trim() === '';
}

export function attemptRowMissingEmotionalVocabDensity(row: InterviewRollupArtifactRow | null | undefined): boolean {
  if (!row) return true;
  return finiteNumber(row.personal_moment_emotional_vocab_density) == null;
}

/**
 * Critical rollup fields that must never be null after scoring completes.
 * Soft fields (ego, disclosure, vocab) are preferred but may remain null if holistic never produced them.
 */
export function attemptRowMissingRollupArtifacts(row: InterviewRollupArtifactRow | null | undefined): boolean {
  if (!row) return true;
  if (attemptRowMissingScenarioComposites(row)) return true;
  if (attemptRowMissingDefenseCrossReference(row)) return true;
  if (attemptRowMissingDefensePatterns(row)) return true;
  return false;
}

/** Extended check including ego / disclosure / vocab — used for post-write diagnostics. */
export function attemptRowMissingExtendedRollupArtifacts(
  row: InterviewRollupArtifactRow | null | undefined,
): boolean {
  if (attemptRowMissingRollupArtifacts(row)) return true;
  if (attemptRowMissingEgoDevelopmentLevel(row)) return true;
  if (attemptRowMissingDisclosureCalibration(row)) return true;
  if (attemptRowMissingEmotionalVocabDensity(row)) return true;
  if (row!.gate_fail_reasons != null && !Array.isArray(row!.gate_fail_reasons)) return true;
  return false;
}

export function buildScenarioCompositesBackfillFromAttemptRow(
  row: InterviewRollupArtifactRow,
): Record<string, number | null> | null {
  const triple = buildScenarioCompositesTriple(
    buildScenarioPillarMapsFromStoredBundles(
      row.scenario_1_scores,
      row.scenario_2_scores,
      row.scenario_3_scores,
    ),
  );
  const hasAnyComposite = triple['1'] != null || triple['2'] != null || triple['3'] != null;
  if (!hasAnyComposite) return null;
  return scenarioCompositesToStorageJson(triple);
}

export function buildDefenseCrossReferenceBackfillFromAttemptRow(
  row: InterviewRollupArtifactRow,
  userPsychometrics?: Record<string, unknown> | null,
): DefenseCrossReferenceResult {
  const depthModifier =
    typeof row.depth_signal_modifier === 'number' && Number.isFinite(row.depth_signal_modifier)
      ? row.depth_signal_modifier
      : typeof row.score_modifier === 'number' && Number.isFinite(row.score_modifier)
        ? row.score_modifier
        : 0;
  try {
    return buildDefenseCrossReferenceForAttempt({
      defensePatterns:
        row.defense_patterns != null && typeof row.defense_patterns === 'object' && !Array.isArray(row.defense_patterns)
          ? (row.defense_patterns as Record<string, unknown>)
          : null,
      userPsychometrics: userPsychometrics ?? null,
      depthSignalModifierApplied: depthModifier,
    });
  } catch (e) {
    console.warn('[rollup] defense cross-reference backfill failed — using empty result', {
      message: e instanceof Error ? e.message : String(e),
    });
    return { ...EMPTY_DEFENSE_CROSS_REFERENCE_RESULT, overallConfidence: 'low' };
  }
}

/**
 * Patch missing rollup artifacts without overwriting populated fields.
 * Prefer {@link buildFullInterviewRollupPatchFromAttemptRow} + atomic write for completion paths.
 */
export function buildInterviewRollupArtifactBackfillPatch(
  row: InterviewRollupArtifactRow,
  userPsychometrics?: Record<string, unknown> | null,
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  if (attemptRowMissingScenarioComposites(row)) {
    const composites = buildScenarioCompositesBackfillFromAttemptRow(row);
    if (composites != null) {
      patch.scenario_composites = composites;
    }
  }
  if (attemptRowMissingDefensePatterns(row)) {
    patch.defense_patterns = normalizeDefensePatternsForPersist({ ...DEFAULT_DEFENSE_PATTERNS });
  }
  if (attemptRowMissingDefenseCrossReference(row)) {
    const rowForCrossRef = {
      ...row,
      defense_patterns: patch.defense_patterns ?? row.defense_patterns,
    };
    patch.defense_cross_reference = buildDefenseCrossReferenceBackfillFromAttemptRow(
      rowForCrossRef,
      userPsychometrics,
    );
  }
  return patch;
}

/**
 * Build the full set of rollup fields that can be derived without an LLM call.
 * Does not invent ego/disclosure/vocab when transcript aggregation is unavailable —
 * those are filled by {@link runFullInterviewRollup} via stored-slice recalculation.
 */
export function buildFullInterviewRollupPatchFromAttemptRow(
  row: InterviewRollupArtifactRow,
  userPsychometrics?: Record<string, unknown> | null,
  overrides?: Record<string, unknown>,
): Record<string, unknown> {
  const merged: InterviewRollupArtifactRow = { ...row, ...(overrides ?? {}) };
  const patch: Record<string, unknown> = { ...(overrides ?? {}) };

  if (attemptRowMissingScenarioComposites(merged) || patch.scenario_composites == null) {
    const composites = buildScenarioCompositesBackfillFromAttemptRow(merged);
    if (composites != null) {
      patch.scenario_composites = composites;
    }
  } else if (patch.scenario_composites == null && merged.scenario_composites != null) {
    patch.scenario_composites = merged.scenario_composites;
  }

  if (attemptRowMissingDefensePatterns(merged) || patch.defense_patterns == null) {
    patch.defense_patterns = normalizeDefensePatternsForPersist(
      merged.defense_patterns != null && typeof merged.defense_patterns === 'object'
        ? (merged.defense_patterns as Record<string, unknown>)
        : { ...DEFAULT_DEFENSE_PATTERNS },
    );
  }

  const rowForCrossRef: InterviewRollupArtifactRow = {
    ...merged,
    defense_patterns: patch.defense_patterns ?? merged.defense_patterns,
    depth_signal_modifier: patch.depth_signal_modifier ?? merged.depth_signal_modifier,
    score_modifier: patch.score_modifier ?? merged.score_modifier,
  };
  if (attemptRowMissingDefenseCrossReference(merged) || patch.defense_cross_reference == null) {
    patch.defense_cross_reference = buildDefenseCrossReferenceBackfillFromAttemptRow(
      rowForCrossRef,
      userPsychometrics,
    );
  }

  if (Array.isArray(merged.gate_fail_reasons)) {
    patch.gate_fail_reasons = merged.gate_fail_reasons;
  } else if (patch.gate_fail_reasons == null) {
    patch.gate_fail_reasons = [];
  }

  if (typeof merged.disclosure_calibration === 'string' && merged.disclosure_calibration.trim() !== '') {
    patch.disclosure_calibration = merged.disclosure_calibration;
  }
  if (finiteNumber(merged.ego_development_level) != null) {
    patch.ego_development_level = merged.ego_development_level;
  }
  if (finiteNumber(merged.personal_moment_emotional_vocab_density) != null) {
    patch.personal_moment_emotional_vocab_density = merged.personal_moment_emotional_vocab_density;
  }
  if (typeof merged.personal_moment_emotional_vocab_low === 'boolean') {
    patch.personal_moment_emotional_vocab_low = merged.personal_moment_emotional_vocab_low;
  }

  return patch;
}

export type RunFullInterviewRollupResult = {
  ok: boolean;
  verified: boolean;
  skipped?: string;
  error?: string;
  patchKeys?: string[];
};

export type ScoringStageId = 'scenario1' | 'scenario2' | 'scenario3' | 'moment4' | 'moment5';

export const SCORING_STAGES_TO_COMPLETE: readonly ScoringStageId[] = [
  'scenario1',
  'scenario2',
  'scenario3',
  'moment4',
  'moment5',
];

export type RunFullInterviewRollupOptions = {
  userPsychometrics?: Record<string, unknown> | null;
  /** Extra fields already computed by the caller (gate, ego, disclosure, etc.). */
  overrides?: Record<string, unknown>;
  /**
   * When true, still require scoring stages to be ready (unless bypassStagesGate).
   * Re-writes even if critical artifacts already look present.
   */
  force?: boolean;
  /**
   * Escape hatch for admin/backfill only — do not use on live completion paths.
   * Live paths must wait until S1–S3 + M4 + M5 (when reached) are scored.
   */
  bypassStagesGate?: boolean;
  /** Caller label for rollup-trigger diagnostics (not persisted). */
  trigger?: string;
};

const ROLLUP_VERIFY_SELECT =
  'scenario_composites, defense_patterns, defense_cross_reference, ego_development_level, disclosure_calibration, personal_moment_emotional_vocab_density, gate_fail_reasons';

/** Minimal client surface — works with supabase-js browser + Deno edge clients. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseLike = any;

const sessionCompletedStages = new Map<string, Set<ScoringStageId>>();
const rollupInFlight = new Map<string, Promise<RunFullInterviewRollupResult>>();

function rollupTriggerCallerLine(skipFrames = 2): string {
  const stack = new Error().stack?.split('\n') ?? [];
  return stack[skipFrames]?.trim() ?? 'unknown';
}

/**
 * Record that a scoring stage finished for this attempt, then run rollup only when the DB row
 * confirms all stages are scored. This is the preferred entry point for live interview paths.
 */
export async function markScoringStageComplete(
  supabase: SupabaseLike,
  attemptId: string,
  userId: string,
  stage: ScoringStageId,
  opts?: RunFullInterviewRollupOptions,
): Promise<RunFullInterviewRollupResult> {
  const trigger = opts?.trigger ?? rollupTriggerCallerLine(2);
  console.log(
    `[rollup-trigger] markScoringStageComplete(${stage}) for ${attemptId} from: ${trigger}`,
  );

  if (!sessionCompletedStages.has(attemptId)) {
    sessionCompletedStages.set(attemptId, new Set());
  }
  const completed = sessionCompletedStages.get(attemptId)!;
  completed.add(stage);
  console.log(
    `[gate] ${stage} complete for ${attemptId}. Completed: ${[...completed].join(', ')}`,
  );

  return tryRunInterviewRollupWhenStagesComplete(supabase, attemptId, userId, {
    ...opts,
    trigger: `after_${stage}:${trigger}`,
  });
}

/**
 * Attempt gated rollup when the attempt row shows all scoring stages are ready.
 * Live completion paths should call this (or {@link markScoringStageComplete}) — not {@link runFullInterviewRollup} directly.
 */
export async function tryRunInterviewRollupWhenStagesComplete(
  supabase: SupabaseLike,
  attemptId: string,
  userId: string,
  opts?: RunFullInterviewRollupOptions,
): Promise<RunFullInterviewRollupResult> {
  const trigger = opts?.trigger ?? rollupTriggerCallerLine(2);
  console.log(
    `[rollup-trigger] tryRunInterviewRollupWhenStagesComplete for ${attemptId} from: ${trigger}`,
  );

  const inFlight = rollupInFlight.get(attemptId);
  if (inFlight) {
    console.log(`[rollup-trigger] joining in-flight rollup for ${attemptId}`);
    return inFlight;
  }

  const run = runFullInterviewRollup(supabase, attemptId, userId, { ...opts, trigger }).finally(() => {
    rollupInFlight.delete(attemptId);
  });
  rollupInFlight.set(attemptId, run);
  const result = await run;

  if (result.ok && result.verified) {
    sessionCompletedStages.delete(attemptId);
    console.log(`[gate] ALL stages complete for ${attemptId} — rollup verified`);
  }

  return result;
}

/** @deprecated Prefer {@link markScoringStageComplete} or {@link tryRunInterviewRollupWhenStagesComplete}. */
export const markStageComplete = markScoringStageComplete;

/**
 * Atomic rollup write: compute missing artifacts from the attempt row, persist in one update, verify.
 * Do not call from live interview paths — use {@link markScoringStageComplete} / {@link tryRunInterviewRollupWhenStagesComplete}.
 *
 * Note: ego / disclosure / vocab density require either caller overrides or values already on the row
 * (from holistic / stored-slice aggregation). Composites + defense_* are always derived from scenario scores.
 */
export async function runFullInterviewRollup(
  supabase: SupabaseLike,
  attemptId: string,
  userId: string,
  opts?: RunFullInterviewRollupOptions,
): Promise<RunFullInterviewRollupResult> {
  const trigger = opts?.trigger ?? rollupTriggerCallerLine(2);
  console.log(`[rollup-trigger] runFullInterviewRollup for ${attemptId} from: ${trigger}`);
  console.log(`[rollup] Starting full rollup for ${attemptId}`);

  const { data: rowRaw, error: readErr } = await supabase
    .from('interview_attempts')
    .select(
      `id, user_id, weighted_score, modified_weighted_score, depth_signal_modifier, score_modifier,
       scenario_1_scores, scenario_2_scores, scenario_3_scores, scenario_composites,
       defense_patterns, defense_cross_reference, ego_development_level, disclosure_calibration,
       personal_moment_emotional_vocab_density, personal_moment_emotional_vocab_low, gate_fail_reasons,
       pillar_scores, transcript, scenario_specific_patterns`,
    )
    .eq('id', attemptId)
    .eq('user_id', userId)
    .maybeSingle();

  if (readErr || !rowRaw) {
    const message = readErr?.message ?? 'attempt_not_found';
    console.error(`[rollup] Failed to read attempt ${attemptId}:`, message);
    return { ok: false, verified: false, error: message };
  }

  const row = rowRaw as InterviewRollupArtifactRow;

  // ROOT CAUSE GATE: never write rollup artifacts until all scoring stages are present.
  // Early callers (psychometric backfill, interview-only gate, incomplete holistic) used to
  // persist partial composites and lock them in as "already complete."
  if (!opts?.bypassStagesGate) {
    const stages = evaluateScoringStagesReadyForRollup(row);
    console.log(`[gate] scoring stages for ${attemptId}`, {
      ...stages.state,
      ready: stages.ready,
      missing: stages.missing,
    });
    if (!stages.ready) {
      const scenarioRollup = evaluateScoringStagesReadyForScenarioRollup(row);
      if (scenarioRollup.ready && attemptRowMissingRollupArtifacts(row)) {
        let userPsychPartial = opts?.userPsychometrics ?? null;
        if (userPsychPartial == null) {
          const { data: userRowPartial } = await supabase
            .from('users')
            .select(
              'psychometrics_gasp_score, psychometrics_aaq2_score, psychometrics_rses_score, psychometrics_scs_sf_score, psychometrics_sd3_narcissism_score, psychometrics_rfq_score',
            )
            .eq('id', userId)
            .maybeSingle();
          userPsychPartial = (userRowPartial as Record<string, unknown> | null) ?? null;
        }
        const partialPatch = buildPartialInterviewRollupPatchFromAttemptRow(row, userPsychPartial);
        if (Object.keys(partialPatch).length > 0) {
          console.log(`[rollup] Writing partial scenario rollup for ${attemptId} (M5 or other stages pending)`, {
            keys: Object.keys(partialPatch),
            missingStages: stages.missing,
          });
          const { error: partialErr } = await supabase
            .from('interview_attempts')
            .update(partialPatch)
            .eq('id', attemptId)
            .eq('user_id', userId);
          if (partialErr) {
            console.warn(`[rollup] Partial scenario rollup write failed for ${attemptId}:`, partialErr.message);
          }
        }
      }
      console.log(
        `[gate] Rollup deferred for ${attemptId} — waiting on: ${stages.missing.join(', ')}`,
      );
      return {
        ok: false,
        verified: false,
        skipped: `stages_incomplete:${stages.missing.join(',')}`,
      };
    }
    console.log(`[gate] ALL stages complete for ${attemptId} — running rollup`);
  }

  // Idempotent: if critical artifacts are already complete and caller has no overrides, skip.
  if (!opts?.force && !attemptRowMissingRollupArtifacts(row) && opts?.overrides == null) {
    console.log(`[rollup] Already complete for ${attemptId} — skipping`);
    return { ok: true, verified: true, skipped: 'already_complete' };
  }

  let userPsych = opts?.userPsychometrics ?? null;
  if (userPsych == null) {
    const { data: userRow } = await supabase
      .from('users')
      .select(
        'psychometrics_gasp_score, psychometrics_aaq2_score, psychometrics_rses_score, psychometrics_scs_sf_score, psychometrics_sd3_narcissism_score, psychometrics_rfq_score',
      )
      .eq('id', userId)
      .maybeSingle();
    userPsych = (userRow as Record<string, unknown> | null) ?? null;
  }

  const patch = buildFullInterviewRollupPatchFromAttemptRow(row, userPsych, opts?.overrides);
  if (Object.keys(patch).length === 0) {
    console.warn(`[rollup] No patch keys for ${attemptId}`);
    return { ok: false, verified: false, skipped: 'empty_patch' };
  }

  console.log(`[rollup] Writing atomic patch for ${attemptId}`, { keys: Object.keys(patch) });
  const { error: writeErr } = await supabase
    .from('interview_attempts')
    .update(patch)
    .eq('id', attemptId)
    .eq('user_id', userId);

  if (writeErr) {
    console.error(`[rollup] DB write failed for ${attemptId}:`, writeErr.message);
    return { ok: false, verified: false, error: writeErr.message, patchKeys: Object.keys(patch) };
  }

  const { data: checkRaw, error: checkErr } = await supabase
    .from('interview_attempts')
    .select(ROLLUP_VERIFY_SELECT)
    .eq('id', attemptId)
    .eq('user_id', userId)
    .maybeSingle();

  if (checkErr || !checkRaw) {
    console.error(`[rollup] Verification read failed for ${attemptId}:`, checkErr?.message);
    return {
      ok: true,
      verified: false,
      error: checkErr?.message ?? 'verify_read_failed',
      patchKeys: Object.keys(patch),
    };
  }

  const check = checkRaw as InterviewRollupArtifactRow;
  // Composites + defense_* must be present; ego/disclosure/vocab may still be null if holistic never produced them.
  const criticalMissing =
    attemptRowMissingScenarioComposites(check) ||
    attemptRowMissingDefenseCrossReference(check) ||
    attemptRowMissingDefensePatterns(check);

  if (criticalMissing) {
    console.error(`[rollup] Verification failed — critical rollup fields still incomplete for ${attemptId}`, {
      missingComposites: attemptRowMissingScenarioComposites(check),
      missingDefenseCrossRef: attemptRowMissingDefenseCrossReference(check),
      missingDefensePatterns: attemptRowMissingDefensePatterns(check),
    });
    const retryPatch = buildFullInterviewRollupPatchFromAttemptRow(check, userPsych, opts?.overrides);
    const { error: retryErr } = await supabase
      .from('interview_attempts')
      .update(retryPatch)
      .eq('id', attemptId)
      .eq('user_id', userId);
    if (retryErr) {
      return { ok: false, verified: false, error: retryErr.message, patchKeys: Object.keys(retryPatch) };
    }
    const { data: check2 } = await supabase
      .from('interview_attempts')
      .select(ROLLUP_VERIFY_SELECT)
      .eq('id', attemptId)
      .eq('user_id', userId)
      .maybeSingle();
    const c2 = check2 as InterviewRollupArtifactRow;
    const verified =
      !attemptRowMissingScenarioComposites(c2) &&
      !attemptRowMissingDefenseCrossReference(c2) &&
      !attemptRowMissingDefensePatterns(c2);
    console.log(`[rollup] Retry verification for ${attemptId}:`, verified ? 'ok' : 'still incomplete');
    return { ok: verified, verified, patchKeys: Object.keys(retryPatch) };
  }

  console.log(`[rollup] Complete and verified for ${attemptId}`, {
    egoPresent: !attemptRowMissingEgoDevelopmentLevel(check),
    disclosurePresent: !attemptRowMissingDisclosureCalibration(check),
    vocabPresent: !attemptRowMissingEmotionalVocabDensity(check),
  });
  return { ok: true, verified: true, patchKeys: Object.keys(patch) };
}
