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

  it('does not treat object-pronoun endings as cut-offs when the answer is substantive', () => {
    const answer =
      'They have a difference in priorities, Ryan should be able to tell their family that they will call them back if they really liked Emma and wanted to spend time with her.';
    expect(looksLikeIncompleteCutOffUserAnswer(answer)).toBe(false);
    expect(looksLikeUnassessableScenarioAnswer(answer)).toBe(false);
  });

  it('flags mid-sentence cut-offs even when a character name is present', () => {
    expect(looksLikeIncompleteCutOffUserAnswer('If I were Ryan, I would')).toBe(true);
    expect(looksLikeIncompleteCutOffUserAnswer('If I were Ryan I would')).toBe(true);
    expect(looksLikeIncompleteCutOffUserAnswer('If I were Ryan')).toBe(true);
    expect(looksLikeIncompleteCutOffUserAnswer('Emma is')).toBe(true);
    expect(looksLikeIncompleteCutOffUserAnswer('I think Emma is')).toBe(true);
    expect(looksLikeIncompleteCutOffUserAnswer('I think Daniel')).toBe(true);
    expect(looksLikeIncompleteCutOffUserAnswer('I think that Daniel')).toBe(true);
    expect(looksLikeIncompleteCutOffUserAnswer('I think that James could have')).toBe(true);
    expect(looksLikeIncompleteCutOffUserAnswer('I think James could have')).toBe(true);
    expect(looksLikeIncompleteCutOffUserAnswer('I think Sophie')).toBe(true);
    expect(looksLikeIncompleteCutOffUserAnswer('I think')).toBe(true);
    expect(looksLikeIncompleteCutOffUserAnswer('I think that')).toBe(true);
    expect(looksLikeIncompleteCutOffUserAnswer('Daniel felt genuinely')).toBe(true);
    expect(looksLikeIncompleteCutOffUserAnswer('Daniel felt genuinely at')).toBe(true);
    expect(
      looksLikeIncompleteCutOffUserAnswer(
        'Daniel felt genuinely at a loss about what to say next.',
      ),
    ).toBe(false);
    expect(
      looksLikeIncompleteCutOffUserAnswer('If I were Ryan, I would apologize and listen'),
    ).toBe(false);
    expect(
      looksLikeIncompleteCutOffUserAnswer(
        'We talked afterwards and figured out it was a misunderstanding and we parted ways amicably after that.',
      ),
    ).toBe(false);
    expect(looksLikeUnassessableScenarioAnswer('If I were Ryan, I would')).toBe(true);
    expect(looksLikeUnassessableScenarioAnswer('I think Daniel')).toBe(true);
    expect(looksLikeUnassessableScenarioAnswer('I think that Daniel')).toBe(true);
    expect(looksLikeUnassessableScenarioAnswer('I think')).toBe(true);
    expect(looksLikeUnassessableScenarioAnswer('Daniel felt genuinely')).toBe(true);
    expect(looksLikeIncompleteCutOffUserAnswer("I'm generally too nice and I don't")).toBe(true);
    expect(looksLikeIncompleteCutOffUserAnswer("I generally don't")).toBe(true);
    expect(looksLikeUnassessableScenarioAnswer("I'm generally too nice and I don't")).toBe(true);
    expect(
      looksLikeUnassessableScenarioAnswer('If I were Ryan, I would apologize and listen to Emma'),
    ).toBe(false);
  });

  it('does not treat complete short auxiliary replies as cut-offs or unassessable', () => {
    expect(looksLikeIncompleteCutOffUserAnswer('I did.')).toBe(false);
    expect(looksLikeIncompleteCutOffUserAnswer('I did')).toBe(false);
    expect(looksLikeIncompleteCutOffUserAnswer('I have.')).toBe(false);
    expect(looksLikeIncompleteCutOffUserAnswer('I was not.')).toBe(false);
    expect(looksLikeUnassessableScenarioAnswer('I did.')).toBe(false);
    expect(looksLikeUnassessableScenarioAnswer('I did it.')).toBe(false);
    expect(looksLikeIncompleteCutOffUserAnswer('I already did.')).toBe(false);
    expect(looksLikeIncompleteCutOffUserAnswer('I already did it.')).toBe(false);
    expect(looksLikeUnassessableScenarioAnswer('I already did')).toBe(false);
    expect(looksLikeUnassessableScenarioAnswer('I already did it')).toBe(false);
    expect(looksLikeIncompleteCutOffUserAnswer('If I were Ryan, I would')).toBe(true);
  });

  it('flags M5 mic-stop fragments and Whisper hallucination outros', () => {
    expect(looksLikeIncompleteCutOffUserAnswer('Yeah, me and my partner.')).toBe(true);
    expect(looksLikeIncompleteCutOffUserAnswer('Yeah, me and my partner')).toBe(true);
    expect(looksLikeIncompleteCutOffUserAnswer('Me and my partner')).toBe(true);
    expect(looksLikeUnassessableScenarioAnswer('Yeah, me and my partner.')).toBe(true);
    expect(looksLikeIncompleteCutOffUserAnswer('Thank you for watching!')).toBe(true);
    expect(looksLikeUnassessableScenarioAnswer('Thank you for watching!')).toBe(true);
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
    expect(hasMinimalAssessableScenarioContent("she's very frustrated")).toBe(true);
    expect(hasMinimalAssessableScenarioContent("I think she's very frustrated")).toBe(true);
  });

  it('accepts short Emma affect reads on the contempt probe', () => {
    expect(looksLikeUnassessableScenarioAnswer("I think she's very frustrated")).toBe(false);
    expect(looksLikeIncompleteCutOffUserAnswer("I think she's very frustrated")).toBe(false);
  });

  it('does not treat score-status asks as unassessable cut-offs', () => {
    expect(looksLikeUnassessableScenarioAnswer('Can I see my score')).toBe(false);
    expect(looksLikeUnassessableScenarioAnswer('Can I see my school')).toBe(false);
  });

  it('flags dangling threshold openers like "It depends on"', () => {
    expect(looksLikeIncompleteCutOffUserAnswer('It depends on')).toBe(true);
    expect(looksLikeUnassessableScenarioAnswer('It depends on')).toBe(true);
    expect(
      looksLikeUnassessableScenarioAnswer(
        'It depends on whether they keep showing up and doing the work after we talk.',
      ),
    ).toBe(false);
  });

  it('flags incomplete commitment conditionals like "If someone is willing"', () => {
    expect(looksLikeIncompleteCutOffUserAnswer('If someone is willing')).toBe(true);
    expect(looksLikeIncompleteCutOffUserAnswer('If my partner is willing to')).toBe(true);
    expect(looksLikeUnassessableScenarioAnswer('If someone is willing')).toBe(true);
    expect(
      looksLikeIncompleteCutOffUserAnswer(
        'If someone is willing to work on it, I would stay and try to repair things together.',
      ),
    ).toBe(false);
  });

  it('flags narrative openers like "This one time" with no story body', () => {
    expect(looksLikeIncompleteCutOffUserAnswer('This one time')).toBe(true);
    expect(looksLikeIncompleteCutOffUserAnswer('This one time...')).toBe(true);
    expect(looksLikeIncompleteCutOffUserAnswer('One time')).toBe(true);
    expect(looksLikeIncompleteCutOffUserAnswer('So this one time')).toBe(true);
    expect(looksLikeIncompleteCutOffUserAnswer('There was this one time')).toBe(true);
    expect(looksLikeIncompleteCutOffUserAnswer('There was a time')).toBe(true);
    expect(looksLikeIncompleteCutOffUserAnswer('This one time when')).toBe(true);
    expect(looksLikeUnassessableScenarioAnswer('This one time')).toBe(true);
    expect(
      looksLikeIncompleteCutOffUserAnswer(
        'This one time I had a fight with my roommate about dishes and we talked it through.',
      ),
    ).toBe(false);
  });

  it('flags tautological repair echoes without concrete how', () => {
    expect(looksLikeUnassessableScenarioAnswer('This situation can be repaired.')).toBe(true);
    expect(looksLikeUnassessableScenarioAnswer('It could be fixed.')).toBe(true);
    expect(
      looksLikeUnassessableScenarioAnswer(
        'I would apologize to Sophie and ask how she feels about him leaving.',
      ),
    ).toBe(false);
  });
});
