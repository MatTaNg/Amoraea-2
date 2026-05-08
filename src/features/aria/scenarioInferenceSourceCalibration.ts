export type MentalizingInferenceSource =
  | 'scenario_restatement'
  | 'surface_addition'
  | 'independent_inference';

export const MENTALIZING_INFERENCE_SOURCE_CALIBRATION = `
MENTALIZING / ATTUNEMENT — SCENARIO TEXT VS. INDEPENDENT INFERENCE
Before assigning a mentalizing level, identify which observations in the user's response were explicitly stated or directly implied in the scenario text versus which were independently inferred by the user.

Scenario-provided information that does **not** count toward mentalizing credit:
- Behavioral facts stated in the scenario (e.g. "Daniel goes silent or leaves", "Ryan takes a 25 minute call", "Sarah tears up").
- Explicit statements made by characters in the scenario (e.g. "I can't just ignore my mother", "I didn't know what to say", "I never feel appreciated").
- Outcomes described in the scenario (e.g. "Sophie feels unheard", "James is blindsided", "a fight starts").
- Causal relationships the scenario makes explicit (e.g. "the issue is never resolved because Daniel goes silent").

Information that **does** count toward mentalizing credit:
- Internal emotional states not named in the scenario (e.g. "Emma feels like her worth in the relationship is being evaluated").
- Motivational explanations not provided by the scenario (e.g. "Ryan may prioritize his mother because he was raised to see family obligations as non-negotiable").
- Historical or relational context the user constructs beyond what the scenario provides (e.g. "this has probably been a pattern for months, not just tonight").
- Emotional meaning beyond the surface event (e.g. "for Sarah this isn't about the job questions — it's about whether James sees her as a whole person or just a problem to be managed").
- Inferred needs not stated directly (e.g. "Daniel needed Sophie to give him explicit permission to step away briefly rather than interpreting his request as abandonment").

Mentalizing levels:
- **Level 1 (score 3–5):** User describes behavioral patterns and restates scenario facts. Surface labels like "she's upset" or "he's frustrated" remain Level 1 unless they go beyond the scenario text.
- **Level 2 (score 6–8):** User independently infers at least one character-specific internal state, motivation, or emotional meaning not provided by the scenario text.
- **Level 3 (score 8–10):** User perspective-takes both parties simultaneously, infers underlying needs/fears, or connects the surface conflict to deeper relational dynamics not mentioned in the scenario.

Scenario C Daniel calibration:
- "Daniel didn't know what to say because he didn't want to upset her more" mostly paraphrases scenario-provided information with a surface-level addition. Treat as Level 1 (3–5).
- "Daniel probably shuts down because emotional confrontation triggers something for him — when he's flooded he loses access to language and leaving is protective rather than dismissive" is independent internal-state inference. Treat as Level 2 (6–8).
- "Daniel's withdrawal and Sophie's pursuit are locked in a cycle where his leaving confirms her fear of abandonment and her pursuit confirms his fear of being overwhelmed" is simultaneous bilateral perspective-taking and deeper relational inference. Treat as Level 3 (8–10).

Apply the same distinction to **attunement**. Recognizing that "Sophie feels unheard" is not enough for attunement credit because the scenario states it. Attunement credit requires the specific emotional texture of what feeling unheard means for Sophie in this recurring pattern: erosion of trust, repair feeling impossible, or exhaustion from trying.

Audit field: Include top-level \`mentalizing_inference_source\` for the primary mentalizing observation:
- \`"scenario_restatement"\` when the main observation restates scenario text.
- \`"surface_addition"\` when the user adds a thin, generic emotion or motive to scenario facts.
- \`"independent_inference"\` when the user offers a character-specific internal state, motivation, need, fear, or emotional meaning not provided by the scenario.
`.trim();
