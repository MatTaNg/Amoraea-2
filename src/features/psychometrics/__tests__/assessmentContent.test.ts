import { describe, expect, it } from '@jest/globals';
import {
  ANXIETY_TRAIT_REVERSE_ITEMS,
  ASSESSMENT_ORDER,
  ASSESSMENTS,
  GASP_EXTERNALIZATION_ITEM_IDS,
  GASP_GUILT_REPAIR_ITEM_IDS,
  GASP_SHAME_WITHDRAW_ITEM_IDS,
  resolvePsychometricsResumePosition,
  scoreAssessment,
  scoreBRS,
  scorePostInterviewAssessment,
} from '../assessmentContent';
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

  it('means SCS-SF with reverse scoring', () => {
    const responses: Record<number, number> = {};
    for (const id of [2, 3, 5, 6, 7, 8, 10]) responses[id] = 5;
    for (const id of [1, 4, 9, 11, 12]) responses[id] = 1;
    const scores = scoreAssessment('scs_sf', responses);
    expect(scores.total).toBe(5);
    expect(scores.self_kindness).toBe(5);
    expect(scores.common_humanity).toBe(5);
    expect(scores.mindfulness).toBe(5);
  });

  it('means GASP externalization only from items 1–4 (backward compatible)', () => {
    const gasp = scoreAssessment('gasp', { 1: 3, 2: 3, 3: 3, 4: 3 });
    expect(gasp.total).toBe(3);
    expect(gasp.guilt_repair).toBe(0);
    expect(gasp.shame_withdraw).toBe(0);
  });

  it('scores GASP guilt_repair and shame_withdraw subscales from full 12-item battery', () => {
    const responses: Record<number, number> = {
      1: 6,
      2: 5,
      3: 4,
      4: 3,
      5: 7,
      6: 6,
      7: 5,
      8: 4,
      9: 2,
      10: 3,
      11: 4,
      12: 5,
    };
    const gasp = scoreAssessment('gasp', responses);
    expect(gasp.total).toBe(4.5);
    expect(gasp.guilt_repair).toBe(5.5);
    expect(gasp.shame_withdraw).toBe(3.5);
  });

  it('persists GASP subscale scores on save payload', () => {
    const responses: Record<number, number> = Object.fromEntries(
      Array.from({ length: 12 }, (_, i) => [i + 1, 4]),
    );
    const payload = buildAssessmentSavePayload('gasp', responses);
    expect(payload.psychometrics_gasp_score).toBe(4);
    expect(payload.psychometrics_gasp_guilt_repair_score).toBe(4);
    expect(payload.psychometrics_gasp_shame_withdraw_score).toBe(4);
    expect(payload.psychometrics_gasp_responses).toEqual(responses);
  });

  it('GASP item id sets match published subscale membership', () => {
    expect(GASP_EXTERNALIZATION_ITEM_IDS).toEqual([1, 2, 3, 4]);
    expect(GASP_GUILT_REPAIR_ITEM_IDS).toEqual([5, 6, 7, 8]);
    expect(GASP_SHAME_WITHDRAW_ITEM_IDS).toEqual([9, 10, 11, 12]);
    expect(ASSESSMENTS.gasp.questions).toHaveLength(12);
  });

  it('scores combined relationship beliefs with Dweck and RBI subscales', () => {
    const responses = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [i + 1, 4]));
    const scores = scoreAssessment('dweck', responses);
    expect(scores.total).toBe(4);
    expect(scores.growth).toBe(4);
    expect(scores.rbi_disagreement).toBe(4);
  });

  it('sums AAQ-II responses', () => {
    const responses = Object.fromEntries([1, 2, 3, 4, 5, 6, 7].map((id) => [id, 2]));
    expect(scoreAssessment('aaq2', responses)).toEqual({ total: 14 });
  });

  it('means MSPSS family and friends subscales', () => {
    const responses = Object.fromEntries(Array.from({ length: 8 }, (_, i) => [i + 1, 4]));
    const scores = scoreAssessment('mspss', responses);
    expect(scores.total).toBe(4);
    expect(scores.family).toBe(4);
    expect(scores.friends).toBe(4);
  });

  it('means SD3 narcissism and RFQ responses', () => {
    const sd3 = Object.fromEntries(Array.from({ length: 9 }, (_, i) => [i + 1, 3]));
    expect(scoreAssessment('sd3_narcissism', sd3).total).toBe(3);
    const rfq = Object.fromEntries(Array.from({ length: 8 }, (_, i) => [i + 1, 5]));
    expect(scoreAssessment('rfq', rfq).total).toBe(5);
  });

  it('runs assessments in configured order with anxiety_trait after BRS', () => {
    expect(ASSESSMENT_ORDER).toEqual([
      'brs',
      'anxiety_trait',
      'aaq2',
      'rfq',
      'mspss',
      'sd3_narcissism',
      'dweck',
      'rses',
      'scs_sf',
      'gasp',
      'scs',
    ]);
    expect(ASSESSMENT_ORDER).not.toContain('sexual_communication');
  });

  it('means sexual communication post-interview responses', () => {
    const responses = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [i + 1, 4]));
    expect(scorePostInterviewAssessment('sexual_communication', responses)).toEqual({ total: 4 });
  });

  it('maps deprecated PAQ resume position to GASP', () => {
    expect(resolvePsychometricsResumePosition('paq', 5)).toEqual({
      assessmentIndex: 9,
      questionIndex: 0,
      allQuestionsAnswered: false,
    });
  });
});

describe('resolvePsychometricsResumePosition', () => {
  it('clamps an out-of-range index on the current assessment', () => {
    expect(resolvePsychometricsResumePosition('rses', 9)).toEqual({
      assessmentIndex: 7,
      questionIndex: 9,
      allQuestionsAnswered: false,
    });
  });

  it('advances to the next assessment when index is one past the last question', () => {
    expect(resolvePsychometricsResumePosition('rses', 10)).toEqual({
      assessmentIndex: 8,
      questionIndex: 0,
      allQuestionsAnswered: false,
    });
  });

  it('marks flow complete when index is past the final assessment', () => {
    expect(resolvePsychometricsResumePosition('scs', 13)).toEqual({
      assessmentIndex: 10,
      questionIndex: 12,
      allQuestionsAnswered: true,
    });
  });
});
