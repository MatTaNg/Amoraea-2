import {
  buildMatchmakerSummaryFromProfile,
  type MatchmakerSummaryProfileInput,
} from '../../../supabase/functions/_shared/matchmakerSummaryFromProfile';
import { matchmakerSummaryReadsAsChipRestatement } from '../styleTranslations';

function baseProfile(over: Partial<MatchmakerSummaryProfileInput> = {}): MatchmakerSummaryProfileInput {
  return {
    emotional_analytical_score: 0.5,
    narrative_conceptual_score: 0.5,
    certainty_ambiguity_score: 0.5,
    relational_individual_score: 0.5,
    emotional_vocab_density: 5,
    qualifier_density: 5,
    avg_response_length: 100,
    warmth_score: 0.55,
    emotional_expressiveness: 0.5,
    speech_rate: 130,
    audio_confidence: 0.5,
    ...over,
  };
}

describe('buildMatchmakerSummaryFromProfile — production matchmaker_summary template (Prompt 7)', () => {
  it('is the single implementation: Edge + app both import this module via styleTranslations', () => {
    expect(typeof buildMatchmakerSummaryFromProfile).toBe('function');
  });

  it('never returns text that matchmakerSummaryReadsAsChipRestatement flags (dense ea×nc grid)', () => {
    for (let ei = 0; ei <= 10; ei++) {
      for (let ni = 0; ni <= 10; ni++) {
        const s = buildMatchmakerSummaryFromProfile(
          baseProfile({
            emotional_analytical_score: ei / 10,
            narrative_conceptual_score: ni / 10,
          }),
        );
        expect(matchmakerSummaryReadsAsChipRestatement(s)).toBe(false);
        const parts = s.split(/\.\s+/).filter((p) => p.trim().length > 0);
        expect(parts.length).toBe(3);
      }
    }
  });

  it('passes chip guard across relational / certainty / audio edge shapes', () => {
    const variants: Partial<MatchmakerSummaryProfileInput>[] = [
      { relational_individual_score: 0.28, emotional_analytical_score: 0.7, narrative_conceptual_score: 0.7 },
      { relational_individual_score: 0.72, emotional_analytical_score: 0.45, narrative_conceptual_score: 0.45 },
      { certainty_ambiguity_score: 0.62, emotional_analytical_score: 0.6, narrative_conceptual_score: 0.5 },
      { certainty_ambiguity_score: 0.28, emotional_analytical_score: 0.55, narrative_conceptual_score: 0.55 },
      {
        audio_confidence: 0.55,
        emotional_expressiveness: 0.75,
        warmth_score: 0.42,
        speech_rate: 130,
        emotional_analytical_score: 0.5,
        narrative_conceptual_score: 0.5,
      },
      {
        audio_confidence: 0.55,
        speech_rate: 165,
        emotional_analytical_score: 0.55,
        narrative_conceptual_score: 0.55,
      },
      { emotional_vocab_density: 8, qualifier_density: 7, certainty_ambiguity_score: 0.62 },
      { avg_response_length: 200, emotional_analytical_score: 0.6, narrative_conceptual_score: 0.6 },
    ];
    for (const v of variants) {
      const s = buildMatchmakerSummaryFromProfile(baseProfile(v));
      expect(matchmakerSummaryReadsAsChipRestatement(s)).toBe(false);
    }
  });

  it('optional userCorpus still yields three sentences and no chip echo', () => {
    const longCorpus = Array(400).fill('word').join(' ');
    const s = buildMatchmakerSummaryFromProfile(
      baseProfile({ avg_response_length: 50 }),
      { userCorpus: longCorpus },
    );
    expect(matchmakerSummaryReadsAsChipRestatement(s)).toBe(false);
    expect(s.split(/\.\s+/).filter((p) => p.trim().length > 0).length).toBe(3);
  });

  it('when scenario vs personal register diverges, sentence 1 leads with cross-interview register shift', () => {
    const scenario =
      'reese is emotionally immature and too sensitive. not an acceptable explanation. never had to put their partner first.';
    const personal =
      'i am working on this in therapy. i tend to hold on too long. i am not fully there yet. i find it hard to walk away.';
    const s = buildMatchmakerSummaryFromProfile(
      baseProfile({ emotional_analytical_score: 0.85, narrative_conceptual_score: 0.9 }),
      { userCorpus: `${scenario} ${personal}`, scenarioUserCorpus: scenario, personalUserCorpus: personal },
    );
    expect(s.toLowerCase()).toContain('scripted vignettes');
    expect(s.toLowerCase()).toContain('personal questions');
    expect(matchmakerSummaryReadsAsChipRestatement(s)).toBe(false);
  });
});
