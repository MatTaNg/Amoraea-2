import { describe, expect, it, beforeEach } from '@jest/globals';

import {
  clearConfusionRepeatOfferPending,
  isConfusionRepeatOfferPending,
  looksLikeConfusionRepeatOfferAssent,
  looksLikeConfusionRepeatOfferDecline,
  looksLikeQuestionContentConfusion,
  setConfusionRepeatOfferPending,
} from '@features/aria/confusionRepeatOfferState';
import { shouldAllowResumeRepeatChoiceTurnProcessing } from '@features/aria/resumeRepeatGate';
import { classifyResumeRepeatIntent } from '@features/aria/resumeRepeatIntent';

describe('looksLikeQuestionContentConfusion', () => {
  it.each([
    "I don't understand the question.",
    "I don't get the question",
    'What do you mean?',
    'You never asked a question',
    "There was no question",
    "I didn't hear a question",
    "I'm confused",
    "That doesn't make sense",
  ])('matches: %s', (utterance) => {
    expect(looksLikeQuestionContentConfusion(utterance)).toBe(true);
  });

  it.each([
    'Emma seems annoyed',
    'Can you repeat what you said?',
    'I want to skip this',
  ])('does not match: %s', (utterance) => {
    expect(looksLikeQuestionContentConfusion(utterance)).toBe(false);
  });
});

describe('confusion repeat offer assent/decline', () => {
  it('recognizes assent and decline', () => {
    expect(looksLikeConfusionRepeatOfferAssent('Yes')).toBe(true);
    expect(looksLikeConfusionRepeatOfferAssent('please repeat')).toBe(true);
    expect(looksLikeConfusionRepeatOfferDecline('No')).toBe(true);
    expect(looksLikeConfusionRepeatOfferDecline("I'm good")).toBe(true);
  });
});

describe('resume gate + confusion', () => {
  beforeEach(() => {
    clearConfusionRepeatOfferPending();
  });

  it('allows "I don\'t understand the question" through resume repeat-choice pending', () => {
    expect(
      shouldAllowResumeRepeatChoiceTurnProcessing(
        "I don't understand the question.",
        5,
        "What about when Emma says 'you've made that very clear' — what do you make of that?",
      ),
    ).toBe(true);
    expect(classifyResumeRepeatIntent("I don't understand the question.")).toBe('repeat');
  });

  it('tracks offer pending by session id', () => {
    setConfusionRepeatOfferPending('session-a');
    expect(isConfusionRepeatOfferPending('session-a')).toBe(true);
    expect(isConfusionRepeatOfferPending('session-b')).toBe(false);
    clearConfusionRepeatOfferPending();
    expect(isConfusionRepeatOfferPending('session-a')).toBe(false);
  });
});
