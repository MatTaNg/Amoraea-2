/** Phase 1: shadow logging only — no behavior change. */
export const INTERVIEW_TURN_ORCHESTRATOR_SHADOW_ENABLED = true;

/**
 * Phase 2: meta / off-topic / content-confusion turns reach Claude instead of
 * canned client injects (irrelevant-answer retry line, confusion repeat offer).
 * Hard rails unchanged: score decline, go-back decline, verbatim scenario probes.
 */
export const INTERVIEW_TURN_ORCHESTRATOR_PHASE2_ENABLED = true;

/**
 * Phase 3: skip client-owned canonical probe delivery when the construct is already
 * satisfied in the transcript; Claude bridges forward with orchestrator suffix.
 */
export const INTERVIEW_TURN_ORCHESTRATOR_PHASE3_ENABLED = true;

/** Async LLM construct-satisfaction check — logs agreement vs heuristic (no turn blocking). */
export const INTERVIEW_TURN_ORCHESTRATOR_PHASE3_LLM_SHADOW_ENABLED = true;

/**
 * Phase 3 live: await a short LLM construct check before client canonical delivery when
 * heuristics did not mark the pending probe satisfied (edge-case upgrade path).
 */
export const INTERVIEW_TURN_ORCHESTRATOR_PHASE3_LLM_LIVE_ENABLED = true;

/** Max wait for live LLM construct check — keeps mic idle brief on failure. */
export const INTERVIEW_TURN_ORCHESTRATOR_PHASE3_LLM_LIVE_TIMEOUT_MS = 2_500;

/** Shadow/async LLM timeout — can be longer since it does not block the turn. */
export const INTERVIEW_TURN_ORCHESTRATOR_PHASE3_LLM_SHADOW_TIMEOUT_MS = 8_000;

/** Minimum LLM confidence to override heuristic not-satisfied → skip canonical probe. */
export const INTERVIEW_TURN_ORCHESTRATOR_PHASE3_LLM_LIVE_MIN_CONFIDENCE = 0.72;

/**
 * Phase 4 shadow: async full-turn LLM planner when live is disabled — logs agreement vs heuristic v1.
 */
export const INTERVIEW_TURN_ORCHESTRATOR_PHASE4_LLM_SHADOW_ENABLED = true;

/** Shadow LLM turn planner timeout — does not block the mic path. */
export const INTERVIEW_TURN_ORCHESTRATOR_PHASE4_LLM_SHADOW_TIMEOUT_MS = 10_000;

/**
 * Phase 4 live: await short LLM turn planner before Claude — replaces heuristic when parsed.
 */
export const INTERVIEW_TURN_ORCHESTRATOR_PHASE4_LLM_LIVE_ENABLED = true;

/** Max wait for live LLM turn planner — keeps mic idle brief on failure. */
export const INTERVIEW_TURN_ORCHESTRATOR_PHASE4_LLM_LIVE_TIMEOUT_MS = 2_500;

/**
 * Phase 5: execute orchestrator decisions (fixed lines, verbatim canonical, skip telemetry).
 * Gates remain as fallbacks; executor runs after construct prefetch in late intercept.
 */
export const INTERVIEW_TURN_ORCHESTRATOR_EXECUTE_DECISIONS_ENABLED = true;

/**
 * When true with execute enabled: M4 threshold + M5 conflict delivery skip legacy inject gates;
 * orchestrator executor is the sole pre-Claude path for those probes.
 */
export const INTERVIEW_TURN_ORCHESTRATOR_COLLAPSE_M4_M5_INJECT_GATES = true;

/**
 * Phase 1 scenario boundaries: dynamic acknowledgement + transition via Claude before locked
 * vignette / personal-card copy. Falls back to static bundles on timeout or invalid output.
 * Keep false while {@link INCLUDE_SCENARIO_BOUNDARY_REFLECTIONS} is false — LLM leads reintroduce
 * ungrounded content reflections at S1→S2 / S2→S3 / S3→M4.
 */
export const INTERVIEW_SCENARIO_BOUNDARY_LLM_ENABLED = false;

/** Max wait for live scenario-boundary lead — keeps handoff mic idle brief on failure. */
export const INTERVIEW_SCENARIO_BOUNDARY_LLM_TIMEOUT_MS = 2_500;

/**
 * Phase 3: prefetch scenario-boundary leads when repair/boundary satisfaction is detected
 * so handoff TTS can reuse cached copy (~0ms wait vs live 2.5s cap).
 */
export const INTERVIEW_SCENARIO_BOUNDARY_LLM_PREFETCH_ENABLED = true;

/**
 * Phase 3: brief within-scenario acknowledgement via Claude before verbatim canonical probes
 * (orchestrator speak_canonical withBriefAck) and when client backfills a missing receipt.
 */
export const INTERVIEW_WITHIN_SCENARIO_ACK_LLM_ENABLED = true;

/** Max wait for within-scenario brief ack — shorter than boundary handoff. */
export const INTERVIEW_WITHIN_SCENARIO_ACK_LLM_TIMEOUT_MS = 1_500;

/**
 * Hybrid cut-off: await a short LLM completeness check when audio telemetry is suspicious
 * but structural heuristics only reach medium confidence.
 */
export const INTERVIEW_CUT_OFF_COMPLETENESS_LLM_ENABLED = true;

/** Max wait for cut-off completeness LLM — keep shorter than orchestrator/planner calls. */
export const INTERVIEW_CUT_OFF_COMPLETENESS_LLM_TIMEOUT_MS = 900;

/** Minimum LLM confidence to treat a borderline turn as a mic-stop cut-off. */
export const INTERVIEW_CUT_OFF_COMPLETENESS_LLM_MIN_CONFIDENCE = 0.72;

/**
 * Hybrid meta-comment: await fast LLM when regex/heuristic classification is ambiguous
 * (ambiguous_short, low-confidence frustration/inability/confusion).
 */
export const INTERVIEW_META_COMMENT_LLM_ENABLED = true;

/** Max wait for meta-comment LLM — same tier as cut-off completeness. */
export const INTERVIEW_META_COMMENT_LLM_TIMEOUT_MS = 900;

/** Minimum LLM confidence to override heuristic meta classification. */
export const INTERVIEW_META_COMMENT_LLM_MIN_CONFIDENCE = 0.72;
