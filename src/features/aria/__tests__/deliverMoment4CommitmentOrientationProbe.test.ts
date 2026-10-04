import { describe, expect, it, jest } from '@jest/globals';

import { deliverMoment4CommitmentOrientationProbe } from '@features/aria/deliverMoment4CommitmentOrientationProbe';
import {
  MOMENT_4_COMMITMENT_ORIENTATION_FROM_GRUDGE_SPOKEN,
  MOMENT_4_COMMITMENT_ORIENTATION_QUESTION_TEXT,
} from '@features/aria/moment4ProbeLogic';
import { createMockPreClaudeDeps } from './preClaudeGateTestHelpers';

describe('deliverMoment4CommitmentOrientationProbe', () => {
  it('acknowledges the grudge answer and shifts into the keep-investing question', async () => {
    const speakTextSafe = jest.fn().mockResolvedValue(undefined);
    const setMessages = jest.fn();
    const deps = createMockPreClaudeDeps({
      currentInterviewMomentRef: { current: 4 },
      currentScenarioRef: { current: 3 },
      speakTextSafe,
      setMessages,
    });
    const messagesToUse = [
      {
        role: 'assistant' as const,
        content:
          "Think of someone you've had a really hard time with — maybe a falling out, a grudge, or just someone who got under your skin.",
      },
      {
        role: 'user' as const,
        content: 'My friend shared something private and it wrecked the friendship.',
      },
    ];

    const delivered = await deliverMoment4CommitmentOrientationProbe({
      deps,
      trimmed: messagesToUse[1].content,
      messagesToUse,
      logTag: '[TEST_M4_ORIENTATION_ACK]',
    });

    expect(delivered).toBe(true);
    expect(speakTextSafe).toHaveBeenCalledTimes(1);
    const spoken = String(speakTextSafe.mock.calls[0]?.[0] ?? '');
    expect(spoken).toBe(MOMENT_4_COMMITMENT_ORIENTATION_FROM_GRUDGE_SPOKEN);
    expect(spoken).toContain(MOMENT_4_COMMITMENT_ORIENTATION_QUESTION_TEXT);
    expect(spoken).not.toMatch(/i'm with you/i);
    expect(setMessages).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          role: 'assistant',
          content: MOMENT_4_COMMITMENT_ORIENTATION_FROM_GRUDGE_SPOKEN,
        }),
      ]),
    );
  });

  it('keeps the question-only card body even when TTS includes the receipt', async () => {
    const setReferenceCardScenario = jest.fn();
    const deps = createMockPreClaudeDeps({
      currentInterviewMomentRef: { current: 4 },
      currentScenarioRef: { current: 3 },
      speakTextSafe: jest.fn().mockResolvedValue(undefined),
      setMessages: jest.fn(),
      setReferenceCardScenario,
    });

    await deliverMoment4CommitmentOrientationProbe({
      deps,
      trimmed: 'I stayed because I still trusted her.',
      messagesToUse: [{ role: 'user', content: 'I stayed because I still trusted her.' }],
      logTag: '[TEST_M4_ORIENTATION_CARD]',
    });

    expect(setReferenceCardScenario).toHaveBeenCalledWith({
      label: 'Personal reflection',
      text: MOMENT_4_COMMITMENT_ORIENTATION_QUESTION_TEXT,
    });
  });
});
