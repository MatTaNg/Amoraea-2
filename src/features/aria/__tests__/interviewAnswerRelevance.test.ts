import {
  hasMinimalAssessableScenarioContent,
  isIrrelevantAnswerRetryAssistantLine,
  IRRELEVANT_ANSWER_RETRY_LINE,
  looksLikeIncompleteCutOffUserAnswer,
  looksLikeInterviewerIdentityOrOffTopicAsk,
  looksLikeUnassessableScenarioAnswer,
} from '@features/aria/interviewAnswerRelevance';

describe('interviewAnswerRelevance', () => {
  it('flags interviewer identity / off-topic asks', () => {
    expect(looksLikeInterviewerIdentityOrOffTopicAsk('Are you an alien?')).toBe(true);
    expect(looksLikeInterviewerIdentityOrOffTopicAsk('Are you AI?')).toBe(true);
    expect(looksLikeInterviewerIdentityOrOffTopicAsk('Who made you?')).toBe(true);
    expect(looksLikeInterviewerIdentityOrOffTopicAsk("Emma's being contemptuous toward Ryan")).toBe(
      false,
    );
  });

  it('recognizes the cut-off retry line (and legacy copy)', () => {
    expect(isIrrelevantAnswerRetryAssistantLine(IRRELEVANT_ANSWER_RETRY_LINE)).toBe(true);
    expect(
      isIrrelevantAnswerRetryAssistantLine(
        "That's not something I can score — it doesn't answer the question.",
      ),
    ).toBe(true);
    expect(isIrrelevantAnswerRetryAssistantLine('If you were Ryan, how would you repair this?')).toBe(
      false,
    );
  });

  it('flags mid-sentence cut-offs even when a character name is present', () => {
    expect(looksLikeIncompleteCutOffUserAnswer('If I were Ryan, I would')).toBe(true);
    expect(looksLikeIncompleteCutOffUserAnswer('If I were Ryan I would')).toBe(true);
    expect(looksLikeIncompleteCutOffUserAnswer('If I were Ryan')).toBe(true);
    expect(looksLikeIncompleteCutOffUserAnswer('Emma is')).toBe(true);
    expect(looksLikeIncompleteCutOffUserAnswer('I think Emma is')).toBe(true);
    expect(
      looksLikeIncompleteCutOffUserAnswer('If I were Ryan, I would apologize and listen'),
    ).toBe(false);
    expect(looksLikeUnassessableScenarioAnswer('If I were Ryan, I would')).toBe(true);
    expect(
      looksLikeUnassessableScenarioAnswer('If I were Ryan, I would apologize and listen to Emma'),
    ).toBe(false);
  });

  it('flags unassessable answers including identity asks and empty engagement', () => {
    expect(looksLikeUnassessableScenarioAnswer('Are you an alien?')).toBe(true);
    expect(looksLikeUnassessableScenarioAnswer('pizza')).toBe(true);
    expect(looksLikeUnassessableScenarioAnswer('blue sky')).toBe(true);
    expect(
      looksLikeUnassessableScenarioAnswer("She's showing contempt — that clear closing line"),
    ).toBe(false);
    expect(looksLikeUnassessableScenarioAnswer("I'd apologize and listen to how Emma feels")).toBe(
      false,
    );
  });

  it('requires minimal assessable scenario content', () => {
    expect(hasMinimalAssessableScenarioContent('Are you an alien?')).toBe(false);
    expect(hasMinimalAssessableScenarioContent('contempt')).toBe(true);
    expect(hasMinimalAssessableScenarioContent('Ryan should apologize')).toBe(true);
  });
});
