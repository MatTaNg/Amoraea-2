import {
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

  it('Matt S1-style phrasing yields lexicon hits (attempt 125 style)', () => {
    const t =
      "Some people just aren't capable of prioritizing their relationship over their family of origin and that's a real problem.";
    expect(countScenarioContemptVerdictSignals(t)).toBeGreaterThanOrEqual(2);
  });

  it('enrich adds contempt_expression when model only returned monolithic contempt on S1-shaped slice', () => {
    const slice = {
      pillarScores: { mentalizing: 3, contempt: 8, repair: 4 },
      keyEvidence: { contempt: 'recognition-heavy evidence' },
    };
    const userText =
      "Reese sounds like someone who has never had to put their partner first. Some people just aren't capable of prioritizing.";
    const out = enrichScenarioSliceWithContemptHeuristic(slice, userText);
    expect(typeof out?.pillarScores?.contempt_expression).toBe('number');
    expect((out?.pillarScores?.contempt_expression as number) <= 4.5).toBe(true);
  });

  it('applyContemptExpression uses Math.min when model set high contempt_expression', () => {
    const out = applyContemptExpressionHeuristicToScenarioScores(
      'Theo sounds emotionally immature and has a lot of growing up to do.',
      { contempt_expression: 8 },
      { contempt_expression: 'model too soft' },
    );
    expect(out.pillarScores.contempt_expression).toBeLessThanOrEqual(4.5);
  });
});
