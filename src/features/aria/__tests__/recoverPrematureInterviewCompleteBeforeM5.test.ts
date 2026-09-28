import { describe, expect, it, jest } from '@jest/globals';

import { recoverPrematureInterviewCompleteBeforeM5 } from '@features/aria/recoverPrematureInterviewCompleteBeforeM5';
import { MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT } from '@features/aria/probeAndScoringUtils';
import {
  createMockPostClaudeDeps,
  createMockPostClaudeParams,
} from './postClaudeGateTestHelpers';

describe('recoverPrematureInterviewCompleteBeforeM5', () => {
  it('returns text unchanged when [INTERVIEW_COMPLETE] is absent', async () => {
    const deps = createMockPostClaudeDeps();
    const params = createMockPostClaudeParams();

    const result = await recoverPrematureInterviewCompleteBeforeM5(
      deps,
      params,
      'Thanks Alex, that helps.',
    );

    expect(result).toEqual({
      text: 'Thanks Alex, that helps.',
      rawApiHadInterviewComplete: false,
      strippedPrematureComplete: false,
      appendedMoment5RecoveryBundle: false,
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

    const result = await recoverPrematureInterviewCompleteBeforeM5(
      deps,
      params,
      'Thank you Alex. [INTERVIEW_COMPLETE]',
    );

    expect(result.rawApiHadInterviewComplete).toBe(true);
    expect(result.strippedPrematureComplete).toBe(true);
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

    const result = await recoverPrematureInterviewCompleteBeforeM5(
      deps,
      params,
      'Thank you for being so open with me. [INTERVIEW_COMPLETE]',
    );

    expect(result.rawApiHadInterviewComplete).toBe(true);
    expect(result.strippedPrematureComplete).toBe(false);
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

    const result = await recoverPrematureInterviewCompleteBeforeM5(
      deps,
      params,
      'Thanks Alex. [INTERVIEW_COMPLETE]',
    );

    expect(result.text).not.toMatch(/\[INTERVIEW_COMPLETE\]/i);
    expect(result.text).toMatch(/Alex/i);
    expect(result.appendedMoment5RecoveryBundle).toBe(true);
    expect(deps.moment5QuestionDeliveredRef.current).toBe(true);
    expect(deps.currentInterviewMomentRef.current).toBe(5);
    expect(speakTextSafe).toHaveBeenCalled();
  });

  it('injects Moment 5 after stripping natural-language closing before M5 was asked', async () => {
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
      participantFirstNameForSpoken: 'Matt',
      textToParallelStream: { full: '', spokenStarted: true, closingSpoken: false },
      messagesToUse: [
        {
          role: 'assistant',
          content:
            'Think of a time when a partner, or someone you care about, heard some bad news, needed support from you, or was really stressed. What happened, and what did you do?',
        },
        { role: 'user', content: 'I asked her.' },
      ],
    });

    const result = await recoverPrematureInterviewCompleteBeforeM5(
      deps,
      params,
      'Good work getting through all of this. Your interview is complete. Thank you for being so open with me, Matt.',
    );

    expect(result.rawApiHadInterviewComplete).toBe(false);
    expect(result.strippedPrematureComplete).toBe(true);
    expect(result.text).not.toMatch(/interview is complete/i);
    expect(result.appendedMoment5RecoveryBundle).toBe(true);
    expect(deps.moment5QuestionDeliveredRef.current).toBe(true);
    expect(deps.currentInterviewMomentRef.current).toBe(5);
  });
});
