import {
  isNamePromptInterviewMoment,
  isShortAnswerOkForWhisperRatioGate,
} from '../interviewLanguageGate';

describe('isNamePromptInterviewMoment', () => {
  it('matches the standard opening line', () => {
    expect(
      isNamePromptInterviewMoment("Hi, I'm Amoraea. What can I call you?")
    ).toBe(true);
  });

  it('matches what/should i call you without leading hi', () => {
    expect(isNamePromptInterviewMoment('What should I call you?')).toBe(true);
  });

  it('still matches legacy phrasings', () => {
    expect(isNamePromptInterviewMoment("What's your name?")).toBe(true);
    expect(isNamePromptInterviewMoment('How should I call you?')).toBe(true);
  });
});

describe('isShortAnswerOkForWhisperRatioGate', () => {
  it('treats opening name question as short-answer OK', () => {
    expect(
      isShortAnswerOkForWhisperRatioGate("Hi, I'm Amoraea. What can I call you?")
    ).toBe(true);
  });
});
