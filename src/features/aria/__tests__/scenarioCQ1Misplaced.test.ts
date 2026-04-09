import { isMisplacedScenarioCQ1Answer, isScenarioCQ1Prompt } from '../probeAndScoringUtils';

describe('Scenario C Q1 misplaced answer detection', () => {
  it('isScenarioCQ1Prompt matches Theo opening', () => {
    expect(
      isScenarioCQ1Prompt(
        "When Theo comes back and says 'I didn't know how' — what do you make of that?"
      )
    ).toBe(true);
  });

  it('isScenarioCQ1Prompt matches when model uses typographic apostrophe in didn’t', () => {
    const withCurly = "When Theo comes back and says 'I didn\u2019t know how' — what do you make of that?";
    expect(isScenarioCQ1Prompt(withCurly)).toBe(true);
  });

  it('isScenarioCQ1Prompt rejects repair question', () => {
    expect(
      isScenarioCQ1Prompt('How do you think this situation could be repaired?')
    ).toBe(false);
  });

  it('flags repair logistics without Theo-internal read', () => {
    const a =
      'They should sit down and make a plan — maybe couples therapy and ground rules for timeouts so both feel heard.';
    expect(isMisplacedScenarioCQ1Answer(a)).toBe(true);
  });

  it('does not flag interpretation of Theo line', () => {
    const a =
      "That line sounds like he's ashamed he kept bailing — he didn't know how to come back without flooding, not that he didn't care.";
    expect(isMisplacedScenarioCQ1Answer(a)).toBe(false);
  });

  it('flags prescription + threshold verdict when user never engages the quoted line', () => {
    const a =
      "Theo needs to stop leaving. That's the core issue. You can't keep walking out on someone and expect the relationship to work. Thirty minutes is too long. Theo needs to learn to stay present even when it's uncomfortable. Morgan is right to be frustrated. I'd say if this happens a fourth time without real change, Morgan should seriously consider whether this relationship is working.";
    expect(isMisplacedScenarioCQ1Answer(a)).toBe(true);
  });
});
