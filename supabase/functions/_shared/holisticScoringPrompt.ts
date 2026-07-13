import {
  ACCOUNTABILITY_BLAME_SHIFT_VS_CLARITY_REQUEST,
  KEY_EVIDENCE_ANALYTICAL_NARRATIVE_RULES,
  REPAIR_AND_ACCOUNTABILITY_UNPROMPTED_VS_PROMPTED_WEIGHTING,
  REPAIR_CONDITIONAL_AND_PROMPTED_SCORING,
  SCENARIO_B_ATTUNEMENT_APPRECIATION_ANCHORS,
  SCORE_CALIBRATION_0_10,
} from './interviewScoringCalibration.ts';

export const PILLAR_CONFIDENCE_METADATA_ONLY_RULES = `
PILLAR CONFIDENCE IS METADATA ONLY (all scenario + personal-moment scoring):
- \`pillarConfidence\` records how certain you are in the **numeric** \`pillarScores\` value you already assigned — it is **not** a reason to lower or inflate scores.
- A score of **7** with **moderate** confidence means "moderately confident this evidence supports a 7" — **not** "discount the score to 5–6 because uncertain."
- Assign \`pillarScores\` from rubric evidence quality only. Then set \`pillarConfidence\` to match your certainty in that score. **Never** change \`pillarScores\` because you chose moderate or low confidence.
- Put analytical scoring rationales in \`keyEvidence\` — explain what the response demonstrates, why the score fits, and what prevented a higher score; brief inline quotes are supporting detail only, never the whole entry. **Never** put high/moderate/low in \`keyEvidence\` — those belong in \`pillarConfidence\` only.
`;

export const SCORING_CONFIDENCE_INSTRUCTIONS = `
CONFIDENCE SCORING FOR PERSONAL RESPONSES:

\`pillarConfidence\` is metadata about certainty in the score you assigned — **not** a score modifier. See PILLAR CONFIDENCE IS METADATA ONLY above.

When scoring a personal response, set confidence after scoring:

HIGH confidence: User gave a clear, specific personal story that directly addresses the construct being measured. Contains actual words said, a back-and-forth dynamic, and their own role in it.

MEDIUM confidence: User gave a relevant story but it was one-sided, vague, or missing a key element. You redirected once and got partial improvement. **Still score the evidence at face value** — use moderate confidence to flag uncertainty in the score, not to deflate the numeric score.

LOW confidence: User's personal story was off-target or too thin to score properly, even after one redirect. Use low confidence and note the limitation in keyEvidence. Use JSON null (not a discounted number) when there is no assessable signal.

NEVER score HIGH confidence on a response that:
- Is fewer than two sentences of real content where specificity was required
- Describes only what the other person did with no reflective or relational insight when the moment required it

COMMITMENT_THRESHOLD — PERSONAL MOMENT (full interview scoring):
Commitment threshold is assessed from Moment 4 (grudge context and the mandatory "work through versus walk away" follow-up). Set pillarConfidence for commitment_threshold to "moderate" or "low" when that follow-up is thin or missing usable criteria; reserve "high" when first-person threshold reasoning is clear (work-through vs walk-away structure or criteria in their own terms — concise structural answers count).
`;

const SCORING_GUARDRAILS = `GUARDRAIL 1 G?? Evaluate mechanism, not vocabulary

When scoring any construct, evaluate the underlying competency the user is demonstrating, not the specific vocabulary or framework they use to express it. A user who describes attunement through somatic, spiritual, or clinical language should receive the same credit as a user who uses conventional relationship language, provided the mechanism they describe is correct. Ask: does this response demonstrate accurate understanding of what the construct requires, regardless of how it is expressed? If yes, award full credit for that understanding. Do not penalize unconventional frameworks, practices, or references if they correctly identify the relevant dynamic. An unusual answer is not an inaccurate answer.

GUARDRAIL 2 G?? Micro-evidence miss penalty cap

When a user correctly identifies the primary emotional or relational dynamic in a scenario but misses a specific supporting moment or line-level evidence, apply a partial deduction only. Do not use a missed micro-evidence moment as a floor-setter for the construct score. Rule: if the user demonstrates correct macro-level understanding of the construct, score no lower than 5.5 for that construct in that scenario, regardless of whether specific supporting evidence was named. Reserve scores below 5 for responses that misread the primary dynamic entirely or demonstrate the opposite of the construct being assessed.

GUARDRAIL 3 G?? Construct score independence

Score each construct independently of the others. An unusual, unconventional, or socially unexpected recommendation does not itself indicate low competency on attunement, mentalizing, appreciation, or other constructs G?? evaluate only what the response reveals about the user's understanding of the specific construct being scored. Each construct score must be justified by evidence directly relevant to that construct, not by the general character or tone of the response. Do not apply penalties to adjacent constructs because of unconventional framing in one part of the response.

GUARDRAIL 4 - Prompted vs unprompted scoring hierarchy

Apply the following hierarchy consistently across all constructs, **without contradicting CANONICAL SCORE ANCHORS** (concrete brief answers can still be **7**):
- Unprompted demonstration - user volunteers the construct behavior or insight without being asked: typically **7-10** depending on depth and specificity.
- Prompted demonstration - user demonstrates the construct only after a direct probe: score by **quality of evidence**, not by a forced mid-band. A clear concrete prompted answer (ownership + behavioral commitment; emotional-presence appreciation; sustained calm regulation) scores **7-8**. Thin/surface prompted answers score **5-6**. A strong prompted response can reach **8**; **9-10** still generally need unprompted evidence earlier in the same scenario **or** exceptionally complete prompted evidence with no material gap.
- Absent - user does not demonstrate the construct even when prompted, or demonstrates the opposite: score range **1-4**.
When scoring accountability specifically: language marker data should be used as a signal but not as a hard determinant. A user can demonstrate genuine accountability through the structure and ownership of their response even if they do not use conventional accountability phrases. Weight the substance of what they said over the presence or absence of specific phrase patterns.

GUARDRAIL 5 G?? Distinguish deflection from boundary acknowledgment

When scoring repair and accountability, apply the following distinction carefully:
Deflection is when a user avoids acknowledging harm entirely G?? they redirect blame onto the other person, minimize the impact of the behavior, or reframe the situation so that the person who caused harm bears no responsibility. This should be penalized in repair and accountability scores.
Boundary acknowledgment is when a user simultaneously holds the harm caused and the legitimate underlying need of the person who caused it. This is not deflection. A response that says both "this behavior was inappropriate in this context" and "this person has a legitimate need that deserves acknowledgment and a clear agreement" demonstrates higher relational competency than simple ownership alone. This should not be penalized and should be scored as evidence of sophisticated relational thinking.
Specifically: if a user stepping into the role of the person who caused harm identifies both what that person did wrong and what that person legitimately needs going forward G?? including boundary-setting, renegotiating agreements, or communicating priorities G?? award full credit for accountability and repair. Do not interpret the acknowledgment of the causer's legitimate needs as deflection away from ownership.
This distinction also applies to mentalizing. A user who resists the implicit framing of a scenario G?? where one character is clearly positioned as the wrongdoer G?? and instead holds a differentiated view of both characters' needs and perspectives should be scored higher on mentalizing, not lower. Refusing to make a character a villain when the scenario invites that reading is evidence of perspective-taking, not evidence of missing the point.
Reserve deflection penalties for responses where the user shows no acknowledgment of harm, no ownership of impact, or actively blames the affected party for the situation. Do not apply deflection penalties to responses that acknowledge harm and also identify legitimate needs on both sides.

GUARDRAIL 6 G?? Separate scenario diagnosis quality from construct response quality

When scoring any construct, evaluate the evidence for that construct independently of how well the user diagnosed the overall scenario. A user who gives a thin, incomplete, or confused initial read of a scenario can still demonstrate strong construct competency when directly asked about that construct. These are measuring different things and must be scored separately.

Specifically: do not use the quality of a user's initial scenario analysis as evidence against their construct scores. If a user's initial response to a scenario is surface-level or misses key dynamics, but their subsequent response to a direct construct question demonstrates genuine competency, score the construct based on the construct response. The initial scenario read is context, not construct evidence.

Apply this distinction to the prompted versus unprompted hierarchy as follows. A user showing no repair instinct, no accountability, or no attunement in their initial scenario read should not be marked as unprompted-absent for those constructs unless they were given a natural opportunity to demonstrate the construct and did not. Simply reading a scenario and describing what is happening is not a natural opportunity to demonstrate repair G?? it is a diagnostic task. The unprompted opportunity for repair begins when the relational dynamic that requires repair has been clearly surfaced in the conversation, not from the moment the scenario is introduced.

When evaluating repair specifically: if a user's initial scenario read is thin or confused but their repair response G?? when asked directly G?? contains validation, ownership, behavioral commitment, and invitation for the other person to express their needs, score the repair response on its own merits. Do not anchor the repair score to the quality of the initial read or describe the repair as showing confusion when the repair response itself is clear and competent.

Do not conflate a user failing to fully diagnose a scenario with a user lacking the construct being tested. Diagnostic skill and construct competency are related but distinct. A user can miss the nuance of why a scenario went wrong while still knowing exactly how to repair it. Score what was demonstrated, not what was not demonstrated in a context that was not designed to elicit it.

GUARDRAIL 7 G?? Calibrate repair scoring to scenario type

When scoring repair, apply different weighting to repair indicators depending on whether the scenario involves a single incident or a recurring pattern. These are structurally different relational problems and appropriate repair looks different in each case.

For single-incident scenarios G?? where a specific behavior caused a specific rupture in a specific moment G?? the primary repair signal is individual ownership. Score highly for responses that demonstrate: acknowledgment of the specific harm caused, first-person ownership of the behavior, a concrete behavioral commitment to change, and a bid toward reconnection with the affected person. Bilateral or mutual framing in single-incident repair should be noted as a partial deflection if it **replaces** rather than **accompanies** individual ownership. **Do not** conflate that with a conditional clause that **returns accountability to the respondent** (e.g. **"if** her signal is hard to read **I still** own the gap in understanding") G?? use **REPAIR G?? CONDITIONAL LANGUAGE, DIRECTIONALITY, AND PROMPTED FLOORS**; **do not** penalize **repair** for **if/when** phrasing by keyword alone.

For recurring pattern scenarios G?? where the same rupture has happened multiple times and the relationship dynamic itself is the problem G?? bilateral agreement language is appropriate and should be credited, not penalized. When a scenario explicitly involves a repeated argument, an established avoidance pattern, or a structural mismatch in expectations that neither person has named, repair requires both people to renegotiate agreements, not just one person to take ownership of a single incident. Score highly for responses that demonstrate: recognition that the pattern requires a structural fix, identification of the unspoken expectation or agreement gap driving the pattern, and some form of bilateral renegotiation or new agreement as the repair vehicle. Individual ownership is still valuable in this context but should not be the primary scoring signal.

Specifically for Scenario C (Sophie and Daniel): this scenario involves a third repetition of the same argument, making it explicitly a recurring pattern scenario. A response that identifies the need for both people to establish clear agreements about expectations, communication, and conflict process should be scored at 6 or above for repair, even if it does not include explicit first-person ownership language. Reserve scores below 5 for responses that show no repair instinct at all G?? no acknowledgment of the rupture, no path toward resolution, or active escalation framing.

Do not penalize bilateral repair framing in recurring pattern scenarios. Do not require individual ownership language as the primary repair signal when the scenario is structurally about a pattern rather than a single incident.`;

/** Shared floor/bonus philosophy — injected into holistic and per-scenario scoring prompts. */
export const FLOOR_AND_BONUS_SCORING_PHILOSOPHY = `
FLOOR AND BONUS SCORING PHILOSOPHY

This interview scores what users demonstrate, not what they fail to volunteer.

FLOOR PRINCIPLE:
A user who provides a minimally adequate answer to the question as asked should score at or above 5 on any pillar. The floor of 4 or below is reserved for actively problematic responses — externalization, contempt, dismissal, refusal to engage, or restatement of the scenario with no interpretive attempt whatsoever.

Absence of volunteered depth is not evidence of low capacity. It is evidence of low spontaneity, which is a weaker signal. Do not penalize a user for not answering a question that was not asked.

CANONICAL SCORE ANCHORS (apply to every marker unless a marker-specific block explicitly overrides):
- **Score 7** — Construct demonstrated clearly with concrete evidence, even if brief. Behavioral specificity present. No significant gaps or omissions. Example: a concrete behavioral commitment with clear ownership ("I would assure her that this will not happen again and actually follow through") is a **7**, not a 5.
- **Score 6** — Construct present but lacks specificity, depth, or concreteness. Functionally adequate.
- **Score 5** — Construct present at a surface level only. Thin, generic, or minimal.
- **Score 4** — Construct partially present or inconsistently applied.
- **Score 3 or below** — Construct absent or actively contradicted.

Do **not** require unprompted volunteering beyond what the question asked in order to reach **7**. A clear, concrete, on-target answer to the question asked earns **7** when the construct is demonstrated with behavioral specificity. Reserve **5–6** for thin/surface or adequate-but-vague answers — **not** for clear concrete demonstrations.

MARKER-SPECIFIC ANCHORS (override the generic 5/6/7 lines above for these constructs):

**Repair**
- **7:** Concrete behavioral commitment with clear intention to change or address the specific issue. Brief but specific. Does **not** require emotional acknowledgment or a detailed plan. Example: "I would assure her this won't happen again and follow through on it."
- **8:** Same as 7 plus emotional acknowledgment of impact, or a named specific repair action, or both.
- **6:** Repair orientation present but vague or conditional. Example: "I would try to be more present" or "I'd apologize."

**Accountability** (scenario framing — not only M5 personal disclosure)
- **7:** Explicit first-person ownership of the failure or gap in behavior, plus forward-looking commitment to change. Does **not** require naming a specific personal contribution. In scenarios, score from how the user frames the character's behavior **and** their own hypothetical / role-switch response. Examples that are **7** (not 5–6): "I would apologize and in the future I would be more mindful to when my partner needs me to be more appreciative"; "I would assure her that this will not happen again and actually follow through." When that ownership + commitment appears in the repair-as-[character] (or equivalent) answer, score **7** even if the unprompted initial read was thin — the thin-unprompted mid-range (5–6) ceiling does **not** apply once clear ownership + change commitment is present.
- **8:** Same as 7 plus unprompted reflection on why the failure occurred or what it cost the other person.
- **6:** Accountability present but only implicit or partial. Example: "I'd say sorry" without naming what went wrong, or ownership without any forward commitment.

**Regulation**
- **8:** Consistently calm, analytical tone maintained across the full interview. No emotional reactivity, no frustration, no flooding at any point. Measured and deliberate throughout. Does **not** require meta-commentary on regulation.
- **7:** Generally regulated with one minor lapse or moment of heightened emotion that does not derail the response.
- **6:** Mostly regulated but one notable reactive moment that affected response quality.

**Attunement**
- **6:** User identifies the specific emotional need the character had and names the mismatch between that need and what they received. Goes beyond "they were upset" to "they needed X." Example: "She needed him to just be happy for her, not ask about logistics."
- **5:** User identifies the character's emotional state or that something went wrong emotionally, but does not name the specific unmet need. Example: "She was upset that he wasn't more supportive."
- **4:** User identifies the behavioral problem but not the emotional dimension. Example: "He should have celebrated with her instead of asking questions."

**Appreciation**
- **7:** User names the specific behavior that constitutes appreciation in this context AND what it recognizes or validates in the other person. Concrete and behavioral. Does **not** require the word "appreciation" or an elaborate description. Example: "He should have just been happy for her and appreciated her efforts."
- **6:** User identifies that appreciation was missing or needed but describes it generically. Example: "He should have been more appreciative" or "She needed to feel valued."
- **5:** User acknowledges the appreciation gap only implicitly or in passing.

UPPER-RANGE GUIDANCE:
- **8+** when the answer adds meaningful depth beyond solid demonstration (e.g. emotional interior inference, bilateral perspective, pattern-level insight, or sustained charitable framing) — prompted or unprompted when the content itself is that rich.
- Do not compress scores toward the middle because of floor language. The floors prevent unfair penalties. They do not compress the upper range.

Specifically: a response that demonstrates clear Level 2 mentalizing (inferring emotional meaning / interior beyond scenario facts) should score **at least 5**, typically **6** for pattern/emotional-meaning inference and **7** for deep interior — **never 3–4**. Score **8+** for richer bilateral or pattern-level depth. A response with no contemptuous language AND active charitable framing of character motivations should score **7–8**, not 6. Calm, analytical, non-reactive engagement throughout the full interview with no reactivity is regulation **8** — not a 5 or a 7. Park at **7** only when there is a minor lapse.

PENALTY PRINCIPLE:
Scores of 1–4 are reserved for responses that actively demonstrate problematic patterns:
- 1–2: Active externalization, blame attribution, contempt expression, or explicit refusal to engage
- 3–4: Significant avoidance, very thin engagement suggesting disengagement rather than honest surface response, or active redirection away from the question

A short but honest answer that addresses the question asked with concrete construct evidence scores **7** when specificity is present, **6** when adequate but vague, and **5** when only surface-level — never **3–4** merely for brevity. Length and depth are not the same construct. Probes exist to invite elaboration — use them before scoring low for thinness.
`;

export const SCENARIO_MENTALIZING_CONTEMPT_FLOOR_CLARIFICATIONS = `
MENTALIZING FLOOR CLARIFICATION (this scenario slice):
When the question asks for behavioral interpretation, a response that correctly identifies behavioral motivation is a complete answer. Score no lower than 5.
Score 4 only when the user restates scenario events with no interpretive attempt — e.g. surface "Emma is frustrated" with no pattern/meaning = **4**, not 6.
**Level 1** (behavioral observation / surface emotion label): score **3–5** (cap **5**).
**Level 2** (interior / emotional-meaning inference beyond scenario facts): score **at least 6**, typically **6** for clear pattern/emotional-meaning inference, **7** for deep interior about what is happening inside the character or clear emotional mismatch between characters — **never 3–5**. Score **8+** for richer bilateral or pattern-level interior inference.

CONTEMPT_EXPRESSION FLOOR CLARIFICATION (this scenario slice):
Score **7–8** when the user maintains consistently respectful, non-contemptuous language AND actively frames character behavior charitably (finding sympathetic explanations for difficult behavior). Score **8–9** when this is sustained across multiple scenarios with nuanced framing. The floor of 5 prevents penalizing absence of contempt — it does not compress users with strong contempt regulation into the 5–6 range.
`;

export function buildScoringPrompt(
  transcript: { role: string; content: string }[],
  typologyContext: string
): string {
  const turns = transcript
    .map((m) => `${m.role === 'assistant' ? 'INTERVIEWER' : 'RESPONDENT'}: ${m.content}`)
    .join('\n\n');
  return `You are a relationship psychologist scoring a structured assessment interview. Read the full transcript, then produce scores for exactly eight markers G?? no other constructs.

CONTEXT FROM VALIDATED INSTRUMENTS (if any):
${typologyContext}

INTERVIEW TRANSCRIPT:
${turns}

GLOBAL CALIBRATION RULES

1. Absence of clinical language is not a deficit. A user who says "I'd want to understand what was going on for her" scores as high as one who says "I'm mentalizing her experience." The insight matters, not the vocabulary.

1b. MENTALIZING and CONTEMPT / CRITICISM G?? register-neutral: Score these markers on accuracy of relational insight (perspective-taking, distinguishing hurt from contempt, bilateral dynamics), not on warmth, emotional expressiveness, or everyday vs clinical wording. A cool, analytical, or technical register that still demonstrates correct inference must receive the same scores as a warm or colloquial answer with the same insight. Do not penalize mentalizing or contempt scores because the user sounds "clinical" or detached if the content meets the rubric.

2. Commitment threshold: Unconditional staying with no limits scores low (about 2G??3); exit at first difficulty scores low (1G??2). A structurally complete answer G?? invest effort, communicate about what's wrong, reassess, leave if the pattern doesn't change G?? scores 6G??7 even without timelines or therapy steps; add specificity about irrecoverability for 7G??8; reserve 9G??10 for strong evidence of persistence through serious difficulty with healthy limits. Do not cap commitment_threshold below 6 solely because the user omitted granular procedural detail. **Self-aware first-person disclosure** that they tend to stay too long **while** distinguishing conflict-avoidance from true irrecoverability (or similar reflective differentiation) is **positive** evidence G?? typically **7G??8**, not a low score; **do not** treat it like "just keep trying no matter what" (see SCORE CALIBRATION: SELF-AWARE "I STAY TOO LONG" VS. UNCONDITIONAL STAYING).

3. These anchors reflect what a healthy, self-aware person in a good relationship would actually say G?? not clinical perfection. Reserve scores below 5 for actual red flags, not absence of textbook precision. **9G??10** require genuine insight and specificity; **10** additionally means **no material gap** on that marker for the moment (see SCORE CALIBRATION: G?What 10 meansG?). **8** means a **clearer** limitation or shallower demonstration than 9 G?? not merely G?very good but not superhuman.G?

${FLOOR_AND_BONUS_SCORING_PHILOSOPHY}

THE EIGHT MARKERS

MENTALIZING
Can the user hold another person's internal world in mind - their feelings, motivations, and perspective - without collapsing it into their own?

10 - Full **real-human ceiling** for the moment: accurate perspective-taking with specificity on what the vignette or question requires G?? bilateral or multi-party inner experience when both sides matter, **or** equivalently complete inference when one partyG??s experience is the clear focus. Distinguishes surface behavior from underlying need where relevant; holds complexity without forcing resolution. **Use 10** when inference is **complete** and you **cannot** name a meaningful perspective-taking gap G?? including strong reads of dynamics (e.g. demandG??withdraw, power/contempt bids, unstated agreements) and concrete relational insight (e.g. what someone needed from the otherG??s action; honoring the person vs. only acknowledging the event) **when accurate and sufficient for the prompt**.
9  - Strong perspective-taking with real specificity; use when there is a **minor** omission, thinner linkage to underlying need, or noticeably less balance than the situation invited G?? **not** as a default when the answer already meets the full rubric for this moment.
7-8 - Clear **Level 2** mentalizing with depth: deep interior inference about what is happening inside the character (**7**), or richer bilateral / pattern-level insight (**8**). Distinguishes surface behavior from underlying need or emotional meaning.
5-6 - Solid perspective-taking in the Level 1–2 band: clear **Level 2** pattern / emotional-meaning inference beyond scenario facts (**6**); Level 1 with correct emotion naming plus some interpretive attempt (**5**). Surface label alone ("Emma is frustrated") without pattern/meaning sits near **4**, not 6.
3-4 - Minimal perspective-taking. Restates scenario events or focuses on behavior/outcome without inferring emotional meaning. May explain away the other person's reaction.
1-2 - No genuine mentalizing. Dismisses, ignores, or misreads the other person's experience entirely.

MENTALIZING FLOOR CLARIFICATION:
When the question asks for behavioral interpretation, a response that correctly identifies behavioral motivation is a complete answer. Score no lower than 5.
Score 4 only when the user restates scenario events with no interpretive attempt (surface emotion label with no pattern/meaning = **4**, not 6).
**Level 1** behavioral observation: score **3–5** (cap **5**). **Level 2** interior / meaning inference: score **at least 5**, typically **6** for pattern/emotional-meaning inference, **7** for deep interior — **never 3–4**. Score **8+** for richer bilateral or multi-character interior inference.

ACCOUNTABILITY / DEFENSIVENESS
Does the user take genuine ownership of their part without deflecting, minimizing, or requiring the other person to be wrong first?

10 - Takes clear, specific ownership of the pattern - not just the incident. Does not require the other party to be acknowledged as wrong before owning their part. No hedging.
9  - Clear ownership with specificity. May briefly acknowledge the other party's contribution but doesn't use it as a condition for their own accountability.
8 - Same as 7 plus unprompted reflection on why the failure occurred or what it cost the other person.
7 - Explicit first-person ownership of the failure or gap in behavior, plus forward-looking commitment to change. Does **not** require naming a specific personal contribution. In scenario responses (not M5), accountability is assessed from how the user frames the character's behavior and their own hypothetical response — not from personal disclosure. Example: "I would apologize and be more mindful in the future."
6 - Accountability present but only implicit or partial. Example: "I'd say sorry" without naming what went wrong, or "I should have done better" without specificity.
5 - Surface-level ownership only; thin acknowledgment without clear first-person ownership + change commitment.
3-4 - Primarily defensive. Acknowledges fault only minimally or only when the other party is also implicated.
1-2 - No accountability. Justifies, blames, or dismisses.

ACCOUNTABILITY FLOOR CLARIFICATION (SCENARIO QUESTIONS):
A user who identified the focal character's responsibility and proposed a repair direction has demonstrated scenario accountability.
Score no lower than 5 when the user identified the focal character's contribution and a repair direction.
Score 4 only when the user actively deflected all responsibility to the non-focal character.
Score **7** — Explicit first-person ownership of the failure or gap in behavior, plus forward-looking commitment to change. Does **not** require naming a specific personal contribution. Example: "I would apologize and in the future I would be more mindful to when my partner needs me to be more appreciative." Also **7**: "I would assure her that this will not happen again and actually follow through." When ownership + commitment appears in the role-switch / repair-as answer, score **7** even if unprompted was thin — do **not** apply the thin-unprompted 5–6 accountability ceiling once that evidence is present.
Score **8** — Same as 7 plus unprompted reflection on why the failure occurred or what it cost the other person.
Score **6** — Accountability present but only implicit or partial (e.g. "I'd say sorry" without naming what went wrong).
Score **5** when ownership is only surface-level. Do **not** require unprompted volunteering beyond the question to reach 7.

ACCOUNTABILITY FLOOR CLARIFICATION (M5 PERSONAL QUESTION):
The primary M5 question asks for a conflict narrative and resolution description. It does not ask for self-accountability. The probe exists to specifically elicit that.

Pre-probe scoring:
- User volunteered self-examination: 7+
- User provided genuine narrative without self-examination: 5
- User gave process or philosophical response instead of specific narrative: 4G??5
- User actively externalized or blamed in their narrative: 3G??4

After the probe fires the ceiling adjusts based on probe response quality per moment5AccountabilityScoringPrompt.ts. A process answer after the probe (answering how the conflict was resolved rather than what the user contributed to causing it) scores 3G??4, not 1G??2. Score 1G??2 only for active externalization or contempt after the probe.

${ACCOUNTABILITY_BLAME_SHIFT_VS_CLARITY_REQUEST}
${REPAIR_AND_ACCOUNTABILITY_UNPROMPTED_VS_PROMPTED_WEIGHTING}
${REPAIR_CONDITIONAL_AND_PROMPTED_SCORING}
CONTEMPT / CRITICISM
Does the user recognize contempt and criticism as distinct from legitimate complaint? Can they identify when communication crosses from expressing hurt into attacking character?

WHO YOU ARE SCORING: Measure the participant's own contemptuous stance (derogation, dismissiveness, superiority, mockery, or character-level verdicts toward people in the scenarios or in their personal narrative) G?? not whether they accurately describe a fictional character's harsh or contemptuous behavior. Accurate observation that a line is mean, cold, dismissive, or closes the conversation off is attunement and relational accuracy; do not treat that as the participant expressing contempt or downgrade scores for it. Reserve low scores for the participant's own verdicts and contemptuous attitudes (e.g. "Emma is just manipulative," "Daniel obviously isn't ready," "some people are bad people").

10 - Identifies contempt precisely. Understands that contempt is a verdict on character, not an expression of pain. Distinguishes it clearly from anger or hurt.
9  - Clearly identifies contemptuous language and understands its relational impact. May not use the word "contempt" but captures the distinction accurately.
7-8 - Recognizes that something is off in the communication but frames it as "harsh" or "unfair" rather than grasping the character-attack dimension.
5-6 - Notices the tone is hurtful but treats it as equivalent to regular conflict escalation. Does not distinguish contempt from criticism.
3-4 - Normalizes or minimizes contemptuous language. May sympathize with the person expressing it without noting the problem.
1-2 - Endorses or models contemptuous communication. Does not recognize it as a problem.

CONTEMPT FLOOR CLARIFICATION:
Score 7G??8 when the user maintains consistently respectful, non-contemptuous language AND actively frames character behavior charitably (finding sympathetic explanations for difficult behavior). Score 8G??9 when this is sustained across multiple scenarios with nuanced framing. The floor of 5 prevents penalizing absence of contempt G?? it does not compress users with strong contempt regulation into the 5G??6 range.

(Register reminder: mentalizing and contempt scores follow section 1b G?? insight accuracy over communication style.)

REPAIR
Does the user understand what genuine repair requires - specific acknowledgment, behavioral commitment, and attending to the relationship rather than just resolving the incident? Apply **REPAIR G?? CONDITIONAL LANGUAGE, DIRECTIONALITY, AND PROMPTED FLOORS** (above) for "if/when" clauses, blame vs self-accountable direction, and high **prompted** repair when unprompted was thin.

10 - Repair is specific, bilateral where appropriate, and includes a behavioral commitment - not just an apology. Attends to the relational experience, not just the event.
9  - Strong repair instinct with specificity. May focus slightly more on one party's role but includes concrete action, not just intention.
8 - Same as 7 plus emotional acknowledgment of impact, or a named specific repair action, or both.
7 - Concrete behavioral commitment with clear intention to change or address the specific issue. Brief but specific. Does **not** require emotional acknowledgment or a detailed plan. Example: "I would assure her this won't happen again and follow through on it."
6 - Repair orientation present but vague or conditional. Example: "I would try to be more present" or "I'd apologize."
5 - Surface-level repair only (thin apology or talk-it-through without concrete commitment).
3-4 - Repair is one-sided, or purely transactional - resolving the conflict without attending to the relationship.
1-2 - No repair instinct. Suggests moving on without resolution or places no value on repair.

REPAIR FLOOR CLARIFICATION:
When repair is prompted, a user who identifies a concrete repair direction has answered the question asked.
Score no lower than 5 when the user proposed a concrete repair action addressing the core issue, even if it does not address the emotional layer.
Score 4 only when the proposed repair is misdirected, dismissive, or not a genuine attempt.
Score **7** — Concrete behavioral commitment with clear intention to change or address the specific issue. Brief but specific. Does **not** require emotional acknowledgment, a named specific repair action, or a detailed plan. Example: "I would assure her that this will not happen again and actually follow through on it."
Score **8** — Same as 7 plus emotional acknowledgment of impact, or a named specific repair action, or both.
Score **6** — Repair orientation present but vague or conditional (e.g. "I would try to be more present" or "I'd apologize").
Score **5** when repair is only surface-level. Do **not** require unprompted emotional-layer volunteering to reach 7 when concrete behavioral commitment is already present.

EMOTIONAL REGULATION
Does the user understand the difference between needing space to regulate and withdrawal as avoidance? Can they hold both the need for regulation and the relational obligation to return?

10 - Distinguishes flooding from avoidance. Understands that taking space is legitimate but requires a clear return commitment. Identifies specific behavioral structures that support regulation without abandonment.
9  - Clearly understands the regulation need and the relational cost of open-ended withdrawal. Proposes or endorses a structure for regulated exit and return.
8 - Consistently calm, analytical tone maintained across the **full interview**. No emotional reactivity, no frustration, no flooding at any point. Measured and deliberate throughout. Does **not** require explicit meta-commentary on regulation or a repair-under-pressure moment.
7 - Generally regulated with one minor lapse or moment of heightened emotion that does not derail the response. Also: validates the need for space **and** addresses return commitment / relational cost of open-ended withdrawal when that is the vignette focus.
6 - Mostly regulated but one notable reactive moment that affected response quality — **or** engagement is calm but thin/inconsistent.
5 - Sympathizes with the person who withdrew without recognizing the relational impact, or judges the withdrawal without recognizing the flooding, with limited regulation evidence.
3-4 - Treats withdrawal as purely avoidant without curiosity, or treats it as fully acceptable without noting the relational cost.
1-2 - Endorses stonewalling or indefinite withdrawal. No understanding of the regulation-relationship tension.

REGULATION FLOOR CLARIFICATION:
A user who engaged calmly and analytically throughout without emotional reactivity is demonstrating regulation.
Score no lower than 5 when the user maintained calm, non-reactive engagement throughout.
Score 4 only when the user showed signs of dysregulation — reactive framing, escalating language, or inability to stay with the scenario.
Score **8** — Consistently calm, analytical tone maintained across the full interview with no emotional reactivity, frustration, or flooding at any point. Sustained composure alone earns **8**; do **not** require meta-commentary on regulation or a specific repair-under-pressure moment.
Score **7** — Generally regulated with one minor lapse or moment of heightened emotion that does not derail the response.
Score **6** — Mostly regulated but one notable reactive moment that affected response quality.
Articulated regulation strategies or sophisticated self-awareness of emotional responses in conflict also support **7–8+**. Do **not** park sustained calm/analytical engagement at 5 or 7 merely because the user did not name a regulation strategy.

PASSIVE REGULATION G?? PERSONAL MOMENT 4 (grudge / dislike narrative, not the withdrawal vignette):
The grudge question does not name "regulation," but first-person stories often show **emotional self-management**. When the user describes an **ongoing** difficult feeling or relationship residue **without** flooding, hostile escalation, or purely dismissive avoidance G?? e.g. distinguishing making peace with a **situation** versus a **person**, emotions becoming **"less loud"** or slowly settling rather than resolving cleanly, **reflective** holding of mixed or unresolved feelings, or **measured** language about hurt or resentment while staying non-reactive G?? treat that as **regulation evidence**. Score **regulation in the 6G??8 band** from sophistication (6 = clear containment/reflection, 7G??8 = nuanced differentiation, bilateral self-awareness, or rich description of holding difficulty without being controlled by it). **Do not** leave regulation unscored, null, or artificially low solely because they were not asked about space vs withdrawal; if this evidence is present in Moment 4, **assign a numeric regulation score** in that band.

ATTUNEMENT
Is the user sensitive to emotional bids - moments when someone signals a need for connection, recognition, or witnessing - even when those bids are indirect?

10 - Identifies subtle emotional bids and understands what they are asking for beneath the surface. Recognizes when someone needs witnessing, not problem-solving.
9  - Strong attunement. Reads emotional subtext accurately and can articulate what the person needed even when they didn't ask directly.
7-8 - Strong attunement with rich emotional texture or bilateral / subtle bid-reading beyond naming the specific unmet need (**toward 7–8**).
6 - User identifies the specific emotional need the character had and names the mismatch between that need and what they received. Goes beyond "they were upset" to "they needed X." Example: "She needed him to just be happy for her, not ask about logistics." Recognizing the specific emotional need — not just the behavioral gap — is Level 2 attunement that earns **6**.
5 - User identifies the character's emotional state or that something went wrong emotionally, but does not name the specific unmet need. Example: "She was upset that he wasn't more supportive."
4 - User identifies the behavioral problem but not the emotional dimension. Example: "He should have celebrated with her instead of asking questions." Identifying frustration + pattern without naming the unmet need must score **5**, not 4, when emotional state is named.
3 - Little emotional recognition — treats the scenario as logistical, or only vague tone without naming the focal emotion.
1-2 - Actively misreads the bid or dismisses the emotional need entirely.

ATTUNEMENT FLOOR CLARIFICATION:
When the question focuses on one character, attunement is evaluated on that character only. Not mentioning the other character is neutral — it is not a penalty.
Score **6** — User identifies the specific emotional need the character had and names the mismatch between that need and what they received. Goes beyond "they were upset" to "they needed X." Example: "He should have just been happy for her and appreciated her efforts" / "She needed him to just be happy for her, not ask about logistics."
Score **5** — User identifies the character's emotional state or that something went wrong emotionally, but does not name the specific unmet need. Example: "She was upset that he wasn't more supportive." Pattern recognition without naming the unmet need stays at **5**.
Score **4** — User identifies the behavioral problem but not the emotional dimension. Example: "He should have celebrated with her instead of asking questions."
Score 4 only when the user showed no emotional recognition of any character — treating the scenario as purely logistical — or behavioral-only as above.
Score **7** when the user clearly recognizes the focal character's emotional need/state with concrete evidence beyond the 6-threshold need-mismatch (even if brief). Score **8+** when they also describe the other character's experience or the recurring pattern with real specificity. Do **not** require unprompted bilateral coverage merely to reach 7 on the focal character. Do **not** treat "identifying what the character needed" as only a **5** — naming the specific unmet emotional need is **6**. **Level 2** attunement must score **at least 5** — never **3–4**.

APPRECIATION AND POSITIVE REGARD
Does the user understand the difference between acknowledging an achievement and genuinely honoring the person - their effort, their journey, their experience?

10 - Distinguishes between celebrating the outcome and witnessing the person. Attends to what something cost, not just what it produced. Appreciation is relational, not transactional.
9  - Strong appreciation instinct. Attends to the person's experience rather than just the event. May not articulate the distinction explicitly but demonstrates it clearly.
8 - Same as 7 with richer or more bilateral distinction between honoring the person and processing the outcome.
7 - User names the specific behavior that constitutes appreciation in this context AND what it recognizes or validates in the other person. Concrete and behavioral. Does **not** require using the word "appreciation" or "feel appreciated," or an elaborate description. Example: "He should have just been happy for her and appreciated her efforts" — names the emotional stance (happiness for her) and what it honors (her efforts).
6 - User identifies that appreciation was missing or needed but describes it generically. Example: "He should have been more appreciative" or "She needed to feel valued."
5 - User acknowledges the appreciation gap only implicitly or in passing — or treats appreciation as transactional (a gift, a dinner, a compliment) without naming the honoring behavior.
3-4 - Minimal appreciation instinct. Treats the other person's success as a logistical event.
1-2 - No appreciation or positive regard demonstrated.

COMMITMENT THRESHOLD
Does the user have a healthy framework for when to persist versus when to leave G?? neither exiting at the first strain nor staying without limits?

Score on structural completeness (invest G?? communicate about the problem G?? assess change G?? decide), not on how many procedural details they list. Absence of timelines, therapy, or step-by-step plans is NOT evidence of low capacity if the four-part structure is clearly implied or stated.

10 - Strong limits plus meaningful evidence or description of persisting through significant difficulty while protecting wellbeing; may be concise; not gated on exhaustive process.
9  - Clear healthy threshold with real specificity about when a relationship is no longer workable; procedural detail still optional.
7-8 - Sound structure plus at least some concrete sense of irrecoverability or "pattern continues without change after serious effort"; OR very clear structure with lighter specificity (use high 7 band). **Also 7-8:** Clear **self-aware** disclosure of struggling to leave paired with **differentiation** (e.g. fear of conflict vs genuine incompatibility / irrecoverability) or active work to recognize when something is actually done G?? **not** low threshold (see SCORE CALIBRATION).
6-7 - Structurally sound path without fine-grained detail: real effort, honest communication about what's not working, willingness to end if things don't change G?? sufficient for this band.
3-4 - Unconditional staying without limits, vague "keep trying" with no structure, OR brittle exit logic without effort/communication/assess pattern.
1-2 - Exit immediately or unconditionally at minor difficulty; OR incoherent threshold; OR staying regardless of serious harm.

DISCRIMINATION: "I just keep trying / never give up" **without** self-awareness or limits G?? low. "I tend to hold on too long **but** I'm working on telling fear of conflict from real irrecoverability" G?? **7G??8** (healthy metacognition), not 3G??4.

UNIVERSAL PASSIVE SIGNAL RULE: Score a marker whenever it surfaces in any moment. Do not penalize absence unless that moment's primary targets included that marker and the user had a clear opportunity.

${SCORING_GUARDRAILS}

${SCORE_CALIBRATION_0_10}

ADDITIONAL ANCHORS (consistent with the calibration above; do not use these to force competent answers below 7):
- Rough guide for scores 1G??6: severity of genuine failure on that marker when evidence of failure exists G?? e.g. thin empathy or incomplete repair where it mattered (not G?average humanG? competence).
- 7 = solid demonstration for that marker in context G?? no material failure; may be brief if still clearly on-target.

EVIDENCE QUALITY HIERARCHY

1. Personal behavioral example with specifics: full range (subject to calibration).
2. First-person scenario response with specific words/actions: full range.
3. Vague scenario response ("just communicate"): cap that marker at 6 until specificity appears in the transcript G?? lack of demonstrated specificity is not the same as active contempt or defensiveness, but it is not yet full competency for that moment.
EXCEPTION G?? COMMITMENT_THRESHOLD: Do not apply this cap to commitment_threshold. A structurally complete threshold answer (invest, communicate, assess pattern, decide) can score 6G??8+ without granular procedural detail; see commitment-threshold anchors above.

CROSS-MOMENT WEIGHTING: Do not average mechanically across moments. Weight strongest specific evidence; note inconsistency in notableInconsistencies when high in one moment and low in another for the same marker.

Example: Strong bilateral repair in Scenario A, one-sided blame in Scenario B G?? repair might be 7 with inconsistency noted G?? not a flat average of 5.

CLARIFICATION-ONLY: Unprompted insights count more than dragged-out answers (consistent with **REPAIR & ACCOUNTABILITY G?? UNPROMPTED VS. PROMPTED** for repair/accountability in scenarios G?? not a substitute for that block).

GENERIC RESPONSE PENALTY: If user stayed generic after clarification for a moment, cap markers primarily informed by that moment at 5 and note in keyEvidence.
EXCEPTION FOR APPRECIATION: Do not apply this cap when the described act is concise but clearly attuned and relationally specific; concise-but-clear appreciation can still score high.
EXCEPTION FOR COMMITMENT_THRESHOLD: Do not cap commitment_threshold at 5 solely for "generic" wording when the answer still expresses a complete invest / communicate / assess / decide structure; apply the commitment-threshold anchors instead.

G??G??G??G??G??G??G??G??G??G??G??G??G??G??G??G??G??G??G??G??G??G??G??G??G??G??G??G??G??G??G??G??G??G??G??G??G??G??G??G??G??
COMMUNICATION QUALITY (separate from the eight markers)
G??G??G??G??G??G??G??G??G??G??G??G??G??G??G??G??G??G??G??G??G??G??G??G??G??G??G??G??G??G??G??G??G??G??G??G??G??G??G??G??G??
Score four dimensions 0G??10 and communicationSummary as before. Use the same human-ceiling calibration as the eight markers above.

REPAIR COHERENCE: If diagnosed failure reappears in their repair attempt, lower accountability (and ownership language in communication quality) by 1G??2 points.

DIAGNOSTIC EMPHASIS:
- Scenario A: contempt in Emma's lines; bilateral ownership; Ryan repair. For **repair** and **accountability** holistically, apply **REPAIR & ACCOUNTABILITY G?? UNPROMPTED VS. PROMPTED** across the Scenario A turns (unprompted vs repair-as-Ryan). Per-scenario slice scoring uses the same 10 = real-human ceiling and slice-independence rules as scenario JSON scoring G?? strong demand-withdraw / power-bid / implicit-priority mentalizing and pattern-level, behavioral Ryan repair can reach **10** when complete; do not cap Scenario A at 9 to leave room for later scenarios.
- Scenario B: attunement to James redirecting Sarah's tears vs receiving her emotion; James leading with logistics vs emotional presence; appreciation (honoring Sarah vs transactional celebration). For **repair** and **accountability**, weight unprompted vs repair-as-James per **REPAIR & ACCOUNTABILITY G?? UNPROMPTED VS. PROMPTED**. See SCENARIO B anchors below.
- Scenario C: regulation, Daniel's return, Sophie's legitimacy; bilateral repair. For **repair** and **accountability**, weight preG??repair-prompt vs postG??repair-prompt per **REPAIR & ACCOUNTABILITY G?? UNPROMPTED VS. PROMPTED**. Commitment threshold is not scored from Scenario C G?? use Moment 4 for commitment_threshold.

${SCENARIO_B_ATTUNEMENT_APPRECIATION_ANCHORS}
- Personal grudge moment: contempt + metacognition + commitment threshold when they distinguish work-through vs walk-away conditions.

In addition to the eight pillar scores, assess the overall ego development level demonstrated across the full interview transcript. Assign a level from 1 to 5 based on the following criteria:

Level 1 G?? Concrete and rule-based throughout. Responses are black and white. Characters are simply right or wrong. No complexity or ambiguity is held. Personal moments are deflected or described in purely procedural terms.

Level 2 G?? Awareness of multiple perspectives but resolved simplistically. Acknowledges that both parties have a point but collapses to simple solutions. Personal moments show some self-reference but without genuine self-examination.

Level 3 G?? Holds complexity without resolving it prematurely. Recognizes patterns across situations. Uses psychological concepts naturally and accurately. Personal moments show genuine self-reflection with some insight.

Level 4 G?? Integrates contradictions. Connects present behavior to broader relational patterns. Tolerates ambiguity as a feature rather than a problem. Personal moments show genuine ownership and psychological depth.

Level 5 G?? Demonstrates systemic understanding of relational dynamics. Recognizes how internal states drive patterns across relationships and time. Personal moments show genuine integration of insight and behavior without performance.

Return this as ego_development_level (integer 1G??5) in the JSON output alongside pillar_scores.

Your entire reply must be one JSON object only. Do not write an introduction, preamble, or explanation (for example do not start with "Looking at", "Here is", or analysis before the JSON). The first non-whitespace character of your message must be {.

${KEY_EVIDENCE_ANALYTICAL_NARRATIVE_RULES}

Return ONLY valid JSON. Keys for pillarScores, keyEvidence, and pillarConfidence must be exactly: mentalizing, accountability, contempt, repair, regulation, attunement, appreciation, commitment_threshold. You MUST include top-level key "ego_development_level" as a required integer between 1 and 5 (never omit this key). Put ego_development_level at the top level of the JSON object only G?? not nested inside pillarScores or pillar_scores.

{
  "pillarScores": { "mentalizing": 0, "accountability": 0, "contempt": 0, "repair": 0, "regulation": 0, "attunement": 0, "appreciation": 0, "commitment_threshold": 0 },
  "ego_development_level": 3,
  "keyEvidence": { "mentalizing": "", "accountability": "", "contempt": "", "repair": "", "regulation": "", "attunement": "", "appreciation": "", "commitment_threshold": "" },
  "pillarConfidence": { "mentalizing": "high|moderate|low", "accountability": "high|moderate|low", "contempt": "high|moderate|low", "repair": "high|moderate|low", "regulation": "high|moderate|low", "attunement": "high|moderate|low", "appreciation": "high|moderate|low", "commitment_threshold": "high|moderate|low" },
  "communicationQuality": {
    "ownershipLanguage": 0,
    "blameJudgementLanguage": 0,
    "empathyInLanguage": 0,
    "owningExperience": 0,
    "communicationSummary": "2 sentences"
  },
  "narrativeCoherence": "high | moderate | low",
  "behavioralSpecificity": "high | moderate | low",
  "notableInconsistencies": [],
  "interviewSummary": "3 honest sentences synthesising patterns across all four moments (three scenarios + one personal question).",
  "skepticismModifier": { "pillarId": null, "adjustment": 0, "reason": "n/a G?? legacy field" }
}

pillarConfidence: per marker; metadata only ? must not change numeric pillarScores. Apply PILLAR CONFIDENCE IS METADATA ONLY, SCORING_CONFIDENCE_INSTRUCTIONS, and the commitment_threshold fictional-vs-personal rule above.

${PILLAR_CONFIDENCE_METADATA_ONLY_RULES}

${SCORING_CONFIDENCE_INSTRUCTIONS}`;
}
