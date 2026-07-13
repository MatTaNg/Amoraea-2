import {
  SHOW_SCENARIO_1_FULL_EXACT,
  SHOW_SCENARIO_1_OPENING_EXACT,
  SHOW_SCENARIO_1_VIGNETTE_EXACT,
  SHOW_SCENARIO_2_FULL_EXACT,
  SHOW_SCENARIO_2_OPENING_EXACT,
  SHOW_SCENARIO_2_VIGNETTE_EXACT,
  SHOW_SCENARIO_3_FULL_EXACT,
  SHOW_SCENARIO_3_OPENING_EXACT,
  SHOW_SCENARIO_3_VIGNETTE_EXACT,
} from '@features/aria/interviewShowScenarioExactCopy';

describe('interviewShowScenarioExactCopy', () => {
  it('Scenario 1 vignette matches product script verbatim', () => {
    expect(SHOW_SCENARIO_1_VIGNETTE_EXACT).toContain('Emma and Ryan have dinner plans');
    expect(SHOW_SCENARIO_1_VIGNETTE_EXACT).toContain("you've made that very clear");
    expect(SHOW_SCENARIO_1_OPENING_EXACT).toBe("What's going on between these two?");
    expect(SHOW_SCENARIO_1_FULL_EXACT).toContain(SHOW_SCENARIO_1_VIGNETTE_EXACT);
    expect(SHOW_SCENARIO_1_FULL_EXACT).toContain(SHOW_SCENARIO_1_OPENING_EXACT);
  });

  it('Scenario 2 vignette matches product script verbatim', () => {
    expect(SHOW_SCENARIO_2_VIGNETTE_EXACT).toBe(
      `Sarah has been job hunting for four months. She gets an offer and calls James from the street, too excited to wait. James is on a deadline, says 'that's amazing, let's celebrate tonight.' That evening James leads with questions about the salary, the start date, and the commute. At one point Sarah tears up. James says 'hey don't cry, this is a good thing'. The next day Sarah tells James she never feels appreciated. James is blindsided, he showed up, he celebrated, he asked questions. A fight starts.`,
    );
    expect(SHOW_SCENARIO_2_OPENING_EXACT).toBe('What do you think is going on here?');
    expect(SHOW_SCENARIO_2_FULL_EXACT).toContain(SHOW_SCENARIO_2_VIGNETTE_EXACT);
    expect(SHOW_SCENARIO_2_FULL_EXACT).toContain(SHOW_SCENARIO_2_OPENING_EXACT);
  });

  it('Scenario 3 vignette matches product script verbatim', () => {
    expect(SHOW_SCENARIO_3_VIGNETTE_EXACT).toBe(
      `Sophie and Daniel have had the same argument for the third time. Sophie feels unheard because Daniel goes silent or leaves, so the issue is never resolved. This time Sophie says "we need to finish this." Daniel tries to avoid the conversation again. Sophie says "you can't just keep avoiding this." Daniel's voice goes flat. He says "I need ten minutes" and leaves. Sophie calls after him: "that's exactly what I mean."
Thirty minutes later Daniel comes back and says "okay, I'm ready. I should have come back sooner the other times. I didn't know what to say." Sophie is still upset.`,
    );
    expect(SHOW_SCENARIO_3_OPENING_EXACT).toBe(
      "When Daniel comes back and says 'I didn't know what to say' — what do you make of that?",
    );
    expect(SHOW_SCENARIO_3_FULL_EXACT).toContain(SHOW_SCENARIO_3_VIGNETTE_EXACT);
    expect(SHOW_SCENARIO_3_FULL_EXACT).toContain(SHOW_SCENARIO_3_OPENING_EXACT);
  });
});
