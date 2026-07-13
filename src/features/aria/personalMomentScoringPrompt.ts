import { ACCOUNTABILITY_BLAME_SHIFT_VS_CLARITY_REQUEST, SCORE_CALIBRATION_0_10 } from './interviewScoringCalibration';
import { MOMENT4_RESPONSE_CONCRETENESS_SCORING_INSTRUCTION } from './moment4ConcretenessClassification';
import { PERSONAL_MOMENT_EMOTIONAL_VOCAB_SCORING_INSTRUCTION } from './personalMomentEmotionalVocab';
import {
  ELABORATION_ABSENCE_MOMENT4_MARKERS,
  ELABORATION_ABSENCE_SCORING_HEADER,
  KEY_EVIDENCE_ANALYTICAL_NARRATIVE_RULES,
} from './elaborationAbsencePenaltiesRubric';
import {
  CONTEMPT_EXPRESSION_SCORING_RUBRIC,
  CONTEMPT_TIER_BREAKDOWN_JSON_INSTRUCTION,
  CONTEMPT_TIER_BREAKDOWN_JSON_TEMPLATE,
} from './contemptExpressionScoringRubric';
import { MOMENT_4_GRUDGE_QUESTION_TEXT } from './moment4ProbeLogic';
import { PILLAR_CONFIDENCE_METADATA_ONLY_RULES } from './holisticScoringPrompt';

/** Shared across scenario + personal moment prompts; JSON field \`mentalizing_overcertainty\` (boolean, top-level; \`keyEvidence\` or \`scoringMetadata\` mirrors accepted — see {@link coerceMentalizingOvercertaintyFromModelJson}). */
export const MENTALIZING_OVERCERTAINTY_SCORING_INSTRUCTION = `MENTALIZING OVERCERTAINTY FLAG

Set mentalizing_overcertainty: **true** when the user treats another person's inner world, fixed traits, or future behavior as **settled fact** (no hedging, no uncertainty, no "I could be wrong") — especially when the language mirrors **clinical verdicts**, **permanent character judgments**, or **mind-reading** phrased as certainty.

## CRITICAL — MUST-FIRE PHRASES AND PATTERNS (this slice)

If the user's words include **any** of the following (exact wording or obvious same-meaning paraphrase), you **must** set mentalizing_overcertainty to **true** unless they are explicitly framed as a tentative guess:

1. **"Ryan clearly doesn't care"** — including when followed by an object ("…about Emma / about her"). This is a definitive mind-read of caring vs not caring; **must** trigger the flag.
2. **"definitely emotionally unavailable"** — or the same idea with another name ("James is definitely emotionally unavailable"). **Must** trigger.
3. **"He's never going to change"** — especially paired with permanence / identity ("that is just who he is", "that's who she is"). **Must** trigger.
4. The pattern **"the type of person who"** + a global trait (e.g. "who processes everything analytically and can't be present emotionally", "who can't be present emotionally"). **Must** trigger when it reads as categorical typing, not a one-off behavior in one situation.

Additional high-signal patterns (also true unless clearly hedged):
- "He's conflict-avoidant and probably has avoiding attachment from childhood" — attachment / childhood etiology stated as fact.
- "He clearly doesn't want to have this conversation" / "She's never going to feel appreciated" — definitive reads of intent or immutable future.
- "She's being passive-aggressive" / "He's emotionally immature" — character verdicts as fact.

PATTERNS THAT MUST TRIGGER THE FLAG (recap):

Absolute character verdicts with no evidence beyond behavior:
- "Ryan clearly doesn't care" / "Ryan clearly doesn't care about Emma"
- "He's never going to change, this is just who he is"
- "She's being passive-aggressive"
- "He clearly doesn't want to have this conversation"

Definitive personality diagnoses stated as fact:
- "James is definitely emotionally unavailable"
- "He's the type of person who processes everything analytically and can't be present emotionally"
- "He's conflict-avoidant and probably has avoiding attachment from childhood"
- "She's anxiously attached"
- "He is emotionally immature"

Certainty about future behavior:
- "He'll never prioritize her"
- "This is always going to happen"
- "She's never going to feel appreciated"

Key markers: "clearly," "definitely," "obviously," "never," "always," "this is just who he is/she is," "the type of person who," diagnoses stated without hedging ("has avoidant attachment" vs "seems to have" or "might have").

PATTERNS THAT DO NOT TRIGGER THE FLAG:

Appropriately hedged inferences:
- "Ryan might be using the call to avoid tension"
- "Emma seems to have dealt with this pattern before"
- "It sounds like Daniel struggles to access language when flooded"
- "She may be feeling deprioritized"
- "This could be a sign of deeper resentment"

Evidence-grounded observations:
- "The fact that she says 'you've made that very clear' suggests this has happened before"
- "His leaving three times in a row indicates avoidance as a pattern"

The flag should fire when a user states internal states as facts rather than inferences. When the language matches any **MUST-FIRE** line above, **do not** return false to be "kind" — overcertainty is the instrument error mode we are measuring.

Output the required boolean as the top-level JSON key \`mentalizing_overcertainty\` (true or false). You may duplicate the boolean under \`keyEvidence.mentalizing_overcertainty\` or under \`scoringMetadata.mentalizing_overcertainty\` if your JSON layout uses a metadata object; all locations are read.

When mentalizing_overcertainty is true, the **mentalizing** pillar score for this slice must **not exceed 7** regardless of other evidence quality (mentalizing score must not exceed 7).`;

/** Coalesce model output for overcertainty from top-level, optional keyEvidence mirror, or scoringMetadata. */
export function coerceMentalizingOvercertaintyFromModelJson(parsed: {
  mentalizing_overcertainty?: unknown;
  keyEvidence?: Record<string, unknown> | null;
  scoringMetadata?: Record<string, unknown> | null;
}): boolean {
  const truthy = (raw: unknown): boolean => {
    if (raw === true) return true;
    if (typeof raw === 'string') {
      const t = raw.trim().toLowerCase();
      return t === 'true' || t === 'yes' || t === '1';
    }
    return false;
  };
  if (truthy(parsed.mentalizing_overcertainty)) return true;
  const ke = parsed.keyEvidence;
  if (ke && typeof ke === 'object' && !Array.isArray(ke)) {
    if (truthy((ke as Record<string, unknown>).mentalizing_overcertainty)) return true;
  }
  const sm = parsed.scoringMetadata;
  if (sm && typeof sm === 'object' && !Array.isArray(sm)) {
    if (truthy((sm as Record<string, unknown>).mentalizing_overcertainty)) return true;
  }
  return false;
}

const MOMENT_META = {
  name: 'Moment 4 (Personal Grudge/Dislike)',
  constructs:
    'contempt_recognition (only ongoing bitterness/hostility toward the real person named), contempt_expression, commitment_threshold, accountability, mentalizing — NOT repair, NOT attunement, NOT appreciation, NOT regulation',
  markerIds: [
    'contempt_recognition',
    'contempt_expression',
    'commitment_threshold',
    'accountability',
    'mentalizing',
  ] as const,
};

/** Optional client-side Moment 4 probe metadata (thin signal handling). */
export type Moment4ClientScoringMetadata = {
  clientSpecificityFollowUpAsked: boolean;
  /** True when answers stayed thin/generic after the one scripted specificity follow-up. */
  lowSpecificityAfterProbe: boolean;
};

/** Cap any single user turn so the Moment 4 scoring prompt stays within practical model context. */
export const MOMENT4_MAX_USER_TURN_CHARS_FOR_SCORING = 5000;

/**
 * Truncate long user turns before embedding in the Moment 4 scorer prompt (rubric + instructions are large).
 * Assistant turns are kept verbatim.
 */
export function truncateTranscriptTurnsForMoment4Scoring(
  transcript: { role: string; content: string }[],
): { role: string; content: string }[] {
  const suffix = '\n…[truncated for Moment 4 scoring context length]';
  return transcript.map((m) => {
    const content = typeof m.content === 'string' ? m.content : String(m.content ?? '');
    if (m.role !== 'user' || content.length <= MOMENT4_MAX_USER_TURN_CHARS_FOR_SCORING) {
      return { role: m.role, content };
    }
    return {
      role: m.role,
      content: `${content.slice(0, MOMENT4_MAX_USER_TURN_CHARS_FOR_SCORING)}${suffix}`,
    };
  });
}

export function buildPersonalMomentScoringPrompt(
  transcript: { role: string; content: string }[],
  moment4ClientMeta?: Moment4ClientScoringMetadata | null,
): string {
  const budgetedTurns = truncateTranscriptTurnsForMoment4Scoring(transcript);
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    let rawJsonLen = 0;
    let budgetedJsonLen = 0;
    try {
      rawJsonLen = JSON.stringify(transcript).length;
      budgetedJsonLen = JSON.stringify(budgetedTurns).length;
    } catch {
      rawJsonLen = -1;
      budgetedJsonLen = -1;
    }
    console.log('[M4 Debug] buildPersonalMomentScoringPrompt turns:', transcript?.length, 'hasMeta:', !!moment4ClientMeta);
    console.log('[M4 Debug] moment4Turns count (input):', transcript?.length ?? 0);
    console.log('[M4 Debug] total transcript JSON length (input):', rawJsonLen);
    console.log(
      '[M4 Debug] budgeted turns count / JSON length:',
      budgetedTurns.length,
      budgetedJsonLen,
    );
  }
  const ids = [...MOMENT_META.markerIds];
  const turns = budgetedTurns
    .map((m) => `${m.role === 'user' ? 'User' : 'Interviewer'}: ${m.content}`)
    .join('\n\n');
  const specificityProbeCalibration =
    moment4ClientMeta?.clientSpecificityFollowUpAsked === true
      ? `\nCLIENT METADATA — SPECIFICITY FOLLOW-UP (truth for scoring):\nThe interviewer **already** delivered **one** scripted follow-up inviting a concrete personal situation (thin signal is **not** because no probe was offered).\n${
          moment4ClientMeta.lowSpecificityAfterProbe
            ? 'After that follow-up, the participant\'s content was **still** thin or generic — treat low specificity / sparse evidence as **reflecting their answers**, not missing interviewer scaffolding.'
            : 'Use the full transcript (including the follow-up exchange) normally; the follow-up is context, not a score boost.'
        }\n`
      : '';

  const momentSpecificCalibration = `
MOMENT 4 — VALID NON-APPLICABLE (coherent absence of grudges):
When the user states they do not hold grudges (or have no one who got under their skin) AND provides coherent personal reasoning — growth, boundaries, forgiveness practice, resolved past patterns, energy/capacity, quality-over-quantity friendships, etc. — WITHOUT naming a specific person or describing a specific episodic event, set response_concreteness to **valid_non_applicable**. This is informative about whether they hold onto grudges; it is NOT bypass or deflection.
- Score **mentalizing** and **accountability** from the quality of self-reflection present (e.g. connecting past grudge patterns to childhood trauma, trust, or personal growth can support scores of 7–8 when evidence is substantive — as with any engaged answer).
- Do NOT set all markers to null solely because no specific grudge example was given when valid_non_applicable applies.
- Reserve JSON null markers for **absent** — genuine non-engagement, single-word answers, or circular philosophical restatement with no personal reasoning.

MOMENT 4 — NON-ENGAGEMENT / DEFLECTION (entire moment):
If the user does not substantively engage with the grudge/dislike question — topic switching, philosophical deflection without personal reasoning, vague non-answers with no real person or situation, single-word replies, or other absence of signal — set EVERY listed marker in pillarScores to JSON null (not 0, not 1). Use the SAME keyEvidence string for all markers: "No substantive engagement with grudge/dislike question in this slice — deflection, avoidance, or absent signal." Set pillarConfidence to "low" for each. Set response_concreteness to **absent**. Numeric scores apply only when there is assessable content (including valid_non_applicable).

MOMENT 4 — SCORE 1 ONLY FOR ACTIVE FAILURE (when there IS engagement):
Reserve score 1 for active construct failure: e.g. unreflective contempt expression, explicit refusal of any responsibility, or hostile framing. Do NOT use 1 for mere absence of signal — that is null as above.

MOMENT 4 — CONSTRUCT SCOPE (this slice only):
- **repair:** Do not score. Set \`repair\` to JSON null if present in your template keys, or omit it — this moment does not assess live repair skill.
- **contempt_recognition:** Score ONLY if the user shows ongoing bitterness, hostility, or contemptuous narrative toward the real person they named (not generic conflict description). If there is no assessable signal for that specific recognition strand, use JSON null with keyEvidence noting it was not assessed.
- **contempt_expression:** (Real person, not a vignette — but same **CONTEMPT_EXPRESSION** scale as scenarios.)${CONTEMPT_EXPRESSION_SCORING_RUBRIC}
  In this moment, chronic "I can’t win" / global blame **without** reflective ownership may sit in the mid/lower **expression** range when it functions as a contemptuous narrative; that is separate from **fair** moral language about the other’s **concrete** harmful **actions** (not automatically low 1–4 per the rubric).
- **attunement:** Do not score. Omit or null — the grudge prompt does not test real-time attunement to another's emotional state.
- **regulation:** Do not score. Omit or null — regulation is assessed only from Scenario C (pursue-withdraw).

M4 QUESTION DESIGN AND SCORING CALIBRATION

The M4 question is now episodically anchored: "${MOMENT_4_GRUDGE_QUESTION_TEXT}"

The question explicitly asks for a specific person and what happened. This changes the baseline expectation for responses:

CONCRETE RESPONSE (adequate baseline for concreteness metadata):
User describes a specific person or situation — even minimally. Names or refers to someone specific, describes what the difficulty was, and indicates current state of the relationship or their feelings about it. This establishes episodic concreteness; it does **not** by itself require numeric scores on mentalizing or accountability when inner-state content is still too thin to assess.

LOW CONCRETENESS / UNASSESSED INNER-STATE MARKERS (mentalizing, accountability, contempt_recognition):
When disclosure is **low-concreteness** (no real personal conflict named, or conflict too thin to assess inner states), set **mentalizing** and **accountability** to JSON **null** — not 4–5. Null means unassessable and excludes those markers from rollup. Do **not** apply a low-specificity floor score.

Assessability requires a named/referenced specific person **and** enough emotional/inner-state narrative to infer the user's or the other's inner state. A gaming misunderstanding resolved amicably without meaningful inner-state content: **mentalizing** and **accountability** = **null**.

PHILOSOPHICAL BYPASS (below baseline):
User responds with general reflections about grudges, forgiveness, or people in general without anchoring to a specific person or situation — e.g. "I've learned that people don't always have the same heart as you" with no specific person mentioned. Set **mentalizing** and **accountability** to JSON **null** unless valid_non_applicable applies. **Commitment_threshold** may still be scored when threshold framework language is present.

PARTIAL EPISODIC (thin but named):
User names a person or situation vaguely ("a friend," "someone at work," "this one guy") with minimal narrative texture. Score **contempt_expression** and **commitment_threshold** when assessable. Set **mentalizing** and **accountability** to **null** unless the answer includes assessable inner-state content (emotional processing, perspective-taking, or ownership), not logistics-only resolution.

CONCRETENESS CEILING:
Scores of 7+ on mentalizing and accountability require genuine emotional depth — the user described their own emotional experience in the situation, what it meant to them, or what they learned about themselves. A concrete but emotionally flat narrative should use **null** on mentalizing/accountability when unassessable, not 4–6 floor scores.

MOMENT 4 CALIBRATION ANCHORS (when engagement exists — apply M4 QUESTION DESIGN above):
${ACCOUNTABILITY_BLAME_SHIFT_VS_CLARITY_REQUEST}

${MENTALIZING_OVERCERTAINTY_SCORING_INSTRUCTION}

${MOMENT4_RESPONSE_CONCRETENESS_SCORING_INSTRUCTION}

${PERSONAL_MOMENT_EMOTIONAL_VOCAB_SCORING_INSTRUCTION}

RESOLUTION ORIENTATION / "MOVED ON" HANDLING:
Do not treat "I moved on", "I don't think about them anymore", "I don't think about it", or similar phrases as standalone evidence of resolution orientation or its absence. These phrases are ambiguous: they can indicate genuine emotional release or suppression of unresolved hostility depending on context.

Treat resolution orientation as present when "I moved on" / "I don't think about it" is accompanied by any surrounding evidence of:
- Understanding why the other person acted as they did.
- Empathy or perspective-taking about the other person's situation.
- Personal growth or learning from the experience.
- Matter-of-fact, non-bitter tone throughout the response.

Treat resolution orientation as absent when "I moved on" / "I don't think about it" is the primary or only statement about where the user is now, with no surrounding evidence of processing, understanding, or growth. The phrase alone is insufficient evidence of genuine release.

If the surrounding tone is dismissive, contemptuous, or frames the other person as entirely at fault with no curiosity, treat "I moved on" as consistent with unresolved hostility regardless of the phrasing.

Other resolution-orientation indicators remain direct evidence when present: explicit forgiveness, perspective-taking, acknowledgment of personal growth, or ongoing relationship survival. Do not include "neutral acceptance without ongoing hostility" as a standalone indicator.

COMMITMENT_THRESHOLD (Moment 4 — first-person):
- **Low scores (about 2–4):** Unconditional persistence, "I never walk away," "just keep trying no matter what," or no workable invest/communicate/assess/decide structure — **without** reflective limits or self-critique.
- **7 (single internal exit marker):** One concrete, personally anchored internal shift as a threshold signal — e.g. switching from looking forward to meeting their partner every day to dreading the next time they would have to see them — scores **7** without requiring an explicit invest→communicate step. Do **not** score **6** solely because a communicate step was omitted when this marker is present.
- **7–8 (positive, not a deficit):** The user admits tending to **stay too long** or struggling to leave **and** shows **differentiation** — e.g. working on recognizing **genuine irrecoverability** vs **fear of conflict** / avoidance, or growth-oriented framing of past over-staying. That is **self-knowledge and developing capacity**; **do not** score as unhealthy commitment threshold or conflate with "no limits" staying.

COMMITMENT_THRESHOLD CONFIDENCE (this moment slice):
Reserve "high" pillarConfidence for commitment_threshold when this slice includes clear first-person work-through versus walk-away reasoning (from the follow-up or embedded in the grudge answer) — including a concise but complete invest/communicate/assess/decide structure without procedural detail, **or** clear self-aware differentiation as in the 7–8 anchor above. If threshold signal is absent or purely vague ("just try harder"), use "moderate" or "low".

MOMENT 4 — SITUATIONAL ACCOUNTABILITY EXEMPTION (metadata flag):
When the disclosure describes a situation where the **other party's behavior is the primary or overwhelming cause** of the conflict — e.g. abuse or significant harm, abandonment/neglect/co-parenting failure, described narcissistic or personality-disordered behavior, severe betrayal (infidelity, financial fraud, deliberate cruelty), or the user appropriately frames no-contact/walking away as resolution **given what they described** — low **accountability** in this slice may reflect **accurate judgment**, not low construct capacity.
- Set \`scoringMetadata.moment_4_accountability_situationally_exempt\` to **true** and a one-line \`scoringMetadata.moment_4_accountability_situationally_exempt_reason\` (e.g. "M4 disclosure involves co-parenting abandonment — accountability absence is situationally appropriate").
- Do **not** inflate accountability solely because the user stayed in the injured-party position when that position matches the facts they described.
- Do **not** set this flag for genuinely mutual or ambiguous conflicts where self-attribution would be expected.
`;
  const prompt = `You are scoring one personal moment from a relationship assessment interview.

MOMENT: ${MOMENT_META.name}
MARKERS TO SCORE IN THIS SLICE: ${MOMENT_META.constructs}

${SCORE_CALIBRATION_0_10}
${CONTEMPT_EXPRESSION_SCORING_RUBRIC}

TRANSCRIPT OF THIS MOMENT ONLY:
${turns}

SCORING INSTRUCTIONS:
Score only the listed markers using only this moment transcript slice.
If responses are generic and unspecific, cap that marker at 5.
${KEY_EVIDENCE_ANALYTICAL_NARRATIVE_RULES}
${PILLAR_CONFIDENCE_METADATA_ONLY_RULES}
${ELABORATION_ABSENCE_SCORING_HEADER}
${ELABORATION_ABSENCE_MOMENT4_MARKERS}
${specificityProbeCalibration}
${momentSpecificCalibration}

When any marker uses JSON null per instructions above, output null (not 0) for that key.

${CONTEMPT_TIER_BREAKDOWN_JSON_INSTRUCTION}

Return ONLY valid JSON:
{
  "momentNumber": 4,
  "momentName": "${MOMENT_META.name}",
  "pillarScores": { ${ids.map((id) => `"${id}": 0`).join(', ')} },
  "pillarConfidence": { ${ids.map((id) => `"${id}": "high"`).join(', ')} },
  "keyEvidence": { ${ids.map((id) => `"${id}": ""`).join(', ')} },
  "mentalizing_overcertainty": false,
  "response_concreteness": "moderate",
  "emotional_vocab_count": 0,
  "emotional_vocab_words": [],
  "user_slice_word_count": 0,
  "contempt_tier_breakdown": ${CONTEMPT_TIER_BREAKDOWN_JSON_TEMPLATE},
  "scoringMetadata": {
    "moment_4_accountability_situationally_exempt": false,
    "moment_4_accountability_situationally_exempt_reason": ""
  },
  "summary": "",
  "specificity": "high"
}`;
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.log('[M4 Debug] prompt character length:', prompt.length);
  }
  return prompt;
}
