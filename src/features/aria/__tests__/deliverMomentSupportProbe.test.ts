import { describe, expect, it, jest } from '@jest/globals';

import { deliverMomentSupportProbe } from '../deliverMomentSupportProbe';
import { MOMENT_SUPPORT_QUESTION_TEXT } from '../moment4ProbeLogic';
import { createMockPreClaudeDeps } from './preClaudeGateTestHelpers';

describe('deliverMomentSupportProbe', () => {
  it('speaks the standard personal-block pivot then the support question', async () => {
    const speakTextSafe = jest.fn().mockResolvedValue(undefined);
    const setMessages = jest.fn();
    const deps = createMockPreClaudeDeps({
      currentInterviewMomentRef: { current: 4 },
      speakTextSafe,
      setMessages,
    });
    const messagesToUse = [
      {
        role: 'assistant',
        content:
          'When things get difficult, at what point do you work through it versus walk away?',
      },
      {
        role: 'user',
        content: 'I would walk away when trust is broken and repair feels impossible.',
      },
    ];

    const delivered = await deliverMomentSupportProbe({
      deps,
      messagesToUse,
      logTag: '[TEST_M_SUPPORT]',
    });

    expect(delivered).toBe(true);
    expect(speakTextSafe).toHaveBeenCalledWith(
      expect.stringMatching(/^Good work\./),
      expect.any(Object),
    );
    const spoken = String(speakTextSafe.mock.calls[0]?.[0] ?? '');
    expect(spoken.toLowerCase()).not.toMatch(/personal question|still personal|another question about you/);
    expect(speakTextSafe).toHaveBeenCalledWith(
      expect.stringContaining(MOMENT_SUPPORT_QUESTION_TEXT),
      expect.any(Object),
    );
    expect(deps.lastQuestionTextRef.current).toBe(MOMENT_SUPPORT_QUESTION_TEXT);
  });

  it('does not redeliver when support question is already in the transcript', async () => {
    const speakTextSafe = jest.fn().mockResolvedValue(undefined);
    const deps = createMockPreClaudeDeps({
      currentInterviewMomentRef: { current: 4 },
      speakTextSafe,
    });
    const messagesToUse = [
      { role: 'assistant', content: MOMENT_SUPPORT_QUESTION_TEXT },
      { role: 'user', content: 'I sat with her and listened.' },
    ];

    const delivered = await deliverMomentSupportProbe({ deps, messagesToUse });

    expect(delivered).toBe(false);
    expect(speakTextSafe).not.toHaveBeenCalled();
  });
});
