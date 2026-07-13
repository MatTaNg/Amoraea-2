import { describe, expect, it, jest } from '@jest/globals';

import {
  CLIENT_MENTALIZING_SURFACE_PROBE,
  CLIENT_REPAIR_REFUSAL_PROBE,
} from '@features/aria/interviewDisengagementProbes';
import { runPreClaudeClientDisengagementProbeGate } from '@features/aria/runPreClaudeClientDisengagementProbeGate';
import { createMockPreClaudeDeps } from './preClaudeGateTestHelpers';

const SCENARIO_A_OPENING = "What's going on between these two?";
const REPAIR_QUESTION = 'How do you think this situation could be repaired?';

describe('runPreClaudeClientDisengagementProbeGate', () => {
  it('returns handled:false when a meta-comment classification is present', async () => {
    const speakTextSafe = jest.fn().mockResolvedValue(undefined);
    const deps = createMockPreClaudeDeps({ speakTextSafe, messages: [] });
    const messagesToUse = [
      { role: 'assistant', content: SCENARIO_A_OPENING, scenarioNumber: 1 },
      { role: 'user', content: "She's angry and he's upset.", scenarioNumber: 1 },
    ];

    const result = await runPreClaudeClientDisengagementProbeGate(
      deps,
      "She's angry and he's upset.",
      messagesToUse,
      SCENARIO_A_OPENING,
      1,
      { type: 'confusion', confidence: 0.9 },
      false,
    );

    expect(result).toEqual({ handled: false });
    expect(speakTextSafe).not.toHaveBeenCalled();
  });

  it('injects mentalizing probe for surface emotional labels on first scenario turn', async () => {
    const speakTextSafe = jest.fn().mockResolvedValue(undefined);
    const setMessages = jest.fn();
    const deps = createMockPreClaudeDeps({ speakTextSafe, setMessages, messages: [] });
    const userAnswer = "She's angry and he's upset.";
    const messagesToUse = [
      { role: 'assistant', content: SCENARIO_A_OPENING, scenarioNumber: 1 },
      { role: 'user', content: userAnswer, scenarioNumber: 1 },
    ];

    const result = await runPreClaudeClientDisengagementProbeGate(
      deps,
      userAnswer,
      messagesToUse,
      SCENARIO_A_OPENING,
      1,
      null,
      false,
    );

    expect(result).toEqual({ handled: true });
    expect(speakTextSafe).toHaveBeenCalledWith(
      CLIENT_MENTALIZING_SURFACE_PROBE,
      expect.objectContaining({ skipLastQuestionRef: true }),
    );
    expect(deps.lastQuestionTextRef.current).toBe(CLIENT_MENTALIZING_SURFACE_PROBE);
    expect(setMessages).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          role: 'assistant',
          content: CLIENT_MENTALIZING_SURFACE_PROBE,
          scenarioNumber: 1,
        }),
      ]),
    );
    expect(deps.probeLogRef.current).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          construct: 'mentalizing',
          trigger_reason: 'surface_label_no_reasoning',
        }),
      ]),
    );
  });

  it('injects repair-refusal probe for explicit no-repair language', async () => {
    const speakTextSafe = jest.fn().mockResolvedValue(undefined);
    const setMessages = jest.fn();
    const deps = createMockPreClaudeDeps({ speakTextSafe, setMessages, messages: [] });
    const userAnswer = "There's nothing to repair. That's not Daniel's responsibility.";
    const messagesToUse = [
      { role: 'assistant', content: REPAIR_QUESTION, scenarioNumber: 2 },
      { role: 'user', content: userAnswer, scenarioNumber: 2 },
    ];

    const result = await runPreClaudeClientDisengagementProbeGate(
      deps,
      userAnswer,
      messagesToUse,
      REPAIR_QUESTION,
      2,
      null,
      false,
    );

    expect(result).toEqual({ handled: true });
    expect(speakTextSafe).toHaveBeenCalledWith(
      CLIENT_REPAIR_REFUSAL_PROBE,
      expect.objectContaining({ skipLastQuestionRef: true }),
    );
    expect(setMessages).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          role: 'assistant',
          content: CLIENT_REPAIR_REFUSAL_PROBE,
          scenarioNumber: 2,
        }),
      ]),
    );
    expect(deps.probeLogRef.current).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          construct: 'repair',
          trigger_reason: 'repair_refusal_detected',
        }),
      ]),
    );
  });

  it('returns handled:false for substantive repair suggestions', async () => {
    const speakTextSafe = jest.fn().mockResolvedValue(undefined);
    const deps = createMockPreClaudeDeps({ speakTextSafe, messages: [] });
    const userAnswer =
      'Daniel could share with Sophie that he gets overwhelmed and ask for a pause instead of leaving without explanation.';
    const messagesToUse = [
      { role: 'assistant', content: REPAIR_QUESTION, scenarioNumber: 2 },
      { role: 'user', content: userAnswer, scenarioNumber: 2 },
    ];

    const result = await runPreClaudeClientDisengagementProbeGate(
      deps,
      userAnswer,
      messagesToUse,
      REPAIR_QUESTION,
      2,
      null,
      false,
    );

    expect(result).toEqual({ handled: false });
    expect(speakTextSafe).not.toHaveBeenCalled();
  });
});
