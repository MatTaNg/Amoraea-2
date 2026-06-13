import { SCORE_CALIBRATION_0_10 } from './interviewScoringCalibration';
import {
  ELABORATION_ABSENCE_MOMENT5_MARKERS,
  ELABORATION_ABSENCE_SCORING_HEADER,
} from './elaborationAbsencePenaltiesRubric';
import {
  CONTEMPT_EXPRESSION_SCORING_RUBRIC,
  CONTEMPT_TIER_BREAKDOWN_JSON_INSTRUCTION,
  CONTEMPT_TIER_BREAKDOWN_JSON_TEMPLATE,
} from './contemptExpressionScoringRubric';
import { MENTALIZING_OVERCERTAINTY_SCORING_INSTRUCTION } from './personalMomentScoringPrompt';
import { RESPONSE_CONCRETENESS_SCORING_INSTRUCTION } from './personalMomentConcreteness';
import { PERSONAL_MOMENT_EMOTIONAL_VOCAB_SCORING_INSTRUCTION } from './personalMomentEmotionalVocab';
import type { ConflictValidityResult } from './probeAndScoringUtils';

const MOMENT5_CONFLICT_VALIDITY_FRAMEWORK = `
M5 CONFLICT VALIDITY — THREE-STATE FRAMEWORK

The conflict validity clarification question determines which of three scoring contexts applies.

─────────────────────────────────────────────
TYPE A — NO GENUINE CONFLICT (conflict_validity: 'no_conflict')
─────────────────────────────────────────────
User confirmed the situation resolved without real tension — nothing got difficult, nothing ruptured, it was smooth throughout.

This is not a scoring failure. It may reflect good relational functioning. Someone who communicates well, addresses friction early, or chooses healthy relationships will naturally have fewer high-conflict examples to draw from. The absence of conflict is itself a signal worth honoring.

Scoring for Type A:
- Repair: baseline 6 when the user described constructive resolution behavior (talking it through, apologizing, listening, checking in). The repair capacity is present even if it wasn't tested under pressure.
- Regulation: baseline 6 when the user stayed calm enough that nothing escalated. Staying regulated is itself evidence of regulation.
- Accountability: baseline 5 — neutral. Without a rupture the accountability signal is limited, but absence of defensiveness or blame is a mild positive.
- Contempt: score normally based on language used.

Cap all M5 scores at 6 for Type A. Scores of 7+ require evidence of navigating genuine difficulty — a real rupture, a moment of pressure, a repair under stress. These cannot be fairly assessed without a genuine conflict example.

Do not score below 5 for Type A unless the user described actively harmful behavior even in a low-stakes situation — contempt, stonewalling, or explicit blame attribution with no acknowledgment of their own part.

─────────────────────────────────────────────
TYPE B — REAL CONFLICT THAT RESOLVED WELL (conflict_validity: 'resolved_well')
─────────────────────────────────────────────
Real tension existed and the conflict resolved successfully. "Resolved smoothly" in this context means the repair worked — this is a positive signal for repair and regulation, not a limitation.

No score cap applies. Score based on the quality of the resolution process described.

Repair and regulation scores of 7+ are available when the user described a repair process that was emotionally attuned, showed genuine accountability, and addressed the relational core of the conflict — not just logistics.

Repair and regulation scores of 5–6 apply when the user described basic constructive resolution (talked it through, apologized, moved on) without significant emotional depth.

─────────────────────────────────────────────
TYPE C — GENUINE CONFLICT, RESOLUTION VARIED (conflict_validity: 'genuine_conflict')
─────────────────────────────────────────────
Real tension existed. Resolution quality varies. Full scoring range available in both directions.

This provides the richest signal for repair, regulation, and accountability. Score based on what the user described — high scores require demonstrated repair capacity and genuine accountability, low scores reflect avoidance, blame, contempt, or refusal to engage with the difficulty.

─────────────────────────────────────────────
REACTIVE FRAMING — NOT EXTERNALIZATION
─────────────────────────────────────────────
"I responded based on how they came at me" or "I said what I said because of what they said" is reactive framing — a description of cause and effect — not externalization or blame attribution.

Externalization means attributing the conflict entirely to the other person and denying any personal contribution. Reactive framing means acknowledging your response while contextualizing the trigger. These are meaningfully different.

A user who says "I responded because of how they spoke to me, and I still apologized" is demonstrating accountability — they owned their response through the apology while describing what triggered it. Score this as moderate accountability (5–6), not low accountability (3–4).

Score 3–4 only when the user:
- Attributes the conflict entirely to the other person with no acknowledgment of their own contribution
- Provides no apology or repair attempt
- Actively dismisses the other person's feelings or perspective

Acknowledging a trigger while still apologizing is not the same as blaming. It is honest contextualizing combined with ownership.
`;

const MOMENT_META = {
  name: 'Moment 5 (Personal Conflict / Accountability)',
  constructs:
    'accountability (primary), mentalizing, repair, regulation, contempt_expression — NOT commitment_threshold, NOT appreciation, NOT attunement, NOT contempt_recognition',
  markerIds: ['accountability', 'mentalizing', 'repair', 'regulation', 'contempt_expression'] as const,
};

export type Moment5ClientScoringMetadata = {
  accountabilityProbeFired: boolean;
  /** Echo of probe_log.trigger_reason when applicable (e.g. lacks_explicit_self_accountability). */
  probeTriggerReason?: string;
  /** Client asked once for a concrete person/situation before accountability (abstract first answer). */
  specificityRedirectIssued?: boolean;
  /**
   * Product / analytics: `conflict_validity_clarification_fired` — true once the **specificity redirect**
   * ("specific time… walk me through") was issued during Moment 5 (distinct from tense/smooth clarification).
   */
  conflictValidityClarificationFired?: boolean;
  /** Product / analytics: `conflict_validity_second_response_abstract` — user follow-up after that redirect was still abstract. */
  conflictValiditySecondResponseAbstract?: boolean;
  /** Product / analytics: `accountability_probe_fired_on_abstract_followup` — probe fired as alternate entry after abstract second answer. */
  accountabilityProbeFiredOnAbstractFollowup?: boolean;
  /** User stayed abstract after that redirect — accountability probe was not delivered. */
  persistentAbstractionMoveOn?: boolean;
  /** Brief scripted appreciation line immediately before the accountability question (standard for every fired probe). */
  warmAckBeforeAccountabilityProbe?: boolean;
  /** Participant's answer included death / bereavement; same warm line is used, plus this flag for scorer context. */
  griefAckBeforeAccountabilityProbe?: boolean;
  /** Client asked whether the situation actually got tense before any accountability probe. */
  conflictValidityClarificationAsked?: boolean;
  /**
   * Three-state classification after the conflict-validity clarification answer.
   * null/undefined → treat as genuine_conflict (full range) when scoring.
   */
  conflictValidity?: ConflictValidityResult | null;
  /** @deprecated Use {@link conflictValidity} === 'no_conflict' */
  conflictValidityLow?: boolean;
};

export function buildMoment5AccountabilityScoringPrompt(
  transcript: { role: string; content: string }[],
  clientMeta?: Moment5ClientScoringMetadata | null,
): string {
  const ids = [...MOMENT_META.markerIds];
  const turns = transcript
    .map((m) => `${m.role === 'user' ? 'User' : 'Interviewer'}: ${m.content}`)
    .join('\n\n');

  const specificityNote =
    clientMeta?.specificityRedirectIssued === true
      ? `\nCLIENT METADATA — SPECIFICITY REDIRECT (Moment 5):\nThe participant\'s first answer lacked a concrete interpersonal episode (generic advice or process-only). The interviewer delivered **one** brief redirect asking for a specific person/time **before** any accountability probe.\n`
      : '';

  const persistentAbstractNote =
    clientMeta?.persistentAbstractionMoveOn === true &&
    clientMeta?.accountabilityProbeFiredOnAbstractFollowup !== true
      ? `\nCLIENT METADATA — NO ACCOUNTABILITY PROBE (persistent abstraction):\nAfter the specificity redirect, the participant still did not anchor to a concrete episode and declined or evaded; **no** "What was your part…" probe was delivered — score from thin behavioral evidence only.\n`
      : '';

  const abstractFollowupProbeNote =
    clientMeta?.accountabilityProbeFiredOnAbstractFollowup === true
      ? `\nCLIENT METADATA — ABSTRACT FOLLOW-UP AFTER SPECIFICITY REDIRECT (Moment 5):\nThe participant\'s second answer after the "specific time" redirect remained abstract; the interviewer delivered the accountability probe once as an alternate entry point (not a second redirect). Apply **low behavioral specificity** expectations for pre-probe turns unless concrete episode detail appears in the post-probe answer.\n`
      : '';

  const warmAckNote =
    clientMeta?.warmAckBeforeAccountabilityProbe === true
      ? `\nCLIENT METADATA — WARM ACKNOWLEDGMENT BEFORE PROBE (Moment 5):\nThe interviewer delivered **one** brief scripted appreciation line immediately **before** the same-turn accountability question — standard pipeline tone, not therapy or extended validation.\n`
      : '';

  const griefAckNote =
    clientMeta?.griefAckBeforeAccountabilityProbe === true
      ? `\nCLIENT METADATA — DEATH / BEREAVEMENT IN USER TURN (Moment 5):\nThe participant\'s answer included death or bereavement. The scripted line before the probe is the same warmth beat used for all probes; treat it as brief acknowledgment only — not a support conversation, no invitation to elaborate on grief.\n`
      : '';

  const conflictValidityState: ConflictValidityResult | null =
    clientMeta?.conflictValidity ??
    (clientMeta?.conflictValidityLow === true ? 'no_conflict' : null);

  const conflictValidityNote =
    conflictValidityState === 'no_conflict'
      ? `\nCLIENT METADATA — CONFLICT VALIDITY (Moment 5): **conflict_validity: no_conflict**\nApply TYPE A scoring from the M5 CONFLICT VALIDITY framework below.\n`
      : conflictValidityState === 'resolved_well'
        ? `\nCLIENT METADATA — CONFLICT VALIDITY (Moment 5): **conflict_validity: resolved_well**\nApply TYPE B scoring from the M5 CONFLICT VALIDITY framework below.\n`
        : conflictValidityState === 'genuine_conflict'
          ? `\nCLIENT METADATA — CONFLICT VALIDITY (Moment 5): **conflict_validity: genuine_conflict**\nApply TYPE C scoring from the M5 CONFLICT VALIDITY framework below.\n`
          : clientMeta?.conflictValidityClarificationAsked === true
            ? `\nCLIENT METADATA — CONFLICT VALIDITY CLARIFIED (Moment 5):\nThe interviewer asked whether the situation actually became tense or resolved smoothly before any accountability probe. Score using the M5 CONFLICT VALIDITY framework (default to TYPE C when classification is unclear).\n`
            : '';

  const probeCalibration =
    clientMeta?.accountabilityProbeFired === true
      ? `\nCLIENT METADATA — ACCOUNTABILITY PROBE:\nThe interviewer delivered **one** scripted follow-up ("What do you think you did or said that contributed to the conflict?") because the participant\'s answer narrated the conflict **without** referring to their own role (after any specificity redirect, when applicable).\n- If their **subsequent** answer shows genuine reflection on their own contribution, **moderate** accountability scores are appropriate even if the first answer was one-sided.\n- If after the probe they still narrate only from the other person\'s perspective, use **low** accountability with clear evidence.\n- **HIGH** accountability requires **voluntary** ownership in the participant\'s own words **before** any probe — unprompted references to their behavior, contribution to tension, or what they could have done differently.\n`
      : `\nCLIENT METADATA — NO ACCOUNTABILITY PROBE:\nThe scripted accountability follow-up did **not** fire — evaluate accountability from the participant\'s spontaneous narrative only (see specificity / abstraction notes above when present).\n`;

  const pathFlagsNote = clientMeta
    ? `\nCLIENT METADATA — MOMENT 5 PATH FLAGS (echo for scoring):\n- conflict_validity: ${conflictValidityState ?? 'null (default TYPE C)'}\n- conflict_validity_clarification_fired: ${clientMeta.conflictValidityClarificationFired === true}\n- conflict_validity_second_response_abstract: ${clientMeta.conflictValiditySecondResponseAbstract === true}\n- accountability_probe_fired_on_abstract_followup: ${clientMeta.accountabilityProbeFiredOnAbstractFollowup === true}\n`
    : '';

  const probeCalibrationResolved =
    specificityNote +
    persistentAbstractNote +
    abstractFollowupProbeNote +
    warmAckNote +
    griefAckNote +
    conflictValidityNote +
    pathFlagsNote +
    probeCalibration;

  const bandCalibration = `
ACCOUNTABILITY FLOOR CLARIFICATION (M5 PERSONAL QUESTION):
The primary M5 question asks for a conflict narrative and resolution description. It does not ask for self-accountability. The probe exists to specifically elicit that.

Pre-probe scoring:
- User volunteered self-examination: 7+
- User provided genuine narrative without self-examination: 5
- User gave process or philosophical response instead of specific narrative: 4–5
- User actively externalized or blamed in their narrative: 3–4

After the probe fires the ceiling adjusts based on probe response quality (see below). A process answer after the probe (answering how the conflict was resolved rather than what the user contributed to causing it) scores 3–4, not 1–2. Score 1–2 only for active externalization or contempt after the probe.

ACCOUNTABILITY-BAND CALIBRATION (encode in scores + evidence; use literal summary labels when summarizing):
- **HIGH** (typically pillar accountability 8–10 when evidence is clear): User **without being asked** references their own behavior, contribution to tension, fault, repair attempts, regret, or what they could have done differently.
- **MODERATE** (typically 4–7): Ownership appears **mainly after** the accountability probe, with genuine reflection — or mixed ownership with meaningful self-reflection.
- **LOW** (typically 0–3): Narrative stays entirely about the other person's actions **even after** the probe, blame-only framing, dismissive contempt of the other, or vague "we both had issues" without concrete ownership of self.

IMPORTANT DISTINCTION — Process answers vs genuine deflection:

A score of 1–2 is reserved for users who actively externalize, blame the other party, or dismiss their contribution when directly asked. This includes: attributing the conflict entirely to the other person, responding with contempt toward the other person after the probe, or explicitly denying any personal contribution.

A score of 3–4 is appropriate when the user gives a process-oriented answer that could reflect ambiguous interpretation of the probe rather than genuine accountability avoidance — for example, describing how the conflict was resolved rather than what they contributed to causing it. This is evidence of limited accountability but not active externalization.

The distinction matters: a user who answers "we sat down and listened to each other" after being asked "what did you do or say that contributed to the conflict" may be misinterpreting the question, underdisclosing, or avoiding — but they are not demonstrating the active blame attribution or contempt that warrants a score of 1–2. Score such responses 3–4, not 1–2.

Score 1–2 only when the response after the probe contains explicit blame attribution, externalization, or dismissal of the user's own contribution.

Score mentalizing, repair, regulation, and contempt_expression from this slice **only when there is assessable evidence**; otherwise JSON null for that marker with a brief keyEvidence note.

${MENTALIZING_OVERCERTAINTY_SCORING_INSTRUCTION}

${RESPONSE_CONCRETENESS_SCORING_INSTRUCTION}

${PERSONAL_MOMENT_EMOTIONAL_VOCAB_SCORING_INSTRUCTION}

contempt_expression (same CONTEMPT_EXPRESSION tier rubric as scenarios — full block below).
`;

  return `You are scoring one personal moment from a relationship assessment interview.

MOMENT: ${MOMENT_META.name}
MARKERS TO SCORE IN THIS SLICE: ${MOMENT_META.constructs}

${SCORE_CALIBRATION_0_10}
${CONTEMPT_EXPRESSION_SCORING_RUBRIC}

TRANSCRIPT OF THIS MOMENT ONLY:
${turns}

SCORING INSTRUCTIONS:
Score only the listed markers using only this moment transcript slice.
For each marker: quote or paraphrase the response that most informed the score.
${ELABORATION_ABSENCE_SCORING_HEADER}
${ELABORATION_ABSENCE_MOMENT5_MARKERS}
${probeCalibrationResolved}
${MOMENT5_CONFLICT_VALIDITY_FRAMEWORK}
${bandCalibration}

When any marker uses JSON null per instructions above, output null (not 0) for that key.

${CONTEMPT_TIER_BREAKDOWN_JSON_INSTRUCTION}

Return ONLY valid JSON:
{
  "momentNumber": 5,
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
  "summary": "",
  "specificity": "high"
}`;
}
