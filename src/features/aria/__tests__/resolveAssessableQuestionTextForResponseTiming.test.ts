import { describe, expect, it } from '@jest/globals';

import { MOMENT_4_GRUDGE_QUESTION_TEXT } from '@features/aria/moment4ProbeLogic';
import { MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT } from '@features/aria/probeAndScoringUtils';
import { resolveAssessableQuestionTextForResponseTiming } from '@features/aria/resolveAssessableQuestionTextForResponseTiming';
import { buildScenario3ToMoment4BundleForInterview } from '@features/aria/interviewTransitionBundles';
import { MOMENT_4_PERSONAL_CARD } from '@features/aria/interviewMomentScenarioConfig';
import { buildMoment4ThresholdAnswerToMoment5Bundle } from '@features/aria/interviewTransitionBundles';

describe('resolveAssessableQuestionTextForResponseTiming', () => {
  it('extracts grudge question from S3→M4 handoff bundle', () => {
    const bundle = buildScenario3ToMoment4BundleForInterview(
      'Alex',
      MOMENT_4_PERSONAL_CARD,
      'They need to stop walking away without resolving things.',
    );
    expect(resolveAssessableQuestionTextForResponseTiming(bundle)).toBe(MOMENT_4_GRUDGE_QUESTION_TEXT);
  });

  it('extracts M5 conflict question from M4 threshold→M5 bundle', () => {
    const bundle = buildMoment4ThresholdAnswerToMoment5Bundle(
      'Alex',
      MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT,
      'I would keep working at it unless there is no path forward.',
    );
    expect(resolveAssessableQuestionTextForResponseTiming(bundle)).toBe(
      MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT,
    );
  });

  it('returns canonical repair when given repair-only text', () => {
    expect(
      resolveAssessableQuestionTextForResponseTiming(
        'Got it. How do you think this situation could be repaired?',
      ),
    ).toBe('Got it. How do you think this situation could be repaired?');
  });
});
