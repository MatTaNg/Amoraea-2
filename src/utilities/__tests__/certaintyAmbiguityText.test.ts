import {
  certaintyAmbiguityFromUserCorpus,
  certaintyAmbiguityQualifierAndClosureCounts,
} from '../../../supabase/functions/_shared/certaintyAmbiguityText';

/** Realistic user turn with first-person pattern uncertainty (Prompt 5). */
const PROMPT5_USER_SNIPPET =
  "I tend to hold on too long — I find it hard to walk away even when I probably should. But I'm working on recognizing when something is genuinely irrecoverable versus when I'm just afraid of conflict.";

describe('certaintyAmbiguityFromUserCorpus (production text axis)', () => {
  it('documents direction: higher score = more ambiguity/hedging comfort, not "certainty magnitude"', () => {
    const decisive = certaintyAmbiguityFromUserCorpus(
      'clearly obviously definitely they are wrong and should never do that the problem is always them',
    );
    const hedged = certaintyAmbiguityFromUserCorpus(
      'maybe perhaps i think it depends complicated nuanced i guess i tend to find it hard probably should',
    );
    expect(hedged).toBeGreaterThan(decisive);
  });

  it('Prompt 5: personal uncertainty disclosures land in 0.6–0.8, not at ceiling 1.0', () => {
    const s = certaintyAmbiguityFromUserCorpus(PROMPT5_USER_SNIPPET);
    expect(s).toBeGreaterThanOrEqual(0.6);
    expect(s).toBeLessThanOrEqual(0.82);
    const { qualifierCount, closureCount } = certaintyAmbiguityQualifierAndClosureCounts(PROMPT5_USER_SNIPPET);
    expect(qualifierCount).toBeGreaterThanOrEqual(4);
    expect(closureCount).toBe(0);
  });

  it('single weak hedge without closure does not snap to 1.0 (smoothing)', () => {
    const s = certaintyAmbiguityFromUserCorpus('i think emma was upset.');
    expect(s).toBeLessThan(0.95);
    expect(s).toBeGreaterThan(0.45);
  });

  it('empty corpus stays near neutral', () => {
    expect(certaintyAmbiguityFromUserCorpus('')).toBe(0.5);
  });

  it('does not treat substring "right" inside "alright" as closure', () => {
    const { closureCount } = certaintyAmbiguityQualifierAndClosureCounts("yeah, alright — i'll go with that.");
    expect(closureCount).toBe(0);
  });

  it('counts first-person "i struggle with" as qualifier', () => {
    const { qualifierCount } = certaintyAmbiguityQualifierAndClosureCounts(
      'i struggle with walking away even when i know i should.',
    );
    expect(qualifierCount).toBeGreaterThanOrEqual(1);
  });
});
