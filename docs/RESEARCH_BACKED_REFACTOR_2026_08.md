# Research-backed refactor — implementation report (2026-08)

Guiding principle: slices can be experimental; pillars stay conservative. Historical assessment and interview data remain readable. Consequential scoring is versioned.

## 1. Files changed (representative)

- Psychometrics: `src/features/psychometrics/assessmentContent.ts`, `psychometricsPersistence.ts`, `supabase/functions/_shared/computePsychometricModifier.ts`, `supabase/functions/_shared/psychometricFloorBreaches.ts`
- Versions: `src/config/algorithmVersions.ts`
- Interview pillars / rollup: `supabase/functions/_shared/interviewMarkers.ts`, `aggregateMarkerScoresFromSlices.ts`, `src/config/scoring/interviewGateThresholds.ts`, `experimentalInterviewSlices.ts`, `interviewMarkerAliases.ts`
- Interview probes: `interviewCanonicalProbeRegistry.ts`, `moment4ProbeLogic.ts`, `resolvePendingPersonalMomentProbe.ts`, `evaluateInterviewTurnOrchestratorDecision.ts`, `runPreClaudeClientOwnedCanonicalConstructGate.ts`, `runPreClaudeOrchestratorExecuteGate.ts`, `runPostClaudeScenarioBJamesRepairForcedProbeGate.ts`, `personalMomentScoringPrompt.ts`, `supportMomentScoringPrompt.ts`
- Compatibility: `computeCompatibilityScore.ts`, `computePairCompatibilityScore.ts`, `compatibilityEvidenceRegistry.ts`, `compatibilityDomainPresentation.ts`, `matchOutcomeInstrumentation.ts`
- Analytics: `experimentalSliceCorrelationAnalytics.ts`, `adminScoringGlossary.ts`
- Migrations: `20260819180000_psychometric_battery_v2_experimental_instruments.sql`, `20260819190000_match_outcome_instrumentation.sql`

## 2. Schema migrations

- `users` experimental instrument columns + `psychometrics_battery_version` (historical AAQ-II / RFQ / NPI / Dweck columns retained).
- `match_outcome_events` and `post_date_feedback` for funnel + post-date feedback. Collection only.

## 3. Removed from the active battery

AAQ-II, RFQ-8, NPI Entitlement, and combined Dweck are out of `ASSESSMENT_ORDER`, new-user modifiers, new-user floors, and RFQ/AAQ consistency flags. Historical scores and `wouldTrigger*` helpers remain.

## 4. `amoraea_entitlement_v1`

Display name **Relationship Attitudes**. Eight Likert 1–7 items, reverse 5 and 7, mean persisted with raw/scored/version. `confidence: experimental`, `amoraeaValidationStatus: not_validated`. No auto-fail.

## 5. Relationship growth / destiny

New `relationship_growth_beliefs` (Amoraea items; reverse 1–3 so higher = growth). Not Knee ITR. Historical Dweck is not remapped into this subscale.

## 6. Conflict catastrophizing

`conflict_catastrophizing` uses historical Dweck item ids 7–10, scored independently. Not averaged into growth beliefs.

## 7. Experimental instruments — no auto-fail

Confirmed for entitlement, growth beliefs, and conflict catastrophizing (not in `ACTIVE_NEW_USER_PSYCHOMETRIC_FLOOR_CODES`).

## 8. Final pillars and weights (sum 1.00)

| Pillar | Weight |
| --- | --- |
| destructive_conflict | 0.18 |
| accountability | 0.18 |
| repair | 0.17 |
| regulation | 0.14 |
| appreciation | 0.10 |
| responsiveness_support | 0.09 |
| mentalizing | 0.07 |
| commitment_persistence | 0.07 |

Aliases: contempt → destructive_conflict, attunement → responsiveness_support, commitment_threshold → commitment_persistence.

## 9. Final interview flow

S1 contempt → S2 James differently → S3 Sophie perspective → S3 repair → M4 grudge → walk-away threshold (`persistence_exit_judgment`) → keep-investing orientation (`commitment_orientation`) → support moment → conditional need-recognition probe if needed → M5 conflict.

S1 “If you were Ryan…” and S2 “If you were James…” hypothetical repair probes are retired (`retired: true`). Spontaneous S1/S2 repair still scores. S3 repair remains the canonical hypothetical repair probe. M5 autobiographical repair remains the primary lived-conflict repair source.

Persisted repair sources (`repair_source_signals`, `repair_sources_v1_2026_08`): `hypothetical_repair` (S3), `autobiographical_repair` (M5), `spontaneous_repair` (opportunistic S1/S2). These roll into the single Repair pillar using the existing average. Hypothetical vs autobiographical disagreement is preserved for later evaluation (knowledge of healthy repair vs demonstrated behavior) and is not treated as measurement error.

Analytics: `evaluateRepairSourceValidation` reports hypo↔auto correlation, per-source reliability (item-total; S1/S2 split-half for spontaneous), incremental predictive validity, and whether the hypo−auto gap predicts outcomes. `|r| >= 0.70` is a review flag only. Do not auto-change the Repair pillar, restore retired probes, or penalize disagreement from correlation alone.

## 10. New slices

Responsiveness: `need_recognition`, `attunement`, `support_response`, `adaptability`. Commitment: `commitment_orientation`, `persistence_exit_judgment`. Destructive-conflict and repair slices kept.

## 11. Regulation rollup

Allowed moments: S1, S3, M4, M5, support moment. Prefer meaningful evidence (null when none). Version: `pillars_v4_destructive_conflict_multi_moment_regulation`.

## 12. Dealbreaker fields reused

Existing kids, religion requirement, relationship style, relocate/distance, politics requirement, substance comfort, and onboarding `hobbyDealbreakerId` (`__none__` = not a hard block). No new negotiability questionnaire.

## 13. Compatibility architecture (compat_v5)

- **A** hard/logical incompatibility (including hobby dealbreaker when named and unmet). Hard-blocked dimensions are omitted from `concreteLifeFit`.
- **B** explicit desired-life ranking: `concreteLifeFit` (0.50) from existing onboarding/profile fields, plus structured finance (0.22), plus abstract domain-importance sliders (0.21).
- **C** anxious×avoidant continuous ECR — small soft penalty (max −0.05), never a hard block, separate from the 2% generic ECR term.
- **D** conflict-style — low-influence soft adjustment.
- **E** generic ECR/PVQ similarity — 0.02 / 0.05; cannot dominate ranking.

Narrative fit and a full Intimacy domain are **not_assessed**. Interview process and capacity discount are not ranking inputs.

Legacy v2 weights remain exported for historical attribution, including `sexualCommAdjustment` on the V2 function only.

## 14. Compatibility Evidence Registry

`src/config/matching/compatibilityEvidenceRegistry.ts` (`compat_evidence_v1_2026_08`). Experimental instruments registered as `experimental` / `not_validated`. No active coefficient is labeled `amoraea_validated`.

## 15. Duplicate-penalty findings

Unintended stacking that was bounded in this pass:

- AAQ-II / RFQ-8 / combined Dweck no longer apply both a modifier *and* a new-user floor.
- NPI entitlement is not a new-user floor or gate modifier.
- Generic ECR similarity is no longer a 0.40 ranking driver on top of the anxious×avoidant interaction (interaction is a small Level C penalty; similarity is Level E).
- Interview contempt/repair still inform both the admission gate and a modest compatibility interview-process term; this is **intentional dual use** (admission vs matching) and was not auto-removed.
- Capacity discount still uses interview pillars + remaining psychometrics; it is bounded and should be reviewed against outcome data before tightening further.

Do not automatically delete correlated signals.

## 16. Compatibility UI

Domain labels: Life Vision, Values & Worldview, Relationship Needs, Intimacy, Lifestyle, Financial Outlook, Interaction / Conflict Dynamics. Bands: Exceptional / Strong / Good / Mixed / Potential Friction.

**Product flag:** overall percentage is retained temporarily (`COMPATIBILITY_OVERALL_PERCENT_TEMPORARY_FLAG`). Internal ranking remains `compat_v3`.

## 17. Outcome instrumentation

Stages from match shown through 12-month follow-up; post-date fields for attraction, chemistry, conversation ease, felt understood, comfort/safety, curiosity, romantic interest, desire for another date. **Do not auto-train.**

## 18. Experimental-slice validation analytics

`evaluateExperimentalSlicePairCorrelations` for the three specified pairs. `|r| >= 0.70` is a review flag only.

Repair sources: `evaluateRepairSourceValidation` for hypothetical vs autobiographical agreement, per-source reliability, incremental validity, and gap→outcome prediction. High correlation is a review flag only — not a merge, restore-probes, or discrepancy-penalty rule.

## 19. Mentalizing early-review TODO

Kept at 7%. Evaluation TODO in `MENTALIZING_EARLY_REVIEW_TODO` and admin glossary. Not an automatic weight change.

## 20. Version identifiers

- Battery: `pre_interview_v2_2026_08`
- RGB: `amoraea_rgb_v1`
- Conflict catastrophizing: `amoraea_cc_v1`
- Entitlement: `amoraea_entitlement_v1`
- Rollup: `pillars_v4_destructive_conflict_multi_moment_regulation`
- Gate weights: `gate_weights_v4_2026_08`
- Compatibility: `compat_v5_concrete_life_2026_08`
- Registry: `compat_evidence_v3_2026_08`
- Repair sources: `repair_sources_v1_2026_08`

## 21. Tests added/updated

Psychometrics battery order, reverse scoring, no auto-fail, historical readability; interview retired probes, support/commitment hops, regulation multi-moment (including M4 keep), commitment merge, weights sum; S1/S2 handoff without hypothetical repair; dealbreakers; compatibility hierarchy; evidence registry; slice correlations; version stamps. Existing floor/modifier tests updated so retired instruments are not new-user auto-fails.

## 22. PES licensing TODO

Replace `amoraea_entitlement_v1` with the validated Psychological Entitlement Scale if/when commercial reproduction/digital-administration permission is obtained.

## 23. Knee ITR licensing TODO

Replace `relationship_growth_beliefs` items with the validated Knee Implicit Theories of Relationships scale if/when commercial use permission is obtained from C. Raymond Knee / the appropriate rights holder.

## 24. Remaining product decisions

- Whether to drop the user-facing overall compatibility percentage in favor of domain labels only.
- When (if ever) to license PES and Knee ITR.
- Whether hobby dealbreaker should ever be a scaled penalty instead of a hard block when the hobby is “important but not absolute.” Current onboarding treats a named hobby as non-negotiable.
- Support-moment LLM scoring is prompted, persisted as `moment_support_scores`, and rolled into pillars on the standard deferred and alpha scoring paths.
- S1/S2 hypothetical repair probes stay retired: S1 handoff waits on the contempt probe; S2 handoff waits on James-differently (historical repair-Q3 answers still count). Streamed S2 repair questions are suppressed.
- Repair source disagreement (hypothetical vs autobiographical) is stored for later outcome analysis; do not auto-change the Repair pillar from correlation alone.
- Contextual reasoning uses the existing ego-development / overcertainty / depth framework; no new pillar.

## 25. Remaining Amoraea heuristics that are not outcome-validated

All `amoraea_heuristic` and `research_direction_only` registry coefficients, experimental slice scores, experimental psychometric instruments, gate weights, capacity discount, and interview-process matching term. Outcome tables exist for later evaluation — not for automatic reweighting.
