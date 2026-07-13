import { describe, expect, it, jest } from '@jest/globals';

import { runPreClaudeDeferredEmotionModalIntercept } from '@features/aria/runPreClaudeDeferredEmotionModalIntercept';
import { createMockPreClaudeDeps } from './preClaudeGateTestHelpers';

describe('runPreClaudeDeferredEmotionModalIntercept', () => {
  it('returns handled:false when no deferred emotion modal is pending', async () => {
    const deps = createMockPreClaudeDeps({
      pendingEmotionModalTransitionRef: { current: null },
    });

    const result = await runPreClaudeDeferredEmotionModalIntercept(deps, 'okay');

    expect(result).toEqual({ handled: false });
    expect(deps.setMessages).not.toHaveBeenCalled();
  });

  it('returns handled:false for admin users even when pending', async () => {
    const deps = createMockPreClaudeDeps({
      isAdmin: true,
      pendingEmotionModalTransitionRef: {
        current: {
          completedScenario: 1,
          priorScenario: 1,
          transitionText: 'transition',
          afterModal: 'after',
        },
      },
    });

    const result = await runPreClaudeDeferredEmotionModalIntercept(deps, 'okay');

    expect(result).toEqual({ handled: false });
  });

  it('runs emotion modal and speaks afterModal when deferred transition is pending', async () => {
    const speakTextSafe = jest.fn().mockResolvedValue(undefined);
    const setMessages = jest.fn();
    const ensureCompletedScenarioScored = jest.fn();
    const runEmotionModalAfterScenarioTransition = jest.fn().mockResolvedValue(undefined);
    const notifyScenarioStarted = jest.fn().mockResolvedValue(undefined);
    const deps = createMockPreClaudeDeps({
      currentScenarioRef: { current: 1 },
      currentInterviewMomentRef: { current: 1 },
      pendingEmotionModalTransitionRef: {
        current: {
          completedScenario: 1,
          priorScenario: 1,
          transitionText: 'Scenario one transition body',
          afterModal: 'Scenario two opening question here.',
        },
      },
      speakTextSafe,
      setMessages,
      ensureCompletedScenarioScored,
      runEmotionModalAfterScenarioTransition,
      notifyScenarioStarted,
    });

    const result = await runPreClaudeDeferredEmotionModalIntercept(deps, 'sounds good');

    expect(result).toEqual({ handled: true });
    expect(deps.pendingEmotionModalTransitionRef.current).toBeNull();
    expect(ensureCompletedScenarioScored).toHaveBeenCalledWith(
      1,
      expect.any(Array),
      'deferred_bundled_handoff_intercept',
    );
    expect(runEmotionModalAfterScenarioTransition).toHaveBeenCalledWith(1, {
      transitionText: 'Scenario one transition body',
      priorScenario: 1,
      afterBeforeModalPlayback: true,
    });
    expect(deps.interviewMomentsCompleteRef.current[1]).toBe(true);
    expect(deps.currentInterviewMomentRef.current).toBe(2);
    expect(deps.currentScenarioRef.current).toBe(2);
    expect(speakTextSafe).toHaveBeenCalledWith(
      'Scenario two opening question here.',
      expect.any(Object),
    );
    expect(notifyScenarioStarted).toHaveBeenCalledWith(2, expect.any(Array));
    expect(setMessages).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ role: 'user', content: 'sounds good', scenarioNumber: 1 }),
        expect.objectContaining({
          role: 'assistant',
          content: 'Scenario two opening question here.',
          scenarioNumber: 2,
        }),
      ]),
    );
  });

  it('skips afterModal speak when afterModal is blank', async () => {
    const speakTextSafe = jest.fn().mockResolvedValue(undefined);
    const runEmotionModalAfterScenarioTransition = jest.fn().mockResolvedValue(undefined);
    const deps = createMockPreClaudeDeps({
      pendingEmotionModalTransitionRef: {
        current: {
          completedScenario: 2,
          priorScenario: 2,
          transitionText: 'Scenario two transition',
          afterModal: '   ',
        },
      },
      speakTextSafe,
      runEmotionModalAfterScenarioTransition,
    });

    const result = await runPreClaudeDeferredEmotionModalIntercept(deps, 'yes');

    expect(result).toEqual({ handled: true });
    expect(runEmotionModalAfterScenarioTransition).toHaveBeenCalled();
    expect(speakTextSafe).not.toHaveBeenCalled();
    expect(deps.currentInterviewMomentRef.current).toBe(1);
  });
});
