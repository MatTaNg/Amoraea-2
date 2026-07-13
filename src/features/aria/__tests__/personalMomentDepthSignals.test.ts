import {
  applyMoment5PostParseCoercionAndSalvage,
  fillMoment5KeyEvidenceWhenNumericScoreButMissingQuote,
  mergeMoment5PillarScoresAfterEvidenceNormalize,
  MOMENT5_SCORE_RECOVERED_EVIDENCE_LINE,
  normalizeScoresByEvidence,
} from '../probeAndScoringUtils';
import {
  applyMoment5RecoveryPathDepthSignals,
  finalizePersonalMomentDepthSignals,
} from '../personalMomentDepthSignals';

describe('personalMomentDepthSignals', () => {
  const concreteM5Transcript = [
    {
      role: 'assistant',
      content: 'Tell me about a conflict with someone important.',
      interviewMoment: 5,
    },
    {
      role: 'user',
      content:
        'There was a time when my best friend Sarah and I had a serious falling out after I missed her wedding rehearsal because I was stuck at work. I felt terrible and ashamed that I let her down. We stopped talking for months. Eventually I called her, apologized for how dismissive I had been, and explained how afraid I was of disappointing her. She told me she felt hurt and abandoned. We met for coffee, talked through the tension, and slowly rebuilt trust. I learned that avoiding hard conversations only made things worse and that I need to show up even when it is uncomfortable.',
      interviewMoment: 5,
    },
  ] as const;

  const scoringSlice = [
    { role: 'assistant', content: 'Tell me about a conflict with someone important.' },
    { role: 'user', content: concreteM5Transcript[1]!.content },
  ];

  it('populates Moment 5 depth signals after recovery path with truncated model JSON', () => {
    const raw =
      '{"pillarScores":{"accountability":7,"mentalizing":6},"truncated":true}\n"repair": 5, "regulation": 6, "contempt_expression": 4';
    const parsed = {
      pillarScores: {} as Record<string, number | null>,
      keyEvidence: {} as Record<string, string>,
    };
    applyMoment5PostParseCoercionAndSalvage(raw, parsed as unknown as Record<string, unknown>, {
      transcript: [...concreteM5Transcript],
      scoringSlice,
    });
    fillMoment5KeyEvidenceWhenNumericScoreButMissingQuote(parsed, {
      transcript: [...concreteM5Transcript],
      scoringSlice,
    });
    parsed.pillarScores = mergeMoment5PillarScoresAfterEvidenceNormalize(
      normalizeScoresByEvidence(parsed.pillarScores, parsed.keyEvidence),
    ) as Record<string, number | null>;

    expect(parsed.keyEvidence.accountability).toMatch(/^User: "/);
    expect(parsed.pillarScores.accountability).toBe(7);

    const out = applyMoment5RecoveryPathDepthSignals({
      rawModelText: raw,
      parsed,
      transcript: concreteM5Transcript,
      scoringSlice,
    });

    expect(out.response_concreteness).not.toBeNull();
    expect(out.user_slice_word_count).toBeGreaterThan(100);
    expect(out.emotional_vocab_count).toBeGreaterThanOrEqual(1);
    expect(out.emotional_vocab_words?.length).toBeGreaterThanOrEqual(1);
  });

  it('salvages depth fields from raw model text when present in truncated tail', () => {
    const raw =
      '{"pillarScores":{"accountability":8}}\n"response_concreteness": "high", "user_slice_word_count": 183, "emotional_vocab_count": 4';
    const parsed = { pillarScores: { accountability: 8 }, keyEvidence: {} as Record<string, string> };

    finalizePersonalMomentDepthSignals(parsed, {
      rawModelText: raw,
      transcript: concreteM5Transcript,
      scoringSlice,
      moment: 5,
    });

    expect(parsed.response_concreteness).toBe('high');
    expect(parsed.user_slice_word_count).toBe(183);
    expect(parsed.emotional_vocab_count).toBe(4);
  });

  it('derives depth signals from transcript when recovery JSON has only pillar scores', () => {
    const parsed = {
      pillarScores: { accountability: 6, mentalizing: 5 },
      keyEvidence: { accountability: MOMENT5_SCORE_RECOVERED_EVIDENCE_LINE },
    };

    finalizePersonalMomentDepthSignals(parsed, {
      transcript: concreteM5Transcript,
      scoringSlice,
      moment: 5,
    });

    expect(parsed.response_concreteness).toMatch(/moderate|high/);
    expect(parsed.user_slice_word_count).toBeGreaterThan(80);
    expect(parsed.emotional_vocab_count).toBeGreaterThanOrEqual(1);
  });
});
