import { describe, expect, it } from '@jest/globals';
import {
  ANXIETY_TRAIT_REVERSE_ITEMS,
  ASSESSMENT_ORDER,
  ASSESSMENTS,
  GASP_EXTERNALIZATION_ITEM_COUNT,
  GASP_EXTERNALIZATION_ITEM_IDS,
  GASP_GUILT_REPAIR_ITEM_IDS,
  GASP_SHAME_WITHDRAW_ITEM_IDS,
  SCS_SF_COMMON_HUMANITY_ITEM_IDS,
  SCS_SF_MINDFULNESS_ITEM_IDS,
  SCS_SF_SELF_KINDNESS_ITEM_IDS,
  isUnfavorableLikertItemResponse,
  psychometricBatteryProgressPosition,
  psychometricBatteryTotalQuestions,
  resolvePsychometricsResumePosition,
  scoreAssessment,
  scoreBRS,
  scoreNpiEntitlement,
  scorePostInterviewAssessment,
  scoreRetiredAssessment,
} from '../assessmentContent';
import { NPI_ENTITLEMENT_ENABLED } from '../interviewCompletionStatus';
import { buildAssessmentSavePayload } from '../psychometricsPersistence';

describe('scoreAssessment', () => {
  it('means anxiety_trait with reverse scoring on items 2 and 4', () => {
    expect(ANXIETY_TRAIT_REVERSE_ITEMS).toEqual([2, 4]);
    const allFives: Record<number, number> = { 1: 5, 2: 5, 3: 5, 4: 5 };
    expect(scoreAssessment('anxiety_trait', allFives).total).toBe(3);
    const highAnxiety: Record<number, number> = { 1: 5, 2: 1, 3: 5, 4: 1 };
    expect(scoreAssessment('anxiety_trait', highAnxiety).total).toBe(5);
  });

  it('persists anxiety_trait score and responses on save payload', () => {
    const responses: Record<number, number> = { 1: 5, 2: 1, 3: 5, 4: 1 };
    const payload = buildAssessmentSavePayload('anxiety_trait', responses);
    expect(payload.psychometrics_anxiety_trait_score).toBe(5);
    expect(payload.psychometrics_anxiety_trait_responses).toEqual(responses);
  });

  it('means BRS responses with reverse scoring', () => {
    const responses: Record<number, number> = {
      1: 5,
      2: 1,
      3: 5,
      4: 1,
      5: 5,
      6: 1,
    };
    expect(scoreBRS(responses)).toBe(5);
    expect(scoreAssessment('brs', responses)).toEqual({ total: 5 });
  });

  it('means SCS-SF from 8 retained items with reverse scoring', () => {
    const responses: Record<number, number> = {};
    for (const id of [2, 3, 5, 6, 7]) responses[id] = 5;
    for (const id of [1, 9, 11]) responses[id] = 1;
    const scores = scoreAssessment('scs_sf', responses);
    expect(scores.total).toBe(5);
    expect(scores.self_kindness).toBe(5);
    expect(scores.common_humanity).toBe(5);
    expect(scores.mindfulness).toBe(5);
    expect(ASSESSMENTS.scs_sf.questions).toHaveLength(8);
    expect(ASSESSMENTS.scs_sf.scoring.reverseItems).toEqual([1, 9, 11]);
    expect(SCS_SF_SELF_KINDNESS_ITEM_IDS).toEqual([2, 6, 11]);
    expect(SCS_SF_COMMON_HUMANITY_ITEM_IDS).toEqual([5]);
    expect(SCS_SF_MINDFULNESS_ITEM_IDS).toEqual([1, 3, 7]);
  });

  it('flags unfavorable Likert poles using item keying direction, not keyed score alone', () => {
    const scs = ASSESSMENTS.scs_sf;
    expect(isUnfavorableLikertItemResponse('scs_sf', scs, 2, 5)).toBe(false);
    expect(isUnfavorableLikertItemResponse('scs_sf', scs, 3, 4)).toBe(false);
    expect(isUnfavorableLikertItemResponse('scs_sf', scs, 6, 3)).toBe(false);
    expect(isUnfavorableLikertItemResponse('scs_sf', scs, 1, 5)).toBe(true);
    expect(isUnfavorableLikertItemResponse('scs_sf', scs, 11, 4)).toBe(true);

    const rses = ASSESSMENTS.rses;
    expect(isUnfavorableLikertItemResponse('rses', rses, 1, 3)).toBe(false);
    expect(isUnfavorableLikertItemResponse('rses', rses, 4, 3)).toBe(false);
    expect(isUnfavorableLikertItemResponse('rses', rses, 5, 3)).toBe(true);
    expect(isUnfavorableLikertItemResponse('rses', rses, 8, 4)).toBe(true);

    const anxiety = ASSESSMENTS.anxiety_trait;
    expect(isUnfavorableLikertItemResponse('anxiety_trait', anxiety, 1, 5)).toBe(true);
    expect(isUnfavorableLikertItemResponse('anxiety_trait', anxiety, 2, 1)).toBe(true);

    const gasp = ASSESSMENTS.gasp;
    // Guilt-proneness (1, 3) and Shame-proneness (2, 4) — high is favorable
    expect(isUnfavorableLikertItemResponse('gasp', gasp, 1, 1)).toBe(true);
    expect(isUnfavorableLikertItemResponse('gasp', gasp, 2, 2)).toBe(true);
    expect(isUnfavorableLikertItemResponse('gasp', gasp, 1, 6)).toBe(false);
    expect(isUnfavorableLikertItemResponse('gasp', gasp, 2, 7)).toBe(false);
    // Externalization (5, 6, 7, 8) — high is unfavorable
    expect(isUnfavorableLikertItemResponse('gasp', gasp, 5, 6)).toBe(true);
    expect(isUnfavorableLikertItemResponse('gasp', gasp, 6, 7)).toBe(true);
  });

  it('means GASP prosocial subscales and externalization subscale', () => {
    const responses: Record<number, number> = {
      1: 6,
      2: 2,
      3: 6,
      4: 2,
      5: 3,
      6: 3,
      7: 3,
      8: 3,
    };
    const gasp = scoreAssessment('gasp', responses);
    expect(gasp.total).toBe(4); // (6 + 2) / 2
    expect(gasp.guilt_repair).toBe(6);
    expect(gasp.shame_withdraw).toBe(2);
    expect(gasp.externalization).toBe(3);
    expect(ASSESSMENTS.gasp.questions).toHaveLength(8);
  });

  it('persists GASP subscores on save payload', () => {
    const responses: Record<number, number> = {
      1: 6,
      2: 2,
      3: 6,
      4: 2,
      5: 3,
      6: 3,
      7: 3,
      8: 3,
    };
    const payload = buildAssessmentSavePayload('gasp', responses);
    expect(payload.psychometrics_gasp_score).toBe(4);
    expect(payload.psychometrics_gasp_guilt_repair_score).toBe(6);
    expect(payload.psychometrics_gasp_shame_withdraw_score).toBe(2);
    expect(payload.psychometrics_gasp_responses).toEqual(responses);
  });

  it('GASP item id sets match 8-item battery', () => {
    expect(GASP_GUILT_REPAIR_ITEM_IDS).toEqual([1, 3]);
    expect(GASP_SHAME_WITHDRAW_ITEM_IDS).toEqual([2, 4]);
    expect(GASP_EXTERNALIZATION_ITEM_IDS).toEqual([5, 6, 7, 8]);
  });

  it('scores combined relationship beliefs with Dweck and RBI subscales', () => {
    const responses: Record<number, number> = {
      1: 1,
      2: 1,
      3: 1,
      4: 6,
      5: 6,
      6: 6,
      7: 1,
      8: 1,
      9: 1,
      10: 1,
    };
    const scores = scoreAssessment('dweck', responses);
    expect(scores.total).toBe(6);
    expect(scores.growth).toBe(6);
    expect(scores.rbi_disagreement).toBe(6);
  });

  it('sums AAQ-II responses', () => {
    const responses = Object.fromEntries([1, 2, 3, 4, 5, 6, 7].map((id) => [id, 2]));
    expect(scoreAssessment('aaq2', responses)).toEqual({ total: 14 });
  });

  it('scores retired MSPSS for legacy admin paths', () => {
    const responses = Object.fromEntries(Array.from({ length: 8 }, (_, i) => [i + 1, 4]));
    const scores = scoreRetiredAssessment('mspss', responses);
    expect(scores.total).toBe(4);
    expect(scores.family).toBe(4);
    expect(scores.friends).toBe(4);
  });

  it('means SD3 narcissism and RFQ responses', () => {
    const sd3 = Object.fromEntries(Array.from({ length: 9 }, (_, i) => [i + 1, 3]));
    expect(scoreAssessment('sd3_narcissism', sd3).total).toBe(3);
    const rfq: Record<number, number> = { 1: 1, 2: 7, 3: 1, 4: 7, 5: 1, 6: 7, 7: 1, 8: 7 };
    expect(scoreAssessment('rfq', rfq).total).toBe(7);
  });

  it('counts NPI Entitlement entitlement poles selected', () => {
    const responses = {
      1: { selectedOptionIndex: 0 as const, wasEntitlement: true },
      2: { selectedOptionIndex: 1 as const, wasEntitlement: false },
      3: { selectedOptionIndex: 0 as const, wasEntitlement: true },
      4: { selectedOptionIndex: 0 as const, wasEntitlement: true },
      5: { selectedOptionIndex: 1 as const, wasEntitlement: false },
      6: { selectedOptionIndex: 0 as const, wasEntitlement: true },
      7: { selectedOptionIndex: 1 as const, wasEntitlement: false },
    };
    expect(scoreNpiEntitlement(responses)).toBe(4);
    expect(scoreAssessment('npi_entitlement', responses).total).toBe(4);
  });

  it('runs 9 active instruments in configured order', () => {
    expect(ASSESSMENT_ORDER).toEqual([
      'brs',
      'anxiety_trait',
      'scs_sf',
      'gasp',
      'dweck',
      'aaq2',
      'rses',
      NPI_ENTITLEMENT_ENABLED ? 'npi_entitlement' : 'sd3_narcissism',
      'rfq',
    ]);
    expect(ASSESSMENT_ORDER).not.toContain('sexual_communication');
    expect(ASSESSMENT_ORDER).not.toContain('mspss');
    expect(ASSESSMENT_ORDER).not.toContain('scs');
  });

  it('means sexual communication post-interview responses', () => {
    const responses = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [i + 1, 4]));
    expect(scorePostInterviewAssessment('sexual_communication', responses)).toMatchObject({ total: 4 });
  });

  it('maps deprecated PAQ resume position to GASP', () => {
    expect(resolvePsychometricsResumePosition('paq', 5)).toEqual({
      assessmentIndex: 3,
      questionIndex: 0,
      allQuestionsAnswered: false,
    });
  });

  it('maps retired MSPSS resume position to SD3', () => {
    expect(resolvePsychometricsResumePosition('mspss', 2)).toEqual({
      assessmentIndex: 7,
      questionIndex: 0,
      allQuestionsAnswered: false,
    });
  });

  it('maps retired SCS resume position to RFQ (final instrument)', () => {
    expect(resolvePsychometricsResumePosition('scs', 5)).toEqual({
      assessmentIndex: 8,
      questionIndex: 0,
      allQuestionsAnswered: false,
    });
  });
});

describe('psychometricBatteryProgressPosition', () => {
  it('tracks cumulative position across the full battery', () => {
    const total = psychometricBatteryTotalQuestions();
    expect(total).toBeGreaterThan(0);

    expect(psychometricBatteryProgressPosition(0, 0)).toEqual({ current: 1, total });
    expect(psychometricBatteryProgressPosition(0, 5)).toEqual({ current: 6, total });

    const brsCount = ASSESSMENTS.brs.questions.length;
    expect(psychometricBatteryProgressPosition(1, 0)).toEqual({
      current: brsCount + 1,
      total,
    });

    const anxietyCount = ASSESSMENTS.anxiety_trait.questions.length;
    expect(psychometricBatteryProgressPosition(2, 0)).toEqual({
      current: brsCount + anxietyCount + 1,
      total,
    });
  });

  it('uses NPI or SD3 item count based on active battery slot', () => {
    const narcissismId = ASSESSMENT_ORDER[7];
    const narcissismCount = ASSESSMENTS[narcissismId].questions.length;
    const beforeNarcissism = ASSESSMENT_ORDER.slice(0, 7).reduce(
      (sum, id) => sum + ASSESSMENTS[id].questions.length,
      0,
    );
    expect(psychometricBatteryProgressPosition(7, 0)).toEqual({
      current: beforeNarcissism + 1,
      total: psychometricBatteryTotalQuestions(),
    });
    expect(narcissismCount).toBe(NPI_ENTITLEMENT_ENABLED ? 7 : 9);
  });
});

describe('resolvePsychometricsResumePosition', () => {
  it('clamps an out-of-range index on the current assessment', () => {
    expect(resolvePsychometricsResumePosition('rses', 9)).toEqual({
      assessmentIndex: 6,
      questionIndex: 9,
      allQuestionsAnswered: false,
    });
  });

  it('advances to the next assessment when index is one past the last question', () => {
    expect(resolvePsychometricsResumePosition('rses', 10)).toEqual({
      assessmentIndex: 7,
      questionIndex: 0,
      allQuestionsAnswered: false,
    });
  });

  it('marks flow complete when index is past the final assessment', () => {
    expect(resolvePsychometricsResumePosition('rfq', 8)).toEqual({
      assessmentIndex: 8,
      questionIndex: 7,
      allQuestionsAnswered: true,
    });
  });
});
