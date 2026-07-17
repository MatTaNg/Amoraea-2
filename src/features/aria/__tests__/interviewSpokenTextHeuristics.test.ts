import {
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

  it('recognizes short in-scenario probes', () => {
    expect(looksLikeShortProbeFallback('Got it. And if you were James, how would you repair?')).toBe(
      true,
    );
  });
});
