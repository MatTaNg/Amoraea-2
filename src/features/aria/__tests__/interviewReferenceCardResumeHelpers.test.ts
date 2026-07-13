import { describe, expect, it } from '@jest/globals';

import { buildScenario1VignetteIntroBundle } from '@features/aria/interviewTransitionBundles';
import {
  isResumeOrScenarioReplayUiPrompt,
  trySplitFictionalScenarioIntroLongDelivery,
} from '@features/aria/interviewReferenceCardResumeHelpers';
import { SCENARIO_1_OPENING } from '@features/aria/interviewScenarioOpeningStreamGate';
import { SCENARIO_1_VIGNETTE } from '@features/aria/interviewScenarioVignetteCopy';

describe('interviewReferenceCardResumeHelpers', () => {
  it('isResumeOrScenarioReplayUiPrompt detects scenario replay offers', () => {
    expect(
      isResumeOrScenarioReplayUiPrompt('Would it help to hear the scenario again?'),
    ).toBe(true);
    expect(isResumeOrScenarioReplayUiPrompt('How would you repair this as Ryan?')).toBe(false);
  });

  it('does not split locked Scenario 1 intro bundle (vignette + opening in one TTS)', () => {
    const bundle = buildScenario1VignetteIntroBundle(SCENARIO_1_VIGNETTE, SCENARIO_1_OPENING);
    expect(trySplitFictionalScenarioIntroLongDelivery(bundle)).toBeNull();
    expect(bundle).toContain(SCENARIO_1_OPENING);
  });
});
