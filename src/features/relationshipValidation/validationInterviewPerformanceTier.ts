import { GATE_PASS_WEIGHTED_MIN } from '@features/aria/computeGateResultCore';

/** Qualitative interview outcome for validation report tone — never shown to the user. */
export type ValidationInterviewPerformanceTier =
  | 'strong_demonstration'
  | 'balanced_demonstration'
  | 'needs_development';

/** Scores at or above threshold + this margin are "comfortably above" for warm interview tone. */
export const VALIDATION_INTERVIEW_COMFORTABLE_PASS_MARGIN = 0.5;

export function deriveValidationInterviewPerformanceTier(
  finalGatePass: boolean | null | undefined,
  modifiedWeightedScore: number | null | undefined,
): ValidationInterviewPerformanceTier | null {
  if (finalGatePass == null) return null;
  if (!finalGatePass) return 'needs_development';

  const score =
    typeof modifiedWeightedScore === 'number' && Number.isFinite(modifiedWeightedScore)
      ? modifiedWeightedScore
      : GATE_PASS_WEIGHTED_MIN;

  if (score >= GATE_PASS_WEIGHTED_MIN + VALIDATION_INTERVIEW_COMFORTABLE_PASS_MARGIN) {
    return 'strong_demonstration';
  }
  return 'balanced_demonstration';
}

/**
 * Tone calibration for interview sections — mirrors generateAIReasoning / holistic scoring honesty rules
 * without exposing assessment mechanics in the rendered report.
 */
export function buildInterviewToneCalibrationInstructions(
  tier: ValidationInterviewPerformanceTier | null,
  hasInterview: boolean,
): string {
  if (!hasInterview) return '';

  const base = `
INTERVIEW TONE CALIBRATION (internal guidance — never mention tiers, scores, thresholds, pillars, gates, or pass/fail in the report):
Apply the same honesty standard as Amoraea interview feedback: do not reframe weak interview signals as strengths; use emotionally neutral, descriptive language about what was observed; never convert thin or surface-level responses into compliments.

Forbidden in ALL report text: numeric interview scores; pillar or construct names as scored dimensions (mentalizing, accountability, repair, regulation, attunement, appreciation, commitment_threshold, contempt); the words "gate", "floor", "threshold", "pass", "fail", or "score" in an assessment sense; probe names or scoring methodology.

Describe patterns in plain language (e.g. "your responses leaned toward brief, surface-level descriptions rather than deeper exploration of what others might be feeling") — never attach numbers or construct labels.`;

  switch (tier) {
    case 'strong_demonstration':
      return `${base}
Performance tier: strong_demonstration — In interview-focused sections, you may describe genuine relational strengths warmly, consistent with the rest of the report.`;
    case 'balanced_demonstration':
      return `${base}
Performance tier: balanced_demonstration — In interview-focused sections, name genuine strengths but give growth areas equal or greater weight. Stay encouraging without overstating interview depth.`;
    case 'needs_development':
      return `${base}
Performance tier: needs_development — In interview-focused sections ("What Your AI Interview Revealed", "Patterns Across Conversation and Questionnaires", and any closing lines about the interview), do NOT use unqualified strength language ("commendable", "strong foundation", "valuable asset", "remarkable ability", "commendable ability") for overall interview performance. Be warm and respectful; cite specific observable patterns from the transcript. Psychometric strengths may still be named warmly in non-interview sections. Growth-oriented framing is fine; false reassurance is not.`;
    default:
      return `${base}
Performance tier: unknown — Stay descriptive and neutral in interview-focused sections; avoid strong positive or negative labels about overall interview performance.`;
  }
}
