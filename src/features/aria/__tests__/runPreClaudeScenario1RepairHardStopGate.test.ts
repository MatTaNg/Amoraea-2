import { describe, expect, it, jest } from '@jest/globals';

import { runPreClaudeScenario1RepairHardStopGate } from '@features/aria/runPreClaudeScenario1RepairHardStopGate';
import { createMockPreClaudeDeps } from './preClaudeGateTestHelpers';

const REPAIR_FOLLOW_UP =
  'Got it — how would you make that repair actually happen as Ryan?';

describe('runPreClaudeScenario1RepairHardStopGate', () => {
  it('returns handled:false when user is not refusing after a repair probe', async () => {
    const deps = createMockPreClaudeDeps({
      currentInterviewMomentRef: { current: 1 },
      currentScenarioRef: { current: 1 },
    });
    const messagesToUse = [
      { role: 'assistant', content: REPAIR_FOLLOW_UP, scenarioNumber: 1 },
      { role: 'user', content: 'I would apologize and listen.', scenarioNumber: 1 },
    ];

    const result = await runPreClaudeScenario1RepairHardStopGate(
      deps,
      'I would apologize and listen.',
      messagesToUse,
      REPAIR_FOLLOW_UP,
      1,
      'Alex',
    );

    expect(result).toEqual({ handled: false });
    expect(deps.currentInterviewMomentRef.current).toBe(1);
  });

  it('does not advance when inability meta should offer skip confirmation instead', async () => {
    const deps = createMockPreClaudeDeps({
      currentInterviewMomentRef: { current: 1 },
      currentScenarioRef: { current: 1 },
    });
    const messagesToUse = [
      { role: 'assistant', content: REPAIR_FOLLOW_UP, scenarioNumber: 1 },
      { role: 'user', content: "I don't know", scenarioNumber: 1 },
    ];

    const result = await runPreClaudeScenario1RepairHardStopGate(
      deps,
      "I don't know",
      messagesToUse,
      REPAIR_FOLLOW_UP,
      1,
      'Alex',
      { type: 'inability', confidence: 0.89 },
    );

    expect(result).toEqual({ handled: false });
    expect(deps.currentInterviewMomentRef.current).toBe(1);
    expect(deps.currentScenarioRef.current).toBe(1);
  });

  it('advances to Scenario 2 when user hard-stops after a repair follow-up', async () => {
    const speakTextSafe = jest.fn().mockResolvedValue(undefined);
    const setMessages = jest.fn();
    const scoreScenario = jest.fn();
    const applyInterviewProgressFromAssistantText = jest.fn();
    const notifyScenarioStarted = jest.fn().mockResolvedValue(undefined);
    const runEmotionModalAfterScenarioTransition = jest.fn().mockResolvedValue(undefined);
    const deps = createMockPreClaudeDeps({
      currentInterviewMomentRef: { current: 1 },
      currentScenarioRef: { current: 1 },
      speakTextSafe,
      setMessages,
      scoreScenario,
      applyInterviewProgressFromAssistantText,
      notifyScenarioStarted,
      runEmotionModalAfterScenarioTransition,
    });
    const messagesToUse = [
      { role: 'assistant', content: REPAIR_FOLLOW_UP, scenarioNumber: 1 },
      { role: 'user', content: 'No', scenarioNumber: 1 },
    ];

    const result = await runPreClaudeScenario1RepairHardStopGate(
      deps,
      'No',
      messagesToUse,
      REPAIR_FOLLOW_UP,
      1,
      'Alex',
    );

    expect(result).toEqual({ handled: true });
    expect(deps.interviewMomentsCompleteRef.current[1]).toBe(true);
    expect(deps.currentInterviewMomentRef.current).toBe(2);
    expect(deps.currentScenarioRef.current).toBe(2);
    expect(deps.scoredScenariosRef.current.has(1)).toBe(true);
    expect(scoreScenario).toHaveBeenCalledWith(1, expect.any(Array));
    expect(applyInterviewProgressFromAssistantText).toHaveBeenCalled();
    expect(notifyScenarioStarted).toHaveBeenCalledWith(2, expect.any(Array));
    expect(runEmotionModalAfterScenarioTransition).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ priorScenario: 1 }),
    );
    expect(speakTextSafe).toHaveBeenCalled();
    expect(setMessages).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          role: 'assistant',
          scenarioNumber: 2,
          content: expect.stringMatching(/leave it there|Alex/i),
        }),
      ]),
    );
  });
});
