import { KEY_EVIDENCE_ANALYTICAL_NARRATIVE_RULES } from './interviewScoringCalibration';

export { KEY_EVIDENCE_ANALYTICAL_NARRATIVE_RULES };

export const ELABORATION_ABSENCE_SCORING_HEADER = `
ABSENCE PENALTIES — HARD CEILINGS (apply FIRST; log each ceiling in keyEvidence when it fires)
These cap how high the score can go regardless of polish or vocabulary. When a ceiling applies, state it explicitly in that marker's keyEvidence (e.g. prefix "Ceiling: … | " before your substantive evidence).

`;

/**
 * Behavioral observation vs emotional-interior inference — central to mentalizing & attunement.
 * Injected after absence ceilings; models must tag Level 1 vs 2 in keyEvidence for those markers.
 */
export const BEHAVIORAL_VS_EMOTIONAL_INTERIOR_SCENARIO = `
BEHAVIORAL OBSERVATION vs EMOTIONAL-INTERIOR INFERENCE (mentalizing, attunement, repair)

Correct behavioral description is **not** relational intelligence — it is **restatement of the scenario**. Apply this **before** rewarding polish or accuracy.

**Level 1 — Behavioral observation (mentalizing & attunement scores 3–5):**
The user describes what a character **did** or **is doing**, or names a **surface** emotional label without inferring emotional meaning beyond the scenario facts.
Examples and score anchors:
- **"Emma is frustrated"** alone (surface label, no pattern/meaning) → mentalizing/attunement about **4**, not 6.
- Identifying frustration **plus** a clear pattern recognition without deep interior texture → attunement about **5** (**Level 1 ceiling** — not Level 2).
- Pure restatement of vignette events with no interpretive attempt → **3**.
Do **not** score mentalizing or attunement above **5** when the slice stays at Level 1. Do **not** park Level 1 answers at **2–3** when they correctly name the focal emotion or behavior.
Psychological labels ("dismissive avoidant," "anxious attachment," "narcissist") are **Level 1** unless the participant **also** gives **Level 2** elaboration of what that means for the character's **felt** experience.

**Level 2 — Emotional-interior / meaning inference (mentalizing & attunement scores 6–7 typical; 8–10 for richer depth):**
The user infers emotional meaning **beyond scenario facts** — what the situation means for the character, an unspoken need, fear, shame, or interior state not explicitly stated in the vignette.
Canonical score anchors:
- **Mentalizing 6:** Infers emotional significance of a pattern beyond restating facts. Example: "I'm assuming she's referring to him always taking shared time they were supposed to spend together to spend it with his family" — Level 2 pattern/meaning inference → **6**, not 4.
- **Mentalizing 6 (S2):** Recognizes the partner's underlying need for emotional presence / appreciation (e.g. "be more mindful when my partner needs me to be more appreciative") → **6**, not 4.
- **Mentalizing 7 (S2):** Identifies the **emotional mismatch** between Sarah and James and infers interior experience — what each needed emotionally in the moment vs what they received (celebration/witnessing vs logistics or stopping tears). Example: "should have been just happy for her and appreciated her efforts" instead of "leading with pointed offer questions." → **7**, not 4–6.
- **Mentalizing 7:** Deep interior inference about what is happening inside the character. Example: "Daniel felt genuinely at a loss… he had unresolved things he wanted to say but doesn't know how" → **7**, not 6.
- **Attunement 6:** User identifies the specific emotional need the character had and names the mismatch between that need and what they received. Goes beyond "they were upset" to "they needed X." Example: "She needed him to just be happy for her, not ask about logistics." → **6**, not 4–5.
- **Attunement 7 (S2):** Names the specific unmet emotional need **and** the mismatch with what was received — celebration/witnessing vs logistics or stopping tears. Example: "should have been just happy for her and appreciated her efforts" instead of "leading with pointed offer questions." → **7**, not 5–6.
- **Attunement 5:** **Level 1 ceiling only** — identifies emotional state or that something went wrong emotionally, but does **not** name the specific unmet need or need-mismatch. Example: "She was upset that he wasn't more supportive." → **5** maximum; **not** Level 2.
- **Attunement 4:** Identifies the behavioral problem but not the emotional dimension. Example: "He should have celebrated with her instead of asking questions."
Other Level 2 examples: "Emma's response suggests this isn't about one dinner — she's questioning whether she matters"; "Sarah didn't want the job analyzed — she wanted James in the moment with her."

**Apply:**
- When assigning an evidence level tag, evaluate the **full content of the user's answer across all turns for this scenario**. Do **not** base the level tag on the opening reaction alone. If the user begins with a surface-level statement but develops genuine internal-state reasoning, emotional attunement, or meta-level relational insight later in their answer, the evidence level must reflect that **developed content**.
- **Mentalizing:** Level 1 throughout → score **3–5** (cap **5**). Level 2 present → score **at least 6**, typically **6** for clear pattern/emotional-meaning inference, **7** for deep interior or clear emotional mismatch between characters, **8–10** for richer bilateral/pattern depth. **Do not** compress Level 2 answers to **3–5**.
- **Attunement:** Surface emotion labels alone ("upset," "overwhelmed") without pattern or need-mismatch → Level 1, typically **4–5**. Naming the specific unmet emotional need / need-mismatch → Level 2 **6** minimum (**7** when mismatch texture is clear). Richer bilateral texture beyond that → **8+**. **Do not** score Level 2 attunement at **3–5**. **Do not** treat "identifying what the character needed" as only a **5**.
- **Repair:** Compensatory or logistical moves **without** a concrete behavioral commitment or awareness of the rupture → cap **repair at 5**. **Score 7** is a concrete behavioral commitment with clear intention to change (e.g. "I would assure her this won't happen again and follow through") — does **not** require emotional acknowledgment or a detailed plan. **Score 8** adds emotional acknowledgment of impact and/or a named specific repair action. **Score 6** is repair orientation that is vague or conditional ("I'd apologize," "I would try to be more present"). Pure logistics without commitment still caps at **5**:
  - Misses the core (cap at 5): "I would make up the time somehow, plan another date."
  - Score 7 concrete commitment: "I would assure her that this will not happen again and actually follow through on it."
  - Score 8 with emotional layer: "I would acknowledge she's been feeling like she comes second, and show her concretely that I want to renegotiate how we handle those competing priorities."

**keyEvidence format (required every scenario for these markers):**
- **mentalizing** and **attunement** keyEvidence strings must **begin** with exactly **Level 1 —** or **Level 2 —** (Unicode em dash U+2014), then an **analytical narrative** per KEY EVIDENCE rules below — not a quote-only excerpt.
- In **scoringMetadata**, also include holistic evidence-level fields for these markers based on the **full scenario answer**, not just the keyEvidence snippet:
  - \`scoringMetadata.evidence_levels.mentalizing\` = 1 or 2
  - \`scoringMetadata.evidence_levels.attunement\` = 1 or 2
  - \`scoringMetadata.evidence_level_basis.mentalizing\` = brief note naming the full-answer content that justified the level
  - \`scoringMetadata.evidence_level_basis.attunement\` = brief note naming the full-answer content that justified the level
- Example (Level 1): Level 1 — Surface restatement only; user names Emma walking away without inferring felt experience or relational meaning. Score ~4 because no interior inference beyond observable behavior.
- Example (Level 2): Level 2 — User infers Emma is questioning whether she matters in the relationship (pattern beyond one dinner); supports Level 2 mentalizing at 6–7 because emotional meaning is inferred, not merely restated.
- Do **not** put pillarConfidence values (high/moderate/low) in keyEvidence — those belong only in pillarConfidence.
- If you assign **Level 1** for a marker, the **numeric score must be 3–5** (cap **5**). If you assign **Level 2**, the **numeric score must be at least 6** and typically **6–7** (higher only for richer depth) — **never 3–5**.
`;

export const SCENARIO_KEY_EVIDENCE_PER_PILLAR_RULES = `
${KEY_EVIDENCE_ANALYTICAL_NARRATIVE_RULES}
KEY EVIDENCE — PER PILLAR (required):
- \`keyEvidence\` must be **distinct for every scored marker** in this scenario JSON. Each entry must be its own analytical narrative for **that construct only** — not a shared transcript paste.
- **Never** reuse one generic scenario quote for every pillar. Repair evidence must analyze repair moves; mentalizing evidence must analyze perspective-taking; accountability evidence must analyze ownership — these are different narratives.
- **Never** put high/moderate/low confidence tokens in \`keyEvidence\` — those belong in \`pillarConfidence\` only.
- For **mentalizing** and **attunement**, prefix with **Level 1 —** or **Level 2 —** per BEHAVIORAL_VS_EMOTIONAL_INTERIOR above, then the analytical narrative (not quote-only).
- For **repair** and **accountability**, tag unprompted / prompted / both when applicable inside the narrative.
- Include **appreciation** keyEvidence in Scenario B whenever appreciation is scored — do not omit it.
`;

/** Scenario slices (A/B/C): mentalizing, attunement, repair, appreciation where scored. */
export const ELABORATION_ABSENCE_SCENARIO_MARKERS = `
MENTALIZING — diagnostic / typing without Level 2 interior (ceiling **5**):
- Diagnostic labels or behavioral typing **without** Level 2 elaboration of **felt** experience for the character → treat as **Level 1**; score **3–5**, cap **5** (align with BEHAVIORAL_VS_EMOTIONAL_INTERIOR block).
- **Restating observable behavior** as the explanation → Level 1; cap **5** when that is the only move across the slice.
- **Level 2** pattern/emotional-meaning inference → score **at least 6**, typically **6**; emotional mismatch / deep interior → **7**. Never score Level 2 at **3–5**.

ATTUNEMENT — surface-only emotional naming (ceiling **5** for Level 1):
- No **specific emotional experience** with **texture** for at least one character → Level 1; typically **4–5**, cap **5**.
- Surface labels ("overwhelmed," "feels deprioritized") **without** pattern or need-mismatch → **Level 1** (~4). Identifying emotional state / that something went wrong emotionally without naming the unmet need → **5** (**Level 1 ceiling**). Naming the specific unmet emotional need / need-mismatch (needed vs received) → Level 2 **6** minimum (**7** when mismatch is clear).
- **Do not** score Level 2 attunement at **3–5**. **Do not** park need-mismatch answers at **5**.

REPAIR — logistics / compensation without concrete commitment (ceiling **5**):
- Logistical or **purely compensatory** repair **without** a concrete behavioral commitment addressing the rupture → cap **repair at 5** (see examples in BEHAVIORAL_VS_EMOTIONAL_INTERIOR block).
- **Score 7** = concrete behavioral commitment with clear intention to change (brief OK; emotional acknowledgment **not** required). **Score 8** = 7 plus emotional acknowledgment and/or a named specific repair action. **Score 6** = vague/conditional repair orientation. Do **not** require emotional-layer volunteering to reach **7**.

APPRECIATION (Scenario B) — wrong attunement failure + absolution (ceiling **6**):
- If the participant proposes an appreciation-style repair **without first correctly identifying** what the **original attunement failure** was (e.g. James redirecting Sarah's tears / leading with logistics vs receiving her emotion), cap **appreciation at 6**.
- If they **absolve the character of wrongdoing** in a way that erases the miss (e.g. "he did everything he could," "there was nothing else he could do" **before** naming what he could have done differently attunement-wise), cap **appreciation at 6**.
- **Score 7–8** when the user names specific appreciation behavior in context AND what it recognizes/validates — including prompted repair that names **concrete celebration alternatives** and explicitly acknowledges Sarah **did not feel appreciated** (e.g. drink/dinner/dancing instead of questions + "I hear you, you didn't feel appreciated"). That is **not** generic — do **not** cap at **6**.
- **Score 7** when the user names the specific appreciation behavior without full repair validation (e.g. "just be happy for her and appreciated her efforts"). Generic "be more appreciative" without mismatch or repair specificity stays at **6**.

RESPONSE DEPTH MODIFIER (user turns in **this slice only**; **per marker**, after substantive scoring + keyEvidence):
- Compute **avg_response_length** = mean word count across **source transcript user turns** in this scenario slice. For **each** of **mentalizing**, **attunement**, and **repair**, apply **−1** (floor at 0) **only if both**: (1) **avg_response_length is below the turn-type threshold** (unprompted scenario turn <25 words; prompted follow-up scenario slice <20 words), and (2) that marker's keyEvidence indicates **no assessable evidence** — e.g. empty, "insufficient evidence," "no assessable evidence," "response too brief to assess," or **Score recovered from model output** — **not** merely because the slice was short.
- If keyEvidence for a marker cites a **specific observation, inference, or behavior** from the user's response, **do not** apply the modifier to that marker **even when** avg length is low.
- When the modifier fires for a marker, append to that marker's keyEvidence: "Response-depth modifier: short response with insufficient evidence for [marker] (−1)". **Do not** add short-response notes when no penalty applies.
- **Do not** apply this modifier to **contempt_expression**, **regulation**, or **commitment_threshold**.
`;

export const ELABORATION_ABSENCE_MOMENT4_MARKERS = `
MOMENT 4 — LOW SPECIFICITY / LOW CONCRETENESS (mentalizing & accountability):
- When specificity is **low** or **response_concreteness** is **low** or **absent** — no real concrete personal example, only general philosophy, abstraction, or vague platitudes; or thin signal after the scripted specificity follow-up when one was delivered — set **mentalizing** and **accountability** to JSON **null** (not 0, not 4–5). Use keyEvidence: "Not assessed — Moment 4 disclosure too thin to assess inner-state content for this marker (low concreteness)." Set pillarConfidence to **not_assessed** for those markers.
- **Null means unassessable** — excluded from rollup and weighted average. Do **not** apply a low-specificity floor score.
- **valid_non_applicable** (coherent no-grudge reasoning without a named person) is **not** low concreteness — score mentalizing/accountability from that reflection when substantive.
- **contempt_expression** and **commitment_threshold** may still be scored when assessable signal exists in the slice.

RESPONSE DEPTH (Moment 4 slice; **per marker**):
- Same rule as scenarios: **−1** to **mentalizing** or **accountability** only when **source transcript avg_response_length < 20** **and** that marker's keyEvidence shows **no assessable evidence**; use the same keyEvidence suffix as scenario depth modifier. Does **not** apply to **contempt_expression** or **commitment_threshold** here.

`;

export const ELABORATION_ABSENCE_MOMENT5_MARKERS = `
MOMENT 5 — same absence rules as scenarios where applicable:
- **Mentalizing:** diagnostic/attachment labels without Level 2 interior → cap **5**; **Response depth:** **−1** to **mentalizing** or **repair** only when source transcript avg user words per turn for interviewMoment 5 is **< 20** **and** that marker's keyEvidence lacks assessable evidence (same per-marker rule as scenarios).
- **Repair:** logistics-only “fix” without emotional pattern/rupture → cap **5** when that is the only move.

`;
