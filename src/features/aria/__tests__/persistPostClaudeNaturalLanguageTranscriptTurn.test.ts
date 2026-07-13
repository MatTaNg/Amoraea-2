import { describe, expect, it, jest } from '@jest/globals';

import {
  ensureScenarioCQ1SequenceAfterVignette,
  stripScenarioCRepairQuestionFromText,
} from '@features/aria/interviewScenarioCTextHelpers';
import { persistPostClaudeNaturalLanguageTranscriptTurn } from '@features/aria/persistPostClaudeNaturalLanguageTranscriptTurn';
import {
  createMockPostClaudeDeps,
  createMockPostClaudeParams,
} from './postClaudeGateTestHelpers';

describe('interviewScenarioCTextHelpers', () => {
  it('stripScenarioCRepairQuestionFromText removes repair prompt lines', () => {
    const text = "Sophie and Daniel argue.\n\nHow do you think this situation could be repaired?";
    expect(stripScenarioCRepairQuestionFromText(text)).not.toMatch(/could be repaired/i);
  });
});

describe('persistPostClaudeNaturalLanguageTranscriptTurn', () => {
  it('commits assistant messages and returns transcript persist metadata', () => {
    const commitInterviewMessages = jest.fn();
    const deps = createMockPostClaudeDeps({
      commitInterviewMessages,
      currentScenarioRef: { current: 1 },
      currentInterviewMomentRef: { current: 1 },
      currentMessagesRef: { current: [{ role: 'user', content: 'I sided with Emma.' }] },
    });
    const params = createMockPostClaudeParams({
      messagesToUse: [{ role: 'user', content: 'I sided with Emma.' }],
    });

    const result = persistPostClaudeNaturalLanguageTranscriptTurn(
      deps,
      params,
      'Thanks Alex, that makes sense.',
      'Thanks Alex, that makes sense.',
    );

    expect(commitInterviewMessages).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ role: 'assistant', content: 'Thanks Alex, that makes sense.' }),
      ]),
    );
    expect(result.priorScenarioNum).toBe(1);
    expect(result.updatedMessages.length).toBeGreaterThan(0);
    expect(result.aiMsg.content).toMatch(/makes sense/i);
  });
});
