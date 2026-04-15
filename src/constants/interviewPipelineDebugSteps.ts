/**
 * Manual / QA checklist for interview flow and `communication_style_profiles` debugging
 * (repro steps, regression review, Cursor debug sessions).
 *
 * Import where useful (e.g. admin tooling); not shown in product UI by default.
 */

/** Ordered checklist — keep entries self-contained for copy into repro notes. */
export const INTERVIEW_PIPELINE_DEBUG_STEPS: readonly string[] = [
  'Moment 5: no banned reflective bridge before the scripted appreciation question (no “Taking that in…”, etc.).',
  'Closing: at least one **specific** callback to this transcript (personal moment or scenario detail) plus optional task thanks; no generic-only or trait-only sign-off — see CLOSING_LINE_INSTRUCTIONS in AriaScreen.',
  'communication_style_profiles: polling stops once labels exist; matchmaker_summary sentence 2 has proper punctuation (no “…fog Forced…”).',
  'narrative_conceptual_score: verify extremes — see NARRATIVE_CONCEPTUAL_SCORE_DEBUG_REFERENCE.',
  'Style pipeline “caching”: see STYLE_PROFILE_PIPELINE_PRODUCTION_NOTES — identical matchmaker text across attempts is usually identical **inputs**, not HTTP cache.',
];

/**
 * Stored axis (DB): 0 = conceptual pole, 1 = narrative pole (`narrativeConceptualRatioFromCorpus`).
 * A stored value of **0** for a verdict-heavy, non-framework speaker is suspect for QA.
 */
export const NARRATIVE_CONCEPTUAL_SCORE_DEBUG_REFERENCE = `
narrative_conceptual_score near 0 — sanity check (example: direct, verdict-oriented scenario answers)

Expected band for this voice: ~0.3–0.4 (toward conceptual, not the extreme pole).

Reasoning:
- Language is direct and verdict-oriented (“Emma is being contemptuous. That's the problem.”,
  “James dropped the ball. Simple as that.”, “Daniel needs to stop leaving.”) — declarative,
  not episodic scene-setting; scenario answers are not personal stories.
- It is also not deeply “conceptual” in the framework sense: no heavy analytical terminology
  (e.g. demand-withdraw pattern, category error, co-regulation, pursue-withdraw cycle).
  Plain-language verdicts ≠ theoretical frameworks.
- So the score should reflect: not narrative (no stories/scenes in hypotheticals), not deep
  framework lexicon, but **closer to the conceptual pole** because the style is analytical
  and diagnostic rather than narrative and feeling-led.
- ~0.3–0.4 captures that. **0** reads as the extreme conceptual pole and is misleading.
  **0.5** implies a genuine balance of narrative vs conceptual lexicon hits. **1.0** is the
  opposite error (pure narrative pole).

Implementation note: production uses \`narrativeConceptualRatioFromCorpus\` in
\`supabase/functions/_shared/interviewStyleMarkers.ts\` — mid-band floor (~0.36) when the voice is
verdict-heavy and **strong** framework lexicon count is **≤ 1** (one stray "hypothesis"/compound token
must not pin the score to 0). **≥ 2** strong hits → raw ratio kept (deep framework stays near 0).
Deploy \`analyze-interview-text\` after changes, then \`npm run reprocess-narrative-conceptual\`.
`.trim();

/**
 * For developer escalation: `communication_style_profiles` is **one row per user_id** (unique index).
 * `analyze-interview-text` upserts text features first; **`analyze-interview-audio` finalize runs second**
 * and recomputes **labels + matchmaker_summary** from `merged`. If finalize used a stale
 * `narrative_conceptual_score` from a partial read, the DB could keep **0** and an old **matchmaker** string
 * until both Edge functions are redeployed. Finalize now **recomputes narrative from the attempt transcript**
 * and **persists** `narrative_conceptual_score` on upsert. Deploy **both** `analyze-interview-text` and
 * `analyze-interview-audio` (`npm run deploy:fn:communication-style`). Identical matchmaker across attempts
 * with the same axis values is still **deterministic**, not HTTP cache.
 */
export const STYLE_PROFILE_PIPELINE_PRODUCTION_NOTES = `
communication_style_profiles / matchmaker_summary — not "cached" by default

- Table shape: unique on user_id; each successful analyze-interview-text run upserts that row and sets source_attempt_id to the attempt processed.
- matchmaker_summary is regenerated from translateStyleProfile → buildMatchmakerSummaryFromProfile using current column values + user transcript corpus. Identical summaries across attempts 79/81/95 usually means the **computed features and corpus-derived text were the same** (e.g. narrative_conceptual_score stuck at 0 and similar emotional/relational axes), not that the Edge Function served a cached string.
- Verify: deploy latest analyze-interview-text (\`npm run deploy:fn:analyze-interview-text\` from repo root); check Edge logs for \`[analyze-interview-text] response\` and attempt_id; inspect JSON response fields narrative_conceptual_score, user_corpus_char_count, user_turn_count; run npm run reprocess-narrative-conceptual if historical rows need backfill.
`.trim();
