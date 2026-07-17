import { describe, expect, it, jest, beforeEach } from '@jest/globals';

import {
  clearConfusionRepeatOfferPending,
  CONFUSION_REPEAT_OFFER_LINE,
  setConfusionRepeatOfferPending,
} from '@features/aria/confusionRepeatOfferState';
import { runPreClaudeConfusionOfferRepeatGate } from '@features/aria/runPreClaudeConfusionOfferRepeatGate';
import { createMockPreClaudeDeps } from './preClaudeGateTestHelpers';

const scenarioQuestion =
  "Here's the first situation: Emma and Ryan have dinner plans. What's going on between these two?";

describe('runPreClaudeConfusionOfferRepeatGate', () => {
  beforeEach(() => {
    clearConfusionRepeatOfferPending();
  });

  it('offers to repeat on content confusion', async () => {
    const speakTextSafe = jest.fn().mockResolvedValue(undefined);
    const deps = createMockPreClaudeDeps({
      interviewSessionIdRef: { current: 'sess-1' },
      speakTextSafe,
    });
    const messages = [
      { role: 'assistant', content: scenarioQuestion, scenarioNumber: 1 },
      { role: 'user', content: "I don't understand the question.", scenarioNumber: 1 },
    ];

    const result = await runPreClaudeConfusionOfferRepeatGate(
      deps,
      "I don't understand the question.",
      messages,
      { type: 'confusion', confidence: 0.9 },
    );

    expect(result).toEqual({ handled: true });
    expect(speakTextSafe).toHaveBeenCalledWith(
      CONFUSION_REPEAT_OFFER_LINE,
      expect.objectContaining({ skipLastQuestionRef: true }),
    );
  });

  it('replays the scenario question after offer assent', async () => {
    const speakTextSafe = jest.fn().mockResolvedValue(undefined);
    const deps = createMockPreClaudeDeps({
      interviewSessionIdRef: { current: 'sess-1' },
      lastQuestionTextRef: { current: scenarioQuestion },
      speakTextSafe,
    });
    setConfusionRepeatOfferPending('sess-1');
    const messages = [
      { role: 'assistant', content: scenarioQuestion, scenarioNumber: 1 },
      { role: 'user', content: "I don't understand the question.", scenarioNumber: 1 },
      { role: 'assistant', content: CONFUSION_REPEAT_OFFER_LINE, scenarioNumber: 1 },
      { role: 'user', content: 'Yes', scenarioNumber: 1 },
    ];

    const result = await runPreClaudeConfusionOfferRepeatGate(deps, 'Yes', messages, null);

    expect(result).toEqual({ handled: true });
    const spoken = String(speakTextSafe.mock.calls[0]?.[0] ?? '');
    expect(spoken).toMatch(/What's going on between these two/i);
    expect(spoken).not.toMatch(/want me to repeat/i);
  });

  it('does not offer on repeat_request subtype', async () => {
    const speakTextSafe = jest.fn().mockResolvedValue(undefined);
    const deps = createMockPreClaudeDeps({ speakTextSafe });
    const result = await runPreClaudeConfusionOfferRepeatGate(
      deps,
      'Can you repeat that?',
      [{ role: 'assistant', content: scenarioQuestion }],
      { type: 'confusion', confidence: 1, confusion_subtype: 'repeat_request' },
    );
    expect(result).toEqual({ handled: false });
    expect(speakTextSafe).not.toHaveBeenCalled();
  });
});
