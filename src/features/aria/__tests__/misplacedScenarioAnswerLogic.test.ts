import {
  SCENARIO_A_MISPLACED_S2_ANSWER_REDIRECT,
  coerceMisplacedScenarioRedirectForActiveScenario,
  isIncompleteMisplacedScenarioRedirectLeadSentence,
  isMisplacedScenarioMetaRedirectText,
  userAnswerLooksLikeMisplacedScenarioBInScenarioA,
} from '@features/aria/misplacedScenarioAnswerLogic';
import { detectScenarioFromResponse } from '@features/aria/scenarioNumberDetection';

describe('misplacedScenarioAnswerLogic', () => {
  it('detects Sarah/James answer misplaced in Situation 1', () => {
    expect(
      userAnswerLooksLikeMisplacedScenarioBInScenarioA(
        'James sounds clueless and Sarah should know better than to expect emotional presence from him.',
      ),
    ).toBe(true);
    expect(
      userAnswerLooksLikeMisplacedScenarioBInScenarioA(
        'Emma feels dismissed and Ryan should have checked in first.',
      ),
    ).toBe(false);
  });

  it('flags incomplete misplaced redirect from session logs', () => {
    const truncated = "Makes sense. That's Situation 2 — we haven't quite gotten there yet. We";
    expect(isIncompleteMisplacedScenarioRedirectLeadSentence(truncated)).toBe(true);
    expect(coerceMisplacedScenarioRedirectForActiveScenario(truncated, 1)).toBe(
      SCENARIO_A_MISPLACED_S2_ANSWER_REDIRECT,
    );
  });

  it('accepts complete misplaced redirect with S1 re-ask', () => {
    expect(isIncompleteMisplacedScenarioRedirectLeadSentence(SCENARIO_A_MISPLACED_S2_ANSWER_REDIRECT)).toBe(
      false,
    );
  });
});

describe('detectScenarioFromResponse misplaced meta redirect', () => {
  it('does not advance scenario on meta redirect naming Situation 2', () => {
    expect(
      detectScenarioFromResponse(
        "Makes sense. That's Situation 2 — we haven't quite gotten there yet. We're still with Emma and Ryan.",
      ),
    ).toBeNull();
  });

  it('still detects real Situation 2 vignette intros', () => {
    expect(
      detectScenarioFromResponse(
        "Here's the next situation: Sarah has been job hunting for four months. James says they should celebrate.",
      ),
    ).toBe(2);
  });
});
