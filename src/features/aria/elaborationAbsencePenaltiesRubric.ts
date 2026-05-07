/**
 * Injected into scenario and personal-moment scoring prompts.
 * Absence penalties are **hard ceilings**: apply before treating positive language as lifting the score.
 * Always append the ceiling note to **keyEvidence** for affected markers when a ceiling fires.
 */

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

**Level 1 — Behavioral observation (mentalizing & attunement scores 1–5 only):**
The user describes what a character **did** or **is doing**, or names a **surface** emotional label without the **texture** of that experience for that person.
Examples (do **not** score mentalizing or attunement above **5** when the slice stays at this level): "He's avoiding the conversation"; "She feels deprioritized"; "He asked the wrong type of questions"; "Daniel shuts down"; pattern-only ("this has happened before," "it's an accumulation") **without** what that pattern **means emotionally** for the affected character.
Psychological labels ("dismissive avoidant," "anxious attachment," "narcissist") are **Level 1** unless the participant **also** gives **Level 2** elaboration of what that means for the character's **felt** experience.

**Level 2 — Emotional-interior inference (mentalizing & attunement scores 6–10):**
The user infers what is happening **inside** the character — felt experience, unspoken need, fear, shame, or the **meaning** the situation carries **for them**.
Examples: "Emma's response suggests this isn't about one dinner — she's questioning whether she matters in this relationship at all"; "Daniel may be flooded and unable to access language when overwhelmed, which Sophie reads as indifference"; "Sarah didn't want the job analyzed — she wanted James in the moment with her, to feel what she felt."

**Apply:**
- **Mentalizing:** If perspective-taking in this slice stays **Level 1** throughout, cap **mentalizing at 5** regardless of vocabulary. **7+** requires **Level 2** inference in the user's own words.
- **Attunement:** Surface emotion labels alone ("upset," "overwhelmed") **without** elaborating **why it hurts** for **that** character in **this** situation → cap **attunement at 5**. **7+** requires grasp of **why** it lands as it does — stakes, meaning, identity — not only that they feel bad.
- **Repair:** Compensatory or logistical moves **without** awareness of the **emotional core** of the rupture → cap **repair at 5**. **6+** requires the repair to address **underlying emotional need or relational meaning**, not only the surface incident.
  - Misses the core (cap appropriately): "I would make up the time somehow, plan another date."
  - Addresses the core: "I would acknowledge she's been feeling like she comes second, and show her concretely that I want to renegotiate how we handle those competing priorities."

**keyEvidence format (required every scenario for these markers):**
- **mentalizing** and **attunement** keyEvidence strings must **begin** with exactly **Level 1 —** or **Level 2 —** (Unicode em dash U+2014), then your substantive evidence. Example: Level 2 — User infers Emma is questioning whether she matters…
- If you assign **Level 1** for a marker, the **numeric score for that marker must not exceed 5.** If you assign **Level 2**, scores may go to 6–10 per rubric quality.
`;

/** Scenario slices (A/B/C): mentalizing, attunement, repair, appreciation where scored. */
export const ELABORATION_ABSENCE_SCENARIO_MARKERS = `
MENTALIZING — diagnostic / typing without Level 2 interior (ceiling **5**):
- Diagnostic labels or behavioral typing **without** Level 2 elaboration of **felt** experience for the character → treat as **Level 1**; cap **mentalizing at 5** (align with BEHAVIORAL_VS_EMOTIONAL_INTERIOR block).
- **Restating observable behavior** as the explanation → Level 1; cap **5** when that is the only move across the slice.

ATTUNEMENT — surface-only emotional naming (ceiling **5**):
- No **specific emotional experience** with **texture** for at least one character → cap **attunement at 5**.
- Surface labels ("overwhelmed," "feels deprioritized") **without** what that **means** for them → **Level 1**; **7+** only with **Level 2** attunement per block above.

REPAIR — logistics / compensation without emotional core (ceiling **5**):
- Logistical or **purely compensatory** repair **without** engaging the **relational meaning** or **emotional pattern** of the rupture → cap **repair at 5** (see examples in BEHAVIORAL_VS_EMOTIONAL_INTERIOR block).
- Scores **above 6** require addressing the **underlying emotional need**, not only the incident or a schedule fix.

APPRECIATION (Scenario B) — wrong attunement failure + absolution (ceiling **6**):
- If the participant proposes an appreciation-style repair **without first correctly identifying** what the **original attunement failure** was (e.g. James redirecting Sarah's tears / leading with logistics vs receiving her emotion), cap **appreciation at 6**.
- If they **absolve the character of wrongdoing** in a way that erases the miss (e.g. "he did everything he could," "there was nothing else he could do" **before** naming what he could have done differently attunement-wise), cap **appreciation at 6**. High appreciation requires accurate recognition of the miss **and** genuine positive regard / repair direction.

RESPONSE DEPTH MODIFIER (user turns in **this slice only**):
- Compute **avg_response_length** = mean word count across **user** turns in this scenario slice (if not already computed). If **avg_response_length < 35**, apply a **−1 effective ceiling** on **mentalizing**, **attunement**, and **repair** only: reduce the numeric score by **1** (floor at 0), and note in keyEvidence: "Response-depth modifier: avg user words <35 in this slice (−1 to mentalizing/attunement/repair per absence policy)."
- **Do not** apply this modifier to **contempt_expression**, **regulation**, or **commitment_threshold** — those do not depend on elaboration length to assess reliably.
`;

export const ELABORATION_ABSENCE_MOMENT4_MARKERS = `
MOMENT 4 — LOW SPECIFICITY (mentalizing & accountability ceilings):
- When specificity is **low** — no real concrete personal example (only general philosophy, abstraction, or vague platitudes; or thin signal after the scripted specificity follow-up when one was delivered): cap **mentalizing at 5** and **accountability at 4** for this moment.
- Low specificity means **insufficient signal** to treat the answer as a scored personal narrative; do not inflate because the topic sounds mature.

RESPONSE DEPTH (Moment 4 slice):
- Compute **avg_response_length** = mean word count across **user** turns in this moment slice. If **< 35**, apply **−1** to **mentalizing** and **accountability** (floor at 0) and note in keyEvidence. Does **not** apply to **contempt_expression** or **commitment_threshold** here.

`;

export const ELABORATION_ABSENCE_MOMENT5_MARKERS = `
MOMENT 5 — same absence rules as scenarios where applicable:
- **Mentalizing:** diagnostic/attachment labels without Level 2 interior → cap **5**; **Response depth:** if mean user words per turn in this slice <35, apply **−1** to **mentalizing** and **repair** only (not regulation or contempt_expression).
- **Repair:** logistics-only “fix” without emotional pattern/rupture → cap **5** when that is the only move.

`;
