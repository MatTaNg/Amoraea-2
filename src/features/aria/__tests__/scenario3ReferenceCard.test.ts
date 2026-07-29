import { describe, expect, it, jest } from '@jest/globals';

import { runApplyReferenceCardFromAssistantSpeech } from '@features/aria/runReferenceCardFromAssistantSpeech';
import {
  SHOW_SCENARIO_1_VIGNETTE_EXACT,
  SHOW_SCENARIO_3_VIGNETTE_EXACT,
} from '@features/aria/interviewShowScenarioExactCopy';
import { SCENARIO_3_OPENING } from '@features/aria/interviewScenarioOpeningStreamGate';
import { SCENARIO_3_TEXT } from '@features/aria/interviewScenarioVignetteCopy';
import { SCENARIO_C_SOPHIE_PERSPECTIVE_PROBE } from '@features/aria/interviewDisengagementProbeCopy';
import {
  SCENARIO_C_REPAIR_QUESTION_CANONICAL,
} from '@features/aria/scenarioCPromptDetection';
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

describe('Scenario 3 show-scenario reference card', () => {
  it('shows Situation 3 vignette for repair Q2 even when committedScenarioRef is stale Situation 1', () => {
    const deps = createDeps({
      messages: [
        { role: 'assistant', content: SCENARIO_3_TEXT },
        { role: 'user', content: 'Daniel needed space.' },
        { role: 'assistant', content: SCENARIO_C_REPAIR_QUESTION_CANONICAL },
      ],
    });

    runApplyReferenceCardFromAssistantSpeech(deps, SCENARIO_C_REPAIR_QUESTION_CANONICAL);

    expect(deps.setReferenceCardScenario).toHaveBeenCalledWith({
      label: 'Situation 3',
      text: SHOW_SCENARIO_3_VIGNETTE_EXACT,
    });
    expect(deps.setReferenceCardPrompt).toHaveBeenCalledWith(SCENARIO_C_REPAIR_QUESTION_CANONICAL);
    expect(deps.committedScenarioRef.current).toEqual({
      label: 'Situation 3',
      text: SHOW_SCENARIO_3_VIGNETTE_EXACT,
    });
    expect(deps.setInterviewUiPhase).toHaveBeenCalledWith('scenario_active');
  });

  it('shows Situation 3 vignette for Sophie perspective probe with stale Situation 1 committed ref', () => {
    const deps = createDeps({
      messages: [
        { role: 'assistant', content: SCENARIO_3_TEXT },
        { role: 'user', content: 'He was avoiding conflict.' },
        { role: 'assistant', content: SCENARIO_C_SOPHIE_PERSPECTIVE_PROBE },
      ],
    });

    runApplyReferenceCardFromAssistantSpeech(deps, SCENARIO_C_SOPHIE_PERSPECTIVE_PROBE);

    expect(deps.setReferenceCardScenario).toHaveBeenCalledWith({
      label: 'Situation 3',
      text: SHOW_SCENARIO_3_VIGNETTE_EXACT,
    });
    expect(deps.setReferenceCardPrompt).toHaveBeenCalledWith(SCENARIO_C_SOPHIE_PERSPECTIVE_PROBE);
    expect(deps.committedScenarioRef.current?.label).toBe('Situation 3');
  });

  it('shows Situation 3 opening on vignette delivery without reverting to Situation 1 modal', () => {
    const deps = createDeps({
      messages: [{ role: 'assistant', content: SCENARIO_3_TEXT }],
    });

    runApplyReferenceCardFromAssistantSpeech(deps, SCENARIO_3_TEXT);

    expect(deps.setReferenceCardScenario).toHaveBeenCalledWith({
      label: 'Situation 3',
      text: SHOW_SCENARIO_3_VIGNETTE_EXACT,
    });
    expect(deps.setReferenceCardPrompt).toHaveBeenCalledWith(SCENARIO_3_OPENING);
    expect(deps.committedScenarioRef.current?.label).toBe('Situation 3');
  });

  it('shows Situation 3 vignette when committed ref is stale Situation 2', () => {
    const deps = createDeps({
      committedScenarioRef: {
        current: { label: 'Situation 2', text: 'Sarah and James...' },
      },
      messages: [{ role: 'assistant', content: SCENARIO_3_TEXT }],
    });

    runApplyReferenceCardFromAssistantSpeech(deps, SCENARIO_3_TEXT);

    expect(deps.setReferenceCardScenario).toHaveBeenCalledWith({
      label: 'Situation 3',
      text: SHOW_SCENARIO_3_VIGNETTE_EXACT,
    });
    expect(deps.committedScenarioRef.current?.label).toBe('Situation 3');
  });
});
