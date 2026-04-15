import {
  conceptualMarkerCount,
  countPersonalNarrativeEpisodesAcrossTranscript,
  narrativeConceptualRatioFromCorpus,
  normalizeInterviewStyleCorpus,
  qualifiesForLeadsWithFeelingPrimary,
  storyMarkerCount,
  STORY_MARKER_PATTERNS,
  strongConceptualMarkerCount,
  strongConceptualPatternFamilyCount,
} from '../../../supabase/functions/_shared/interviewStyleMarkers';
import { translateStyleProfile, type StyleProfile } from '../styleTranslations';

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

/** Gold-standard conceptual transcript (user-reported failure case): analytical only, no personal story. */
const GOLD_CONCEPTUAL_TRANSCRIPT =
  'demand-withdraw pattern category error co-regulation behavioral contract pursue-withdraw cycle';

/** Gold-standard narrative transcript: first-person episodic cues only (no framework lexicon). */
const GOLD_NARRATIVE_TRANSCRIPT =
  'i remember last year when i was home for the holidays growing up we were never big on speeches but the other day i called my aunt just to tell her i was proud of her';

/** Two user turns so episode count ≥ 2 (storyteller primary requires distinct narrative evidence). */
const GOLD_NARRATIVE_USER_TURNS = [
  'i remember last year when i was home my sister and i had a rough patch after a fight',
  'the other day i called my aunt growing up we never said much but i told her i was proud of her',
];

/** Longer analytical / clinical user voice (no story-marker hits; many conceptual hits). */
const GOLD_PURE_CONCEPTUAL_EXTENDED =
  'mentalizing attunement framework pattern dynamic typically in general people tend to relationships often co-regulation behavioral demand-withdraw cycle hypothesis construct operationalize systemic mechanism vignette category error';

/** Personal-story voice using only allowed story markers (sister / partner themes; avoid "pattern" etc.). */
const GOLD_PURE_NARRATIVE_EXTENDED =
  'i remember when i was younger my sister and i had a falling out last year the other day she texted me growing up we never said sorry but i called her';

/** Would match legacy bare `when i was` / `i remember` and score 1.0 with no conceptual tokens. */
const REGRESSION_VIGNETTE_HYPOTHETICAL_VOICE =
  'when i was thinking about the fight i remember ryan was pretty harsh and james could have listened better';

describe('leads with feeling primary (transcript + emotional_analytical_score)', () => {
  it('qualifies when opening is felt-forward and EA ≥ 0.65 even if corpus has many verdict phrases', () => {
    const turns = [
      'Oh, that line from Emma really landed for me — it felt harsh.',
      "James dropped the ball. That's the problem. The problem is he never showed up. Bottom line, he failed the repair.",
    ];
    const corpus = turns.join(' ').toLowerCase();
    expect(
      qualifiesForLeadsWithFeelingPrimary(
        { emotional_vocab_density: 2, first_person_ratio: 0.6, narrative_conceptual_score: 0.36 },
        { userTurns: turns, userCorpus: corpus },
      ),
    ).toBe(true);
    const labels = translateStyleProfile(
      baseProfile({
        emotional_analytical_score: 0.77,
        narrative_conceptual_score: 0.36,
        emotional_vocab_density: 2,
      }),
      { userTurns: turns, userCorpus: corpus },
    );
    expect(labels.primary).toContain('leads with feeling');
  });

  it('attempt 155 DB row shape: primary includes leads with feeling (high-axis path)', () => {
    const row = {
      emotional_analytical_score: 0.710526315789474,
      narrative_conceptual_score: 0.36,
      certainty_ambiguity_score: 0.5,
      relational_individual_score: 0.534653465346535,
      emotional_vocab_density: 1.92582025677603,
      first_person_ratio: 0.771428571428571,
      qualifier_density: 0.641940085592011,
      avg_response_length: 100.142857142857,
      text_confidence: 1,
      audio_confidence: 0,
    };
    const turns = ['Matt', 'yes', '"I think Emma has been sitting on this frustration for a while and it finally came out.'];
    const corpus = turns.join(' ').toLowerCase();
    const t = translateStyleProfile(baseProfile(row), { userTurns: turns, userCorpus: corpus });
    expect(t.primary).toContain('leads with feeling');
  });

  it('qualifies via high-axis fallback when openings are analytical but EA and emotional_vocab_density are high (attempt 153 shape)', () => {
    const turns = [
      'I think Emma has been sitting on this frustration for a while and it finally came out.',
      'I think James genuinely tried but missed the point entirely.',
    ];
    const corpus = turns.join(' ').toLowerCase();
    expect(
      qualifiesForLeadsWithFeelingPrimary(
        {
          emotional_analytical_score: 0.694,
          emotional_vocab_density: 1.86,
          first_person_ratio: 0.77,
          narrative_conceptual_score: 0.36,
        },
        { userTurns: turns, userCorpus: corpus },
      ),
    ).toBe(true);
    const labels = translateStyleProfile(
      baseProfile({
        emotional_analytical_score: 0.694,
        narrative_conceptual_score: 0.36,
        emotional_vocab_density: 1.86,
        first_person_ratio: 0.77,
      }),
      { userTurns: turns, userCorpus: corpus },
    );
    expect(labels.primary).toContain('leads with feeling');
  });
});

describe('interviewStyleMarkers narrative vs conceptual (production scoring)', () => {
  /**
   * VALIDATION — scale direction (production):
   *   narrative_conceptual_score ∈ [0, 1]. 0 = conceptual pole, 1 = narrative pole.
   *   Purely conceptual vs purely narrative gold corpora must land on opposite ends.
   */
  it('validation: pure conceptual vs pure narrative corpora hit opposite poles (0 vs 1) in correct direction', () => {
    const cShort = narrativeConceptualRatioFromCorpus(GOLD_CONCEPTUAL_TRANSCRIPT.toLowerCase());
    const nShort = narrativeConceptualRatioFromCorpus(GOLD_NARRATIVE_TRANSCRIPT.toLowerCase());
    const cLong = narrativeConceptualRatioFromCorpus(GOLD_PURE_CONCEPTUAL_EXTENDED.toLowerCase());
    const nLong = narrativeConceptualRatioFromCorpus(GOLD_PURE_NARRATIVE_EXTENDED.toLowerCase());

    expect(cShort).toBe(0);
    expect(nShort).toBe(1);
    expect(cLong).toBe(0);
    expect(nLong).toBe(1);

    expect(cShort).toBeLessThan(nShort);
    expect(cLong).toBeLessThan(nLong);
    expect(Math.min(cShort, cLong)).toBeLessThan(Math.max(nShort, nLong));
  });

  it('GOLD conceptual: ratio is 0.0 — not 1.0; labels must not be storyteller', () => {
    const corpus = GOLD_CONCEPTUAL_TRANSCRIPT.toLowerCase();
    const r = narrativeConceptualRatioFromCorpus(corpus);
    expect(r).toBe(0);
    expect(storyMarkerCount(normalizeInterviewStyleCorpus(corpus))).toBe(0);
    expect(conceptualMarkerCount(normalizeInterviewStyleCorpus(corpus))).toBeGreaterThan(3);

    const t = translateStyleProfile(
      baseProfile({
        narrative_conceptual_score: r,
        emotional_analytical_score: 0.52,
        audio_confidence: 0.3,
        text_confidence: 0.8,
      }),
      { userCorpus: corpus },
    );
    expect(t.primary).not.toContain('storyteller');
    expect(t.primary).toContain('conceptual thinker');
  });

  it('GOLD narrative: ratio is 1.0; storyteller label when score crosses threshold and ≥2 narrative episodes', () => {
    const corpus = GOLD_NARRATIVE_TRANSCRIPT.toLowerCase();
    const r = narrativeConceptualRatioFromCorpus(corpus);
    expect(r).toBe(1);
    expect(storyMarkerCount(normalizeInterviewStyleCorpus(corpus))).toBeGreaterThan(0);
    expect(conceptualMarkerCount(normalizeInterviewStyleCorpus(corpus))).toBe(0);

    expect(countPersonalNarrativeEpisodesAcrossTranscript({ userCorpus: corpus })).toBeLessThan(2);

    const tBlocked = translateStyleProfile(
      baseProfile({
        narrative_conceptual_score: r,
        emotional_analytical_score: 0.55,
        audio_confidence: 0.3,
        text_confidence: 0.8,
      }),
      { userCorpus: corpus },
    );
    expect(tBlocked.primary).not.toContain('storyteller');

    const turnsCorpus = GOLD_NARRATIVE_USER_TURNS.join(' ').toLowerCase();
    const t = translateStyleProfile(
      baseProfile({
        narrative_conceptual_score: r,
        emotional_analytical_score: 0.55,
        audio_confidence: 0.3,
        text_confidence: 0.8,
      }),
      { userCorpus: turnsCorpus, userTurns: GOLD_NARRATIVE_USER_TURNS },
    );
    expect(countPersonalNarrativeEpisodesAcrossTranscript({ userTurns: GOLD_NARRATIVE_USER_TURNS })).toBeGreaterThanOrEqual(2);
    expect(t.primary).toContain('storyteller');
    expect(t.primary).not.toContain('conceptual thinker');
  });

  it('normalizes Unicode hyphens so co-regulation matches conceptual lexicon', () => {
    const withUnicodeDash = 'co\u2011regulation demand\u2011withdraw pattern';
    const r = narrativeConceptualRatioFromCorpus(withUnicodeDash);
    expect(r).toBe(0);
    expect(conceptualMarkerCount(normalizeInterviewStyleCorpus(withUnicodeDash))).toBeGreaterThan(2);
  });

  it('treats mixed clinical + vignette deixis as conceptual (low narrative ratio)', () => {
    const corpus =
      `${GOLD_CONCEPTUAL_TRANSCRIPT} earlier when sarah said james needed repair mentalizing attunement`.toLowerCase();
    const r = narrativeConceptualRatioFromCorpus(corpus);
    expect(r).toBeLessThan(0.35);
    expect(storyMarkerCount(normalizeInterviewStyleCorpus(corpus))).toBe(0);
    expect(conceptualMarkerCount(normalizeInterviewStyleCorpus(corpus))).toBeGreaterThan(5);
  });

  it('does not count generic "earlier" / "yesterday" as story markers', () => {
    const corpus =
      'earlier yesterday when the interviewer asked about the vignette the pattern was demand withdraw'
        .toLowerCase();
    expect(storyMarkerCount(normalizeInterviewStyleCorpus(corpus))).toBe(0);
  });

  /**
   * Prompt 5 — Bare "when i was …" / "i remember …" on vignette hypotheticals used to yield
   * storyHits > 0 with conceptHits === 0 → narrative_conceptual_score 1.0 with almost no real narrative.
   */
  it('regression (Prompt 5): vignette-hypothetical voice does not hit narrative pole (not 1.0)', () => {
    const norm = normalizeInterviewStyleCorpus(REGRESSION_VIGNETTE_HYPOTHETICAL_VOICE.toLowerCase());
    expect(storyMarkerCount(norm)).toBe(0);
    const r = narrativeConceptualRatioFromCorpus(REGRESSION_VIGNETTE_HYPOTHETICAL_VOICE.toLowerCase());
    expect(r).not.toBe(1);
    expect(r).toBe(0.5);
  });

  it('regression (Prompt 5): analytical scenario walkthrough + old false positives stays conceptual pole', () => {
    const conceptualWalkthrough =
      `${REGRESSION_VIGNETTE_HYPOTHETICAL_VOICE} ${GOLD_CONCEPTUAL_TRANSCRIPT}`.toLowerCase();
    const r = narrativeConceptualRatioFromCorpus(conceptualWalkthrough);
    expect(r).toBe(0);
    expect(r).toBeLessThan(0.35);
  });

  it('regression (Prompt 5): rich autobiographical transcript still hits narrative pole (1.0)', () => {
    expect(STORY_MARKER_PATTERNS.length).toBeGreaterThanOrEqual(5);
    const r = narrativeConceptualRatioFromCorpus(GOLD_NARRATIVE_TRANSCRIPT.toLowerCase());
    expect(r).toBe(1);
    expect(storyMarkerCount(normalizeInterviewStyleCorpus(GOLD_NARRATIVE_TRANSCRIPT.toLowerCase()))).toBeGreaterThan(0);
  });

  it('never maps conceptual-heavy text to storyteller (heady path still avoids storyteller)', () => {
    const nc = narrativeConceptualRatioFromCorpus(
      'demand-withdraw cycle category error co-regulation behavioral contract'.toLowerCase(),
    );
    expect(nc).toBe(0);
    const conceptualCorpus =
      'demand-withdraw cycle category error co-regulation behavioral contract'.toLowerCase();
    const t = translateStyleProfile(
      baseProfile({
        narrative_conceptual_score: nc,
        emotional_analytical_score: 0.2,
        audio_confidence: 0.5,
        speech_rate: 160,
        text_confidence: 0.8,
      }),
      { userCorpus: conceptualCorpus },
    );
    expect(t.primary).toContain('heady');
    expect(t.primary).not.toContain('storyteller');
  });

  /** Verdict-oriented scenario analysis without framework lexicon — not the conceptual pole (Prompt 4). */
  const VERDICT_SCENARIO_VOICE =
    'james dropped the ball emma was contemptuous ryan needs to apologize the pattern keeps repeating';

  it('verdict-oriented scenario voice uses mid-band floor when ratio would be 0 with only weak conceptual hits', () => {
    const norm = normalizeInterviewStyleCorpus(VERDICT_SCENARIO_VOICE.toLowerCase());
    expect(storyMarkerCount(norm)).toBe(0);
    expect(conceptualMarkerCount(norm)).toBeGreaterThan(0);
    expect(strongConceptualMarkerCount(norm)).toBe(0);
    const r = narrativeConceptualRatioFromCorpus(VERDICT_SCENARIO_VOICE.toLowerCase());
    expect(r).toBeGreaterThanOrEqual(0.34);
    expect(r).toBeLessThanOrEqual(0.38);
  });

  it('mid-band floor applies when raw ratio is small but non-zero and strong framework count is 0 (Prompt 4)', () => {
    const corpus =
      'last year james dropped the ball emma was contemptuous ryan should apologize the thing about repair is people tend to listen when you pattern the dynamic'
        .toLowerCase();
    const norm = normalizeInterviewStyleCorpus(corpus);
    expect(storyMarkerCount(norm)).toBeGreaterThanOrEqual(1);
    expect(strongConceptualMarkerCount(norm)).toBe(0);
    const r = narrativeConceptualRatioFromCorpus(corpus);
    expect(r).toBeGreaterThanOrEqual(0.34);
    expect(r).toBeLessThanOrEqual(0.38);
  });

  it('mid-band floor still applies with exactly one strong framework token (verdict-heavy interview)', () => {
    const corpus =
      'emma is being contemptuous that is the problem james dropped the ball daniel needs to stop leaving frustrating the pattern for sophie one stray hypothesis about repair'
        .toLowerCase();
    const norm = normalizeInterviewStyleCorpus(corpus);
    expect(strongConceptualMarkerCount(norm)).toBe(1);
    expect(storyMarkerCount(norm)).toBe(0);
    const r = narrativeConceptualRatioFromCorpus(corpus);
    expect(r).toBeGreaterThanOrEqual(0.35);
    expect(r).toBeLessThanOrEqual(0.4);
  });

  it('two or more distinct strong framework families keep raw ratio at conceptual pole (no floor)', () => {
    const corpus =
      'demand-withdraw dynamic and co-regulation framing emma was wrong category error pursue-withdrawal cycle'
        .toLowerCase();
    const norm = normalizeInterviewStyleCorpus(corpus);
    expect(strongConceptualPatternFamilyCount(norm)).toBeGreaterThanOrEqual(2);
    const r = narrativeConceptualRatioFromCorpus(corpus);
    expect(r).toBeLessThanOrEqual(0.05);
  });

  it('repeated mentions of one framework token count as one family so mid-band floor still applies', () => {
    const corpus =
      'emma was wrong james failed hypothesis hypothesis hypothesis ryan should apologize the pattern keeps repeating'
        .toLowerCase();
    const norm = normalizeInterviewStyleCorpus(corpus);
    expect(strongConceptualMarkerCount(norm)).toBeGreaterThanOrEqual(2);
    expect(strongConceptualPatternFamilyCount(norm)).toBe(1);
    const r = narrativeConceptualRatioFromCorpus(corpus);
    expect(r).toBeGreaterThanOrEqual(0.34);
    expect(r).toBeLessThanOrEqual(0.4);
  });
});

/** Prompt 5 — production validation transcripts (opposite poles on 0 = conceptual, 1 = narrative). */
const PROMPT5_CONCEPTUAL_USER_TRANSCRIPT =
  'demand-withdraw pattern category error pursue-withdraw cycle behavioral contract. verdict-oriented: emma blew it james failed the repair. no story just the frame.';

const PROMPT5_NARRATIVE_USER_TRANSCRIPT =
  'oh emma is hurting when he says that line. this one actually made me a little sad. i had a grudge with my sister for years after she bailed on my birthday. when my partner got their promotion i remember how lit up they were we went out to celebrate growing up we never said proud out loud but that night i told them.';

describe('Prompt 5 — narrative_conceptual_score validation corpora', () => {
  it('conceptual user transcript stays near conceptual pole; narrative transcript near narrative pole', () => {
    const c = narrativeConceptualRatioFromCorpus(PROMPT5_CONCEPTUAL_USER_TRANSCRIPT.toLowerCase());
    const n = narrativeConceptualRatioFromCorpus(PROMPT5_NARRATIVE_USER_TRANSCRIPT.toLowerCase());
    expect(c).toBeLessThan(0.4);
    expect(n).toBeGreaterThan(0.6);
    expect(c).toBeLessThan(n);
  });

  it('conceptual transcript does not yield storyteller primary; narrative with two-turn episodes can', () => {
    const c = PROMPT5_CONCEPTUAL_USER_TRANSCRIPT.toLowerCase();
    const nc = narrativeConceptualRatioFromCorpus(c);
    const tConcept = translateStyleProfile(
      baseProfile({
        narrative_conceptual_score: nc,
        emotional_analytical_score: 0.45,
        audio_confidence: 0.3,
        text_confidence: 0.85,
      }),
      { userCorpus: c },
    );
    expect(tConcept.primary).not.toContain('storyteller');
    expect(tConcept.primary).toContain('conceptual thinker');

    const turns = [
      'oh emma is hurting when he says that this one actually made me a little sad. i remember last year when i was home my sister and i had a rough patch after she bailed on my birthday.',
      'the other day i called my aunt growing up we never said proud out loud but i told her i was proud of her.',
      'when my partner got promoted i remember how lit up they were we went out to celebrate that night.',
    ];
    const corpusN = turns.join(' ').toLowerCase();
    const nn = narrativeConceptualRatioFromCorpus(corpusN);
    expect(nn).toBeGreaterThan(0.6);
    expect(countPersonalNarrativeEpisodesAcrossTranscript({ userTurns: turns })).toBeGreaterThanOrEqual(2);
    const tNarr = translateStyleProfile(
      baseProfile({
        narrative_conceptual_score: nn,
        emotional_analytical_score: 0.58,
        audio_confidence: 0.3,
        text_confidence: 0.85,
      }),
      { userCorpus: corpusN, userTurns: turns },
    );
    expect(tNarr.primary).toContain('storyteller');
    expect(tNarr.primary).not.toContain('conceptual thinker');
  });
});
