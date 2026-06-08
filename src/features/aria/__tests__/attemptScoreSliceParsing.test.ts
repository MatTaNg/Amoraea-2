import {
  buildInterviewAttemptGateCompletionFields,
  emotionalVocabWordsFromField,
  finiteNumberOrNull,
  markerSliceFromAttemptScoresField,
  markerSlicesFromAttemptRow,
  pickPersistedNumber,
  sliceScoresFromAttemptField,
} from '../../../../supabase/functions/_shared/attemptScoreSliceParsing';

describe('sliceScoresFromAttemptField', () => {
  it('reads camelCase and snake_case pillar fields', () => {
    expect(
      sliceScoresFromAttemptField({
        pillar_scores: { repair: 6.5 },
        key_evidence: { repair: 'owned the conflict' },
      }),
    ).toEqual({
      pillarScores: { repair: 6.5 },
      keyEvidence: { repair: 'owned the conflict' },
    });
  });

  it('returns null for non-objects', () => {
    expect(sliceScoresFromAttemptField(null)).toBeNull();
    expect(sliceScoresFromAttemptField([])).toBeNull();
  });
});

describe('markerSliceFromAttemptScoresField', () => {
  it('parses mentalizing and concreteness extensions', () => {
    const slice = markerSliceFromAttemptScoresField({
      pillarScores: { mentalizing: 5 },
      mentalizing_overcertainty: true,
      response_concreteness: 'high',
      user_slice_word_count: 42,
      emotional_vocab_count: 3,
      emotional_vocab_words: [' sad ', ''],
    });
    expect(slice).toMatchObject({
      pillarScores: { mentalizing: 5 },
      mentalizing_overcertainty: true,
      response_concreteness: 'high',
      user_slice_word_count: 42,
      emotional_vocab_count: 3,
      emotional_vocab_words: ['sad'],
    });
  });

  it('falls back specificity to response_concreteness', () => {
    expect(
      markerSliceFromAttemptScoresField({
        pillarScores: { repair: 1 },
        specificity: 'low',
      })?.response_concreteness,
    ).toBe('low');
  });
});

describe('markerSlicesFromAttemptRow', () => {
  it('returns five slots including moment scores from patterns', () => {
    const slices = markerSlicesFromAttemptRow({
      scenario_1_scores: { pillarScores: { contempt: 7 } },
      scenario_2_scores: null,
      scenario_3_scores: { pillarScores: { repair: 6 } },
      scenario_specific_patterns: {
        moment_4_scores: { pillarScores: { accountability: 5 } },
        moment_5_scores: { pillarScores: { regulation: 4 } },
      },
    });
    expect(slices).toHaveLength(5);
    expect(slices[0]?.pillarScores).toEqual({ contempt: 7 });
    expect(slices[1]).toBeNull();
    expect(slices[3]?.pillarScores).toEqual({ accountability: 5 });
  });
});

describe('finiteNumberOrNull / pickPersistedNumber', () => {
  it('coerces numeric strings', () => {
    expect(finiteNumberOrNull('6.25')).toBe(6.25);
    expect(finiteNumberOrNull('')).toBeNull();
  });

  it('prefers primary over fallback', () => {
    expect(pickPersistedNumber('7', 3)).toBe(7);
    expect(pickPersistedNumber(null, 3)).toBe(3);
  });
});

describe('emotionalVocabWordsFromField', () => {
  it('filters empty strings', () => {
    expect(emotionalVocabWordsFromField(['a', '  ', 'b'])).toEqual(['a', 'b']);
    expect(emotionalVocabWordsFromField([])).toBeUndefined();
  });
});

describe('buildInterviewAttemptGateCompletionFields', () => {
  it('uses gate_fail_reasons array and omits legacy gate_fail_reason', () => {
    const patch = buildInterviewAttemptGateCompletionFields({
      pass: false,
      weightedScore: 5.4,
      failReasonCodes: ['weighted_score', 'scenario_floor'],
      failReasonDetail: { weighted_score: { score: 5.4, requiredMin: 6 } },
    });
    expect(patch).toEqual({
      weighted_score: 5.4,
      passed: false,
      gate_fail_reasons: ['weighted_score', 'scenario_floor'],
      gate_fail_detail: {
        weighted_score: { score: 5.4, requiredMin: 6 },
        psychometric_floors: {},
      },
    });
    expect(patch).not.toHaveProperty('gate_fail_reason');
  });
});
