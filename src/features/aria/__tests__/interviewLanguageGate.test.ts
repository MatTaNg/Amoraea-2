import {
  getWhisperReaskTurnContext,
  isNamePromptInterviewMoment,
  isShortAnswerOkForWhisperRatioGate,
  shouldFireWhisperRatioReask,
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

describe('shouldFireWhisperRatioReask', () => {
  it('does not re-ask for non-empty name collection turns', () => {
    expect(
      shouldFireWhisperRatioReask({
        turnContext: 'name_collection',
        transcriptText: 'Maya',
        wordCount: 1,
        wordsPerSecond: 0.05,
        shortAnswerOk: true,
      })
    ).toBe(false);
  });

  it('does not re-ask for non-empty readiness confirmation turns', () => {
    expect(
      shouldFireWhisperRatioReask({
        turnContext: 'readiness_confirmation',
        transcriptText: 'Yes',
        wordCount: 1,
        wordsPerSecond: 0.05,
        shortAnswerOk: true,
      })
    ).toBe(false);
  });

  it('still re-asks for empty transcripts even on exempt turns', () => {
    expect(
      shouldFireWhisperRatioReask({
        turnContext: 'readiness_confirmation',
        transcriptText: '   ',
        wordCount: 0,
        wordsPerSecond: 0,
        shortAnswerOk: true,
      })
    ).toBe(true);
  });

  it('keeps substantive turn behavior unchanged', () => {
    expect(
      shouldFireWhisperRatioReask({
        turnContext: 'substantive',
        transcriptText: 'fine',
        wordCount: 1,
        wordsPerSecond: 0.08,
        shortAnswerOk: false,
      })
    ).toBe(true);
  });
});

describe('getWhisperReaskTurnContext', () => {
  it('classifies name and readiness prompts as exempt contexts', () => {
    expect(getWhisperReaskTurnContext("Hi, I'm Amoraea. What can I call you?")).toBe(
      'name_collection'
    );
    expect(getWhisperReaskTurnContext('Are you ready to begin?')).toBe(
      'readiness_confirmation'
    );
  });
});
