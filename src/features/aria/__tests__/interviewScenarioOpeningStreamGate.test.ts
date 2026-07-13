import {
  detectActiveScenarioFromMessage,
  getSituationOpeningQuestion,
  looksLikeCanonicalScenarioOpeningQuestion,
  SCENARIO_1_OPENING,
  SCENARIO_2_OPENING,
} from '../interviewScenarioOpeningStreamGate';

describe('interviewScenarioOpeningStreamGate', () => {
  it('detectActiveScenarioFromMessage recognizes Emma and Ryan vignette', () => {
    expect(
      detectActiveScenarioFromMessage('Emma and Ryan have dinner plans.')?.label,
    ).toBe('Situation 1');
  });

  it('getSituationOpeningQuestion returns canonical openings for fictional scenarios', () => {
    const s1 = detectActiveScenarioFromMessage('Emma and Ryan have dinner plans.');
    expect(getSituationOpeningQuestion(s1!)).toBe(SCENARIO_1_OPENING);

    const s2 = detectActiveScenarioFromMessage('Sarah has been job hunting for months.');
    expect(getSituationOpeningQuestion(s2!)).toBe(SCENARIO_2_OPENING);
  });

  it('looksLikeCanonicalScenarioOpeningQuestion matches canonical scenario openings', () => {
    expect(looksLikeCanonicalScenarioOpeningQuestion(SCENARIO_1_OPENING)).toBe(true);
    expect(looksLikeCanonicalScenarioOpeningQuestion('What is your favorite color?')).toBe(false);
  });

  it('does not treat S2 closing reflection as Situation 2 vignette fiction', () => {
    const reflection =
      "Nice work, Matt — you recognized that James's instinct to ask practical questions missed what Sarah actually needed in that moment, which was for him to just be present and celebrate her.";
    expect(detectActiveScenarioFromMessage(reflection)).toBeNull();
  });
});
