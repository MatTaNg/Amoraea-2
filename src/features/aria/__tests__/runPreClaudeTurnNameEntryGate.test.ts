import { describe, expect, it, jest } from '@jest/globals';

import { runPreClaudeTurnNameEntryGate } from '@features/aria/runPreClaudeTurnNameEntryGate';
import { createMockPreClaudeDeps } from './preClaudeGateTestHelpers';

const NAME_PROMPT = "Hi, I'm Amoraea. What can I call you?";

function nameEntryDeps(overrides: Parameters<typeof createMockPreClaudeDeps>[0] = {}) {
  return createMockPreClaudeDeps({
    isInterviewAppRoute: true,
    interviewNameRef: { current: null },
    interviewNameReaskPendingRef: { current: false },
    interviewNameReaskUsedRef: { current: false },
    lastQuestionTextRef: { current: NAME_PROMPT },
    ...overrides,
  });
}

describe('runPreClaudeTurnNameEntryGate', () => {
  it('re-asks when reply sounds like readiness assent instead of a name', async () => {
    const deliverRecordingRetryLine = jest.fn().mockResolvedValue(undefined);
    const deps = nameEntryDeps({ deliverRecordingRetryLine });

    const result = await runPreClaudeTurnNameEntryGate(deps, 'yes');

    expect(result.isNameEntryTurn).toBe(true);
    expect(result.haltTurn).toBe(true);
    expect(deliverRecordingRetryLine).toHaveBeenCalled();
  });

  it('accepts a plausible name and delivers intro briefing', async () => {
    const speakTextSafe = jest.fn().mockResolvedValue(undefined);
    const deps = nameEntryDeps({
      speakTextSafe,
      lastVoiceTurnConfidenceRef: { current: 0.92 },
    });

    const result = await runPreClaudeTurnNameEntryGate(deps, 'Maya');

    expect(result.isNameEntryTurn).toBe(true);
    expect(result.haltTurn).toBe(true);
    expect(result.participantFirstNameForSpoken).toBe('Maya');
    expect(deps.interviewNameRef.current).toBe('Maya');
    expect(speakTextSafe).toHaveBeenCalled();
  });
});
