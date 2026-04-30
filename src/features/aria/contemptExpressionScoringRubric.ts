/**
 * Injected into LLM scenario + personal-moment prompts for **contempt_expression** only.
 * **contempt_recognition** must use its own separate instructions and is not covered here.
 */
export const CONTEMPT_EXPRESSION_SCORING_RUBRIC = `

CONTEMPT_EXPRESSION (participant’s own language — this marker only; **not** contempt_recognition)
Scale: **higher = healthier**: less use of disdain, character attack, dehumanization, or sweeping verdicts on **people** (1–2 = harshest participant framing, 8–10 = no contemptuous stance). Judge **only** how the *participant* talks about other people in this slice, not how accurately they read fictional content.

- **1–4 (low / concerning):** Reserve for **broad** character **attacks**, mockery, dehumanization, or sweeping verdicts on **who someone is** — e.g. “he’s an idiot / pathetic / a loser,” “what a piece of @#!,” “they’re subhuman / garbage,” “she’s just a bad / toxic person (as a person),” or contemptuous dismissal with no link to a **specific** hurtful *action* in the scenario. Also harsh global judgments not tied to the described events.

- **5–7 (mid / mixed):** The user uses **strong** negative labels or sharp moral language, but it **stays anchored to specific actions, choices, or patterns in the situation** — e.g. calling a choice “unacceptable,” “inconsiderate,” “immature in this moment,” “a lot to work on in how they show up” — *without* reducing the other to trash/idiot/loser language. Harsh *behavior* judgment can sit here. Fine-grained: **5–6** when the tone is repeatedly cutting or one-sided; **6–7** when still grounded in the vignette’s facts.

- **8–10 (strong / best):** Mostly describes impact, process, and needs, **or** uses **ordinary** moral/ethical language for **clearly harmful** *behavior* (rude, wrong, harmful, hurtful, disrespectful, “that dishonored her *here*” when tied to a concrete act) **without** smearing the person as worthless. **Do not** treat normal disapproval of bad *behavior* (e.g. “incredibly rude to take a 25‑minute call mid‑dinner without checking in,” “dishonoring to Emma in that moment,” “inconsiderate”) as low contempt_expression — that is **behavioral** moral language, not contempt-of-person, unless the same line also does character demolition above.

- **Distinguish:** Accurate attunement that a line in the scene *sounds* contemptuous, cold, or stinging = **contempt_recognition** / mentalizing, **not** participant contempt_expression. Participant **contempt_expression** is about *their* stance toward a character, not *quoting* the text.

- **Do not** score ordinary moral or fairness language (rude, wrong, inconsiderate, unfair, hurtful, disrespect, didn’t show up for the partner) **low (1–4)** solely because the user is disapproving of *actions*; **low (1–4) is for character** contempt and similar derogation patterns above.`;
