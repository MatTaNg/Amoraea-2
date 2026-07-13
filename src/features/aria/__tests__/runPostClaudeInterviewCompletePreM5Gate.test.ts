import { describe, expect, it, jest } from '@jest/globals';

import { runPostClaudeInterviewCompletePreM5Gate } from '@features/aria/runPostClaudeInterviewCompletePreM5Gate';
import { MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT } from '@features/aria/probeAndScoringUtils';
import {
  createMockPostClaudeDeps,
  createMockPostClaudeParams,
} from './postClaudeGateTestHelpers';

describe('runPostClaudeInterviewCompletePreM5Gate', () => {
  it('returns text unchanged when [INTERVIEW_COMPLETE] is absent', async () => {
    const deps = createMockPostClaudeDeps();
    const params = createMockPostClaudeParams();

    const result = await runPostClaudeInterviewCompletePreM5Gate(
      deps,
      params,
      'Thanks Alex, that helps.',
    );

    expect(result).toEqual({
      text: 'Thanks Alex, that helps.',
      rawApiHadInterviewComplete: false,
    });
  });

  it('strips premature [INTERVIEW_COMPLETE] before Moment 5 close is allowed', async () => {
    const deps = createMockPostClaudeDeps({
      currentInterviewMomentRef: { current: 4 },
      moment5QuestionDeliveredRef: { current: false },
      moment5PrimaryAnchorDeliveredSessionRef: { current: false },
      moment5PostPromptUserTurnCountRef: { current: 0 },
      moment4ThresholdProbeAskedRef: { current: false },
    });
    const params = createMockPostClaudeParams({
      messagesToUse: [{ role: 'user', content: 'I held a grudge for years.' }],
    });

    const result = await runPostClaudeInterviewCompletePreM5Gate(
      deps,
      params,
      'Thank you Alex. [INTERVIEW_COMPLETE]',
    );

    expect(result.rawApiHadInterviewComplete).toBe(true);
    expect(result.text).not.toMatch(/\[INTERVIEW_COMPLETE\]/i);
    expect(result.text).toBe('Thank you Alex.');
  });

  it('keeps [INTERVIEW_COMPLETE] when Moment 5 close gate is satisfied', async () => {
    const deps = createMockPostClaudeDeps({
      currentInterviewMomentRef: { current: 5 },
      moment5QuestionDeliveredRef: { current: true },
      moment5PrimaryAnchorDeliveredSessionRef: { current: true },
      moment5PostPromptUserTurnCountRef: { current: 2 },
      moment5AccountabilityProbeFiredRef: { current: true },
    });
    const params = createMockPostClaudeParams({
      messagesToUse: [
        { role: 'assistant', content: MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT },
        {
          role: 'user',
          content: 'My coach called me out during practice and I got defensive.',
          interviewMoment: 5,
        },
        {
          role: 'assistant',
          content: 'What do you think you did or said that contributed to the conflict?',
        },
        {
          role: 'user',
          content: 'I raised my voice and should have listened first. We talked it through after.',
          interviewMoment: 5,
        },
      ],
    });

    const result = await runPostClaudeInterviewCompletePreM5Gate(
      deps,
      params,
      'Thank you for being so open with me. [INTERVIEW_COMPLETE]',
    );

    expect(result.rawApiHadInterviewComplete).toBe(true);
    expect(result.text).toMatch(/\[INTERVIEW_COMPLETE\]/i);
  });

  it('injects Moment 5 anchor after stripping complete when M4 threshold was asked', async () => {
    const speakTextSafe = jest.fn().mockResolvedValue(undefined);
    const deps = createMockPostClaudeDeps({
      currentInterviewMomentRef: { current: 4 },
      moment4ThresholdProbeAskedRef: { current: true },
      moment5QuestionDeliveredRef: { current: false },
      moment5QuestionDeliveryInFlightRef: { current: false },
      moment5PrimaryAnchorDeliveredSessionRef: { current: false },
      moment5PostPromptUserTurnCountRef: { current: 0 },
      speakTextSafe,
    });
    const params = createMockPostClaudeParams({
      participantFirstNameForSpoken: 'Alex',
      textToParallelStream: { full: '', spokenStarted: true, closingSpoken: false },
      messagesToUse: [{ role: 'user', content: 'I would leave when trust is broken.' }],
    });

    const result = await runPostClaudeInterviewCompletePreM5Gate(
      deps,
      params,
      'Thanks Alex. [INTERVIEW_COMPLETE]',
    );

    expect(result.text).not.toMatch(/\[INTERVIEW_COMPLETE\]/i);
    expect(result.text).toMatch(/Alex/i);
    expect(deps.moment5QuestionDeliveredRef.current).toBe(true);
    expect(deps.currentInterviewMomentRef.current).toBe(5);
    expect(speakTextSafe).toHaveBeenCalled();
  });
});
