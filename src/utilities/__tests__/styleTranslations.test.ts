import {
  countMatchmakerSummaryTemplateSentences,
  describeEmotionalAnalyticalAxis,
  describeRelationalIndividualAxis,
  formatCommunicationStyleForMatchmakerPrompt,
  matchmakerSummaryReadsAsChipRestatement,
  translateStyleProfile,
  type StyleProfile,
} from '../styleTranslations';

/**
 * Two turns with distinct personal episodic anchors — satisfies storyteller episode guard.
 * Each opens with felt-forward language so **leads with feeling** passes transcript opening guard (Prompt 6).
 */
const TWO_EPISODE_USER_TURNS = [
  'i felt completely stuck when we fought about money last year when i was home with my partner',
  'oh, the other day i called my friend to apologize because growing up i never knew how to say sorry',
];

function baseProfile(over: Partial<StyleProfile> = {}): StyleProfile {
  return {
    emotional_analytical_score: 0.5,
    narrative_conceptual_score: 0.5,
    certainty_ambiguity_score: 0.5,
    relational_individual_score: 0.5,
    emotional_vocab_density: 5,
    first_person_ratio: 0.5,
    qualifier_density: 5,
    avg_response_length: 100,
    warmth_score: 0.5,
    emotional_expressiveness: 0.5,
    pitch_range: 40,
    speech_rate: 130,
    pause_frequency: 2,
    energy_variation: 0.35,
    text_confidence: 0.8,
    audio_confidence: 0.8,
    ...over,
  };
}

describe('translateStyleProfile', () => {
  it('marks highly analytical + conceptual as heady (composite overrides)', () => {
    const t = translateStyleProfile(
      baseProfile({
        emotional_analytical_score: 0.2,
        narrative_conceptual_score: 0.2,
        audio_confidence: 0.5,
        speech_rate: 160,
        text_confidence: 0.8,
      })
    );
    expect(t.primary).toContain('heady');
    expect(t.primary).not.toContain('analytical');
    expect(t.primary).not.toContain('conceptual thinker');
  });

  it('Prompt 5: low narrative_conceptual score with verdict-only transcript does not assign conceptual thinker', () => {
    const corpus =
      'james dropped the ball emma was contemptuous that is the problem ryan should apologize for the long call';
    const t = translateStyleProfile(
      baseProfile({
        narrative_conceptual_score: 0.15,
        emotional_analytical_score: 0.52,
        text_confidence: 0.85,
        audio_confidence: 0.5,
      }),
      { userCorpus: corpus },
    );
    expect(t.primary).not.toContain('conceptual thinker');
    expect(t.secondary).toContain('moves between stories and ideas');
  });

  it('marks highly emotional + narrative profile', () => {
    const corpus = TWO_EPISODE_USER_TURNS.join(' ').toLowerCase();
    const t = translateStyleProfile(
      baseProfile({
        emotional_analytical_score: 0.9,
        narrative_conceptual_score: 0.9,
        audio_confidence: 0.3,
        text_confidence: 0.8,
      }),
      { userCorpus: corpus, userTurns: TWO_EPISODE_USER_TURNS }
    );
    expect(t.primary).toContain('leads with feeling');
    expect(t.primary).toContain('storyteller');
    expect(t.primary).not.toContain('heady');
  });

  /** Whole-word / phrase chips that must not appear in matchmaker_summary (warmth is allowed). */
  const LABEL_CHIP_PATTERNS = [
    /\bstoryteller\b/i,
    /\bconceptual thinker\b/i,
    /\bleads with feeling\b/i,
    /\bheady\b/i,
    /\banalytical\b/i,
    /\bexpressive\b/i,
    /\bcome across as\b/i,
  ];

  it('matchmaker_summary is exactly three sentences (dominant texture → partner needs → friction)', () => {
    const corpus = TWO_EPISODE_USER_TURNS.join(' ').toLowerCase();
    const t = translateStyleProfile(
      baseProfile({
        emotional_analytical_score: 0.72,
        narrative_conceptual_score: 0.72,
        audio_confidence: 0.3,
        text_confidence: 0.8,
      }),
      { userCorpus: corpus, userTurns: TWO_EPISODE_USER_TURNS }
    );
    const parts = t.matchmaker_summary.split(/\.\s+/).filter((p) => p.trim().length > 0);
    expect(parts.length).toBe(3);
    expect(parts[0]).toMatch(/^They |^How it landed/i);
    expect(parts[1]).toMatch(/^To register as heard/i);
    expect(parts[2]).toMatch(/^(With a partner|With a slower-paced)/i);
  });

  it('matchmaker_summary is descriptive prose without echoing label chips', () => {
    const corpus = TWO_EPISODE_USER_TURNS.join(' ').toLowerCase();
    const t = translateStyleProfile(
      baseProfile({
        emotional_analytical_score: 0.9,
        narrative_conceptual_score: 0.9,
        relational_individual_score: 0.3,
        audio_confidence: 0.3,
        text_confidence: 0.8,
      }),
      { userCorpus: corpus, userTurns: TWO_EPISODE_USER_TURNS }
    );
    for (const re of LABEL_CHIP_PATTERNS) {
      expect(t.matchmaker_summary).not.toMatch(re);
    }
    expect(t.matchmaker_summary).toMatch(
      /affect|charged|emotion|feeling|narrative|felt|mood|care|heard|understood|landed/i,
    );
    expect(t.matchmaker_summary).toMatch(/partner|heard|understood/i);
    expect(t.matchmaker_summary.split(/(?<=[.!?])\s+/).length).toBeGreaterThanOrEqual(2);
  });

  it('matchmaker_summary stays descriptive when primary includes storyteller (high narrative + feeling)', () => {
    const corpus = TWO_EPISODE_USER_TURNS.join(' ').toLowerCase();
    const t = translateStyleProfile(
      baseProfile({
        emotional_analytical_score: 0.72,
        narrative_conceptual_score: 0.85,
        audio_confidence: 0.3,
        text_confidence: 0.8,
      }),
      { userCorpus: corpus, userTurns: TWO_EPISODE_USER_TURNS }
    );
    expect(t.primary).toContain('storyteller');
    expect(matchmakerSummaryReadsAsChipRestatement(t.matchmaker_summary)).toBe(false);
    expect(t.matchmaker_summary).not.toMatch(/\bstoryteller\b/i);
    expect(t.matchmaker_summary).toMatch(/partner|heard|understood/i);
    expect(t.matchmaker_summary).toMatch(/friction|misaligned|bridgeable|repairable|clash|uneven|misread|pressed/i);
  });

  it('matchmakerSummaryReadsAsChipRestatement flags label-echo garbage', () => {
    expect(matchmakerSummaryReadsAsChipRestatement('They come across as storyteller.')).toBe(true);
    expect(matchmakerSummaryReadsAsChipRestatement('Concrete moments carry weight.')).toBe(false);
    expect(matchmakerSummaryReadsAsChipRestatement('On calls they sound warm and steady.')).toBe(true);
  });

  it('matchmakerSummaryReadsAsChipRestatement flags malformed primary-label one-liners (Prompt 4)', () => {
    expect(matchmakerSummaryReadsAsChipRestatement('They come across as leads with feeling')).toBe(true);
  });

  it('translateStyleProfile matchmaker_summary is always exactly three template sentences', () => {
    for (let ei = 0; ei <= 10; ei++) {
      for (let ni = 0; ni <= 10; ni++) {
        const t = translateStyleProfile(
          baseProfile({
            emotional_analytical_score: ei / 10,
            narrative_conceptual_score: ni / 10,
          }),
        );
        expect(countMatchmakerSummaryTemplateSentences(t.matchmaker_summary)).toBe(3);
      }
    }
  });

  it('NEUTRAL_MATCHMAKER_SUMMARY_FALLBACK is not mistaken for chip restatement', () => {
    const neutral =
      'They mix reflection and structure without a single fixed default, and context usually pulls whether heart or head goes first. They are most understood when a partner balances warmth with specificity—neither pure venting nor cold cross-examination. Most friction shows up when pace, directness, or how much feeling to surface first stay unstated; making those defaults explicit keeps things repairable.';
    expect(matchmakerSummaryReadsAsChipRestatement(neutral)).toBe(false);
    expect(countMatchmakerSummaryTemplateSentences(neutral)).toBe(3);
  });

  it('formatCommunicationStyleForMatchmakerPrompt centers authoritative summary and forbids chip echo in rules', () => {
    const block = formatCommunicationStyleForMatchmakerPrompt({
      primary: ['storyteller', 'warm'],
      secondary: [],
      matchmaker_summary:
        'They process experiences through emotion and narrative first, often sharing the felt texture before stripping it to logic alone.',
      low_confidence_note: null,
    });
    expect(block).toMatch(/AUTHORITATIVE SUMMARY/i);
    expect(block).toMatch(/PRODUCTION SOURCE|buildMatchmakerSummaryFromProfile/);
    expect(block).toContain('HARD RULES');
    expect(block).toContain('INTERNAL TAGS');
    expect(block).toContain('They process experiences through emotion');
    expect(block).not.toMatch(/unless you rewrite them into fresh descriptive prose/i);
  });

  it('adds low confidence note when text and audio confidence are weak', () => {
    const t = translateStyleProfile(
      baseProfile({
        text_confidence: 0.2,
        audio_confidence: 0.2,
      })
    );
    expect(t.low_confidence_note).toContain('still building');
  });

  it('omits low confidence note when overall confidence is adequate', () => {
    const t = translateStyleProfile(baseProfile({ text_confidence: 0.6, audio_confidence: 0.6 }));
    expect(t.low_confidence_note).toBeNull();
  });

  // relational_individual_score = individual-orientation (0 = relational, 1 = individual)
  it('adds relational secondary when individual-orientation is low (e.g. 0.33)', () => {
    const t = translateStyleProfile(baseProfile({ relational_individual_score: 0.33 }));
    expect(t.secondary).toContain('naturally thinks in terms of "we"');
    expect(t.secondary).not.toContain('strong sense of individual perspective');
  });

  /** Production bug report: 0.325 = low individual-orientation (relational) — must never map to individual secondary. */
  it('relational_individual_score 0.325 yields relational "we" secondary, not individual perspective', () => {
    const t = translateStyleProfile(baseProfile({ relational_individual_score: 0.325 }));
    expect(t.secondary).toContain('naturally thinks in terms of "we"');
    expect(t.secondary).not.toContain('strong sense of individual perspective');
  });

  it('adds individual secondary when individual-orientation is high', () => {
    const t = translateStyleProfile(baseProfile({ relational_individual_score: 0.72 }));
    expect(t.secondary).toContain('strong sense of individual perspective');
    expect(t.secondary).not.toContain('naturally thinks in terms of "we"');
  });

  it('omits relational/individual secondary in the moderate band', () => {
    const t = translateStyleProfile(baseProfile({ relational_individual_score: 0.5 }));
    expect(t.secondary).not.toContain('naturally thinks in terms of "we"');
    expect(t.secondary).not.toContain('strong sense of individual perspective');
  });

  it('describeRelationalIndividualAxis matches thresholds', () => {
    expect(describeRelationalIndividualAxis(0.2)).toBe('naturally thinks in terms of "we"');
    expect(describeRelationalIndividualAxis(0.8)).toBe('strong sense of individual perspective');
    expect(describeRelationalIndividualAxis(0.5)).toBe('balances "I" and "we"');
  });

  it('does not assign "more heart than head" for direct verdict register at moderate emotional_analytical_score', () => {
    const verdictCorpus =
      "emma is being contemptuous. that's the problem. james dropped the ball. simple as that. some people just aren't worth the energy."
        .toLowerCase();
    const t = translateStyleProfile(
      baseProfile({
        emotional_analytical_score: 0.667,
        emotional_vocab_density: 4.5,
        first_person_ratio: 0.48,
        narrative_conceptual_score: 0.48,
        audio_confidence: 0.3,
        text_confidence: 0.8,
      }),
      { userCorpus: verdictCorpus },
    );
    expect(t.secondary).not.toContain('more heart than head');
    expect(t.secondary).toContain('balanced head and heart');
  });

  it('assigns "more heart than head" when score is moderate but transcript has felt-forward language', () => {
    const feltCorpus =
      "oh i feel so sad for emma when he says that line — it hurts to watch. i was really moved when they tried to repair."
        .toLowerCase();
    const t = translateStyleProfile(
      baseProfile({
        emotional_analytical_score: 0.62,
        emotional_vocab_density: 5.5,
        first_person_ratio: 0.5,
        narrative_conceptual_score: 0.5,
        audio_confidence: 0.3,
        text_confidence: 0.8,
      }),
      { userCorpus: feltCorpus },
    );
    expect(t.secondary).toContain('more heart than head');
  });

  it('does not assign "more heart than head" when felt-forward opens only in personal segment (scenario main analysis)', () => {
    const mainAnalysis = [
      'This seems like a communication breakdown. They should set ground rules.',
      'Sarah is being unreasonable. James tried their best.',
    ];
    const personalTurns = [
      "Oh, I feel so sad for Sarah when she tears up — it hurts to watch.",
    ];
    const userTurns = [...mainAnalysis, ...personalTurns];
    const corpus = userTurns.join(' ').toLowerCase();
    const t = translateStyleProfile(
      baseProfile({
        emotional_analytical_score: 0.6,
        emotional_vocab_density: 5,
        first_person_ratio: 0.55,
        narrative_conceptual_score: 0.36,
        audio_confidence: 0.3,
        text_confidence: 1,
      }),
      {
        userCorpus: corpus,
        userTurns,
        scenarioMainAnalysisUserTurns: mainAnalysis,
        scenarioUserTurns: mainAnalysis,
        scenarioUserCorpus: mainAnalysis.join(' ').toLowerCase(),
      },
    );
    expect(t.secondary).not.toContain('more heart than head');
    expect(t.secondary).toContain('balanced head and heart');
  });

  it('assigns "more heart than head" when felt-forward opening appears in a main vignette analysis answer', () => {
    const mainAnalysis = [
      "Oh, I feel for Emma when the dinner runs long — it's painful to watch them disconnect.",
    ];
    const t = translateStyleProfile(
      baseProfile({
        emotional_analytical_score: 0.6,
        emotional_vocab_density: 5,
        first_person_ratio: 0.55,
        narrative_conceptual_score: 0.4,
        audio_confidence: 0.3,
        text_confidence: 1,
      }),
      {
        userCorpus: mainAnalysis.join(' ').toLowerCase(),
        userTurns: mainAnalysis,
        scenarioMainAnalysisUserTurns: mainAnalysis,
        scenarioUserTurns: mainAnalysis,
      },
    );
    expect(t.secondary).toContain('more heart than head');
  });

  it('does not assign "more heart than head" when "I feel" appears only in a fiction repair line, not main analysis', () => {
    const mainAnalysis = [
      'This seems like a communication breakdown.',
      'Sarah is being unreasonable.',
      'Sophie needs to let it go.',
    ];
    const fictionFollowUps = [
      "I would tell Sarah that I feel like I can't win — I showed up, I made plans, and it still wasn't enough.",
    ];
    const personalTurns = ["I'm actually the kind of person who finds it hard to celebrate others."];
    const userTurns = [...mainAnalysis, ...fictionFollowUps, ...personalTurns];
    const corpus = userTurns.join(' ').toLowerCase();
    const t = translateStyleProfile(
      baseProfile({
        emotional_analytical_score: 0.6,
        emotional_vocab_density: 5,
        first_person_ratio: 0.55,
        narrative_conceptual_score: 0.36,
        audio_confidence: 0.3,
        text_confidence: 1,
      }),
      {
        userCorpus: corpus,
        userTurns,
        scenarioMainAnalysisUserTurns: mainAnalysis,
        scenarioUserTurns: [...mainAnalysis, ...fictionFollowUps],
        scenarioUserCorpus: [...mainAnalysis, ...fictionFollowUps].join(' ').toLowerCase(),
      },
    );
    expect(t.secondary).not.toContain('more heart than head');
    expect(t.secondary).toContain('balanced head and heart');
  });

  it('describeEmotionalAnalyticalAxis does not infer "more heart" from profile row without transcript', () => {
    const row = {
      emotional_analytical_score: 0.667,
      emotional_vocab_density: 4.5,
      first_person_ratio: 0.48,
      narrative_conceptual_score: 0.48,
    };
    expect(describeEmotionalAnalyticalAxis(0.667, row)).toBe('balanced head and heart');
    const rowRich = { ...row, emotional_vocab_density: 8.0 };
    expect(describeEmotionalAnalyticalAxis(0.667, rowRich)).toBe('balanced head and heart');
  });

  it('Prompt 5: verdict S1 + generic S3 with high emotional_vocab_density does not get "more heart than head"', () => {
    const turns = [
      'james dropped the ball. simple as that',
      'relationships are hard and you have to push through the difficult parts',
    ];
    const t = translateStyleProfile(
      baseProfile({
        emotional_analytical_score: 0.62,
        emotional_vocab_density: 8.2,
        first_person_ratio: 0.52,
        narrative_conceptual_score: 0.5,
        audio_confidence: 0.3,
        text_confidence: 0.8,
      }),
      { userTurns: turns },
    );
    expect(t.secondary).not.toContain('more heart than head');
    expect(t.secondary).toContain('balanced head and heart');
  });

  it('does not assign storyteller when narrative score is high but transcript has fewer than two episodes', () => {
    const oneEpisodeCorpus =
      'i remember when i was a kid my mom said something that stuck with me and i still think about it sometimes'.toLowerCase();
    const t = translateStyleProfile(
      baseProfile({
        narrative_conceptual_score: 0.95,
        emotional_analytical_score: 0.55,
        audio_confidence: 0.3,
        text_confidence: 0.8,
      }),
      { userCorpus: oneEpisodeCorpus }
    );
    expect(t.primary).not.toContain('storyteller');
    expect(t.secondary).toContain('moves between stories and ideas');
  });

  it('Prompt 6: verdict-oriented transcript does not get leads with feeling or storyteller despite inflated axis scores', () => {
    const turns = [
      'james dropped the ball simple as that sarah needed to feel celebrated not logistics',
      'in general the demand withdraw pattern is obvious and clearly they both missed the bid',
    ];
    const corpus = turns.join(' ').toLowerCase();
    const t = translateStyleProfile(
      baseProfile({
        emotional_analytical_score: 0.78,
        narrative_conceptual_score: 0.82,
        emotional_vocab_density: 6.2,
        first_person_ratio: 0.45,
        audio_confidence: 0.35,
        text_confidence: 0.85,
      }),
      { userCorpus: corpus, userTurns: turns },
    );
    expect(t.primary).not.toContain('leads with feeling');
    expect(t.primary).not.toContain('storyteller');
  });

  it('Prompt 6: without transcript signal, high narrative score alone does not assign storyteller', () => {
    const t = translateStyleProfile(
      baseProfile({
        narrative_conceptual_score: 0.95,
        emotional_analytical_score: 0.5,
        audio_confidence: 0.3,
        text_confidence: 0.8,
      }),
    );
    expect(t.primary).not.toContain('storyteller');
  });

  it('Prompt 6: without transcript signal, high emotional score alone does not assign leads with feeling', () => {
    const t = translateStyleProfile(
      baseProfile({
        emotional_analytical_score: 0.9,
        narrative_conceptual_score: 0.45,
        audio_confidence: 0.3,
        text_confidence: 0.8,
      }),
    );
    expect(t.primary).not.toContain('leads with feeling');
  });
});
