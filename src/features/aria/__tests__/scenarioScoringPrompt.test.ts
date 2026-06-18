import { buildScenarioScoringPrompt } from '../scenarioScoringPrompt';

describe('buildScenarioScoringPrompt', () => {
  it('includes appreciation in Scenario A marker list and rubric', () => {
    const prompt = buildScenarioScoringPrompt(1, [
      { role: 'assistant', content: 'What if you were Ryan? How would you repair?', scenarioNumber: 1 },
      { role: 'user', content: 'I would apologize and tell her she matters to me.', scenarioNumber: 1 },
    ]);
    expect(prompt).toContain('"appreciation"');
    expect(prompt).toContain('SCENARIO A (Emma/Ryan) — APPRECIATION');
    expect(prompt).toContain('repair-as-Ryan');
  });

  it('does not add Scenario A appreciation rubric to Scenario B', () => {
    const prompt = buildScenarioScoringPrompt(2, [
      { role: 'assistant', content: 'What do you think is going on here?', scenarioNumber: 2 },
      { role: 'user', content: 'James missed her emotional need.', scenarioNumber: 2 },
    ]);
    expect(prompt).toContain('SCENARIO B (Sarah/James) — ATTUNEMENT & APPRECIATION');
    expect(prompt).not.toContain('SCENARIO A (Emma/Ryan) — APPRECIATION');
  });
});
