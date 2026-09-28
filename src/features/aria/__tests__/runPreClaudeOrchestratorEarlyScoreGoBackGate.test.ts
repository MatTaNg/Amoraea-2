import { describe, expect, it, jest } from '@jest/globals';

import { runPreClaudeOrchestratorEarlyScoreGoBackGate } from '@features/aria/runPreClaudeOrchestratorEarlyScoreGoBackGate';
import { speakInterviewOrchestratorFixedLine } from '@features/aria/speakInterviewOrchestratorFixedLine';
import { createMockPreClaudeDeps } from './preClaudeGateTestHelpers';

jest.mock('@features/aria/speakInterviewOrchestratorFixedLine', () => ({
  speakInterviewOrchestratorFixedLine: jest.fn(async () => true),
}));

const fixedLineMock = jest.mocked(speakInterviewOrchestratorFixedLine);

const baseMessages = [
  { role: 'assistant', content: 'What do you think is going on here?', scenarioNumber: 2 },
  { role: 'user', content: 'Can we go back to the first scenario?', scenarioNumber: 2 },
];

describe('runPreClaudeOrchestratorEarlyScoreGoBackGate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns handled:false for non score/go-back utterances', async () => {
    const deps = createMockPreClaudeDeps();
    const result = await runPreClaudeOrchestratorEarlyScoreGoBackGate(
      deps,
      'Sarah seems upset',
      baseMessages,
    );
    expect(result).toEqual({ handled: false });
    expect(fixedLineMock).not.toHaveBeenCalled();
  });

  it('declines go-back via orchestrator fixed line before other gates', async () => {
    const deps = createMockPreClaudeDeps();
    const result = await runPreClaudeOrchestratorEarlyScoreGoBackGate(
      deps,
      'Can we go back to the first scenario?',
      baseMessages,
    );
    expect(result).toEqual({ handled: true });
    expect(fixedLineMock).toHaveBeenCalledWith(
      expect.objectContaining({
        lineId: 'go_back_decline',
      }),
    );
  });

  it('declines score asks via orchestrator fixed line', async () => {
    const deps = createMockPreClaudeDeps();
    const result = await runPreClaudeOrchestratorEarlyScoreGoBackGate(
      deps,
      "What's my score?",
      baseMessages,
    );
    expect(result).toEqual({ handled: true });
    expect(fixedLineMock).toHaveBeenCalledWith(
      expect.objectContaining({
        lineId: 'score_decline',
      }),
    );
  });
});
