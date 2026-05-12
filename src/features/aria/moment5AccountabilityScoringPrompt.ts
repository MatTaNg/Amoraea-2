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
  /** Clarification confirmed smooth/no added tension detail, so Moment 5 specificity ceilings apply. */
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

  const conflictValidityNote =
    clientMeta?.conflictValidityLow === true
      ? `\nCLIENT METADATA — LOW CONFLICT VALIDITY (Moment 5):\nThe participant's Moment 5 example did not clearly establish a genuine conflict after one clarifying question. Treat this as **conflict_validity: low**. Because the markers were not tested in a clear rupture/repair process, cap repair at 4, mentalizing at 5, and regulation at 5 regardless of polished language. Accountability and contempt_expression may still be scored normally when evidence is present.\n`
      : clientMeta?.conflictValidityClarificationAsked === true
        ? `\nCLIENT METADATA — CONFLICT VALIDITY CLARIFIED (Moment 5):\nThe interviewer asked whether the situation actually became tense or resolved smoothly before any accountability probe. The participant added enough tension detail to continue normal scoring unless other evidence is thin.\n`
        : '';

  const probeCalibration =
    clientMeta?.accountabilityProbeFired === true
      ? `\nCLIENT METADATA — ACCOUNTABILITY PROBE:\nThe interviewer delivered **one** scripted follow-up ("What was your part in how it unfolded?") because the participant\'s answer narrated the conflict **without** referring to their own role (after any specificity redirect, when applicable).\n- If their **subsequent** answer shows genuine reflection on their own contribution, **moderate** accountability scores are appropriate even if the first answer was one-sided.\n- If after the probe they still narrate only from the other person\'s perspective, use **low** accountability with clear evidence.\n- **HIGH** accountability requires **voluntary** ownership in the participant\'s own words **before** any probe — unprompted references to their behavior, contribution to tension, or what they could have done differently.\n`
      : `\nCLIENT METADATA — NO ACCOUNTABILITY PROBE:\nThe scripted accountability follow-up did **not** fire — evaluate accountability from the participant\'s spontaneous narrative only (see specificity / abstraction notes above when present).\n`;

  const pathFlagsNote = clientMeta
    ? `\nCLIENT METADATA — MOMENT 5 PATH FLAGS (echo for scoring):\n- conflict_validity_clarification_fired: ${clientMeta.conflictValidityClarificationFired === true}\n- conflict_validity_second_response_abstract: ${clientMeta.conflictValiditySecondResponseAbstract === true}\n- accountability_probe_fired_on_abstract_followup: ${clientMeta.accountabilityProbeFiredOnAbstractFollowup === true}\n`
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
ACCOUNTABILITY-BAND CALIBRATION (encode in scores + evidence; use literal summary labels when summarizing):
- **HIGH** (typically pillar accountability 8–10 when evidence is clear): User **without being asked** references their own behavior, contribution to tension, fault, repair attempts, regret, or what they could have done differently.
- **MODERATE** (typically 4–7): Ownership appears **mainly after** the accountability probe, with genuine reflection — or mixed ownership with meaningful self-reflection.
- **LOW** (typically 0–3): Narrative stays entirely about the other person's actions **even after** the probe, blame-only framing, dismissive contempt of the other, or vague "we both had issues" without concrete ownership of self.

Score mentalizing, repair, regulation, and contempt_expression from this slice **only when there is assessable evidence**; otherwise JSON null for that marker with a brief keyEvidence note.

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
  "contempt_tier_breakdown": ${CONTEMPT_TIER_BREAKDOWN_JSON_TEMPLATE},
  "summary": "",
  "specificity": "high"
}`;
}
