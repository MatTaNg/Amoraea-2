/**
 * Regression fixtures inspired by manual interview calibration ("Test Sets" 1–6) and moment probes.
 * These tests do not run the full Aria LLM pipeline; they lock:
 * - `translateStyleProfile` chip outputs for synthetic DB rows + transcript shape
 * - `probeAndScoringUtils` gates on canonical user strings from the calibration doc
 *
 * Production scoring still uses analyze-interview-text/audio; numbers here mirror expected poles.
 */

import {
  hasScenarioAQ1ContemptProbeCoverage,
  hasScenarioAQ1VignetteEngagement,
  hasScenarioCCommitmentThresholdInUserAnswer,
} from '@features/aria/probeAndScoringUtils';
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
    text_confidence: 0.9,
    audio_confidence: 0.5,
    ...over,
  };
}

/** Test Set 1 — analytical / framework voice (manual: heady, conceptual, values clarity). */
const SET1_SCENARIO_CORPUS =
  [
    "What's happening here is a classic demand-withdraw pattern. Sam is expressing unmet needs through criticism rather than vulnerability, and Reese is defending rather than acknowledging impact.",
    'Jordan made a category error — conflating celebration with information processing. Alex needed co-regulation and emotional mirroring, not logistical support.',
    "This is a textbook pursue-withdraw cycle. Morgan's pursuit triggers Theo's flooding which triggers more pursuit. Theo's return with vulnerability is structurally significant.",
    "I've analyzed this pattern in myself — I tend to exit relationships where the cost-benefit ratio of repair exceeds the perceived value of the connection.",
    'I itemized the interventions and their outcomes. They said it was the most meaningful thing a mentee had ever given them.',
  ]
    .join(' ')
    .toLowerCase();

/** Episodic turns would inflate narrative episodes; Set 1 is scored as conceptual-heavy in manual tests. */
const SET1_USER_TURNS = [
  "What's happening here is a classic demand-withdraw pattern. Sam is expressing unmet needs through criticism rather than vulnerability.",
  'Jordan made a category error — conflating celebration with information processing.',
  "This is a textbook pursue-withdraw cycle. Morgan's pursuit triggers Theo's flooding.",
  'I tend to exit relationships where the cost-benefit ratio of repair exceeds the perceived value.',
  'I itemized the interventions and their outcomes in a letter to a mentor.',
];

/** Test Set 2 — warm / expressive / feeling-first (manual). */
const SET2_USER_TURNS = [
  "Oh, Sam is hurting. That 'you've made that very clear' — there's so much pain packed into that line.",
  'This one actually made me a little sad. Alex was so excited — called from the street — and then spent the evening feeling invisible.',
  "When Theo came back I felt something shift. There's something so vulnerable about 'I didn't know how'.",
  'Yeah, I held a grudge against my sister for almost a year after she said something that cut really deep at a family dinner. I was devastated. I cried about it for days.',
  "My partner got a promotion they'd been working toward for two years. I cried when they told me — happy tears, just so proud.",
];

const SET2_CORPUS = SET2_USER_TURNS.join(' ').toLowerCase();

/** Test Set 3 — storyteller / narrative (manual). */
const SET3_USER_TURNS = [
  'This reminds me of a dinner I had with my ex. We were at this little Italian place on a Tuesday night, almost empty, and I took a call from my brother halfway through.',
  "There's a specific feeling I know from the other side of this. I got into grad school after three rejections and I called my dad from the parking lot of a Target.",
  'My college roommate used to go completely silent during arguments. Just — nothing. And I would escalate trying to get a response.',
  'My friend Maya told my then-boyfriend something I had shared in complete confidence. I found out at a dinner party of all places.',
  'My grandmother turned 80 last spring. We threw her a party but the thing I did that mattered — I made a book.',
];

const SET3_CORPUS = SET3_USER_TURNS.join(' ').toLowerCase();

/** Test Set 4 — ambiguity-tolerant (manual: high certainty_ambiguity, qualifiers). */
const SET4_USER_TURNS = [
    "I'm not sure there's a clean read on this one. Sam might be expressing something real or might be displacing frustration from somewhere else entirely.",
    "I keep going back and forth on Jordan. Part of me thinks Jordan genuinely thought that's what celebration looks like.",
    "I don't think there's a formula for when to leave. I've sat with that question for a long time in my own life and I keep arriving at something like — you know when you know.",
    "I've been thinking about this more lately and I'm genuinely not sure I've resolved it. I think I've made peace with the situation but I don't know if I've made peace with the person.",
    "I'm not sure I do this as well as I'd like to. I notice appreciation in myself and sometimes I express it and sometimes it stays internal.",
];

const SET4_CORPUS = SET4_USER_TURNS.join(' ').toLowerCase();

/** Test Set 5 — closure-oriented (manual: definitive language). */
const SET5_USER_TURNS = [
  "Sam is being contemptuous. That's the problem. Reese made a mistake but Sam's response is the bigger issue here.",
  'Jordan dropped the ball. Simple as that. Alex needed to feel celebrated and Jordan made it about logistics.',
  "Theo needs to stop leaving. That's the core issue. You can't keep walking out on someone and expect the relationship to work.",
  "I ended the friendship. We'd been friends for six years but what they did was a clear violation and I wasn't willing to minimize it.",
  'I threw my brother a surprise party for his 40th. Organized everything, got the people there, made sure it went smoothly.',
];

const SET5_CORPUS = SET5_USER_TURNS.join(' ').toLowerCase();

/** Test Set 6 — relational depth (manual: we-frame, long arc). */
const SET6_USER_TURNS = [
  'What strikes me is that neither of them is actually talking about what is between them. Sam line lands as contemptuous but underneath it is probably fear.',
  'The thing that gets me is that Alex and Jordan probably both care deeply about each other — otherwise this would not hurt.',
  "What I keep thinking about is what it costs Theo to come back. Not just this time but every time. There's something in Theo that wants connection badly enough to return despite not knowing how.",
  'What changed for me was realizing that the grudge was about something much older than this particular person.',
  'The most important thing I have ever done for someone was just staying. My closest friend went through something really dark a few years ago and I just stayed present through all of it.',
];

const SET6_CORPUS = SET6_USER_TURNS.join(' ').toLowerCase();

describe('Manual calibration Test Sets 1–6 — translateStyleProfile', () => {
  it('Set 1: heady composite subsumes analytical + conceptual thinker; closure-leaning secondary', () => {
    const t = translateStyleProfile(
      baseProfile({
        emotional_analytical_score: 0.19,
        narrative_conceptual_score: 0.17,
        certainty_ambiguity_score: 0.28,
        relational_individual_score: 0.52,
        qualifier_density: 6.2,
        avg_response_length: 155,
        speech_rate: 162,
        text_confidence: 0.95,
        audio_confidence: 0.55,
        warmth_score: 0.48,
        emotional_expressiveness: 0.42,
      }),
      { userCorpus: SET1_SCENARIO_CORPUS, userTurns: SET1_USER_TURNS },
    );
    expect(t.primary).toContain('heady');
    expect(t.primary).not.toContain('analytical');
    expect(t.primary).not.toContain('conceptual thinker');
    expect(t.secondary).toContain('values clarity and resolution');
    expect(t.matchmaker_summary.length).toBeGreaterThan(80);
    expect(t.matchmaker_summary.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length >= 28).length).toBe(3);
  });

  it('Set 2: leads with feeling, warm, expressive (audio on); NC mid so storyteller stays secondary not third primary', () => {
    const t = translateStyleProfile(
      baseProfile({
        emotional_analytical_score: 0.88,
        // Below 0.68 so storyteller is not a primary chip (manual: storyteller secondary); keeps expressive in top-3 primary.
        narrative_conceptual_score: 0.62,
        certainty_ambiguity_score: 0.48,
        relational_individual_score: 0.42,
        emotional_vocab_density: 2.4,
        first_person_ratio: 0.78,
        avg_response_length: 165,
        warmth_score: 0.78,
        emotional_expressiveness: 0.8,
        speech_rate: 140,
        text_confidence: 0.95,
        audio_confidence: 0.72,
      }),
      { userCorpus: SET2_CORPUS, userTurns: SET2_USER_TURNS },
    );
    expect(t.primary).toEqual(['leads with feeling', 'warm', 'expressive']);
    expect(t.secondary.join(' ')).toMatch(/storyteller|moves between stories and ideas/);
  });

  it('Set 3: storyteller primary with narrative episodes + warm EA', () => {
    const t = translateStyleProfile(
      baseProfile({
        emotional_analytical_score: 0.82,
        narrative_conceptual_score: 0.88,
        certainty_ambiguity_score: 0.45,
        relational_individual_score: 0.48,
        emotional_vocab_density: 2.0,
        first_person_ratio: 0.72,
        avg_response_length: 178,
        warmth_score: 0.62,
        emotional_expressiveness: 0.68,
        text_confidence: 0.95,
        audio_confidence: 0.65,
      }),
      { userCorpus: SET3_CORPUS, userTurns: SET3_USER_TURNS },
    );
    expect(t.primary).toContain('storyteller');
    expect(t.primary).toContain('leads with feeling');
    expect(t.primary).not.toContain('heady');
  });

  it('Set 4: comfortable with uncertainty; not heady (mid EA / NC)', () => {
    const t = translateStyleProfile(
      baseProfile({
        emotional_analytical_score: 0.52,
        narrative_conceptual_score: 0.48,
        certainty_ambiguity_score: 0.72,
        relational_individual_score: 0.5,
        qualifier_density: 8.5,
        avg_response_length: 140,
        text_confidence: 0.92,
        audio_confidence: 0.45,
      }),
      { userCorpus: SET4_CORPUS, userTurns: SET4_USER_TURNS },
    );
    expect(t.secondary).toContain('comfortable with uncertainty');
    expect(t.primary).not.toContain('heady');
  });

  it('Set 5: values clarity and resolution secondary; definitive voice', () => {
    const t = translateStyleProfile(
      baseProfile({
        emotional_analytical_score: 0.48,
        narrative_conceptual_score: 0.42,
        certainty_ambiguity_score: 0.22,
        relational_individual_score: 0.55,
        avg_response_length: 120,
        text_confidence: 0.9,
        audio_confidence: 0.5,
      }),
      { userCorpus: SET5_CORPUS, userTurns: SET5_USER_TURNS },
    );
    expect(t.secondary).toContain('values clarity and resolution');
    expect(t.secondary).not.toContain('comfortable with uncertainty');
  });

  it('Set 6: goes deep + we-oriented secondary when profile is relational and answers are long', () => {
    const t = translateStyleProfile(
      baseProfile({
        emotional_analytical_score: 0.78,
        narrative_conceptual_score: 0.64,
        certainty_ambiguity_score: 0.62,
        relational_individual_score: 0.28,
        avg_response_length: 220,
        emotional_vocab_density: 1.45,
        first_person_ratio: 0.72,
        warmth_score: 0.74,
        emotional_expressiveness: 0.74,
        text_confidence: 0.94,
        audio_confidence: 0.62,
      }),
      { userCorpus: SET6_CORPUS, userTurns: SET6_USER_TURNS },
    );
    expect(t.secondary).toContain('goes deep in conversation');
    expect(t.secondary).toContain('naturally thinks in terms of "we"');
    expect(t.primary).toContain('leads with feeling');
    expect(t.primary).toContain('warm');
  });
});

/** Strings from the calibration doc — Scenario A Sam/Reese. */
const MOMENT1_A1_HIGH_MENTALIZING =
  "I think Sam has been sitting on this frustration for a while and it finally came out — but in a way that was more like a jab than an honest conversation. The 'you've made that very clear' line has this cold, superior quality to it, like Sam has already decided Reese is guilty and there's no room for a real conversation.";

const MOMENT1_CONTEMPT_PROBE_B1 =
  "Sam's line when she says you've made that very clear — it's a contemptuous line. There's a coldness and superiority in it — it's not an expression of hurt, it's a verdict. Sam has already decided Reese is guilty and that line is designed to sting rather than open a conversation.";

describe('Manual calibration — Scenario A probe helpers', () => {
  it('Q1 high mentalizing answer engages vignette (Sam/Reese)', () => {
    expect(hasScenarioAQ1VignetteEngagement(MOMENT1_A1_HIGH_MENTALIZING)).toBe(true);
  });

  it('Contempt probe B1 names contempt + references Sam line — counts as contempt coverage (skips redundant probe)', () => {
    expect(hasScenarioAQ1ContemptProbeCoverage(MOMENT1_CONTEMPT_PROBE_B1)).toBe(true);
  });

  it('Low-insight B6 does not satisfy contempt probe coverage', () => {
    expect(
      hasScenarioAQ1ContemptProbeCoverage(
        "Sam is just upset and saying something in the heat of the moment. You've made that very clear — that phrasing doesn't land as much more than venting.",
      ),
    ).toBe(false);
  });
});

/** Must match `hasScenarioCCommitmentThresholdInUserAnswer` (relationship outcome / irrecoverability). */
const SCENARIO_C_THRESHOLD_HIGH =
  "If this pattern keeps happening after they have really tried therapy, I would say the relationship is not working. Theo and Morgan would need to see real change.";

describe('Manual calibration — Scenario C commitment threshold', () => {
  it('names Theo/Morgan + irrecoverability path (high process + boundaries)', () => {
    expect(hasScenarioCCommitmentThresholdInUserAnswer(SCENARIO_C_THRESHOLD_HIGH)).toBe(true);
  });
});
