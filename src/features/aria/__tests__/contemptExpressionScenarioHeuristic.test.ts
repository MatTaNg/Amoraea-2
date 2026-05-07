import {
  absentCharacterEngagementCapApplies,
  applyContemptExpressionHeuristicToScenarioScores,
  countScenarioContemptVerdictSignals,
  enrichScenarioSliceWithContemptHeuristic,
  userTurnTextForInterviewScenario,
} from '../contemptExpressionScenarioHeuristic';

describe('contemptExpressionScenarioHeuristic', () => {
  it('userTurnTextForInterviewScenario joins only tagged user turns', () => {
    const transcript = [
      { role: 'assistant', content: 'Q', scenarioNumber: 1 },
      { role: 'user', content: ' First ', scenarioNumber: 1 },
      { role: 'user', content: 'Wrong slice', scenarioNumber: 2 },
      { role: 'user', content: ' Second', scenarioNumber: 1 },
    ];
    expect(userTurnTextForInterviewScenario(transcript, 1)).toBe('First Second');
  });

  it('Matt S1-style moral/capability verdict does not hit character-contempt lexicon', () => {
    const t =
      "Some people just aren't capable of prioritizing their relationship over their family of origin and that's a real problem.";
    expect(countScenarioContemptVerdictSignals(t)).toBe(0);
  });

  it('enrich adds contempt_expression when model only returned monolithic contempt on S1-shaped slice', () => {
    const slice = {
      pillarScores: { mentalizing: 3, contempt: 8, repair: 4 },
      keyEvidence: { contempt: 'recognition-heavy evidence' },
    };
    const userText =
      "What a loser. He's a toxic person. He's a narcissist. Human trash.";
    const out = enrichScenarioSliceWithContemptHeuristic(slice, userText);
    expect(typeof out?.pillarScores?.contempt_expression).toBe('number');
    expect((out?.pillarScores?.contempt_expression as number) <= 3.5).toBe(true);
  });

  it('applyContemptExpression caps model score when character-contempt lexicon hits', () => {
    const out = applyContemptExpressionHeuristicToScenarioScores(
      "Daniel is a toxic person and a narcissist; he's subhuman to me.",
      { contempt_expression: 8 },
      { contempt_expression: 'model too soft' },
    );
    expect(out.pillarScores.contempt_expression).toBeLessThanOrEqual(4.5);
  });

  it('does not cap contempt_expression for situation-anchored moral language only', () => {
    const out = applyContemptExpressionHeuristicToScenarioScores(
      "That was incredibly rude and dishonoring to Emma; inconsiderate to take a long call mid-dinner.",
      { contempt_expression: 8.2 },
      {},
    );
    expect(out.pillarScores.contempt_expression).toBe(8.2);
  });

  it('caps contempt_expression at 6 when wholesale relationship dismissal lacks character engagement', () => {
    const t =
      "They shouldn't be together honestly — they have issues and they need therapy more than they need each other.";
    expect(absentCharacterEngagementCapApplies(t)).toBe(true);
    const out = applyContemptExpressionHeuristicToScenarioScores(
      t,
      { contempt_expression: 9 },
      {},
    );
    expect(out.pillarScores.contempt_expression).toBe(6);
    expect(out.keyEvidence.contempt_expression).toMatch(/character-engagement/);
  });

  it('does not apply absent-engagement cap when internal-state curiosity is present', () => {
    const t =
      "They probably shouldn't be together, but I feel for both of them — she's hurt that he keeps withdrawing and he's afraid of being swallowed.";
    expect(absentCharacterEngagementCapApplies(t)).toBe(false);
    const out = applyContemptExpressionHeuristicToScenarioScores(
      t,
      { contempt_expression: 8.5 },
      {},
    );
    expect(out.pillarScores.contempt_expression).toBe(8.5);
  });

  it('absent-engagement cap does not raise low model scores', () => {
    const out = applyContemptExpressionHeuristicToScenarioScores(
      'This relationship is not working. They need therapy.',
      { contempt_expression: 4 },
      {},
    );
    expect(out.pillarScores.contempt_expression).toBe(4);
  });
});
