import { interviewCompletionPercent } from '@features/aria/interviewProgressPresentation';

describe('interviewCompletionPercent', () => {
  const none = {};

  it('starts on the first scenario opening', () => {
    expect(
      interviewCompletionPercent({
        currentMoment: 1,
        momentsComplete: none,
        lastQuestionText: "What's going on between these two?",
      }),
    ).toBe(5);
  });

  it('advances when the Emma follow-up is delivered', () => {
    const opening = interviewCompletionPercent({
      currentMoment: 1,
      momentsComplete: none,
      lastQuestionText: "What's going on between these two?",
    });
    const emmaFollowUp = interviewCompletionPercent({
      currentMoment: 1,
      momentsComplete: none,
      lastQuestionText:
        "What about when Emma says 'you've made that very clear' — what do you make of that?",
    });
    expect(emmaFollowUp).toBeGreaterThan(opening);
    expect(emmaFollowUp).toBe(10);
  });

  it('advances again when the Ryan repair follow-up is delivered', () => {
    expect(
      interviewCompletionPercent({
        currentMoment: 1,
        momentsComplete: none,
        lastQuestionText: 'If you were Ryan, how would you repair this?',
      }),
    ).toBe(14);
  });

  it('stays well under a third after scenario 1 ends', () => {
    expect(
      interviewCompletionPercent({
        currentMoment: 2,
        momentsComplete: { 1: true },
        lastQuestionText: 'What do you think is going on here?',
      }),
    ).toBe(21);
  });

  it('keeps credit for the current section when the latest line is not a prompt', () => {
    expect(
      interviewCompletionPercent({
        currentMoment: 3,
        momentsComplete: { 1: true, 2: true },
        lastQuestionText: 'Got it.',
      }),
    ).toBe(29);
  });

  it('stays under 100 until the last section is complete', () => {
    expect(
      interviewCompletionPercent({
        currentMoment: 5,
        momentsComplete: { 1: true, 2: true, 3: true, 4: true },
        lastQuestionText:
          'Think of a time when you had a conflict with someone important to you. What happened, and how did things get resolved between you two?',
      }),
    ).toBe(93);
  });

  it('reaches 100 when the last section is complete', () => {
    expect(
      interviewCompletionPercent({
        currentMoment: 5,
        momentsComplete: { 1: true, 2: true, 3: true, 4: true, 5: true },
      }),
    ).toBe(100);
  });
});
