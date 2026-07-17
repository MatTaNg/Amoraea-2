import { describe, expect, it } from '@jest/globals';
import {
  applyMoment5PostParseCoercionAndSalvage,
  backfillMoment5KeyEvidenceIfScoresOtherwiseUnpersistable,
  coerceMoment5ParsedModelRecord,
  finalizeMoment5ParsedModelScore,
  mergeMoment5PillarScoresAfterEvidenceNormalize,
  moment5PrimaryParseIsComplete,
  MOMENT5_BUNDLE_INCOMPLETE_EVIDENCE_LINE,
  MOMENT5_SCORE_RECOVERED_EVIDENCE_LINE,
  salvagePersonalMomentDepthFieldsFromRawModelText,
} from '../moment5ScoringParse';
import { MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT } from '@features/aria/moment5ProbeCopy';
import { parseJsonObjectFromModelText } from '@utilities/parseHolisticModelJson';

const M5_SUBSTANTIVE_USER =
  'I had a long conflict with my friend after missing her wedding rehearsal and we eventually talked it through over coffee.';

const M5_TEST_GUARD = {
  transcript: [
    { role: 'assistant', content: MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT },
    { role: 'user', content: M5_SUBSTANTIVE_USER, interviewMoment: 5 },
  ],
  scoringSlice: [{ role: 'user', content: M5_SUBSTANTIVE_USER }],
};

describe('moment5ScoringParse', () => {
  it('mergeMoment5PillarScoresAfterEvidenceNormalize restores explicit nulls', () => {
    expect(mergeMoment5PillarScoresAfterEvidenceNormalize({})).toEqual({
      accountability: null,
      mentalizing: null,
      repair: null,
      regulation: null,
      contempt_expression: null,
    });
  });

  it('salvagePersonalMomentDepthFieldsFromRawModelText parses truncated JSON fields', () => {
    const raw =
      '{"response_concreteness":"moderate","emotional_vocab_count":3,"user_slice_word_count":42,"emotional_vocab_words":["hurt","angry"]}';
    expect(salvagePersonalMomentDepthFieldsFromRawModelText(raw)).toEqual({
      response_concreteness: 'moderate',
      emotional_vocab_count: 3,
      emotional_vocab_words: ['hurt', 'angry'],
      user_slice_word_count: 42,
    });
  });

  it('backfillMoment5KeyEvidenceIfScoresOtherwiseUnpersistable fills incomplete bundles', () => {
    const row = {
      pillarScores: mergeMoment5PillarScoresAfterEvidenceNormalize({}),
      keyEvidence: {},
    };
    backfillMoment5KeyEvidenceIfScoresOtherwiseUnpersistable(row, undefined, M5_TEST_GUARD);
    expect(row.keyEvidence.accountability).toBe(MOMENT5_BUNDLE_INCOMPLETE_EVIDENCE_LINE);
  });

  it('applyMoment5PostParseCoercionAndSalvage merges salvaged pillar scores from raw text', () => {
    const raw = '{"pillar_scores":{"accountability":null},"key_evidence":{},"accountability":7}';
    const parsed: Record<string, unknown> = {
      pillarScores: { accountability: null },
      keyEvidence: {},
    };
    applyMoment5PostParseCoercionAndSalvage(raw, parsed, M5_TEST_GUARD);
    expect(parsed.pillarScores).toEqual(expect.objectContaining({ accountability: 7 }));
  });

  it('moment5PrimaryParseIsComplete requires substantive evidence for every scored marker', () => {
    expect(
      moment5PrimaryParseIsComplete(
        { accountability: 6, mentalizing: 5, repair: null, regulation: null, contempt_expression: null },
        {
          accountability: 'User owned that they escalated when stressed.',
          mentalizing: 'Named what their friend was feeling.',
        },
      ),
    ).toBe(true);
    expect(
      moment5PrimaryParseIsComplete(
        { accountability: 6, mentalizing: 5 },
        { accountability: 'User owned their part.', mentalizing: '' },
      ),
    ).toBe(false);
  });

  it('finalizeMoment5ParsedModelScore keeps primary evidence and skips recovered filler', () => {
    const parsed: Record<string, unknown> = {
      pillarScores: {
        accountability: 6,
        mentalizing: 5,
        repair: null,
        regulation: null,
        contempt_expression: null,
      },
      keyEvidence: {
        accountability: 'User apologized and named their part.',
        mentalizing: 'Described what their friend was feeling.',
      },
    };
    const scoredVia = finalizeMoment5ParsedModelScore('{"pillarScores":{}}', parsed, M5_TEST_GUARD);
    expect(scoredVia).toBe('primary');
    expect(parsed.keyEvidence).toEqual({
      accountability: 'User apologized and named their part.',
      mentalizing: 'Described what their friend was feeling.',
    });
  });

  it('finalizeMoment5ParsedModelScore uses primary with transcript excerpts when model omits keyEvidence', () => {
    const raw =
      '{"pillarScores":{"accountability":6,"mentalizing":5,"repair":null,"regulation":null,"contempt_expression":null},"keyEvidence":{"accountability":"","mentalizing":""}}';
    const parsed: Record<string, unknown> = JSON.parse(raw);
    const scoredVia = finalizeMoment5ParsedModelScore(raw, parsed, M5_TEST_GUARD);
    expect(scoredVia).toBe('primary');
    expect(parsed.keyEvidence).toEqual(
      expect.objectContaining({
        accountability: expect.stringMatching(/^User: "/),
        mentalizing: expect.stringMatching(/^User: "/),
      }),
    );
    expect(parsed.keyEvidence).not.toEqual(
      expect.objectContaining({
        accountability: MOMENT5_SCORE_RECOVERED_EVIDENCE_LINE,
      }),
    );
  });

  it('finalizeMoment5ParsedModelScore uses recovery when transcript is not assessable', () => {
    const thinGuard = {
      transcript: [
        { role: 'assistant', content: MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT },
        { role: 'user', content: 'yes okay', interviewMoment: 5 },
      ],
      scoringSlice: [{ role: 'user', content: 'yes okay' }],
    };
    const raw =
      '{"pillarScores":{"accountability":6,"mentalizing":5,"repair":null,"regulation":null,"contempt_expression":null},"keyEvidence":{}}';
    const parsed: Record<string, unknown> = JSON.parse(raw);
    const scoredVia = finalizeMoment5ParsedModelScore(raw, parsed, thinGuard);
    expect(scoredVia).toBe('recovery');
    expect(parsed.keyEvidence).toEqual({});
  });

  it('lifts flat pillarScores when truncated JSON parses the nested scores object as root', () => {
    // Session ef5ea437: max_tokens cut mid-keyEvidence; only nested {accountability:6,...} balances.
    const truncated = `\`\`\`json
{
  "momentNumber": 5,
  "momentName": "Moment 5 (Personal Conflict / Accountability)",
  "pillarScores": {
    "accountability": 6,
    "mentalizing": 5,
    "repair": 5,
    "regulation": 5,
    "contempt_expression": 7
  },
  "pillarConfidence": {
    "accountability": "high",
    "mentalizing": "medium",
    "repair": "medium",
    "regulation": "medium",
    "contempt_expression": "high"
  },
  "keyEvidence": {
    "accountability": "MODERATE accountability band. The participant's f`;
    const parsedRoot = parseJsonObjectFromModelText(truncated) as Record<string, unknown>;
    expect(parsedRoot.pillarScores).toBeUndefined();
    expect(parsedRoot.accountability).toBe(6);

    const coerced = coerceMoment5ParsedModelRecord(parsedRoot);
    expect(coerced.pillarScores).toEqual(
      expect.objectContaining({
        accountability: 6,
        mentalizing: 5,
        repair: 5,
        regulation: 5,
        contempt_expression: 7,
      }),
    );

    const scoredVia = finalizeMoment5ParsedModelScore(truncated, parsedRoot, M5_TEST_GUARD, {
      parsedSnapshot: { pillarScores: parsedRoot.pillarScores, keyEvidence: parsedRoot.keyEvidence },
    });
    // Flat scores lift + transcript quote backfill → primary (session previously hit recovery via empty {}).
    expect(scoredVia).toBe('primary');
    expect(parsedRoot.pillarScores).toEqual(
      expect.objectContaining({ accountability: 6, contempt_expression: 7 }),
    );
  });
});
