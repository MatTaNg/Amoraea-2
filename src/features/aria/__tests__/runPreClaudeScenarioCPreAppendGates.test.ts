import { describe, expect, it, jest } from '@jest/globals';

import { SCENARIO_C_MISPLACED_Q1_REDIRECT } from '@features/aria/interviewScenarioCTextHelpers';
import {
  captureScenarioCRepairOnlyEvidenceIfApplicable,
  runPreClaudeScenarioCMisplacedQ1Gate,
} from '@features/aria/runPreClaudeScenarioCPreAppendGates';
import { createMockPreClaudeDeps } from './preClaudeGateTestHelpers';

const SCENARIO_C_Q1_PROMPT =
  "When Daniel comes back and says 'I didn't know what to say' — what do you make of that?";

const MISPLACED_REPAIR_LOGISTICS =
  'They should sit down and make a plan — maybe couples therapy and ground rules for timeouts so both feel heard.';

describe('runPreClaudeScenarioCPreAppendGates', () => {
  it('redirects misplaced Scenario C Q1 repair-logistics answer without Claude', async () => {
    const speakTextSafe = jest.fn().mockResolvedValue(undefined);
    const setMessages = jest.fn();
    const deps = createMockPreClaudeDeps({
      currentInterviewMomentRef: { current: 3 },
      currentScenarioRef: { current: 3 },
      messages: [{ role: 'assistant', content: SCENARIO_C_Q1_PROMPT }],
      speakTextSafe,
      setMessages,
    });

    const result = await runPreClaudeScenarioCMisplacedQ1Gate(deps, MISPLACED_REPAIR_LOGISTICS);

    expect(result).toEqual({ handled: true });
    expect(setMessages).toHaveBeenCalledWith([
      { role: 'assistant', content: SCENARIO_C_Q1_PROMPT },
      { role: 'user', content: MISPLACED_REPAIR_LOGISTICS, scenarioNumber: 3 },
      { role: 'assistant', content: SCENARIO_C_MISPLACED_Q1_REDIRECT, scenarioNumber: 3 },
    ]);
    expect(speakTextSafe).toHaveBeenCalledWith(SCENARIO_C_MISPLACED_Q1_REDIRECT, expect.any(Object));
    expect(deps.setVoiceState).toHaveBeenCalledWith('idle');
  });

  it('returns handled:false for interpretation-style Scenario C Q1 answer', async () => {
    const deps = createMockPreClaudeDeps({
      currentInterviewMomentRef: { current: 3 },
      currentScenarioRef: { current: 3 },
      messages: [{ role: 'assistant', content: SCENARIO_C_Q1_PROMPT }],
    });
    const interpretation =
      "That line sounds like he's ashamed he kept bailing — he didn't know how to come back without flooding.";

    const result = await runPreClaudeScenarioCMisplacedQ1Gate(deps, interpretation);

    expect(result).toEqual({ handled: false });
  });

  it('captureScenarioCRepairOnlyEvidenceIfApplicable stores evidence on repair Q2', () => {
    const deps = createMockPreClaudeDeps({
      currentInterviewMomentRef: { current: 3 },
      currentScenarioRef: { current: 3 },
      personalHandoffInjectedRef: { current: false },
      scenarioCRepairOnlyEvidenceRef: { current: null },
      messages: [{ role: 'assistant', content: 'How do you think this situation could be repaired?' }],
    });

    captureScenarioCRepairOnlyEvidenceIfApplicable(deps, MISPLACED_REPAIR_LOGISTICS);

    expect(deps.scenarioCRepairOnlyEvidenceRef.current).toBe(MISPLACED_REPAIR_LOGISTICS);
  });
});
