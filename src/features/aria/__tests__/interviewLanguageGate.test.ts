import {
  computeWhisperRatioReaskState,
  getWhisperRatioReaskSuppressionReason,
  getWhisperReaskTurnContext,
  isNamePromptInterviewMoment,
  isScenarioModalEligibleScenarioQuestionPrompt,
  isScenarioModalExcludedAssistantPrompt,
  isShortAnswerOkForWhisperRatioGate,
  isSimpleYesNoInterviewMoment,
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

describe('isSimpleYesNoInterviewMoment', () => {
  it('does not match scenario reassurance copy merely because it contains "yes" or "no"', () => {
    expect(
      isSimpleYesNoInterviewMoment("There's no right or wrong answer — share what comes to mind.")
    ).toBe(false);
  });

  it('matches explicit yes-or-no choice instructions', () => {
    expect(isSimpleYesNoInterviewMoment('Can you answer with a simple yes or no?')).toBe(true);
  });

  it('matches readiness prompts', () => {
    expect(isSimpleYesNoInterviewMoment('Are you ready to begin?')).toBe(true);
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

  it('does not ratio re-ask substantive one-word transcripts (treat as valid answer)', () => {
    expect(
      shouldFireWhisperRatioReask({
        turnContext: 'substantive',
        transcriptText: 'fine',
        wordCount: 1,
        wordsPerSecond: 0.08,
        shortAnswerOk: false,
      })
    ).toBe(false);
  });

  it('exposes valid_hard_stop log reason when ratio would fire on one word', () => {
    expect(
      computeWhisperRatioReaskState({
        turnContext: 'substantive',
        transcriptText: 'No',
        wordCount: 1,
        wordsPerSecond: 0.05,
        shortAnswerOk: false,
      })
    ).toEqual({ shouldFire: false, logSuppressedReason: 'valid_hard_stop' });
  });

  it('suppresses two-word I cant when ratio gate would fire (multi-token hard stop)', () => {
    expect(
      computeWhisperRatioReaskState({
        turnContext: 'substantive',
        transcriptText: "I can't",
        wordCount: 2,
        wordsPerSecond: 0.06,
        shortAnswerOk: false,
      })
    ).toEqual({ shouldFire: false, logSuppressedReason: 'valid_hard_stop' });
  });

  it('does not log hard_stop suppression when ratio gate would not fire (e.g. three-word answer)', () => {
    expect(
      computeWhisperRatioReaskState({
        turnContext: 'substantive',
        transcriptText: "I don't know.",
        wordCount: 3,
        wordsPerSecond: 0.06,
        shortAnswerOk: false,
      })
    ).toEqual({ shouldFire: false, logSuppressedReason: null });
  });

  it('still ratio re-asks thin two-word answers when ratio is bad', () => {
    expect(
      shouldFireWhisperRatioReask({
        turnContext: 'substantive',
        transcriptText: 'no thanks',
        wordCount: 2,
        wordsPerSecond: 0.08,
        shortAnswerOk: false,
      })
    ).toBe(true);
  });
});

describe('getWhisperRatioReaskSuppressionReason', () => {
  it('treats any single non-empty token as valid_hard_stop', () => {
    expect(getWhisperRatioReaskSuppressionReason('Nope', 1)).toBe('valid_hard_stop');
  });

  it('returns null for empty or zero word count', () => {
    expect(getWhisperRatioReaskSuppressionReason('   ', 0)).toBe(null);
    expect(getWhisperRatioReaskSuppressionReason('hello', 0)).toBe(null);
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

describe('isScenarioModalExcludedAssistantPrompt', () => {
  it('flags whisper infra / ratio recovery copy', () => {
    expect(
      isScenarioModalExcludedAssistantPrompt(
        "I'm having a little trouble on my end — could you say that one more time?"
      )
    ).toBe(true);
    expect(
      isScenarioModalExcludedAssistantPrompt(
        'I only caught part of that — could you answer again in a full sentence?'
      )
    ).toBe(true);
  });

  it('does not flag a normal scenario question', () => {
    expect(
      isScenarioModalExcludedAssistantPrompt(
        'When Daniel comes back and says he did not know what to say — what do you make of that?'
      )
    ).toBe(false);
  });
});

describe('isScenarioModalEligibleScenarioQuestionPrompt', () => {
  it('accepts typical scenario follow-ups', () => {
    expect(
      isScenarioModalEligibleScenarioQuestionPrompt(
        'And if you were James, how would you repair?'
      )
    ).toBe(true);
  });

  it('rejects infra copy even when it contains a question mark', () => {
    expect(
      isScenarioModalEligibleScenarioQuestionPrompt(
        "I'm having a little trouble on my end — could you say that one more time?"
      )
    ).toBe(false);
  });

  it('rejects non-interrogative lines', () => {
    expect(isScenarioModalEligibleScenarioQuestionPrompt("That's the end of this scenario — nice work.")).toBe(
      false
    );
  });

  it('rejects name-collection prompts', () => {
    expect(isScenarioModalEligibleScenarioQuestionPrompt("Hi, I'm Amoraea. What can I call you?")).toBe(false);
  });
});
