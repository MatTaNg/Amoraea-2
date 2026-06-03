import { describe, expect, it } from '@jest/globals';
import {
  coercePsychometricScore,
  isMissingUsersPsychometricsSd3ColumnsError,
  psychometricFloorScoresFromUserRow,
  sd3NarcissismResponsesFromUserRow,
  sd3NarcissismScoreFromUserRow,
  sd3NarcissismScoreForFloorFromUserRow,
} from '../usersPsychometricsSchemaFallback';
import {
  collectPsychometricFloorGateFailReasons,
  RFQ_LOW_REFLECTIVE_FUNCTIONING_FLOOR_CODE,
} from '../psychometricFloorBreaches';
import { SD3_NARCISSISM_FLOOR_FAIL_CODE } from '../sd3NarcissismFloor';

describe('usersPsychometricsSchemaFallback', () => {
  it('detects missing SD3 column errors', () => {
    expect(
      isMissingUsersPsychometricsSd3ColumnsError({
        code: 'PGRST204',
        message:
          "Could not find the 'psychometrics_sd3_narcissism_responses' column of 'users' in the schema cache",
      }),
    ).toBe(true);
  });

  it('reads legacy NARQ responses and scores when SD3 columns are absent', () => {
    const row = {
      psychometrics_narq_s_responses: { 1: 3, 2: 4 },
      psychometrics_narq_s_score: 3.5,
    };
    expect(sd3NarcissismResponsesFromUserRow(row)).toEqual({ 1: 3, 2: 4 });
    expect(sd3NarcissismScoreFromUserRow(row)).toBe(3.5);
  });

  it('coerces string numeric scores from PostgREST', () => {
    expect(coercePsychometricScore('1.625')).toBe(1.625);
    expect(coercePsychometricScore('4.889')).toBe(4.889);
    expect(sd3NarcissismScoreFromUserRow({ psychometrics_narq_s_score: '4.889' })).toBe(4.889);
    expect(
      sd3NarcissismScoreFromUserRow({
        psychometrics_sd3_narcissism_score: null,
        psychometrics_narq_s_score: 4.889,
      }),
    ).toBe(4.889);
    expect(
      sd3NarcissismScoreFromUserRow({
        psychometrics_sd3_narcissism_score: 4.2,
        psychometrics_narq_s_score: 4.889,
      }),
    ).toBe(4.2);
  });

  it('triggers RFQ and SD3 floors when user row scores are strings (attempt 84e8909e shape)', () => {
    const scores = psychometricFloorScoresFromUserRow({
      psychometrics_rfq_score: '1.625',
      psychometrics_sd3_narcissism_score: '4.889',
    });
    const floors = collectPsychometricFloorGateFailReasons(scores, [
      'aaq2_straight_line',
      'rses_straight_line',
      'scs_straight_line',
    ]);
    expect(floors).toContain(RFQ_LOW_REFLECTIVE_FUNCTIONING_FLOOR_CODE);
    expect(floors).toContain(SD3_NARCISSISM_FLOOR_FAIL_CODE);
  });

  it('SD3 floor scoring uses SD3 column only — legacy NARQ score does not trigger floor', () => {
    const scores = psychometricFloorScoresFromUserRow({
      psychometrics_narq_s_score: '4.889',
    });
    const floors = collectPsychometricFloorGateFailReasons(scores, []);
    expect(floors).not.toContain(SD3_NARCISSISM_FLOOR_FAIL_CODE);
    expect(sd3NarcissismScoreForFloorFromUserRow({ psychometrics_narq_s_score: 4.889 })).toBeNull();
    expect(sd3NarcissismScoreFromUserRow({ psychometrics_narq_s_score: 4.889 })).toBe(4.889);
  });

  it('prefers SD3 columns when both SD3 and legacy NARQ are present', () => {
    const row = {
      psychometrics_sd3_narcissism_responses: { 1: 5 },
      psychometrics_narq_s_responses: { 1: 1 },
      psychometrics_sd3_narcissism_score: 4.2,
      psychometrics_narq_s_score: 2.0,
    };
    expect(sd3NarcissismResponsesFromUserRow(row)).toEqual({ 1: 5 });
    expect(sd3NarcissismScoreFromUserRow(row)).toBe(4.2);
  });
});
