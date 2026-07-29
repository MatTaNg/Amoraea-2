import { describe, expect, it } from '@jest/globals';

import { looksLikeInterviewScoreStatusRequest } from '@features/aria/interviewScoreStatusRequest';

describe('looksLikeInterviewScoreStatusRequest', () => {
  it.each([
    "What's my score?",
    'What is my score',
    'Am I passing?',
    'Am I gonna pass',
    'Did I pass?',
    'How am I doing?',
    'How am I doing so far',
    'Am I failing',
    'How did I do',
    'Can you tell me my score',
    "What's my results",
    'Am I doing well',
    'Can I see my score',
    'Can I see my score?',
    'Can I get my score',
    'Show me my score',
  ])('matches score/status ask: %s', (utterance) => {
    expect(looksLikeInterviewScoreStatusRequest(utterance)).toBe(true);
  });

  it('matches common Whisper mishearing of score as school', () => {
    expect(looksLikeInterviewScoreStatusRequest('Can I see my school')).toBe(true);
  });

  it.each([
    'Emma seems annoyed at Ryan',
    'They keep score of every little slight',
    'Hello?',
    'Can you repeat that?',
    'I want to skip this one',
    "I don't know",
  ])('does not match non-score turn: %s', (utterance) => {
    expect(looksLikeInterviewScoreStatusRequest(utterance)).toBe(false);
  });
});
