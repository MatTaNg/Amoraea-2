/** Shared 0–10 rubric for scenario slice + full-interview scoring models. */
export const SCORE_CALIBRATION_0_10 = `
SCORE CALIBRATION (0–10) — apply to every marker:

**What 10 means:** On every marker, **10** is *the best response a thoughtful, psychologically minded real person could reasonably produce in that context* — not a superhuman bar, not “better than complete,” and not a slot reserved for answers that exceed what full competency looks like. If the evidence is **complete**, **accurate** for the moment, and has **no meaningful gap** a fair expert would still expect filled, assign **10**. Withhold **10** only when you can name a **concrete** omission, error, or shallowness — not because another answer elsewhere in the interview was stronger.

**Independence across slices:** Score each scenario or moment **only on its own transcript**. **Do not** cap a marker at 9 (or lower) in one slice to “leave room” because another slice might score higher on the same marker, or to force spread across the interview. **Several slices may each earn 10** on the same marker when each answer meets the ceiling.

Calibrate to real human performance ceilings, not theoretical ideals. If the transcript shows full competency on a marker for the relevant moment(s), that marker should reach the top of the scale (10) when evidence supports it — competency is not capped below 10 for being merely “human.”

Scores below 7 are reserved for genuine marker failures: e.g. active contempt; clear, sustained defensiveness; absence of mentalizing when perspective-taking was clearly required; explicit disinterest in repair or dismissing the other’s legitimacy; or similar hard failures. Do not park adequate, on-target answers in the 4–6 band out of habitual conservatism.

Scores of 8–10 should reflect increasing sophistication, nuance, and specificity in how the competency appears — **not** increasing distance from a hypothetical flawless answer no real participant would produce. Use **8** for competent but thinner answers; **9** for strong answers where you can still name a **minor** gap; **10** when the answer meets the **full real-human ceiling** for that marker in that slice (see “What 10 means” above). **10** does not require being richer than some other strong answer in the same interview.

Commitment-threshold anchors (structure beats procedural verbosity):
- The healthy ceiling is: persist through real difficulty while keeping healthy limits. Unconditional staying without limits scores low; exiting at first difficulty scores low.
- Do NOT treat lack of granular process (timelines, therapy modalities, step-by-step checklists) as low commitment capacity. The scoring question is whether the answer contains a complete decision structure: invest effort → communicate clearly about what's not working → assess whether the pattern changes → decide to stay or go. That structure alone can justify 6–7 without extra detail.
- 1–2: Exit immediately or unconditionally at first/minor difficulty; OR endorse staying no matter what in clearly harmful dynamics; OR no coherent threshold.
- 3–4: Vague persistence or unconditional staying without a workable framework ("just keep trying / stick it out" with no invest→communicate→assess structure), OR exit framing without effort/communicate/assess logic.
- 6–7: Structurally sound path even without specificity — e.g. genuinely try, communicate openly, and exit (or call it done) if the pattern continues without meaningful change. No requirement to name timelines or interventions.
- 7–8: Same structural completeness plus some concrete specificity about what would constitute irrecoverable breakdown or "not workable anymore" (patterns, betrayal, harm, repeated failure after real effort — need not be exhaustive).
- 9–10: Demonstrated or richly described persistence through significant relational challenge with healthy limits and clear criteria; still not gated on procedural detail.
- Unconditional commitment with no limits ("never give up no matter what," "stick it out forever") remains about 2–3, not 6+.

SELF-AWARE "I STAY TOO LONG" VS. UNCONDITIONAL STAYING (commitment_threshold — critical discrimination):
- **Low threshold / score low (about 2–4):** The user endorses **unlimited** persistence with **no** self-awareness — e.g. "I just keep trying no matter what," "I never walk away," "you don't give up on people," with **no** recognition that staying can be unhealthy, **no** criteria for when to stop, **no** distinction between avoidance and genuine incompatibility. Treat vague "just keep trying" without structure the same as other 3–4 anchors.
- **Positive threshold signal (typically 7–8, not a deficit):** The user **discloses** a tendency to hold on **past the point of health** **and** shows **reflective differentiation** — e.g. naming difficulty walking away **while** working on telling **fear of conflict / avoidance** from **genuine irrecoverability or incompatibility**; or explicit self-knowledge that they historically stayed too long **paired with** active growth orientation (learning when something is "actually done" vs when they are afraid to leave). That pattern demonstrates **metacognition and developing capacity** for a healthy threshold — **do not** score it as unhealthy commitment or conflate it with "won't leave / no limits." Use **7–8** when this pattern is **clear** even if the answer is brief; use **6–7** if the differentiation is present but thin. **Do not** park these answers in 3–4 solely because they mention staying or struggling to leave.

Every score must still be tied to explicit evidence in the transcript. Do not inflate without evidence; do not withhold 6–8 when a sound structure is present just because the answer is brief or non-procedural.
`;

/** Accountability: blame-shift vs ownership paired with a clarity/repair bid — used in full + scenario + Moment 4 scoring. */
export const ACCOUNTABILITY_BLAME_SHIFT_VS_CLARITY_REQUEST = `
ACCOUNTABILITY — BLAME-SHIFT VS. GENUINE REQUEST FOR CLARITY (apply everywhere accountability is scored: all scenario slices, full-interview pass, and personal moments):

These patterns can look alike but differ in relational meaning:

• BLAME-SHIFT (score accountability LOW — typically mid-low or lower when this is the main move): Responsibility is redirected onto the other person; the user does not own their impact or contribution. The partner is framed as owing clearer communication, mind-reading, or fixing the dynamic alone. Example: "Sarah should have just told me what she needed instead of expecting me to read her mind" — no ownership; the problem is placed on the partner.

• GENUINE REQUEST FOR CLARITY AFTER OWNERSHIP (do NOT treat as deflection; do not reduce accountability for the ask alone): The user takes clear ownership of their own gap, mistake, or impact, and asks for specific information so they can show up better. That request is a repair bid layered on ownership, not a substitute for it. Example: "I could do a better job of appreciating you — can you help me understand what that looks like for you?"

DECISION TEST: Does the accountability-relevant stretch include genuine ownership of the user's own contribution (behavior, miss, or impact) before or alongside the request? If yes, the request for clarity is additive — score ownership at full strength and do not penalize accountability for asking how to follow through. If no ownership is present and the request functions mainly to shift the burden entirely onto the partner, score as blame-shift.

Apply this distinction consistently across fictional scenarios and personal narrative answers.
`;

/**
 * Fictional scenarios A–C: repair & accountability must weight spontaneous answers vs role-switch / structured repair asks.
 * Used in per-scenario JSON scoring and full-interview holistic scoring (repair + accountability only).
 */
export const REPAIR_AND_ACCOUNTABILITY_UNPROMPTED_VS_PROMPTED_WEIGHTING = `
REPAIR & ACCOUNTABILITY — UNPROMPTED VS. PROMPTED (fictional scenarios only; applies to **repair** and **accountability** markers — not mentalizing, attunement, contempt, appreciation, regulation, or commitment_threshold):

Distinguish two response types in each scenario:

1. **Unprompted initial response** — What the user said **before** any probe that asks them to step into the at-fault party’s shoes or before the scenario’s **general repair** question (Scenario C: before “How do you think this situation could be repaired?” or equivalent). This is their spontaneous reaction to the vignette and reflects instinct.

2. **Prompted role-switch / structured repair response** — What they said **after** being explicitly asked to take that perspective (e.g. “If you were Ryan, how would you repair…?”, “If you were James, how would you repair…?”, or Scenario C’s general repair prompt). This answer is **scaffolded** and is **not** diagnostically equivalent to unprompted material.

**Weighting (approximate, for judgment — not a formula on numbers):** The unprompted initial response should carry **about 70%** of the weight when assigning **repair** and **accountability** in that scenario slice. The prompted response is **supplementary (~30%)**. A polished answer that appears **only** after the role-switch / repair prompt must **not**, by itself, lift **accountability** above what the unprompted evidence supports. **(Repair marker):** That unprompted-first rule does **not** bind **repair** the same way — use the **repair**-specific ceiling and **REPAIR — CONDITIONAL LANGUAGE, DIRECTIONALITY, AND PROMPTED FLOORS** block: a **prompted** repair can justify **7–8** on **repair** when the directionality/ownership pattern fits, even if unprompted was thin.

**Ceiling when unprompted showed no repair instinct (accountability only):** If the unprompted turn(s) show **no** repair instinct (e.g. exit the situation, condemn the person at fault, no curiosity about the other’s perspective, no ownership relevant to the dynamic), a strong prompted role-switch answer may **not** push **accountability** above the **mid-range (5–6 maximum)** — they may be answering a scaffolded question, not necessarily showing genuine accountability. (This ceiling does **not** apply the same way to the **repair** marker; see next paragraph and **REPAIR — CONDITIONAL** block.)

**Ceiling when unprompted showed no repair instinct (repair — different rule):** The same thin-unprompted pattern does **not** auto-cap **repair** at 5–6. **Repair** measures repair capacity, not the same “script vs ownership” test as **accountability**. If the **prompted** repair answer (role-switch or general repair prompt) shows **humble ownership**, **gratitude** toward the other, **growth / learning** orientation, or **self-limitation** framed as a bridge to a repair move, **repair** may be scored in the **7–8** range from that turn **even** when the unprompted read was weak and **even** when they do not reference every specific incident. Apply **REPAIR — CONDITIONAL LANGUAGE, DIRECTIONALITY, AND PROMPTED FLOORS** (below) — in particular, do **not** lower **repair** for conditional clauses on phrase shape alone; judge **directionality** (see that block). **This exception applies only to the "repair" marker,** not to accountability.

**When unprompted already shows repair instinct** (empathy, curiosity, willingness to address the situation, ownership): use the prompted answer to **confirm or refine** the **repair** and **accountability** scores **upward** within the rubric.

**keyEvidence:** For **repair** and **accountability** in each scenario slice, explicitly state whether the cited evidence is **unprompted**, **prompted**, or **both** (and briefly which). This weighting must be auditable from keyEvidence alone.

Do **not** change how you score other markers; do **not** alter construct definitions, floors, or cross-construct weights — only how **repair** and **accountability** evidence is weighted within each scenario’s answers. For **directionality** and **prompted-repair** floors for the **repair** marker only, also apply **REPAIR — CONDITIONAL LANGUAGE, DIRECTIONALITY, AND PROMPTED FLOORS** (separate block in this prompt), which does not replace accountability rules.
`;

/** Repair-only: conditional “if/when” clauses; prompted repair floors; not used for other markers. */
export const REPAIR_CONDITIONAL_AND_PROMPTED_SCORING = `
REPAIR — CONDITIONAL LANGUAGE, DIRECTIONALITY, AND PROMPTED FLOORS (marker: **repair** only; does **not** replace accountability rules):

- **Do not** lower **repair** for conditional language (**"if she…"**, **"if they don't…"**, **"when communication is…"**) **by pattern-matching** or keyword alone. The scoring question is **directionality**:
  - **Self-accountable / maturing (often raise or allow strong repair scores):** The "if" clause **contextualizes the respondent’s own** limitation, listening gap, or learning — and the main clause **takes responsibility** for bridging, apologizing, or doing better. Example: apologizing to Emma **because** the respondent imagines that **even when** her signal is hard to read, they still need to own their part as Ryan — e.g. **"if she doesn't communicate it well… there are times I'm not capable of understanding her, and that's okay, learning together is part of the relationship"** (humble, partnership-oriented, ownership of the gap, not a hit on her character).
  - **Blame-redirecting (penalize repair):** The conditional **makes the other person’s** behavior the **precondition** for a repair that otherwise would not be owed, or undercuts the apology. Examples: **"I would apologize if she had just communicated better"** (suggests fault is primarily hers); **"It's not really my fault, but if she needs an apology…"**; repair framed so the **other** must change first. Those warrant **lower** **repair** scores.
- **Decision test for repair (only):** In the same stretch as the role-switch or repair prompt, does the participant’s **repair move** (apology, return, attunement, repair bid) point **responsibility back at themselves** as the character they stepped into, including limits they own? If yes, **do not** treat a nested **"if"** about the partner’s communication as deflection. If the **"if"** is the **reason** the harm was **really** the partner’s fault, score **down**.

- **Prompted repair without every concrete detail:** A **prompted** repair (Ryan / James / Scenario C repair question) that shows **genuine ownership**, **growth** orientation, and **gratitude** (e.g. thankfulness for the other’s patience) may sit in the **7–8** **repair** range even if it does not enumerate every line of the conflict — **as long as** the relational stance and repair intent are clear and not blame-redirecting (per above). **Do not** use absence of a named incident as the sole reason to cap **repair** below 7 when the prompted answer is otherwise strong on ownership and care.
`;

/** Scenario B (Sarah/James) — attunement/appreciation anchors for slice + holistic scoring models. */
export const SCENARIO_B_ATTUNEMENT_APPRECIATION_ANCHORS = `
SCENARIO B (Sarah/James) — ATTUNEMENT & APPRECIATION (canonical vignette):
Sarah tears up during the celebration; James says "hey don't cry, this is a good thing." James also led with logistics (salary, start date, commute) at the start of the evening.

• **Attunement — primary:** Does the participant recognize that James **redirecting** Sarah's tears — treating them as something to stop or fix ("don't cry," "this is a good thing") — is a **failure to receive** her emotional response: her feeling is framed as a **problem to solve** rather than **witnessed** or **stayed with**? Strong attunement names that miss. Weaker answers read James as merely positive, reassuring, or "trying to help" without naming the attunement failure.

• **Attunement / appreciation — secondary:** Does the participant notice James **led with logistics** at the celebration rather than emotional presence first?

• **Appreciation:** Does the participant distinguish **honoring Sarah's experience** from **processing the outcome logistically** — consistent with the signals above?

Do **not** use deprecated fiction beats (Sarah trailing off mid-sentence; James saying "well it was worth it") as primary scoring anchors — they are not in the current vignette.
`;
