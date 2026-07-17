import { describe, expect, it } from '@jest/globals';

import { looksLikeGoBackToPreviousScenarioRequest } from '@features/aria/interviewGoBackRequest';

describe('looksLikeGoBackToPreviousScenarioRequest', () => {
  it.each([
    'Can we go back?',
    'I want to go back to the previous scenario',
    'Go back to situation 1',
    'Can I redo the last one?',
    "Let's start over",
    'Reset my scores',
    'Take me back to Emma and Ryan',
    'Return to the previous question',
  ])('matches go-back ask: %s', (utterance) => {
    expect(looksLikeGoBackToPreviousScenarioRequest(utterance)).toBe(true);
  });

  it.each([
    'Emma seems annoyed at Ryan',
    "I don't understand the question",
    'Can you repeat that?',
    'Can we skip this?',
    "What's my score?",
  ])('does not match non-go-back turn: %s', (utterance) => {
    expect(looksLikeGoBackToPreviousScenarioRequest(utterance)).toBe(false);
  });
});
