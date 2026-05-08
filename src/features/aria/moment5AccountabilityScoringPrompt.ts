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
  /** User stayed abstract after that redirect — accountability probe was not delivered. */
  persistentAbstractionMoveOn?: boolean;
  /** One-sentence grief acknowledgment prepended before the scripted accountability probe (death/bereavement disclosure). */
  griefAckBeforeAccountabilityProbe?: boolean;
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
    clientMeta?.persistentAbstractionMoveOn === true
      ? `\nCLIENT METADATA — NO ACCOUNTABILITY PROBE (persistent abstraction):\nAfter the specificity redirect, the participant still did not anchor to a concrete episode. **No** "What was your part…" probe was delivered per pipeline rules — score from thin behavioral evidence only.\n`
      : '';

  const griefAckNote =
    clientMeta?.griefAckBeforeAccountabilityProbe === true
      ? `\nCLIENT METADATA — GRIEF ACKNOWLEDGMENT (Moment 5):\nThe participant\'s answer included death / bereavement disclosure. The interviewer delivered **one** brief neutral acknowledgment sentence immediately **before** the same-turn scripted accountability probe — not a support conversation, no invitation to elaborate on grief.\n`
      : '';

  const probeCalibration =
    clientMeta?.accountabilityProbeFired === true
      ? `\nCLIENT METADATA — ACCOUNTABILITY PROBE:\nThe interviewer delivered **one** scripted follow-up ("What was your part in how it unfolded?") because the participant\'s answer narrated the conflict **without** referring to their own role (after any specificity redirect, when applicable).\n- If their **subsequent** answer shows genuine reflection on their own contribution, **moderate** accountability scores are appropriate even if the first answer was one-sided.\n- If after the probe they still narrate only from the other person\'s perspective, use **low** accountability with clear evidence.\n- **HIGH** accountability requires **voluntary** ownership in the participant\'s own words **before** any probe — unprompted references to their behavior, contribution to tension, or what they could have done differently.\n`
      : `\nCLIENT METADATA — NO ACCOUNTABILITY PROBE:\nThe scripted accountability follow-up did **not** fire — evaluate accountability from the participant\'s spontaneous narrative only (see specificity / abstraction notes above when present).\n`;

  const probeCalibrationResolved =
    specificityNote + persistentAbstractNote + griefAckNote + probeCalibration;

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
