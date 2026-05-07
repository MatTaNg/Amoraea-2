import { buildUserPrompt } from '../generateAIReasoning';

describe('buildUserPrompt', () => {
  const pillarScores = {
    mentalizing: 7,
    accountability: 6,
    contempt: 5,
    repair: 6,
    regulation: 6,
    attunement: 6,
    appreciation: 6,
    commitment_threshold: 6,
  };

  it('includes assessment header, marker JSON, and formatted transcript lines', () => {
    const p = buildUserPrompt(
      pillarScores,
      {
        1: { pillarScores: { mentalizing: 7 }, scenarioName: 'A' },
      },
      [
        { role: 'assistant', content: 'Hello' },
        { role: 'user', content: 'Hi there' },
      ],
      6.5,
      true,
      ['regulation']
    );

    expect(p).toContain('ASSESSMENT RESULTS:');
    expect(p).toContain('Weighted Score: 6.5/10');
    expect(p).toContain('Result: PASS');
    expect(p).toContain('"mentalizing": 7');
    expect(p).toContain('UNASSESSED MARKERS');
    expect(p).toContain('[1] Interviewer: Hello');
    expect(p).toContain('[2] Participant: Hi there');
    expect(p).toContain('SCENARIO SCORES:');
    expect(p).not.toContain('COMMITMENT_THRESHOLD — COMPUTED INTERNAL INCONSISTENCY');
  });
});
