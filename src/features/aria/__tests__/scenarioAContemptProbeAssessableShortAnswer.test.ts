import { looksLikeScenarioAContemptProbeAssessableShortAnswer } from '@features/aria/scenarioAContemptProbeCoverage';

describe('looksLikeScenarioAContemptProbeAssessableShortAnswer', () => {
  it('accepts short Emma affect reads', () => {
    expect(looksLikeScenarioAContemptProbeAssessableShortAnswer('Emma was frustrated.')).toBe(true);
    expect(looksLikeScenarioAContemptProbeAssessableShortAnswer('Emma is being condescending.')).toBe(
      true,
    );
    expect(
      looksLikeScenarioAContemptProbeAssessableShortAnswer(
        "So, I think she's very frustrated and disappointed.",
      ),
    ).toBe(true);
    expect(looksLikeScenarioAContemptProbeAssessableShortAnswer("I think she's very frustrated")).toBe(
      true,
    );
  });

  it('rejects unrelated short answers', () => {
    expect(looksLikeScenarioAContemptProbeAssessableShortAnswer('pizza')).toBe(false);
    expect(looksLikeScenarioAContemptProbeAssessableShortAnswer('Ryan was distracted.')).toBe(false);
  });
});
