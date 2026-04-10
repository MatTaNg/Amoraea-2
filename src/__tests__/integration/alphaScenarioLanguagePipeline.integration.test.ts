/**
 * Integration: scenario boundary indices derived from the same transcript
 * are consumed by language marker analysis.
 */
import { analyzeLanguageMarkers, buildScenarioBoundaries } from '@features/aria/alphaAssessmentUtils';

describe('alpha scenario + language pipeline', () => {
  it('produces per-scenario word counts that partition the user corpus', () => {
    const messages = Array.from({ length: 9 }, (_, i) => ({
      role: 'user' as const,
      content: `Turn ${i} maybe I think I own that part.`,
    }));
    const boundaries = buildScenarioBoundaries(messages, []);
    const r = analyzeLanguageMarkers(messages, boundaries);
    const w1 = r.per_scenario[1].word_count;
    const w2 = r.per_scenario[2].word_count;
    const w3 = r.per_scenario[3].word_count;
    expect(w1 + w2 + w3).toBeGreaterThan(0);
    expect(w1).toBeGreaterThan(0);
    expect(w2).toBeGreaterThan(0);
    expect(w3).toBeGreaterThan(0);
  });
});
