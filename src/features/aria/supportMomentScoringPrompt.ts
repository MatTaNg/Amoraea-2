import { SCORE_CALIBRATION_0_10 } from './interviewScoringCalibration';
import { MENTALIZING_OVERCERTAINTY_SCORING_INSTRUCTION } from './personalMomentScoringPrompt';
import { PILLAR_CONFIDENCE_METADATA_ONLY_RULES } from './holisticScoringPrompt';
import {
  MOMENT_SUPPORT_CONDITIONAL_PROBE_TEXT,
  MOMENT_SUPPORT_QUESTION_TEXT,
} from './moment4ProbeLogic';

export const SUPPORT_MARKER_IDS = [
  'responsiveness_support',
  'need_recognition',
  'attunement',
  'support_response',
  'adaptability',
  'mentalizing',
  'regulation',
  'repair',
] as const;

/**
 * Autobiographical responsiveness/support moment — primary pillar responsiveness_support.
 * Experimental slices persist independently for validation; they do not independently gate.
 */
export function buildSupportMomentScoringPrompt(
  transcript: { role: string; content: string }[],
): string {
  const turns = transcript
    .map((m) => `${m.role === 'user' ? 'User' : 'Interviewer'}: ${m.content}`)
    .join('\n\n');
  const ids = [...SUPPORT_MARKER_IDS];
  return `You are scoring one autobiographical support moment from a relationship assessment interview.

MOMENT: Support / responsiveness
PRIMARY PILLAR: responsiveness_support
EXPERIMENTAL SLICES (persist independently): need_recognition, attunement, support_response, adaptability
ALSO SCORE WHEN EVIDENCE EXISTS: mentalizing, regulation, repair (spontaneous only)

PRIMARY QUESTION: "${MOMENT_SUPPORT_QUESTION_TEXT}"
CONDITIONAL PROBE: "${MOMENT_SUPPORT_CONDITIONAL_PROBE_TEXT}"
If the participant says they have no lived example and then answers the hypothetical (what they would do if someone close to them was stressed and needed support), score that hypothetical response on the same markers. Do not treat the moment as empty only because the first reply had no real story.

Reward context-sensitive support rather than one scripted response. Higher scores when the person noticed what the other needed, adapted, and offered support that fit the situation. Lower scores for generic "I just listened" with no situational texture, or imposing one kind of help regardless of the other person.

Score **repair** only if this support story includes a meaningful unprompted repair process after strain (apology, amends, talking a rupture through). Otherwise JSON null for repair — missing, not a low default.

${SCORE_CALIBRATION_0_10}
${MENTALIZING_OVERCERTAINTY_SCORING_INSTRUCTION}
${PILLAR_CONFIDENCE_METADATA_ONLY_RULES}

CONTEXTUAL REASONING (existing ego-development / depth framework — not a new pillar):
Higher-quality reasoning includes contextual reasoning, calibrated uncertainty, multiple plausible interpretations, and holding competing truths. Lower-quality reasoning includes rigid always/never rules, black-and-white interpretations, unjustified certainty, and rote therapy language without contextual understanding.

TRANSCRIPT OF THIS MOMENT ONLY:
${turns}

If a marker has no meaningful evidence, use JSON null (not a midpoint).

Return ONLY valid JSON:
{
  "momentNumber": 6,
  "momentName": "Support / responsiveness",
  "pillarScores": { ${ids.map((id) => `"${id}": 0`).join(', ')} },
  "pillarConfidence": { ${ids.map((id) => `"${id}": "high"`).join(', ')} },
  "keyEvidence": { ${ids.map((id) => `"${id}": ""`).join(', ')} },
  "mentalizing_overcertainty": false,
  "response_concreteness": "moderate",
  "user_slice_word_count": 0,
  "summary": "",
  "specificity": "high"
}`;
}

export function extractSupportMomentTranscriptTurns(
  messages: ReadonlyArray<{ role: string; content?: string | null; interviewMoment?: number }>,
): { role: string; content: string }[] {
  const out: { role: string; content: string }[] = [];
  let started = false;
  for (const m of messages) {
    const content = String(m.content ?? '');
    if (
      m.role === 'assistant' &&
      (content.toLowerCase().includes('needed support from you') ||
        content.toLowerCase().includes('needed your support') ||
        m.interviewMoment === 6)
    ) {
      started = true;
    }
    if (!started) continue;
    if (m.interviewMoment === 5 && m.role === 'assistant' && /conflict with someone/i.test(content)) {
      break;
    }
    out.push({ role: m.role, content });
  }
  return out;
}
