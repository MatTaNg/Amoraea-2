import { describe, expect, it, jest } from '@jest/globals';

import { runApplyReferenceCardFromAssistantSpeech } from '@features/aria/runReferenceCardFromAssistantSpeech';
import {
  SHOW_SCENARIO_1_VIGNETTE_EXACT,
  SHOW_SCENARIO_2_VIGNETTE_EXACT,
} from '@features/aria/interviewShowScenarioExactCopy';
import {
  SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL,
  SCENARIO_B_JAMES_REPAIR_CANONICAL,
} from '@features/aria/scenarioBProbeLogic';
import type { ApplyReferenceCardFromAssistantSpeechDeps } from '@features/aria/referenceCardFromAssistantSpeechTypes';

function createDeps(
  overrides: Partial<ApplyReferenceCardFromAssistantSpeechDeps> = {},
): ApplyReferenceCardFromAssistantSpeechDeps {
  return {
    messages: [],
    committedScenarioRef: {
      current: { label: 'Situation 1', text: SHOW_SCENARIO_1_VIGNETTE_EXACT },
    },
    moment5PrimaryAnchorDeliveredSessionRef: { current: false },
    setReferenceCardScenario: jest.fn(),
    setReferenceCardPrompt: jest.fn(),
    setInterviewUiPhase: jest.fn(),
    lastQuestionTextRef: { current: '' },
    ...overrides,
  } as ApplyReferenceCardFromAssistantSpeechDeps;
}

describe('Scenario 2 show-scenario reference card', () => {
  it('shows Situation 2 vignette for James differently probe with stale Situation 1 committed ref', () => {
    const deps = createDeps();

    runApplyReferenceCardFromAssistantSpeech(deps, SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL);

    expect(deps.setReferenceCardScenario).toHaveBeenCalledWith({
      label: 'Situation 2',
      text: SHOW_SCENARIO_2_VIGNETTE_EXACT,
    });
    expect(deps.setReferenceCardPrompt).toHaveBeenCalledWith(SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL);
    expect(deps.committedScenarioRef.current).toEqual({
      label: 'Situation 2',
      text: SHOW_SCENARIO_2_VIGNETTE_EXACT,
    });
    expect(deps.setInterviewUiPhase).toHaveBeenCalledWith('scenario_active');
  });

  it('shows Situation 2 vignette for James repair probe with stale Situation 1 committed ref', () => {
    const deps = createDeps();

    runApplyReferenceCardFromAssistantSpeech(deps, SCENARIO_B_JAMES_REPAIR_CANONICAL);

    expect(deps.setReferenceCardScenario).toHaveBeenCalledWith({
      label: 'Situation 2',
      text: SHOW_SCENARIO_2_VIGNETTE_EXACT,
    });
    expect(deps.setReferenceCardPrompt).toHaveBeenCalledWith(SCENARIO_B_JAMES_REPAIR_CANONICAL);
    expect(deps.committedScenarioRef.current?.label).toBe('Situation 2');
  });
});
