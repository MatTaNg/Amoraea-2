import { describe, expect, it } from '@jest/globals';
import {
  aggregatePersonalMomentEmotionalVocab,
  computePersonalMomentEmotionalVocabDensityPercent,
  computePersonalMomentEmotionalVocabLow,
  depthEnrichedMarkerSlices,
  extractPersonalMomentEmotionalVocabFromSlice,
  personalMomentLexiconStatsFromInterviewMoment,
  personalMomentLexiconStatsFromUserText,
  scenarioEmotionalVocabDensityPercentFromTranscript,
  tokenMatchesPersonalMomentEmotionLexicon,
} from '../personalMomentEmotionalVocab';
import { responseConcretenessFromStoredMomentBundle } from '../personalMomentConcreteness';

describe('personalMomentEmotionalVocab', () => {
  it('lexicon matches Run 1 emotional terms', () => {
    for (const word of ['hurt', 'deprioritized', 'resigned', 'overwhelmed', 'resentment', 'tense']) {
      expect(tokenMatchesPersonalMomentEmotionLexicon(word)).toBe(true);
    }
  });

  it('personalMomentLexiconStatsFromUserText scans full moment 4+5 user text', () => {
    const stats = personalMomentLexiconStatsFromUserText(
      'I felt hurt and deprioritized, then resigned and overwhelmed by resentment',
    );
    expect(stats.emotional_vocab_words).toEqual(
      expect.arrayContaining(['hurt', 'deprioritized', 'resigned', 'overwhelmed', 'resentment']),
    );
    expect(stats.emotional_vocab_count).toBeGreaterThanOrEqual(5);
  });

  it('scenarioEmotionalVocabDensityPercentFromTranscript counts scenario user tokens', () => {
    const d = scenarioEmotionalVocabDensityPercentFromTranscript([
      { role: 'user', content: 'I felt hurt and angry', scenarioNumber: 1 },
      { role: 'user', content: 'neutral words here', scenarioNumber: 2 },
      { role: 'user', content: 'personal moment no scenario', scenarioNumber: undefined },
    ]);
    expect(d).not.toBeNull();
    expect(d!).toBeGreaterThan(0);
  });

  it('computePersonalMomentEmotionalVocabDensityPercent', () => {
    const m4 = extractPersonalMomentEmotionalVocabFromSlice({
      emotional_vocab_count: 2,
      emotional_vocab_words: ['hurt', 'angry'],
      user_slice_word_count: 100,
    });
    const m5 = extractPersonalMomentEmotionalVocabFromSlice({
      emotional_vocab_count: 1,
      emotional_vocab_words: ['sad'],
      user_slice_word_count: 100,
    });
    expect(computePersonalMomentEmotionalVocabDensityPercent(m4, m5)).toBeCloseTo(1.5, 5);
  });

  it('computePersonalMomentEmotionalVocabLow zero density is always low', () => {
    expect(
      computePersonalMomentEmotionalVocabLow({
        personalMomentDensityPercent: 0,
        scenarioEmotionalVocabDensityPercent: null,
        communicationStyleEmotionalVocabDensityPercent: null,
      }),
    ).toBe(true);
  });

  it('computePersonalMomentEmotionalVocabLow divergence', () => {
    expect(
      computePersonalMomentEmotionalVocabLow({
        personalMomentDensityPercent: 0.2,
        scenarioEmotionalVocabDensityPercent: 1.0,
        communicationStyleEmotionalVocabDensityPercent: null,
      }),
    ).toBe(true);
    expect(
      computePersonalMomentEmotionalVocabLow({
        personalMomentDensityPercent: 0.2,
        scenarioEmotionalVocabDensityPercent: null,
        communicationStyleEmotionalVocabDensityPercent: null,
      }),
    ).toBe(true);
    expect(
      computePersonalMomentEmotionalVocabLow({
        personalMomentDensityPercent: 0.2,
        scenarioEmotionalVocabDensityPercent: 0.1,
        communicationStyleEmotionalVocabDensityPercent: null,
      }),
    ).toBe(true);
    expect(
      computePersonalMomentEmotionalVocabLow({
        personalMomentDensityPercent: 0.5,
        scenarioEmotionalVocabDensityPercent: 2,
        communicationStyleEmotionalVocabDensityPercent: null,
      }),
    ).toBe(true);
  });

  it('responseConcretenessFromStoredMomentBundle reads legacy specificity field', () => {
    expect(responseConcretenessFromStoredMomentBundle({ specificity: 'high' })).toBe('high');
  });

  it('personalMomentLexiconStatsFromInterviewMoment counts words and lexicon hits', () => {
    const stats = personalMomentLexiconStatsFromInterviewMoment(
      [
        { role: 'user', content: 'I felt frustrated and tense', interviewMoment: 5 },
        { role: 'user', content: 'ignored', interviewMoment: 4 },
      ],
      5,
    );
    expect(stats.user_slice_word_count).toBe(5);
    expect(stats.emotional_vocab_count).toBeGreaterThanOrEqual(1);
    expect(stats.emotional_vocab_words.length).toBeGreaterThanOrEqual(1);
  });

  it('Sean-like personal moments yield non-zero vocab density from transcript', () => {
    const tx = [
      {
        role: 'user',
        content:
          'I have held a grudge against someone. I previously held a grudge against the ex-boyfriend of a really good friend of mine for things that he did to her in the relationship, like being unfaithful and not being honest.',
        interviewMoment: 4,
      },
      {
        role: 'user',
        content:
          'A good friend and I were making plans to take a trip, a flight to Vegas, and we were making plans on things to do and what nights to stay, what dates would work, and it just became really hard to communicate via text and it became frustrating for both of us and convoluted',
        interviewMoment: 5,
      },
      {
        role: 'user',
        content:
          'It felt like it got tense when it was a conversation through text, but as soon as we got on the phone with each other and heard each other speak, we were able to resolve it really quickly and just understood that it was not something that was upsetting.',
        interviewMoment: 5,
      },
    ];
    const enriched = depthEnrichedMarkerSlices(
      [null, null, null, { specificity: 'high', pillarScores: {} }, { specificity: 'high', pillarScores: {} }],
      tx,
    );
    const agg = aggregatePersonalMomentEmotionalVocab(enriched[3], enriched[4], {
      scenarioEmotionalVocabDensityPercent: null,
      communicationStyleEmotionalVocabDensityPercent: null,
    });
    expect(agg.personal_moment_emotional_vocab_density).not.toBeNull();
    expect(agg.personal_moment_emotional_vocab_density!).toBeGreaterThan(0);
  });

  it('depthEnrichedMarkerSlices maps specificity and transcript vocab for legacy rows', () => {
    const tx = [
      { role: 'user', content: 'I felt frustrated when we texted', interviewMoment: 5 },
      { role: 'user', content: 'I held a grudge for a long time', interviewMoment: 4 },
    ];
    const enriched = depthEnrichedMarkerSlices(
      [null, null, null, { specificity: 'high', pillarScores: {} }, { specificity: 'high', pillarScores: {} }],
      tx,
    );
    expect(enriched[3]?.response_concreteness).toBe('high');
    expect(enriched[4]?.response_concreteness).toBe('high');
    expect(enriched[4]?.user_slice_word_count).toBeGreaterThan(0);
    expect(enriched[4]?.emotional_vocab_count).toBeGreaterThanOrEqual(1);
  });

  it('aggregatePersonalMomentEmotionalVocab', () => {
    const a = aggregatePersonalMomentEmotionalVocab(
      { emotional_vocab_count: 0, emotional_vocab_words: [], user_slice_word_count: 200 },
      { emotional_vocab_count: 0, emotional_vocab_words: [], user_slice_word_count: 200 },
      { scenarioEmotionalVocabDensityPercent: 1.2, communicationStyleEmotionalVocabDensityPercent: null },
    );
    expect(a.personal_moment_emotional_vocab_density).toBe(0);
    expect(a.personal_moment_emotional_vocab_low).toBe(true);
  });
});
