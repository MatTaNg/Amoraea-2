import { describe, expect, it, jest } from '@jest/globals';

import { runPreClaudeClosingAdditionGate } from '@features/aria/runPreClaudeClosingAdditionGate';
import { createMockPreClaudeDeps } from './preClaudeGateTestHelpers';

describe('runPreClaudeClosingAdditionGate', () => {
  it('returns handled:false when not waiting for a closing addition', async () => {
    const deps = createMockPreClaudeDeps({
      waitingForClosingAdditionRef: { current: null },
    });

    const result = await runPreClaudeClosingAdditionGate(deps, 'something extra', 'Alex');

    expect(result).toEqual({ handled: false });
    expect(deps.setMessages).not.toHaveBeenCalled();
  });

  it('advances scenario 1→2 after substantive closing addition', async () => {
    const speakTextSafe = jest.fn().mockResolvedValue(undefined);
    const setMessages = jest.fn();
    const scoreScenario = jest.fn();
    const notifyScenarioStarted = jest.fn().mockResolvedValue(undefined);
    const runEmotionModalAfterScenarioTransition = jest.fn().mockResolvedValue(undefined);
    const deps = createMockPreClaudeDeps({
      waitingForClosingAdditionRef: { current: 1 },
      currentInterviewMomentRef: { current: 1 },
      currentScenarioRef: { current: 1 },
      speakTextSafe,
      setMessages,
      scoreScenario,
      notifyScenarioStarted,
      runEmotionModalAfterScenarioTransition,
    });

    const result = await runPreClaudeClosingAdditionGate(
      deps,
      'I also wanted to mention that Ryan seemed unfair to Emma.',
      'Alex',
    );

    expect(result).toEqual({ handled: true });
    expect(deps.waitingForClosingAdditionRef.current).toBeNull();
    expect(deps.interviewMomentsCompleteRef.current[1]).toBe(true);
    expect(deps.currentInterviewMomentRef.current).toBe(2);
    expect(deps.currentScenarioRef.current).toBe(2);
    expect(deps.scoredScenariosRef.current.has(1)).toBe(true);
    expect(scoreScenario).toHaveBeenCalledWith(1, expect.any(Array));
    expect(notifyScenarioStarted).toHaveBeenCalledWith(2, expect.any(Array));
    expect(runEmotionModalAfterScenarioTransition).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ priorScenario: 1 }),
    );
    expect(speakTextSafe).toHaveBeenCalled();
  });

  it('uses "No worries." ack and advances when user withdraws the addition', async () => {
    const speakTextSafe = jest.fn().mockResolvedValue(undefined);
    const deps = createMockPreClaudeDeps({
      waitingForClosingAdditionRef: { current: 2 },
      currentInterviewMomentRef: { current: 2 },
      currentScenarioRef: { current: 2 },
      speakTextSafe,
      resetScenarioCClientGatesOnly: jest.fn(),
    });

    const result = await runPreClaudeClosingAdditionGate(deps, 'never mind', 'Alex');

    expect(result).toEqual({ handled: true });
    expect(deps.currentInterviewMomentRef.current).toBe(3);
    expect(deps.currentScenarioRef.current).toBe(3);
    expect(speakTextSafe).toHaveBeenCalledWith('No worries.');
  });
});
