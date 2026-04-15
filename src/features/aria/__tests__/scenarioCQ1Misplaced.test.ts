import { isMisplacedScenarioCQ1Answer, isScenarioCQ1Prompt } from '../probeAndScoringUtils';

describe('Scenario C Q1 misplaced answer detection', () => {
  it('isScenarioCQ1Prompt matches Daniel opening', () => {
    expect(
      isScenarioCQ1Prompt(
        "When Daniel comes back and says 'I didn't know how' — what do you make of that?"
      )
    ).toBe(true);
  });

  it('isScenarioCQ1Prompt matches when model uses typographic apostrophe in didn’t', () => {
    const withCurly = "When Daniel comes back and says 'I didn\u2019t know how' — what do you make of that?";
    expect(isScenarioCQ1Prompt(withCurly)).toBe(true);
  });

  it('isScenarioCQ1Prompt rejects repair question', () => {
    expect(
      isScenarioCQ1Prompt('How do you think this situation could be repaired?')
    ).toBe(false);
  });

  it('flags repair logistics without Daniel-internal read', () => {
    const a =
      'They should sit down and make a plan — maybe couples therapy and ground rules for timeouts so both feel heard.';
    expect(isMisplacedScenarioCQ1Answer(a)).toBe(true);
  });

  it('does not flag interpretation of Daniel line', () => {
    const a =
      "That line sounds like he's ashamed he kept bailing — he didn't know how to come back without flooding, not that he didn't care.";
    expect(isMisplacedScenarioCQ1Answer(a)).toBe(false);
  });

  it('flags prescription + threshold verdict when user never engages the quoted line', () => {
    const a =
      "Daniel needs to stop leaving. That's the core issue. You can't keep walking out on someone and expect the relationship to work. Thirty minutes is too long. Daniel needs to learn to stay present even when it's uncomfortable. Sophie is right to be frustrated. I'd say if this happens a fourth time without real change, Sophie should seriously consider whether this relationship is working.";
    expect(isMisplacedScenarioCQ1Answer(a)).toBe(true);
  });
});
