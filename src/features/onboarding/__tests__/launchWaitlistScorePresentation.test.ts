import { describe, expect, it } from '@jest/globals';

import {
  formatLaunchWaitlistScoreDisplay,
  resolveFinalModifiedScoreForDisplay,
} from '@features/onboarding/launchWaitlistScorePresentation';
import type { InterviewReportAttempt } from '@features/onboarding/loadInterviewReportAttempt';

function makeAttempt(overrides: Partial<InterviewReportAttempt>): InterviewReportAttempt {
  return {
    id: 'attempt-1',
    weighted_score: 6.1,
    modified_weighted_score: 6.4,
    modified_weighted_score_with_psychometrics: 6.7,
    final_gate_pass: null,
    passed: null,
    gate_fail_reasons: null,
    psychometric_modifier_applied: null,
    corrected_psychometric_modifier: null,
    reasoning_pending: false,
    ai_reasoning: null,
    pillar_scores: null,
    hasPersistedPillarScores: false,
    hasPersistedWeightedScore: true,
    gate_result_finalized_at: null,
    ...overrides,
  };
}

describe('launchWaitlistScorePresentation', () => {
  it('resolveFinalModifiedScoreForDisplay prefers psychometric modified score', () => {
    expect(resolveFinalModifiedScoreForDisplay(makeAttempt({}))).toBe(6.7);
    expect(
      resolveFinalModifiedScoreForDisplay(
        makeAttempt({ modified_weighted_score_with_psychometrics: null }),
      ),
    ).toBe(6.4);
  });

  it('formatLaunchWaitlistScoreDisplay rounds to one decimal', () => {
    expect(formatLaunchWaitlistScoreDisplay(6.74)).toBe('6.7');
    expect(formatLaunchWaitlistScoreDisplay(null)).toBe('—');
  });
});
