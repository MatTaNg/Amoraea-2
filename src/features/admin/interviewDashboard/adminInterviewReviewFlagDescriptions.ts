export const ADMIN_REVIEW_FLAG_DESCRIPTIONS: Record<string, string> = {
  ego_development_review: 'Ego development level 1 but weighted score passing — review recommended',
  defense_pattern_review: 'Two immature defense patterns detected — review recommended',
  emotion_recognition_review: 'Low emotion recognition score — review recommended',
  personal_moment_concreteness_review: 'Both personal moments abstract with borderline score — review recommended',
  overdisclosure_review: 'Overdisclosure pattern detected',
  closing_integration_absent: 'Closing integration absent with low ego development',
  mentalizing_overcertainty: 'Mentalizing overcertainty detected across multiple scenarios',
  projection_self_report_contradiction:
    'Projection detected in interview but self-report profile contradicts — possible false positive',
  rationalization_self_report_contradiction:
    'Rationalization detected but self-report suggests strong self-awareness — possible false positive',
  splitting_self_report_contradiction:
    'Splitting detected but self-report profile contradicts — possible false positive',
  denial_self_report_contradiction:
    'Denial detected but self-report profile contradicts — possible false positive',
  defense_possible_false_negative:
    'Psychometric profile suggests possible missed defense detection — no behavioral detection occurred',
  projection_insufficient_psychometric_data:
    'Projection detected but psychometric data insufficient for cross-reference validation',
  rationalization_insufficient_psychometric_data:
    'Rationalization detected but psychometric data insufficient for cross-reference validation',
  splitting_insufficient_psychometric_data:
    'Splitting detected but psychometric data insufficient for cross-reference validation',
  denial_insufficient_psychometric_data:
    'Denial detected but psychometric data insufficient for cross-reference validation',
  projection_self_report_confirmed: 'Projection detection confirmed by self-report psychometric profile',
  rationalization_self_report_confirmed:
    'Rationalization detection confirmed by self-report psychometric profile',
  splitting_self_report_confirmed: 'Splitting detection confirmed by self-report psychometric profile',
  denial_self_report_confirmed: 'Denial detection confirmed by self-report psychometric profile',
  projection_self_report_neutral: 'Projection detected — self-report profile neither confirms nor contradicts',
  rationalization_self_report_neutral:
    'Rationalization detected — self-report profile neither confirms nor contradicts',
  splitting_self_report_neutral: 'Splitting detected — self-report profile neither confirms nor contradicts',
  denial_self_report_neutral: 'Denial detected — self-report profile neither confirms nor contradicts',
  legacy_psychometric_pass_flip_review:
    'Psychometric modifier applied after interview completion would change pass to fail — held for admin review',
  score_recompute_gate_flip:
    'Score recalculation changed pass/fail or final gate outcome — review narrative and routing',
};
