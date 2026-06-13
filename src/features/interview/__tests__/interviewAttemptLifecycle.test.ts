import { describe, expect, it } from '@jest/globals';
import {
  isSubstantiveInterviewAttempt,
  shouldCreateAttemptOnFirstSubstantiveResponse,
  transcriptHasSubstantiveUserTurn,
} from '../interviewAttemptLifecycle';

describe('interviewAttemptLifecycle', () => {
  it('detects substantive user turns in transcript json', () => {
    expect(transcriptHasSubstantiveUserTurn([])).toBe(false);
    expect(
      transcriptHasSubstantiveUserTurn([
        { role: 'user', content: 'yes ready' },
        { role: 'assistant', content: 'What do you think is going on here?' },
      ]),
    ).toBe(false);
    expect(
      transcriptHasSubstantiveUserTurn([
        {
          role: 'user',
          content:
            'I think Emma feels dismissed because Ryan keeps taking calls during their dinner and she has asked for his attention repeatedly without feeling heard.',
        },
      ]),
    ).toBe(true);
  });

  it('treats phantom empty attempts as non-substantive', () => {
    expect(
      isSubstantiveInterviewAttempt({
        is_phantom: true,
        completed_at: null,
        transcript: [],
      }),
    ).toBe(false);
    expect(
      isSubstantiveInterviewAttempt({
        is_phantom: false,
        completed_at: '2026-01-01T00:00:00Z',
        transcript: [],
      }),
    ).toBe(true);
  });

  it('requires substantive Scenario A answer for attempt creation trigger', () => {
    const q1 = "When Ryan takes a call from his mother during dinner with Emma, and Emma says she is done — what do you think is going on for Emma?";
    expect(
      shouldCreateAttemptOnFirstSubstantiveResponse({
        isAdmin: false,
        isInterviewAppRoute: true,
        status: 'active',
        existingAttemptId: null,
        currentInterviewMoment: 1,
        currentScenario: 1,
        userText: 'yes',
        lastAssistantQuestionText: q1,
      }),
    ).toBe(false);
    expect(
      shouldCreateAttemptOnFirstSubstantiveResponse({
        isAdmin: false,
        isInterviewAppRoute: true,
        status: 'active',
        existingAttemptId: null,
        currentInterviewMoment: 1,
        currentScenario: 1,
        userText:
          'Emma seems hurt and exhausted because Ryan keeps prioritizing other people over their time together and she feels invisible in the relationship.',
        lastAssistantQuestionText: q1,
      }),
    ).toBe(true);
  });
});
