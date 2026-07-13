import { describe, expect, it } from '@jest/globals';

import { MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT } from '../moment5ProbeCopy';
import {
  resolveInterviewTranscriptForCompletionScoring,
  scoreCompletionTranscriptM5Richness,
} from '../resolveInterviewTranscriptForCompletionScoring';

describe('resolveInterviewTranscriptForCompletionScoring', () => {
  const m5Anchor = {
    role: 'assistant' as const,
    content: MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT,
    scenarioNumber: 3,
    interviewMoment: 5,
  };
  const m5User = {
    role: 'user' as const,
    content:
      'I had a massive conflict with my mother regarding when I was going to get married. She was concerned I was taking too much time.',
    scenarioNumber: 3,
    interviewMoment: 5,
  };

  it('prefers updatedMessages when currentMessagesRef lacks M5 anchor and answers', () => {
    const staleRef = [
      { role: 'assistant', content: 'Thanks for sharing that. At what point do you walk away?', scenarioNumber: 3 },
      { role: 'user', content: 'When I dread seeing them.', scenarioNumber: 3, interviewMoment: 4 },
    ];
    const updated = [...staleRef, m5Anchor, m5User];
    expect(scoreCompletionTranscriptM5Richness(updated)).toBeGreaterThan(
      scoreCompletionTranscriptM5Richness(staleRef),
    );
    const picked = resolveInterviewTranscriptForCompletionScoring(staleRef, updated);
    expect(picked.some((t) => /conflict with someone important/i.test(t.content ?? ''))).toBe(true);
    expect(picked.filter((t) => t.role === 'user').length).toBeGreaterThanOrEqual(2);
  });

  it('returns empty when all candidates are empty', () => {
    expect(resolveInterviewTranscriptForCompletionScoring([], null, undefined)).toEqual([]);
  });
});
