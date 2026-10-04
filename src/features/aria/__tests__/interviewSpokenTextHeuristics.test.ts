import {
  isAckOnlySentenceBeforeScenarioBoundary,
  isScenarioEndHandoffSentence,
  isUnauthorizedS1FollowUp,
  looksLikeScenarioHandoffOrVignetteBundle,
  looksLikeShortProbeFallback,
} from '../interviewSpokenTextHeuristics';

describe('interviewSpokenTextHeuristics', () => {
  it('recognizes a later scenario handoff/vignette bundle', () => {
    const full =
      "That's the second one done. Nice work, Matt — You saw James's focus on logistics instead of emotions and recognized the need for him to be more present and appreciative. One more situation and then we'll get personal.\n\nSophie and Daniel have had the same argument for the third time this month. When Daniel comes back and says 'I didn't know what to say,' what do you make of that?";
    expect(looksLikeScenarioHandoffOrVignetteBundle(full)).toBe(true);
  });

  it('recognizes suppressed Ryan repair follow-ups', () => {
    const unauthorized =
      'Makes sense. What could Ryan have done differently in that moment at dinner to prevent the situation from escalating?';
    expect(isUnauthorizedS1FollowUp(unauthorized)).toBe(true);
  });

  it('treats a standalone Makes sense as an ack that should not precede the scenario-complete line', () => {
    expect(isAckOnlySentenceBeforeScenarioBoundary('Makes sense.')).toBe(true);
    expect(isAckOnlySentenceBeforeScenarioBoundary('That makes a lot of sense.')).toBe(true);
    expect(isAckOnlySentenceBeforeScenarioBoundary('Nice work.')).toBe(false);
    expect(
      isAckOnlySentenceBeforeScenarioBoundary(
        'Good work — you just finished the three scenarios. Next are three personal questions.',
      ),
    ).toBe(false);
    expect(
      isAckOnlySentenceBeforeScenarioBoundary(
        'Makes sense. How do you think this situation could be repaired?',
      ),
    ).toBe(false);
  });

  it('treats the Situation 1 close as one handoff, not a second Got it', () => {
    expect(isScenarioEndHandoffSentence("That's the end of this scenario. Here's the next situation.")).toBe(
      true,
    );
    expect(
      isScenarioEndHandoffSentence(
        "Good work — that's the end of this scenario. Here's the next situation.",
      ),
    ).toBe(true);
    expect(
      isScenarioEndHandoffSentence('Sarah and James have been together for two years.'),
    ).toBe(true);
    expect(isScenarioEndHandoffSentence('Got it.')).toBe(false);
    expect(isScenarioEndHandoffSentence('If you were Ryan, how would you repair this?')).toBe(false);
  });

  it('recognizes short in-scenario probes', () => {
    expect(looksLikeShortProbeFallback('Got it. And if you were James, how would you repair?')).toBe(
      true,
    );
  });
});
