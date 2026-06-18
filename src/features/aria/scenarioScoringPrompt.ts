import { SCENARIO_A_CONTEMPT_RECOGNITION_CALIBRATION } from './scenarioAContemptRecognitionCalibration';
import {
  CONTEMPT_EXPRESSION_SCORING_RUBRIC,
  CONTEMPT_TIER_BREAKDOWN_JSON_INSTRUCTION,
  CONTEMPT_TIER_BREAKDOWN_JSON_TEMPLATE,
} from './contemptExpressionScoringRubric';
import {
  BEHAVIORAL_VS_EMOTIONAL_INTERIOR_SCENARIO,
  ELABORATION_ABSENCE_SCORING_HEADER,
  ELABORATION_ABSENCE_SCENARIO_MARKERS,
} from './elaborationAbsencePenaltiesRubric';
import {
  FLOOR_AND_BONUS_SCORING_PHILOSOPHY,
  SCENARIO_MENTALIZING_CONTEMPT_FLOOR_CLARIFICATIONS,
  SCORING_CONFIDENCE_INSTRUCTIONS,
} from './holisticScoringPrompt';
import {
  ACCOUNTABILITY_BLAME_SHIFT_VS_CLARITY_REQUEST,
  REPAIR_AND_ACCOUNTABILITY_UNPROMPTED_VS_PROMPTED_WEIGHTING,
  REPAIR_CONDITIONAL_AND_PROMPTED_SCORING,
  SCENARIO_A_APPRECIATION_ANCHORS,
  SCENARIO_B_ATTUNEMENT_APPRECIATION_ANCHORS,
  SCORE_CALIBRATION_0_10,
} from './interviewScoringCalibration';
import {
  SCENARIO_C_SOPHIE_PERSPECTIVE_PROBE,
  transcriptContainsScenarioCSophiePerspectiveProbe,
} from './interviewDisengagementProbes';
import { MENTALIZING_OVERCERTAINTY_SCORING_INSTRUCTION } from './personalMomentScoringPrompt';
import {
  extractScenario3UserCorpusAfterLastRepairPrompt,
  extractScenario3UserCorpusBeforeRepairPrompt,
  sliceTranscriptForScenario3Scoring,
  type ScenarioCorpusMessageSlice,
} from './probeAndScoringUtils';
import { MENTALIZING_INFERENCE_SOURCE_CALIBRATION } from './scenarioInferenceSourceCalibration';
export function buildScenarioScoringPrompt(
  scenarioNumber: 1 | 2 | 3,
  transcript: Array<{ role: string; content: string; scenarioNumber?: number }>,
  priorScenarioMentalizing?: { s1?: number; s2?: number } | null,
  scenario3RepairFocusAnswer?: string | null,
): string {
  const scenarioMeta = {
    1: {
      name: 'Scenario A (Emma/Ryan)',
      constructs:
        'mentalizing, accountability, contempt_recognition, contempt_expression, repair, attunement, appreciation (score only these keys in this scenario JSON; contempt is split: recognition = identifying contemptuous dynamics in the vignette; expression = participant’s own framing of others per the CONTEMPT_EXPRESSION rubric in this prompt)',
      markerIds: [
        'mentalizing',
        'accountability',
        'contempt_recognition',
        'contempt_expression',
        'repair',
        'attunement',
        'appreciation',
      ] as const,
    },
    2: {
      name: 'Scenario B (Sarah/James)',
      constructs:
        'appreciation, attunement, mentalizing, repair, accountability, contempt_expression (per CONTEMPT_EXPRESSION rubric; omit contempt_recognition here)',
      markerIds: [
        'appreciation',
        'attunement',
        'mentalizing',
        'repair',
        'accountability',
        'contempt_expression',
      ] as const,
    },
    3: {
      name: 'Scenario C (Sophie/Daniel)',
      constructs:
        'regulation, repair, mentalizing, attunement, accountability, contempt_expression',
      markerIds: [
        'regulation',
        'repair',
        'mentalizing',
        'attunement',
        'accountability',
        'contempt_expression',
      ] as const,
    },
  }[scenarioNumber];

  const transcriptForScenarioSlice =
    scenarioNumber === 3 ? sliceTranscriptForScenario3Scoring(transcript) : transcript;
  const taggedSlice = transcriptForScenarioSlice.filter(
    (m) => typeof m.scenarioNumber === 'number' && m.scenarioNumber === scenarioNumber
  );
  const scoringSlice = taggedSlice.length >= 2 ? taggedSlice : transcriptForScenarioSlice;
  const turns = scoringSlice
    .map((m) => `${m.role === 'user' ? 'User' : 'Interviewer'}: ${m.content}`)
    .join('\n\n');
  const ids = [...scenarioMeta.markerIds];
  const scenario3Corpus = transcriptForScenarioSlice as ScenarioCorpusMessageSlice[];
  const scenario3BeforeRepairExcerpt = extractScenario3UserCorpusBeforeRepairPrompt(scenario3Corpus);
  const scenario3AfterRepairExcerpt =
    scenario3RepairFocusAnswer?.trim() ||
    extractScenario3UserCorpusAfterLastRepairPrompt(scenario3Corpus);
  const scenario3RepairAccountabilityEvidenceBlock =
    scenarioNumber === 3 && (scenario3BeforeRepairExcerpt.trim() || scenario3AfterRepairExcerpt.trim())
      ? `
SCENARIO C — REPAIR & ACCOUNTABILITY EVIDENCE (use with REPAIR & ACCOUNTABILITY — UNPROMPTED VS. PROMPTED above):
- **Unprompted excerpt** (primary signal for repair & accountability in this slice — typically Q1 and prior user turns before the general repair prompt):
"""${scenario3BeforeRepairExcerpt.trim() || '(none)'}"""
- **Prompted excerpt** (supplementary — answer after "How do you think this situation could be repaired?" or equivalent):
"""${scenario3AfterRepairExcerpt.trim() || '(none)'}"""
Score **repair** and **accountability** using the ~70% / ~30% unprompted/prompted weighting; tag **keyEvidence** as unprompted / prompted / both.
`
      : '';
  const scenario3RepairIsolationCalibration =
    scenarioNumber === 3
      ? `
Scenario C — REPAIR (this slice does not score commitment_threshold):
- Apply **REPAIR & ACCOUNTABILITY — UNPROMPTED VS. PROMPTED** when scoring **repair** and **accountability** (combine unprompted + prompted excerpts per weighting; see Scenario C evidence block when present). Pure exit or "not worth fixing" framing without constructive repair moves keeps **repair** in a **3–5** range when the prompted repair answer lacks workable bilateral content.
`
      : '';
  const scenario1ContemptCalibration =
    scenarioNumber === 1
      ? SCENARIO_A_CONTEMPT_RECOGNITION_CALIBRATION
      : '';
  const scenario1AppreciationCalibration =
    scenarioNumber === 1
      ? `
${SCENARIO_A_APPRECIATION_ANCHORS}
`
      : '';
  const scenario1MentalizingRepairCeiling =
    scenarioNumber === 1
      ? `
Scenario A (Emma/Ryan) — MENTALIZING & REPAIR: REAL-HUMAN 10 CEILING (this slice only):

Re-read SCORE CALIBRATION above: **10** = best a thoughtful real person could reasonably do here, with **no material gap**; **slice independence** — never cap this scenario lower because Scenario B or C might later look “even richer” in another transcript slice you are not scoring now.

MENTALIZING — examples of **complete** inference (when accurate to the vignette and prompts), not an exhaustive list:
- Naming an interactional pattern (e.g. demand–withdraw) that fits Emma/Ryan’s exchange.
- Reading contempt or harshness as functioning as a **bid for power or control** after **feeling powerless** (or an equivalent accurate relational read).
- Surfacing an **implicit or unspoken agreement about priorities** that was never openly negotiated, when the participant grounds it in the scenario.

When that level of inference is **accurate** and **sufficient for the moment** and you **cannot** name a meaningful perspective-taking omission, assign **10**. Use **9** only if you can state a **concrete minor gap**. **Do not** systematically assign **9** for “strong Scenario A” to reserve **10** for later scenarios — **forbidden**.

REPAIR (as Ryan) — apply **REPAIR & ACCOUNTABILITY — UNPROMPTED VS. PROMPTED** for **repair** and **accountability** in this slice (unprompted ≈ Q1 / pre–repair-as-Ryan; prompted ≈ repair-as-Ryan). Examples of **ceiling-level** repair (when actually present in the user’s words), not a checklist:
- Owning not only the **incident** (e.g. the phone call) but the **pattern** it represents, with a **specific behavioral** commitment (not vague intent alone).
- **Correct sequencing** when present in the answer: e.g. clear ownership of Ryan’s part **before** or alongside addressing how Emma’s contempt or dismissal landed — without using that ordering as a pretext to score down when the answer already satisfies bilateral repair at ceiling.

When repair is **bilateral where appropriate**, **pattern-aware**, **behaviorally specific**, and **not** primarily deflected onto Emma’s failings (see Scenario A repair calibration below), assign **9–10**; **10** when there is **no meaningful omission** for this prompt. **Do not** withhold **10** because a hypothetical “even better” repair could exist or because Scenario B’s James repair might be longer.

**Forbidden:** Applying a standing one-point penalty to Scenario A mentalizing or repair relative to Scenario B/C, or capping at **9** to “leave room” on the scale across the interview.
`
      : '';
  const scenario2AccountabilityCalibration =
    scenarioNumber === 2
      ? `
Scenario B (Sarah/James) — ACCOUNTABILITY & REPAIR (unprompted vs. prompted):
- For **repair** and **accountability**, apply **REPAIR & ACCOUNTABILITY — UNPROMPTED VS. PROMPTED**: unprompted = user turn(s) **before** the "if you were James, how would you repair" (or equivalent) prompt; prompted = repair-as-James. Weight unprompted ~70%; tag keyEvidence. Other markers in this slice use the full transcript as usual.

Scenario B (Sarah/James) — ACCOUNTABILITY CEILING (repair as James and comparable ownership turns in this slice):

NAMED CALIBRATION — **OWNERSHIP + "BUT I ALSO NEED THEM"** (accountability **6–7 maximum**; **not 8–10**):
When the user shows **genuine ownership** or care in an apology **and then** uses **"but I also need them to…"**, **"but I need Sarah to…"**, **"but they need to…"**, or **functionally equivalent** wording that **shifts responsibility back to the partner** right after the apology (making the partner's future behavior the hinge), treat that as **meaningful deflection**. **Cap accountability at 6–7.** **8+** requires **clean ownership without** that partner-conditional pivot.

Example (**6–7, not 8**): "I would tell Sarah I'm sorry she felt unappreciated — that wasn't my intention at all. I'd explain that I was asking about the practical stuff because I care about her future... but I also need her to be clearer with me about what she's looking for."

Contrast (often still **8+** when otherwise clean): ownership followed by a **specific information ask** so the user can follow through ("what would appreciation look like for you?") — see ACCOUNTABILITY — BLAME-SHIFT VS. GENUINE REQUEST FOR CLARITY.
`
      : '';
  const scenario2ContemptExpressionCalibration =
    scenarioNumber === 2
      ? `
Scenario B (Sarah/James) — CONTEMPT_EXPRESSION (this slice):
Apply the **CONTEMPT_EXPRESSION** rubric (Tier 1 observation → Tier 2 blame → Tier 3 character attack) **including Tier 2 and Tier 3 prominence** (centrality, proportion, conviction) and **tier_2_adjusted_score** / **tier_3_adjusted_score** — peripheral hedged Tier 2 or throwaway speculative Tier 3 must **not** dominate an otherwise Tier 1–anchored answer. Judge how the participant talks in their own voice about Sarah, James, or the situation. Fiction is not a free pass to **Tier 3 / character demolition** (idiot, loser, “what a piece of @#!,” toxic-person-as-verdict). **Tier 1** analytical observations of behavior must **not** produce low pillar scores. **Tier 2** blame-without-character-attack supports mid pillar scores; **high-adjusted Tier 3** drives low bands. Keep this key separate from appreciation, repair, and accountability.
`
      : '';
  const scenario2AttunementAppreciationCalibration =
    scenarioNumber === 2
      ? `
${SCENARIO_B_ATTUNEMENT_APPRECIATION_ANCHORS}
`
      : '';
  const scenario3ContemptExpressionCalibration =
    scenarioNumber === 3
      ? `
Scenario C (Sophie/Daniel) — CONTEMPT_EXPRESSION (this slice):
Apply the **CONTEMPT_EXPRESSION** tier rubric **with Tier 2 and Tier 3 proportionality** (log all Tier 2/Tier 3 clauses; weight **tier_2_adjusted_score** and **tier_3_adjusted_score**). **Tier 1:** behavior-bound critique (avoidant *here*, inconsiderate *in that moment*) — not pillar contempt. **Tier 2:** fault/blame on choices without character demolition. **Tier 3:** global person derogation, hostile clinical labels, mockery, profanity — **high-centrality Tier 3** caps how high the pillar can go. Distinct from mentalizing quality alone.
`
      : '';
  const scenario3MentalizingCalibration =
    scenarioNumber === 3
      ? `
Scenario C mentalizing calibration:
- Accurately noting an obvious on-vignette dynamic (e.g. Daniel acknowledging a communication problem or taking partial responsibility for avoidance) is competent basic perspective-taking: **5–6** when that is **all** the answer offers.
- **CALIBRATION PRESERVATION (Scenario C):** Do not compress toward 5–6 when the user infers **emotional interior** — discomfort, shame, flooding, fear of confrontation, difficulty being authentic under pressure, or why conflict feels unsafe — even in analytical/clinical register. That is **Level 2** mentalizing and should score **7–8** for this slice when accurate (see Q1 block below).
- Reserve 9–10 only when mentalizing in this answer is markedly richer than solid Level 2 interior inference.

SCENARIO C Q1 MENTALIZING CALIBRATION (Q1-specific — "what do you make of that" re Daniel's "I didn't know what to say"):

The Q1 question asks specifically about Daniel's statement "I didn't know what to say." It does not ask about Sophie's experience. Evaluate mentalizing on Q1 responses as follows:

WHAT TO SCORE ON Q1:
- Mentalizing is evaluated only on the user's inference about Daniel's internal state — what he is experiencing emotionally, why he doesn't know what to say, what is happening inside him that produces this behavior.
- A response that accurately describes Daniel's internal experience (feeling put on the spot, not knowing how to face emotional confrontation, processing difficulty) is demonstrating genuine mentalizing even if it stays focused on Daniel only.
- Do NOT penalize the user for not volunteering Sophie's experience in response to Q1. The question did not ask about Sophie.

LEVEL DEFINITIONS FOR Q1:
- Level 1 (scores 5–6): User describes Daniel's **behavioral logistics only** — he needed time, he walked away, he returned later — with **no** inference about emotional interior, discomfort, or internal conflict.
- Level 2 (scores 7–8): User infers Daniel's **emotional interior** — discomfort with emotional confrontation, fear of saying the wrong thing, avoidance of authentic feeling, people-pleasing under pressure, shame/flooding, or internal conflict about facing Sophie. **Analytical/clinical wording counts** when the inference is accurate (e.g. "he focuses on what he thinks she wants to hear rather than what he feels," "he's trying to avoid the emotional weight of the conversation").
- Level 3 (scores 9–10): Rich bilateral or pattern-level inference beyond solid Level 2 (Sophie's experience volunteered unprompted **plus** nuanced read of Daniel's inner state, or sophisticated linkage to recurring relational pattern with clear interior states for both).

SOPHIE BONUS:
If the user volunteers inference about Sophie's emotional experience (what this pattern has been like for her, what she is feeling while waiting, what the recurring dynamic means for her) without being asked, treat this as additional mentalizing evidence that supports a higher score. It is not required for a high Q1 score and should not reduce the score if absent.

FLOOR ADJUSTMENT:
A response that accurately describes Daniel's behavioral motivation at Level 1 should score no lower than 5 for Q1 mentalizing. The floor of 4 (below average) is reserved for responses that restate the scenario without any inference about Daniel's internal state or motivation — e.g. "he came back and said he was ready" with no attempt to explain why he didn't know what to say.
`
      : '';
  const scenario3AttunementFloorCalibration =
    scenarioNumber === 3
      ? `
SCENARIO C ATTUNEMENT FLOOR:
Q1 asks specifically about Daniel. Attunement for Q1 is evaluated on whether the user recognized Daniel's emotional state. Not mentioning Sophie's experience in response to Q1 is not a penalty.

Score no lower than 5 when the user correctly identified Daniel's emotional state in their Q1 response.
Score 4 only when the user showed no emotional recognition of Daniel — treating his behavior as purely logistical with no acknowledgment of an emotional dimension.
Score 7+ only when the user described the emotional experience of both characters or the recurring pattern without being specifically asked.
`
      : '';
  const scenario3SophiePerspectiveProbeScoringNote =
    scenarioNumber === 3 && transcriptContainsScenarioCSophiePerspectiveProbe(transcriptForScenarioSlice)
      ? `
SCENARIO C — SOPHIE PERSPECTIVE PROBE (prompted mentalizing):
If SCENARIO_C_SOPHIE_PERSPECTIVE_PROBE ("${SCENARIO_C_SOPHIE_PERSPECTIVE_PROBE}") fired and the user responded with genuine inference about Sophie's emotional experience, treat this as **moderate prompted mentalizing evidence**. It supports scores in the **6–7** range for mentalizing when combined with solid Daniel-focused Q1 responses. It does **not** by itself justify scores above **7** — unprompted Sophie-perspective volunteering supports scores of **8+**.
`
      : '';
  const priorM1 = priorScenarioMentalizing?.s1;
  const priorM2 = priorScenarioMentalizing?.s2;
  const scenario3MentalizingInterviewPatternCalibration =
    scenarioNumber === 3 &&
    priorScenarioMentalizing &&
    ((priorM1 != null && Number.isFinite(priorM1) && priorM1 < 4) ||
      (priorM2 != null && Number.isFinite(priorM2) && priorM2 < 4))
      ? `
Scenario C mentalizing — interview pattern calibration:
Prior mentalizing scores in this same interview: Scenario 1 = ${priorM1 != null && Number.isFinite(priorM1) ? priorM1.toFixed(1) : 'n/a'}, Scenario 2 = ${priorM2 != null && Number.isFinite(priorM2) ? priorM2.toFixed(1) : 'n/a'}.
Earlier scenario(s) showed limited mentalizing. Do not assign Scenario C mentalizing 7+ for a single balanced observation that merely labels what the vignette made visible (e.g. "Daniel is acknowledging they have a communication problem") without clearly stronger perspective-taking. In that pattern, 5-6 is appropriate for that level of evidence. Reserve 7+ only if this answer demonstrates a clear step up in sophistication versus those prior moments.
`
      : '';

  return `You are scoring a single scenario from a relationship assessment interview.

SCENARIO: ${scenarioMeta.name}
MARKERS TO SCORE IN THIS SLICE: ${scenarioMeta.constructs}

${SCORE_CALIBRATION_0_10}
${FLOOR_AND_BONUS_SCORING_PHILOSOPHY}
${SCENARIO_MENTALIZING_CONTEMPT_FLOOR_CLARIFICATIONS}
${CONTEMPT_EXPRESSION_SCORING_RUBRIC}

TRANSCRIPT OF THIS SCENARIO ONLY:
${turns}
${scenario3RepairAccountabilityEvidenceBlock}

SCORING INSTRUCTIONS:
Score only the listed markers, based only on this transcript slice.
For each marker: quote or paraphrase the response that most informed the score; behavioral > attitudinal.
GENERIC responses: cap at 5 for that marker.
${BEHAVIORAL_VS_EMOTIONAL_INTERIOR_SCENARIO}
${ELABORATION_ABSENCE_SCORING_HEADER}
${ELABORATION_ABSENCE_SCENARIO_MARKERS}

**This slice only:** Do not down-rank a marker here because another scenario in the same interview might show stronger evidence later, or to keep scores “spread out.” Each slice stands on its own.

${ACCOUNTABILITY_BLAME_SHIFT_VS_CLARITY_REQUEST}

${REPAIR_AND_ACCOUNTABILITY_UNPROMPTED_VS_PROMPTED_WEIGHTING}
${REPAIR_CONDITIONAL_AND_PROMPTED_SCORING}

MENTALIZING and CONTEMPT (where scored) — register-neutral: Judge perspective-taking quality and, for Scenario A, score **contempt_recognition** vs **contempt_expression** **separately** (see Scenario A block). **contempt_recognition** = identifying harsh or contemptuous **dynamics** in the vignette (in others) — unchanged. **contempt_expression** = *only* the **CONTEMPT_EXPRESSION** rubric above: do **not** treat ordinary moral or fairness language about harmful **actions** (rude, wrong, hurtful, disrespectful, “dishonoring *her in that moment*,” inconsiderate) as automatic **low (1–4)** participant expression. Do not down-score formal language when the inference is accurate for mentalizing; **contempt_expression** is about the participant’s **stance** toward *people* in the slice, not about accuracy of vignette reads.

${MENTALIZING_INFERENCE_SOURCE_CALIBRATION}

${MENTALIZING_OVERCERTAINTY_SCORING_INSTRUCTION}

REPAIR COHERENCE: If repair attempt repeats the failure they diagnosed, lower accountability 1-2 points.
Scenario A repair calibration:
- For **repair** and **accountability**, apply **REPAIR & ACCOUNTABILITY — UNPROMPTED VS. PROMPTED**: unprompted = user turn(s) before the repair-as-Ryan prompt; prompted = the "if you were Ryan … repair" answer. Tag keyEvidence. For **repair** only, also apply **REPAIR — CONDITIONAL LANGUAGE, DIRECTIONALITY, AND PROMPTED FLOORS** (directionality: self-owning "if" vs blame-redirect).
- If the repair answer **redirects fault to Emma** (e.g. "Emma needs to communicate better" as the main move, or **"I would apologize if she had just been clearer"** in a way that makes her the problem), score **repair** in the 4-5 range. **Do not** use **"if she doesn't communicate it well"**-style **conditionals alone** as deflection: if the clause **leads into** the respondent’s **own** limits, learning, and ownership (see directionality block), that can support **6+** and often **7–8** for **repair** on the prompted turn.
- Reserve 6+ for answers that keep Ryan’s contribution and repair move **central** (including humbly naming **one’s own** listening/understanding limits with **her** in the room).
- Reserve 9-10 for strong repair with explicit ownership and no **blame-redirecting** conditional (per directionality), not 9-10 for mere absence of the word "if."
${scenario1ContemptCalibration}
${scenario1AppreciationCalibration}
${scenario1MentalizingRepairCeiling}
${scenario2AccountabilityCalibration}
${scenario2ContemptExpressionCalibration}
${scenario2AttunementAppreciationCalibration}
${scenario3ContemptExpressionCalibration}
${scenario3AttunementFloorCalibration}
${scenario3RepairIsolationCalibration}
${scenario3MentalizingCalibration}
${scenario3SophiePerspectiveProbeScoringNote}
${scenario3MentalizingInterviewPatternCalibration}

CONFIDENCE: high / moderate / low per scored marker.
${SCORING_CONFIDENCE_INSTRUCTIONS}

${CONTEMPT_TIER_BREAKDOWN_JSON_INSTRUCTION}

OUTPUT CONTRACT (STRICT):
- Respond with exactly one top-level JSON object.
- Response must start with "{" and end with "}".
- Do not include markdown fences, prose, analysis text, or comments.
- Do not wrap output under alternate keys like "scorecard", "scores", "result", or "data".
- Use exactly these top-level keys: scenarioNumber, scenarioName, pillarScores, pillarConfidence, keyEvidence, mentalizing_inference_source, mentalizing_overcertainty, contempt_tier_breakdown, specificity, repairCoherenceIssue. Optional: scoringMetadata (object) — if present, mentalizing_overcertainty may be duplicated inside scoringMetadata instead of top-level; prefer top-level + boolean.
- Include every marker in pillarScores/pillarConfidence/keyEvidence for this scenario.
- Include \`mentalizing_inference_source\` as exactly one of: "scenario_restatement", "surface_addition", "independent_inference".
- Include boolean \`mentalizing_overcertainty\` (true or false) per the MENTALIZING OVERCERTAINTY instructions above (top-level required; duplicate under \`keyEvidence\` or \`scoringMetadata\` optional if present).

Return ONLY valid JSON:
{
  "scenarioNumber": ${scenarioNumber},
  "scenarioName": "${scenarioMeta.name}",
  "pillarScores": { ${ids.map((id) => `"${id}": 0`).join(', ')} },
  "pillarConfidence": { ${ids.map((id) => `"${id}": "high"`).join(', ')} },
  "keyEvidence": { ${ids.map((id) => `"${id}": ""`).join(', ')} },
  "mentalizing_inference_source": "scenario_restatement",
  "mentalizing_overcertainty": false,
  "contempt_tier_breakdown": ${CONTEMPT_TIER_BREAKDOWN_JSON_TEMPLATE},
  "specificity": "high",
  "repairCoherenceIssue": null
}`;
}