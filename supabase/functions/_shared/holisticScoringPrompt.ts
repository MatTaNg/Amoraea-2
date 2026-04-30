import {
  ACCOUNTABILITY_BLAME_SHIFT_VS_CLARITY_REQUEST,
  REPAIR_AND_ACCOUNTABILITY_UNPROMPTED_VS_PROMPTED_WEIGHTING,
  REPAIR_CONDITIONAL_AND_PROMPTED_SCORING,
  SCENARIO_B_ATTUNEMENT_APPRECIATION_ANCHORS,
  SCORE_CALIBRATION_0_10,
} from './interviewScoringCalibration.ts';

export const SCORING_CONFIDENCE_INSTRUCTIONS = `
CONFIDENCE SCORING FOR PERSONAL RESPONSES:

When scoring a personal response, apply these confidence rules:

HIGH confidence: User gave a clear, specific personal story that directly addresses the construct being measured. Contains actual words said, a back-and-forth dynamic, and their own role in it.

MEDIUM confidence: User gave a relevant story but it was one-sided, vague, or missing a key element. You redirected once and got partial improvement. Score reflects what you could gather but with reduced certainty.

LOW confidence: User's personal story was off-target or too thin to score properly, even after one redirect. Score at low confidence and note the limitation.

NEVER score HIGH confidence on a response that:
- Is fewer than two sentences of real content where specificity was required
- Describes only what the other person did with no reflective or relational insight when the moment required it

COMMITMENT_THRESHOLD — FICTIONAL VS PERSONAL (full interview scoring):
If commitment_threshold is informed only by third-party reasoning about Sophie/Daniel (Scenario C) and there is no substantive first-person threshold content from Moment 4 (the grudge answer and/or the "work through versus walk away" follow-up with scorable criteria in the user's own relationship terms), set pillarConfidence for commitment_threshold to "moderate" or "low" — not "high." Reserve "high" when first-person threshold reasoning appears in the transcript (clear work-through vs walk-away structure or criteria in their own terms — concise structural answers count; they need not be procedurally detailed), or when fictional and personal evidence jointly support the score with strong clarity.
`;

const SCORING_GUARDRAILS = `GUARDRAIL 1 — Evaluate mechanism, not vocabulary

When scoring any construct, evaluate the underlying competency the user is demonstrating, not the specific vocabulary or framework they use to express it. A user who describes attunement through somatic, spiritual, or clinical language should receive the same credit as a user who uses conventional relationship language, provided the mechanism they describe is correct. Ask: does this response demonstrate accurate understanding of what the construct requires, regardless of how it is expressed? If yes, award full credit for that understanding. Do not penalize unconventional frameworks, practices, or references if they correctly identify the relevant dynamic. An unusual answer is not an inaccurate answer.

GUARDRAIL 2 — Micro-evidence miss penalty cap

When a user correctly identifies the primary emotional or relational dynamic in a scenario but misses a specific supporting moment or line-level evidence, apply a partial deduction only. Do not use a missed micro-evidence moment as a floor-setter for the construct score. Rule: if the user demonstrates correct macro-level understanding of the construct, score no lower than 5.5 for that construct in that scenario, regardless of whether specific supporting evidence was named. Reserve scores below 5 for responses that misread the primary dynamic entirely or demonstrate the opposite of the construct being assessed.

GUARDRAIL 3 — Construct score independence

Score each construct independently of the others. An unusual, unconventional, or socially unexpected recommendation does not itself indicate low competency on attunement, mentalizing, appreciation, or other constructs — evaluate only what the response reveals about the user's understanding of the specific construct being scored. Each construct score must be justified by evidence directly relevant to that construct, not by the general character or tone of the response. Do not apply penalties to adjacent constructs because of unconventional framing in one part of the response.

GUARDRAIL 4 — Prompted vs unprompted scoring hierarchy

Apply the following hierarchy consistently across all constructs. Unprompted demonstration — user volunteers the construct behavior or insight without being asked: score range 7–10 depending on depth and specificity. Prompted demonstration — user demonstrates the construct behavior or insight only after a direct probe question: score range 5–8 depending on quality of response. A strong prompted response can reach 8 but cannot reach 9 or 10 without unprompted evidence earlier in the same scenario. Absent — user does not demonstrate the construct even when prompted, or demonstrates the opposite: score range 1–4. When scoring accountability specifically: language marker data should be used as a signal but not as a hard determinant. A user can demonstrate genuine accountability through the structure and ownership of their response even if they do not use conventional accountability phrases. Weight the substance of what they said over the presence or absence of specific phrase patterns.

GUARDRAIL 5 — Distinguish deflection from boundary acknowledgment

When scoring repair and accountability, apply the following distinction carefully:
Deflection is when a user avoids acknowledging harm entirely — they redirect blame onto the other person, minimize the impact of the behavior, or reframe the situation so that the person who caused harm bears no responsibility. This should be penalized in repair and accountability scores.
Boundary acknowledgment is when a user simultaneously holds the harm caused and the legitimate underlying need of the person who caused it. This is not deflection. A response that says both "this behavior was inappropriate in this context" and "this person has a legitimate need that deserves acknowledgment and a clear agreement" demonstrates higher relational competency than simple ownership alone. This should not be penalized and should be scored as evidence of sophisticated relational thinking.
Specifically: if a user stepping into the role of the person who caused harm identifies both what that person did wrong and what that person legitimately needs going forward — including boundary-setting, renegotiating agreements, or communicating priorities — award full credit for accountability and repair. Do not interpret the acknowledgment of the causer's legitimate needs as deflection away from ownership.
This distinction also applies to mentalizing. A user who resists the implicit framing of a scenario — where one character is clearly positioned as the wrongdoer — and instead holds a differentiated view of both characters' needs and perspectives should be scored higher on mentalizing, not lower. Refusing to make a character a villain when the scenario invites that reading is evidence of perspective-taking, not evidence of missing the point.
Reserve deflection penalties for responses where the user shows no acknowledgment of harm, no ownership of impact, or actively blames the affected party for the situation. Do not apply deflection penalties to responses that acknowledge harm and also identify legitimate needs on both sides.

GUARDRAIL 6 — Separate scenario diagnosis quality from construct response quality

When scoring any construct, evaluate the evidence for that construct independently of how well the user diagnosed the overall scenario. A user who gives a thin, incomplete, or confused initial read of a scenario can still demonstrate strong construct competency when directly asked about that construct. These are measuring different things and must be scored separately.

Specifically: do not use the quality of a user's initial scenario analysis as evidence against their construct scores. If a user's initial response to a scenario is surface-level or misses key dynamics, but their subsequent response to a direct construct question demonstrates genuine competency, score the construct based on the construct response. The initial scenario read is context, not construct evidence.

Apply this distinction to the prompted versus unprompted hierarchy as follows. A user showing no repair instinct, no accountability, or no attunement in their initial scenario read should not be marked as unprompted-absent for those constructs unless they were given a natural opportunity to demonstrate the construct and did not. Simply reading a scenario and describing what is happening is not a natural opportunity to demonstrate repair — it is a diagnostic task. The unprompted opportunity for repair begins when the relational dynamic that requires repair has been clearly surfaced in the conversation, not from the moment the scenario is introduced.

When evaluating repair specifically: if a user's initial scenario read is thin or confused but their repair response — when asked directly — contains validation, ownership, behavioral commitment, and invitation for the other person to express their needs, score the repair response on its own merits. Do not anchor the repair score to the quality of the initial read or describe the repair as showing confusion when the repair response itself is clear and competent.

Do not conflate a user failing to fully diagnose a scenario with a user lacking the construct being tested. Diagnostic skill and construct competency are related but distinct. A user can miss the nuance of why a scenario went wrong while still knowing exactly how to repair it. Score what was demonstrated, not what was not demonstrated in a context that was not designed to elicit it.

GUARDRAIL 7 — Calibrate repair scoring to scenario type

When scoring repair, apply different weighting to repair indicators depending on whether the scenario involves a single incident or a recurring pattern. These are structurally different relational problems and appropriate repair looks different in each case.

For single-incident scenarios — where a specific behavior caused a specific rupture in a specific moment — the primary repair signal is individual ownership. Score highly for responses that demonstrate: acknowledgment of the specific harm caused, first-person ownership of the behavior, a concrete behavioral commitment to change, and a bid toward reconnection with the affected person. Bilateral or mutual framing in single-incident repair should be noted as a partial deflection if it **replaces** rather than **accompanies** individual ownership. **Do not** conflate that with a conditional clause that **returns accountability to the respondent** (e.g. **"if** her signal is hard to read **I still** own the gap in understanding") — use **REPAIR — CONDITIONAL LANGUAGE, DIRECTIONALITY, AND PROMPTED FLOORS**; **do not** penalize **repair** for **if/when** phrasing by keyword alone.

For recurring pattern scenarios — where the same rupture has happened multiple times and the relationship dynamic itself is the problem — bilateral agreement language is appropriate and should be credited, not penalized. When a scenario explicitly involves a repeated argument, an established avoidance pattern, or a structural mismatch in expectations that neither person has named, repair requires both people to renegotiate agreements, not just one person to take ownership of a single incident. Score highly for responses that demonstrate: recognition that the pattern requires a structural fix, identification of the unspoken expectation or agreement gap driving the pattern, and some form of bilateral renegotiation or new agreement as the repair vehicle. Individual ownership is still valuable in this context but should not be the primary scoring signal.

Specifically for Scenario C (Sophie and Daniel): this scenario involves a third repetition of the same argument, making it explicitly a recurring pattern scenario. A response that identifies the need for both people to establish clear agreements about expectations, communication, and conflict process should be scored at 6 or above for repair, even if it does not include explicit first-person ownership language. Reserve scores below 5 for responses that show no repair instinct at all — no acknowledgment of the rupture, no path toward resolution, or active escalation framing.

Do not penalize bilateral repair framing in recurring pattern scenarios. Do not require individual ownership language as the primary repair signal when the scenario is structurally about a pattern rather than a single incident.`;

export function buildScoringPrompt(
  transcript: { role: string; content: string }[],
  typologyContext: string
): string {
  const turns = transcript
    .map((m) => `${m.role === 'assistant' ? 'INTERVIEWER' : 'RESPONDENT'}: ${m.content}`)
    .join('\n\n');
  return `You are a relationship psychologist scoring a structured assessment interview. Read the full transcript, then produce scores for exactly eight markers — no other constructs.

CONTEXT FROM VALIDATED INSTRUMENTS (if any):
${typologyContext}

INTERVIEW TRANSCRIPT:
${turns}

GLOBAL CALIBRATION RULES

1. Absence of clinical language is not a deficit. A user who says "I'd want to understand what was going on for her" scores as high as one who says "I'm mentalizing her experience." The insight matters, not the vocabulary.

1b. MENTALIZING and CONTEMPT / CRITICISM — register-neutral: Score these markers on accuracy of relational insight (perspective-taking, distinguishing hurt from contempt, bilateral dynamics), not on warmth, emotional expressiveness, or everyday vs clinical wording. A cool, analytical, or technical register that still demonstrates correct inference must receive the same scores as a warm or colloquial answer with the same insight. Do not penalize mentalizing or contempt scores because the user sounds "clinical" or detached if the content meets the rubric.

2. Commitment threshold: Unconditional staying with no limits scores low (about 2–3); exit at first difficulty scores low (1–2). A structurally complete answer — invest effort, communicate about what's wrong, reassess, leave if the pattern doesn't change — scores 6–7 even without timelines or therapy steps; add specificity about irrecoverability for 7–8; reserve 9–10 for strong evidence of persistence through serious difficulty with healthy limits. Do not cap commitment_threshold below 6 solely because the user omitted granular procedural detail. **Self-aware first-person disclosure** that they tend to stay too long **while** distinguishing conflict-avoidance from true irrecoverability (or similar reflective differentiation) is **positive** evidence — typically **7–8**, not a low score; **do not** treat it like "just keep trying no matter what" (see SCORE CALIBRATION: SELF-AWARE "I STAY TOO LONG" VS. UNCONDITIONAL STAYING).

3. These anchors reflect what a healthy, self-aware person in a good relationship would actually say — not clinical perfection. Reserve scores below 5 for actual red flags, not absence of textbook precision. **9–10** require genuine insight and specificity; **10** additionally means **no material gap** on that marker for the moment (see SCORE CALIBRATION: “What 10 means”). **8** means a **clearer** limitation or shallower demonstration than 9 — not merely “very good but not superhuman.”

THE EIGHT MARKERS

MENTALIZING
Can the user hold another person's internal world in mind - their feelings, motivations, and perspective - without collapsing it into their own?

10 - Full **real-human ceiling** for the moment: accurate perspective-taking with specificity on what the vignette or question requires — bilateral or multi-party inner experience when both sides matter, **or** equivalently complete inference when one party’s experience is the clear focus. Distinguishes surface behavior from underlying need where relevant; holds complexity without forcing resolution. **Use 10** when inference is **complete** and you **cannot** name a meaningful perspective-taking gap — including strong reads of dynamics (e.g. demand–withdraw, power/contempt bids, unstated agreements) and concrete relational insight (e.g. what someone needed from the other’s action; honoring the person vs. only acknowledging the event) **when accurate and sufficient for the prompt**.
9  - Strong perspective-taking with real specificity; use when there is a **minor** omission, thinner linkage to underlying need, or noticeably less balance than the situation invited — **not** as a default when the answer already meets the full rubric for this moment.
7-8 - Shows clear empathy but stays somewhat surface-level. Describes feelings without inferring the deeper need behind them.
5-6 - Acknowledges the other person's feelings but interprets them through their own lens. Some projection or assumption without curiosity.
3-4 - Minimal perspective-taking. Focuses on behavior and outcome rather than inner experience. May explain away the other person's reaction.
1-2 - No genuine mentalizing. Dismisses, ignores, or misreads the other person's experience entirely.

ACCOUNTABILITY / DEFENSIVENESS
Does the user take genuine ownership of their part without deflecting, minimizing, or requiring the other person to be wrong first?

10 - Takes clear, specific ownership of the pattern - not just the incident. Does not require the other party to be acknowledged as wrong before owning their part. No hedging.
9  - Clear ownership with specificity. May briefly acknowledge the other party's contribution but doesn't use it as a condition for their own accountability.
7-8 - Takes ownership but softens it with qualifications - "I could have done better, but..." - or centers the apology on the other person's feelings rather than their own behavior.
5-6 - Partial ownership. Acknowledges a mistake but deflects meaningfully - blames context, timing, or the other person's reaction.
3-4 - Primarily defensive. Acknowledges fault only minimally or only when the other party is also implicated.
1-2 - No accountability. Justifies, blames, or dismisses.

${ACCOUNTABILITY_BLAME_SHIFT_VS_CLARITY_REQUEST}
${REPAIR_AND_ACCOUNTABILITY_UNPROMPTED_VS_PROMPTED_WEIGHTING}
${REPAIR_CONDITIONAL_AND_PROMPTED_SCORING}
CONTEMPT / CRITICISM
Does the user recognize contempt and criticism as distinct from legitimate complaint? Can they identify when communication crosses from expressing hurt into attacking character?

WHO YOU ARE SCORING: Measure the participant's own contemptuous stance (derogation, dismissiveness, superiority, mockery, or character-level verdicts toward people in the scenarios or in their personal narrative) — not whether they accurately describe a fictional character's harsh or contemptuous behavior. Accurate observation that a line is mean, cold, dismissive, or closes the conversation off is attunement and relational accuracy; do not treat that as the participant expressing contempt or downgrade scores for it. Reserve low scores for the participant's own verdicts and contemptuous attitudes (e.g. "Emma is just manipulative," "Daniel obviously isn't ready," "some people are bad people").

10 - Identifies contempt precisely. Understands that contempt is a verdict on character, not an expression of pain. Distinguishes it clearly from anger or hurt.
9  - Clearly identifies contemptuous language and understands its relational impact. May not use the word "contempt" but captures the distinction accurately.
7-8 - Recognizes that something is off in the communication but frames it as "harsh" or "unfair" rather than grasping the character-attack dimension.
5-6 - Notices the tone is hurtful but treats it as equivalent to regular conflict escalation. Does not distinguish contempt from criticism.
3-4 - Normalizes or minimizes contemptuous language. May sympathize with the person expressing it without noting the problem.
1-2 - Endorses or models contemptuous communication. Does not recognize it as a problem.

(Register reminder: mentalizing and contempt scores follow section 1b — insight accuracy over communication style.)

REPAIR
Does the user understand what genuine repair requires - specific acknowledgment, behavioral commitment, and attending to the relationship rather than just resolving the incident? Apply **REPAIR — CONDITIONAL LANGUAGE, DIRECTIONALITY, AND PROMPTED FLOORS** (above) for "if/when" clauses, blame vs self-accountable direction, and high **prompted** repair when unprompted was thin.

10 - Repair is specific, bilateral where appropriate, and includes a behavioral commitment - not just an apology. Attends to the relational experience, not just the event.
9  - Strong repair instinct with specificity. May focus slightly more on one party's role but includes concrete action, not just intention.
7-8 - Understands repair is needed and can articulate an apology, but repair stays at the level of the incident rather than the pattern. No specific behavioral commitment.
5-6 - Suggests talking it through or apologizing but without specificity. Repair is vague.
3-4 - Repair is one-sided, or purely transactional - resolving the conflict without attending to the relationship.
1-2 - No repair instinct. Suggests moving on without resolution or places no value on repair.

EMOTIONAL REGULATION
Does the user understand the difference between needing space to regulate and withdrawal as avoidance? Can they hold both the need for regulation and the relational obligation to return?

10 - Distinguishes flooding from avoidance. Understands that taking space is legitimate but requires a clear return commitment. Identifies specific behavioral structures that support regulation without abandonment.
9  - Clearly understands the regulation need and the relational cost of open-ended withdrawal. Proposes or endorses a structure for regulated exit and return.
7-8 - Validates the need for space but doesn't address the return commitment or the pattern of unresolved exits.
5-6 - Sympathizes with the person who withdrew without recognizing the relational impact, or judges the withdrawal without recognizing the flooding.
3-4 - Treats withdrawal as purely avoidant without curiosity, or treats it as fully acceptable without noting the relational cost.
1-2 - Endorses stonewalling or indefinite withdrawal. No understanding of the regulation-relationship tension.

PASSIVE REGULATION — PERSONAL MOMENT 4 (grudge / dislike narrative, not the withdrawal vignette):
The grudge question does not name "regulation," but first-person stories often show **emotional self-management**. When the user describes an **ongoing** difficult feeling or relationship residue **without** flooding, hostile escalation, or purely dismissive avoidance — e.g. distinguishing making peace with a **situation** versus a **person**, emotions becoming **"less loud"** or slowly settling rather than resolving cleanly, **reflective** holding of mixed or unresolved feelings, or **measured** language about hurt or resentment while staying non-reactive — treat that as **regulation evidence**. Score **regulation in the 6–8 band** from sophistication (6 = clear containment/reflection, 7–8 = nuanced differentiation, bilateral self-awareness, or rich description of holding difficulty without being controlled by it). **Do not** leave regulation unscored, null, or artificially low solely because they were not asked about space vs withdrawal; if this evidence is present in Moment 4, **assign a numeric regulation score** in that band.

ATTUNEMENT
Is the user sensitive to emotional bids - moments when someone signals a need for connection, recognition, or witnessing - even when those bids are indirect?

10 - Identifies subtle emotional bids and understands what they are asking for beneath the surface. Recognizes when someone needs witnessing, not problem-solving.
9  - Strong attunement. Reads emotional subtext accurately and can articulate what the person needed even when they didn't ask directly.
7-8 - Picks up on the emotional tone but interprets it at face value. Responds to what was said rather than what was needed.
5-6 - Misses the bid but notices something feels off. Focuses on content rather than emotional need.
3-4 - Does not register the bid. Responds to surface content only.
1-2 - Actively misreads the bid or dismisses the emotional need entirely.

APPRECIATION AND POSITIVE REGARD
Does the user understand the difference between acknowledging an achievement and genuinely honoring the person - their effort, their journey, their experience?

10 - Distinguishes between celebrating the outcome and witnessing the person. Attends to what something cost, not just what it produced. Appreciation is relational, not transactional.
9  - Strong appreciation instinct. Attends to the person's experience rather than just the event. May not articulate the distinction explicitly but demonstrates it clearly.
7-8 - Warm and genuine but appreciation stays at the level of the achievement. Misses the journey and cost dimension.
5-6 - Acknowledges the achievement but treats appreciation as transactional - a gift, a dinner, a compliment.
3-4 - Minimal appreciation instinct. Treats the other person's success as a logistical event.
1-2 - No appreciation or positive regard demonstrated.

COMMITMENT THRESHOLD
Does the user have a healthy framework for when to persist versus when to leave — neither exiting at the first strain nor staying without limits?

Score on structural completeness (invest → communicate about the problem → assess change → decide), not on how many procedural details they list. Absence of timelines, therapy, or step-by-step plans is NOT evidence of low capacity if the four-part structure is clearly implied or stated.

10 - Strong limits plus meaningful evidence or description of persisting through significant difficulty while protecting wellbeing; may be concise; not gated on exhaustive process.
9  - Clear healthy threshold with real specificity about when a relationship is no longer workable; procedural detail still optional.
7-8 - Sound structure plus at least some concrete sense of irrecoverability or "pattern continues without change after serious effort"; OR very clear structure with lighter specificity (use high 7 band). **Also 7-8:** Clear **self-aware** disclosure of struggling to leave paired with **differentiation** (e.g. fear of conflict vs genuine incompatibility / irrecoverability) or active work to recognize when something is actually done — **not** low threshold (see SCORE CALIBRATION).
6-7 - Structurally sound path without fine-grained detail: real effort, honest communication about what's not working, willingness to end if things don't change — sufficient for this band.
3-4 - Unconditional staying without limits, vague "keep trying" with no structure, OR brittle exit logic without effort/communication/assess pattern.
1-2 - Exit immediately or unconditionally at minor difficulty; OR incoherent threshold; OR staying regardless of serious harm.

DISCRIMINATION: "I just keep trying / never give up" **without** self-awareness or limits → low. "I tend to hold on too long **but** I'm working on telling fear of conflict from real irrecoverability" → **7–8** (healthy metacognition), not 3–4.

UNIVERSAL PASSIVE SIGNAL RULE: Score a marker whenever it surfaces in any moment. Do not penalize absence unless that moment's primary targets included that marker and the user had a clear opportunity.

${SCORING_GUARDRAILS}

${SCORE_CALIBRATION_0_10}

ADDITIONAL ANCHORS (consistent with the calibration above; do not use these to force competent answers below 7):
- Rough guide for scores 1–6: severity of genuine failure on that marker when evidence of failure exists — e.g. thin empathy or incomplete repair where it mattered (not “average human” competence).
- 7 = solid demonstration for that marker in context — no material failure; may be brief if still clearly on-target.

EVIDENCE QUALITY HIERARCHY

1. Personal behavioral example with specifics: full range (subject to calibration).
2. First-person scenario response with specific words/actions: full range.
3. Vague scenario response ("just communicate"): cap that marker at 6 until specificity appears in the transcript — lack of demonstrated specificity is not the same as active contempt or defensiveness, but it is not yet full competency for that moment.
EXCEPTION — COMMITMENT_THRESHOLD: Do not apply this cap to commitment_threshold. A structurally complete threshold answer (invest, communicate, assess pattern, decide) can score 6–8+ without granular procedural detail; see commitment-threshold anchors above.

CROSS-MOMENT WEIGHTING: Do not average mechanically across moments. Weight strongest specific evidence; note inconsistency in notableInconsistencies when high in one moment and low in another for the same marker.

Example: Strong bilateral repair in Scenario A, one-sided blame in Scenario B → repair might be 7 with inconsistency noted — not a flat average of 5.

CLARIFICATION-ONLY: Unprompted insights count more than dragged-out answers (consistent with **REPAIR & ACCOUNTABILITY — UNPROMPTED VS. PROMPTED** for repair/accountability in scenarios — not a substitute for that block).

GENERIC RESPONSE PENALTY: If user stayed generic after clarification for a moment, cap markers primarily informed by that moment at 5 and note in keyEvidence.
EXCEPTION FOR APPRECIATION: Do not apply this cap when the described act is concise but clearly attuned and relationally specific; concise-but-clear appreciation can still score high.
EXCEPTION FOR COMMITMENT_THRESHOLD: Do not cap commitment_threshold at 5 solely for "generic" wording when the answer still expresses a complete invest / communicate / assess / decide structure; apply the commitment-threshold anchors instead.

─────────────────────────────────────────
COMMUNICATION QUALITY (separate from the eight markers)
─────────────────────────────────────────
Score four dimensions 0–10 and communicationSummary as before. Use the same human-ceiling calibration as the eight markers above.

REPAIR COHERENCE: If diagnosed failure reappears in their repair attempt, lower accountability (and ownership language in communication quality) by 1–2 points.

DIAGNOSTIC EMPHASIS:
- Scenario A: contempt in Emma's lines; bilateral ownership; Ryan repair. For **repair** and **accountability** holistically, apply **REPAIR & ACCOUNTABILITY — UNPROMPTED VS. PROMPTED** across the Scenario A turns (unprompted vs repair-as-Ryan). Per-scenario slice scoring uses the same 10 = real-human ceiling and slice-independence rules as scenario JSON scoring — strong demand-withdraw / power-bid / implicit-priority mentalizing and pattern-level, behavioral Ryan repair can reach **10** when complete; do not cap Scenario A at 9 to leave room for later scenarios.
- Scenario B: attunement to James redirecting Sarah's tears vs receiving her emotion; James leading with logistics vs emotional presence; appreciation (honoring Sarah vs transactional celebration). For **repair** and **accountability**, weight unprompted vs repair-as-James per **REPAIR & ACCOUNTABILITY — UNPROMPTED VS. PROMPTED**. See SCENARIO B anchors below.
- Scenario C: regulation, Daniel's return, Sophie's legitimacy; bilateral repair; commitment threshold (especially if they address when the relationship may no longer be workable). For **repair** and **accountability**, weight pre–repair-prompt vs post–repair-prompt per **REPAIR & ACCOUNTABILITY — UNPROMPTED VS. PROMPTED**; commitment_threshold uses its own rules.

${SCENARIO_B_ATTUNEMENT_APPRECIATION_ANCHORS}
- Personal grudge moment: contempt + metacognition + commitment threshold when they distinguish work-through vs walk-away conditions.

Your entire reply must be one JSON object only. Do not write an introduction, preamble, or explanation (for example do not start with "Looking at", "Here is", or analysis before the JSON). The first non-whitespace character of your message must be {.

Return ONLY valid JSON. Keys for pillarScores, keyEvidence, and pillarConfidence must be exactly: mentalizing, accountability, contempt, repair, regulation, attunement, appreciation, commitment_threshold.

{
  "pillarScores": { "mentalizing": 0, "accountability": 0, "contempt": 0, "repair": 0, "regulation": 0, "attunement": 0, "appreciation": 0, "commitment_threshold": 0 },
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
  "skepticismModifier": { "pillarId": null, "adjustment": 0, "reason": "n/a — legacy field" }
}

pillarConfidence: per marker; apply SCORING_CONFIDENCE_INSTRUCTIONS and the commitment_threshold fictional-vs-personal rule above.

${SCORING_CONFIDENCE_INSTRUCTIONS}`;
}