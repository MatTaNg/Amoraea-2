import { describe, expect, it } from '@jest/globals';

import { SCENARIO_C_SOPHIE_PERSPECTIVE_PROBE } from '@features/aria/interviewDisengagementProbeCopy';
import {
  isResumeOrScenarioReplayUiPrompt,
  syncReferenceCardStateFromAssistantMessages,
  trySplitFictionalScenarioIntroLongDelivery,
} from '@features/aria/interviewReferenceCardResumeHelpers';
import { isScenarioModalFollowUpProbe } from '@features/aria/interviewScenarioModalPrompt';
import { SCENARIO_1_OPENING } from '@features/aria/interviewScenarioOpeningStreamGate';
import {
  SCENARIO_1_VIGNETTE,
  SCENARIO_2_TEXT,
  SCENARIO_3_TEXT,
} from '@features/aria/interviewScenarioVignetteCopy';
import { SHOW_SCENARIO_1_VIGNETTE_EXACT } from '@features/aria/interviewShowScenarioExactCopy';
import { buildScenario1VignetteIntroBundle } from '@features/aria/interviewTransitionBundles';
import { SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY } from '@features/aria/scenarioAContemptProbeTtsStrip';
import { SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL } from '@features/aria/scenarioBProbeLogic';

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

  it('resume Show scenario footer keeps Sophie probe instead of Situation 3 opening', () => {
    const synced = syncReferenceCardStateFromAssistantMessages([
      { role: 'assistant', content: SCENARIO_3_TEXT },
      { role: 'assistant', content: SCENARIO_C_SOPHIE_PERSPECTIVE_PROBE },
    ]);
    expect(synced.scenario?.label).toBe('Situation 3');
    expect(synced.prompt).toBe(SCENARIO_C_SOPHIE_PERSPECTIVE_PROBE);
  });

  it('resume Show scenario footer keeps Situation 1 contempt probe', () => {
    const synced = syncReferenceCardStateFromAssistantMessages([
      { role: 'assistant', content: SHOW_SCENARIO_1_VIGNETTE_EXACT },
      { role: 'assistant', content: SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY },
    ]);
    expect(synced.scenario?.label).toBe('Situation 1');
    expect(synced.prompt).toBe(SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY);
  });

  it('resume Show scenario footer keeps Situation 2 James differently probe', () => {
    const synced = syncReferenceCardStateFromAssistantMessages([
      { role: 'assistant', content: SCENARIO_2_TEXT },
      { role: 'assistant', content: SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL },
    ]);
    expect(synced.scenario?.label).toBe('Situation 2');
    expect(synced.prompt).toBe(SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL);
  });
});

describe('isScenarioModalFollowUpProbe scripted construct carve-out', () => {
  it('does not treat Sophie perspective as a thin follow-up', () => {
    expect(isScenarioModalFollowUpProbe(SCENARIO_C_SOPHIE_PERSPECTIVE_PROBE)).toBe(false);
  });
});
