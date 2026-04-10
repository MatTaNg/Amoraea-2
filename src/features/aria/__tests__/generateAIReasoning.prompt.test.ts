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
      ['regulation'],
      null
    );

    expect(p).toContain('ASSESSMENT RESULTS:');
    expect(p).toContain('Weighted Score: 6.5/10');
    expect(p).toContain('Result: PASS');
    expect(p).toContain('"mentalizing": 7');
    expect(p).toContain('UNASSESSED MARKERS');
    expect(p).toContain('[1] Interviewer: Hello');
    expect(p).toContain('[2] Participant: Hi there');
    expect(p).toContain('SCENARIO SCORES:');
  });

  it('embeds commitment inconsistency block when payload provided', () => {
    const p = buildUserPrompt(
      pillarScores,
      {},
      [],
      null,
      false,
      [],
      {
        standardDeviation: 4,
        sliceScores: [3, 8],
        evidenceSnippets: [{ label: 'moment_4', text: 'said X' }],
      }
    );

    expect(p).toContain('COMMITMENT_THRESHOLD — COMPUTED INTERNAL INCONSISTENCY');
    expect(p).toContain('said X');
  });
});
