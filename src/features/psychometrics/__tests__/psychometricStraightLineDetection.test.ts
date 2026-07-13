import { describe, expect, it } from '@jest/globals';
import { computePsychometricModifier } from '../computePsychometricModifier';
import {
  detectAaq2StraightLine,
  detectGaspStraightLine,
  detectPsychometricStraightLineFlags,
  detectRsesStraightLine,
  normalizePsychometricResponseMap,
  psychometricRawResponsesFromUserRow,
  RSES_MAX_SUM_SCORE,
  RSES_MIN_SUM_SCORE,
} from '../psychometricStraightLineDetection';

describe('psychometricStraightLineDetection', () => {
  it('normalizes string-keyed PostgREST response maps', () => {
    expect(normalizePsychometricResponseMap({ '1': 4, '2': '3' })).toEqual({ 1: 4, 2: 3 });
  });

  it('flags RSES ceiling score 40 even without stored responses', () => {
    expect(detectRsesStraightLine(RSES_MAX_SUM_SCORE, undefined)).toBe(true);
    expect(detectRsesStraightLine('40', null)).toBe(true);
  });

  it('flags RSES floor score 10 even without stored responses', () => {
    expect(detectRsesStraightLine(RSES_MIN_SUM_SCORE, undefined)).toBe(true);
    expect(detectRsesStraightLine('10', null)).toBe(true);
  });

  it('flags RSES when every raw item is 4 (ceiling keyed sum 40)', () => {
    const responses = Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((id) => [id, 4]));
    expect(detectRsesStraightLine(28, responses)).toBe(true);
  });

  it('flags RSES when every raw item is 1 (floor keyed sum 10)', () => {
    const responses = Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((id) => [id, 1]));
    expect(detectRsesStraightLine(28, responses)).toBe(true);
  });

  it('does not flag RSES from keyed-score uniformity when raw responses vary', () => {
    const responses = {
      1: 4,
      2: 3,
      3: 2,
      4: 4,
      5: 2,
      6: 3,
      7: 4,
      8: 2,
      9: 3,
      10: 2,
    };
    expect(detectRsesStraightLine(28, responses)).toBe(false);
  });

  it('flags RSES from partial stored responses with low raw unique count (legacy inline parity)', () => {
    expect(
      detectPsychometricStraightLineFlags(
        {
          brsScore: null,
          anxietyTraitScore: null,
          scsSfScore: null,
          gaspScore: null,
          dweckScore: null,
          aaq2Score: null,
          rsesScore: 28,
          scsPublicScore: null,
          scsPrivateScore: null,
          mspssFriendsScore: null,
          sd3NarcissismScore: null,
          rfqScore: null,
        },
        { rses: { '1': 4, '2': 4, '3': 4 } },
      ),
    ).toContain('rses_straight_line');
  });

  it('flags RSES ceiling pattern with alternating raw 4/1 on reverse items via sum score', () => {
    const responses = {
      1: 4,
      2: 4,
      3: 4,
      4: 4,
      5: 1,
      6: 4,
      7: 4,
      8: 1,
      9: 1,
      10: 1,
    };
    expect(detectRsesStraightLine(RSES_MAX_SUM_SCORE, responses)).toBe(true);
    // Raw responses are not uniform (4/1 mix) — must not flag from keyed-score uniformity.
    expect(detectRsesStraightLine(28, responses)).toBe(false);
  });

  it('flags AAQ2 uniform responses and ceiling sum', () => {
    const responses = Object.fromEntries([1, 2, 3, 4, 5, 6, 7].map((id) => [id, 7]));
    expect(detectAaq2StraightLine(49, responses)).toBe(true);
    expect(detectAaq2StraightLine(49, undefined)).toBe(true);
  });

  it('flags GASP when all eight items are identical', () => {
    const responses = Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8].map((id) => [id, 5]));
    expect(detectGaspStraightLine(responses)).toBe(true);
  });

  it('flags GASP when externalization items are all at the unfavorable pole', () => {
    const responses = {
      1: 6,
      2: 2,
      3: 6,
      4: 2,
      5: 7,
      6: 7,
      7: 7,
      8: 7,
    };
    expect(detectGaspStraightLine(responses)).toBe(true);
  });

  it('reads normalized responses from user rows with string keys', () => {
    const raw = psychometricRawResponsesFromUserRow({
      psychometrics_rses_responses: { '1': 4, '5': 1, '10': 1 },
      psychometrics_rses_score: 40,
    });
    expect(raw.rses).toEqual({ 1: 4, 5: 1, 10: 1 });
  });

  it('computePsychometricModifier flags rses_straight_line for ceiling score without responses', () => {
    const result = computePsychometricModifier({
      brsScore: null,
      anxietyTraitScore: null,
      scsSfScore: null,
      gaspScore: null,
      dweckScore: null,
      aaq2Score: null,
      rsesScore: 40,
      scsPublicScore: null,
      scsPrivateScore: null,
      mspssFriendsScore: null,
      mspssFamilyScore: null,
      sd3NarcissismScore: null,
      npiEntitlementScore: null,
      rfqScore: null,
    });
    expect(result.straightLineFlags).toContain('rses_straight_line');
  });

  it('returns expected reference-run style flags for ceiling RSES and uniform AAQ2/GASP', () => {
    const flags = detectPsychometricStraightLineFlags(
      {
        brsScore: null,
        anxietyTraitScore: null,
        scsSfScore: null,
        gaspScore: 4,
        dweckScore: null,
        aaq2Score: 49,
        rsesScore: 40,
        scsPublicScore: null,
        scsPrivateScore: null,
        mspssFriendsScore: null,
        sd3NarcissismScore: null,
        rfqScore: null,
      },
      {
        gasp: Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8].map((id) => [id, 5])),
        aaq2: Object.fromEntries([1, 2, 3, 4, 5, 6, 7].map((id) => [id, 7])),
      },
    );
    expect(flags).toEqual(
      expect.arrayContaining(['gasp_straight_line', 'aaq2_straight_line', 'rses_straight_line']),
    );
  });
});
