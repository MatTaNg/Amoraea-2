import {
  describeRelationalIndividualAxis,
  translateStyleProfile,
  type StyleProfile,
} from '../styleTranslations';

function baseProfile(over: Partial<StyleProfile> = {}): StyleProfile {
  return {
    emotional_analytical_score: 0.5,
    narrative_conceptual_score: 0.5,
    certainty_ambiguity_score: 0.5,
    relational_individual_score: 0.5,
    emotional_vocab_density: 5,
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

  it('marks highly emotional + narrative profile', () => {
    const t = translateStyleProfile(
      baseProfile({
        emotional_analytical_score: 0.9,
        narrative_conceptual_score: 0.9,
        audio_confidence: 0.3,
        text_confidence: 0.8,
      })
    );
    expect(t.primary).toContain('leads with feeling');
    expect(t.primary).toContain('storyteller');
    expect(t.primary).not.toContain('heady');
  });

  const LABEL_CHIP_SUBSTRINGS = [
    'leads with feeling',
    'storyteller',
    'heady',
    'analytical',
    'conceptual thinker',
    'warm',
    'expressive',
  ];

  it('matchmaker_summary is descriptive prose without echoing label chips', () => {
    const t = translateStyleProfile(
      baseProfile({
        emotional_analytical_score: 0.9,
        narrative_conceptual_score: 0.9,
        relational_individual_score: 0.3,
        audio_confidence: 0.3,
        text_confidence: 0.8,
      })
    );
    const lower = t.matchmaker_summary.toLowerCase();
    for (const chip of LABEL_CHIP_SUBSTRINGS) {
      expect(lower).not.toContain(chip);
    }
    expect(t.matchmaker_summary).toMatch(/emotion|feeling|narrative|felt/i);
    expect(t.matchmaker_summary).toMatch(/understood|partner/i);
    expect(t.matchmaker_summary.split(/(?<=[.!?])\s+/).length).toBeGreaterThanOrEqual(2);
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
});
