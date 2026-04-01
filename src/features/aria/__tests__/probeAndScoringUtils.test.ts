import {
  evaluateMoment5AppreciationSpecificity,
  isLikelyMisplacedPersonalNarrativeForScenarioCThreshold,
  normalizeScoresByEvidence,
} from '../probeAndScoringUtils';

describe('probeAndScoringUtils', () => {
  it('does not classify the birthday-party answer as generic appreciation', () => {
    const answer =
      "I threw my friend a birthday party when she turned 30 - she'd been going through a hard year and I wanted to do something that would make her feel special. I organized it and invited people she hadn't seen in a while. She seemed really touched by it";
    const result = evaluateMoment5AppreciationSpecificity(answer);
    expect(result.hasSpecificPerson).toBe(true);
    expect(result.hasSpecificMoment).toBe(true);
    expect(result.hasAttunement).toBe(true);
    expect(result.hasRelationalSpecificity).toBe(true);
    expect(result.isGeneric).toBe(false);
  });

  it('flags personal narrative as misplaced for Scenario C threshold probe', () => {
    const personalNarrative =
      'In my last relationship, I kept trying for months and eventually I left when I felt like I was the only one doing the work.';
    expect(isLikelyMisplacedPersonalNarrativeForScenarioCThreshold(personalNarrative)).toBe(true);
  });

  it('does not flag direct Theo/Morgan threshold answer as misplaced', () => {
    const directScenarioAnswer =
      "Theo or Morgan should end it when they've repeated this same conflict many times and one person still refuses repair.";
    expect(isLikelyMisplacedPersonalNarrativeForScenarioCThreshold(directScenarioAnswer)).toBe(false);
  });

  it('drops scores that explicitly have no evidence text', () => {
    const cleaned = normalizeScoresByEvidence(
      { regulation: 0, accountability: 3.3, repair: 6.2 },
      {
        regulation: 'No regulation content in this scenario.',
        accountability: 'User acknowledged partial ownership.',
      }
    );
    expect(cleaned.regulation).toBeUndefined();
    expect(cleaned.accountability).toBe(3.3);
    expect(cleaned.repair).toBe(6.2);
  });
});
