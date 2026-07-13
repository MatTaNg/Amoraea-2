import { describe, expect, it } from '@jest/globals';

import { buildInterviewResponseTimingEntry } from '@features/aria/buildInterviewResponseTimingEntry';
import { createMockPreClaudeDeps } from './preClaudeGateTestHelpers';

describe('buildInterviewResponseTimingEntry', () => {
  it('skips preamble and yes/no prompts', () => {
    const deps = createMockPreClaudeDeps({
      lastQuestionTextRef: { current: 'Are you ready to begin?' },
      responseTimingsRef: { current: [] },
    });
    expect(buildInterviewResponseTimingEntry(deps, 'yes')).toBeNull();
    expect(deps.responseTimingsRef.current).toEqual([]);
  });

  it('builds a timing entry for substantive scenario questions', () => {
    const deps = createMockPreClaudeDeps({
      lastQuestionTextRef: { current: 'If you were Ryan, how would you repair this situation?' },
      currentScenarioRef: { current: 1 },
      currentInterviewMomentRef: { current: 1 },
      responseTimingsRef: { current: [] },
      timingRef: {
        current: {
          recordingStartTime: 1_000,
          questionEndTime: 800,
        },
      },
      lastUserTurnAudioDurationMsRef: { current: null },
    });

    const entry = buildInterviewResponseTimingEntry(deps, 'I would apologize first.');
    expect(entry).toEqual({
      question_id: 'q_1',
      scenario: 1,
      question_text: 'If you were Ryan, how would you repair this situation?',
      latency_ms: 200,
      duration_ms: expect.any(Number),
      word_count: 4,
    });
  });
});
