import {
  evaluateMoment4RelationshipType,
  isAnsweringFirstUserTurnAfterMoment4Threshold,
  isIncompleteMoment4ThresholdLeadSentence,
  looksLikeMisplacedNonGrudgeMoment4Answer,
  looksLikeMoment4GrudgePrompt,
  looksLikeMoment4ThresholdQuestion,
  looksLikeUnassessableMoment4ThresholdAnswer,
  coerceMoment4ThresholdQuestionForTts,
  MOMENT_4_COMMITMENT_THRESHOLD_QUESTION_CARD_BODY,
  MOMENT_4_COMMITMENT_THRESHOLD_QUESTION_TEXT,
  MOMENT_4_GRUDGE_QUESTION_TEXT,
  shouldForceMoment4ThresholdProbe,
  transcriptIncludesMoment4ThresholdAssistant,
} from '../moment4ProbeLogic';

const M4_GRUDGE_CARD = MOMENT_4_GRUDGE_QUESTION_TEXT;

const M4_THRESHOLD =
  '"At what point do you decide when a relationship is something to work through versus something you need to walk away from?"';

const M4_THRESHOLD_FORCED_INJECT = MOMENT_4_COMMITMENT_THRESHOLD_QUESTION_TEXT;

describe('moment4ProbeLogic', () => {
  it('detects canonical episodic grudge question', () => {
    expect(looksLikeMoment4GrudgePrompt(MOMENT_4_GRUDGE_QUESTION_TEXT)).toBe(true);
    expect(
      looksLikeMoment4GrudgePrompt(
        "Have you ever held a grudge against someone, or had someone in your life you really didn't like?",
      ),
    ).toBe(true);
    expect(
      looksLikeMoment4GrudgePrompt(
        'Is there anyone in your life — past or present — that you really struggle to like or that you hold a grudge against?',
      ),
    ).toBe(true);
  });

  it('detects commitment threshold with smart quotes and without requiring the word "point" in paraphrases', () => {
    expect(looksLikeMoment4ThresholdQuestion(M4_THRESHOLD)).toBe(true);
    expect(
      looksLikeMoment4ThresholdQuestion(
        '\u201cAt what point do you decide when a relationship is something to work through versus something you need to walk away from?\u201d',
      )
    ).toBe(true);
    expect(looksLikeMoment4ThresholdQuestion(M4_THRESHOLD_FORCED_INJECT)).toBe(true);
    expect(
      looksLikeMoment4ThresholdQuestion(
        'When would you decide if a relationship is worth working through or it is time to walk away?',
      )
    ).toBe(true);
    expect(
      looksLikeMoment4ThresholdQuestion(
        "When Devon said that — was there a moment where you considered whether the friendship was worth continuing, or did you always know you'd work through it?",
      ),
    ).toBe(true);
    expect(
      looksLikeMoment4ThresholdQuestion(
        "When something like that comes up — where trust gets broken and the friendship changes — what's your threshold for working through it versus walking away entirely?",
      ),
    ).toBe(true);
    expect(
      looksLikeMoment4ThresholdQuestion(
        "When something like that comes up — where there's real tension with another person — are you someone who tends to work through it, or are there situations where you'd rather just walk away?",
      ),
    ).toBe(true);
    expect(
      looksLikeMoment4ThresholdQuestion(
        "Makes sense. If something like that happened with someone you care about — is that more the kind of thing you'd work through, or would you walk away?",
      ),
    ).toBe(true);
  });

  it('coerces unauthorized care-about work-through/walk-away paraphrase to canonical threshold', () => {
    const unauthorized =
      "Makes sense. If something like that happened with someone you care about — is that more the kind of thing you'd work through, or would you walk away?";
    expect(coerceMoment4ThresholdQuestionForTts(unauthorized)).toBe(
      `Makes sense. Thanks for sharing that. ${MOMENT_4_COMMITMENT_THRESHOLD_QUESTION_CARD_BODY}`,
    );
  });

  it('detects incomplete streaming commitment-threshold paraphrases', () => {
    const truncated = 'When you think about what it takes to fully work through something';
    expect(isIncompleteMoment4ThresholdLeadSentence(truncated)).toBe(true);
    expect(looksLikeMoment4ThresholdQuestion(truncated)).toBe(false);
    expect(coerceMoment4ThresholdQuestionForTts(truncated)).toBe(M4_THRESHOLD_FORCED_INJECT);
  });

  it('detects session-log truncated threshold lead before walk-away fork', () => {
    const truncated =
      "Got it. When it comes to that situation — or relationships in general — what's your";
    expect(isIncompleteMoment4ThresholdLeadSentence(truncated)).toBe(true);
    expect(looksLikeMoment4ThresholdQuestion(truncated)).toBe(false);
    expect(coerceMoment4ThresholdQuestionForTts(truncated)).toBe(
      `Got it. Thanks for sharing that. ${MOMENT_4_COMMITMENT_THRESHOLD_QUESTION_CARD_BODY}`,
    );
  });

  it('detects past-tense truncated threshold paraphrase from live session', () => {
    const truncated = 'Got it. When it came to that situation — is there a point';
    expect(isIncompleteMoment4ThresholdLeadSentence(truncated)).toBe(true);
    expect(looksLikeMoment4ThresholdQuestion(truncated)).toBe(false);
    expect(coerceMoment4ThresholdQuestionForTts(truncated)).toBe(
      `Got it. Thanks for sharing that. ${MOMENT_4_COMMITMENT_THRESHOLD_QUESTION_CARD_BODY}`,
    );
  });

  it('coerces complete model paraphrase to canonical threshold copy (session log)', () => {
    const paraphrase = "Got it. When do you decide it's worth working through versus walking away?";
    expect(coerceMoment4ThresholdQuestionForTts(paraphrase)).toBe(
      `Got it. Thanks for sharing that. ${MOMENT_4_COMMITMENT_THRESHOLD_QUESTION_CARD_BODY}`,
    );
  });

  it('coerces cuts-deep / where\'s-your-line threshold paraphrase to canonical commitment copy', () => {
    const paraphrase =
      "Got it. When something like that happens — when someone you care about says something that cuts deep — where's your line between working through it or walking away from it?";
    expect(looksLikeMoment4ThresholdQuestion(paraphrase)).toBe(true);
    expect(coerceMoment4ThresholdQuestionForTts(paraphrase)).toBe(
      `Got it. Thanks for sharing that. ${MOMENT_4_COMMITMENT_THRESHOLD_QUESTION_CARD_BODY}`,
    );
  });

  it('detects incomplete cuts-deep threshold lead before walk-away fork', () => {
    const truncated =
      "When something like that happens — when someone you care about says something that cuts deep — where's your line between working through it";
    expect(isIncompleteMoment4ThresholdLeadSentence(truncated)).toBe(true);
    expect(coerceMoment4ThresholdQuestionForTts(truncated)).toBe(M4_THRESHOLD_FORCED_INJECT);
  });

  it('strips leading reflection before threshold question for TTS', () => {
    const withReflection =
      'You named who this was with and what still weighs on you from that falling-out. Thanks for sharing that. At what point do you decide when a relationship is something to work through versus something you need to walk away from?';
    expect(coerceMoment4ThresholdQuestionForTts(withReflection)).toBe(M4_THRESHOLD_FORCED_INJECT);
  });

  it('transcriptIncludesMoment4ThresholdAssistant finds a threshold line among assistants', () => {
    const msgs = [
      { role: 'assistant', content: M4_GRUDGE_CARD },
      { role: 'user', content: 'There was a person at work.' },
      { role: 'assistant', content: M4_THRESHOLD_FORCED_INJECT },
    ];
    expect(transcriptIncludesMoment4ThresholdAssistant(msgs)).toBe(true);
    expect(transcriptIncludesMoment4ThresholdAssistant([{ role: 'assistant', content: M4_GRUDGE_CARD }])).toBe(false);
  });

  it('isAnsweringFirstUserTurnAfterMoment4Threshold: true when threshold was asked and no user reply yet (even with assistant ack after threshold)', () => {
    const prior = [
      { role: 'assistant', content: M4_GRUDGE_CARD },
      { role: 'user', content: 'Short grudge story.' },
      { role: 'assistant', content: M4_THRESHOLD_FORCED_INJECT },
      { role: 'assistant', content: "Thanks — I'm curious how you'd put that in practice." },
    ];
    expect(isAnsweringFirstUserTurnAfterMoment4Threshold(prior)).toBe(true);
  });

  it('isAnsweringFirstUserTurnAfterMoment4Threshold: false once user has replied after the threshold', () => {
    const prior = [
      { role: 'assistant', content: M4_GRUDGE_CARD },
      { role: 'user', content: 'Short grudge story.' },
      { role: 'assistant', content: M4_THRESHOLD_FORCED_INJECT },
      { role: 'user', content: 'I walk away when there is no trust left.' },
    ];
    expect(isAnsweringFirstUserTurnAfterMoment4Threshold(prior)).toBe(false);
  });

  it('isAnsweringFirstUserTurnAfterMoment4Threshold: true after unassessable threshold retry before first assessable answer', () => {
    const prior = [
      { role: 'assistant', content: M4_GRUDGE_CARD },
      { role: 'user', content: 'Short grudge story.' },
      { role: 'assistant', content: M4_THRESHOLD_FORCED_INJECT },
      {
        role: 'user',
        content: 'I think it depends. If you really love each other, then you should try your best to make it work.',
      },
      {
        role: 'assistant',
        content: "I wasn't able to understand that — you may have gotten cut off. Can you try again?",
      },
    ];
    expect(isAnsweringFirstUserTurnAfterMoment4Threshold(prior)).toBe(true);
  });

  it('does not classify Moment 5 conflict paraphrase as grudge prompt', () => {
    const m5Paraphrase =
      'Think of a time you had a conflict with someone close to you — maybe a fight, a falling out, or just a moment where things got tense. What happened, and how did things get resolved?';
    expect(looksLikeMoment4GrudgePrompt(m5Paraphrase)).toBe(false);
  });

  it('isAnsweringFirstUserTurnAfterMoment4Threshold: false when threshold never appeared', () => {
    const prior = [
      { role: 'assistant', content: M4_GRUDGE_CARD },
      { role: 'user', content: 'Still on grudge answer only.' },
    ];
    expect(isAnsweringFirstUserTurnAfterMoment4Threshold(prior)).toBe(false);
  });

  it('classifies coworker answers as non_close', () => {
    const answer = 'It was a coworker I worked with closely, and I distanced myself from them.';
    const evalResult = evaluateMoment4RelationshipType(answer);
    expect(evalResult.relationshipType).toBe('non_close');
    expect(evalResult.nonCloseSignals).toContain('coworker');
  });

  it('triggers commitment follow-up eligibility in Moment 4 regardless of relationship classification', () => {
    const answer = 'A colleague at work kept taking credit and I stepped back.';
    const evalResult = evaluateMoment4RelationshipType(answer);
    expect(evalResult.relationshipType).toBe('non_close');
    expect(
      shouldForceMoment4ThresholdProbe({
        isMoment4: true,
        probeAlreadyAsked: false,
        lastAssistantContent: M4_GRUDGE_CARD,
        userAnswerText: answer,
      })
    ).toBe(true);
  });

  it('triggers threshold probe when Moment 4 and probe not yet asked; stops after probe ref is set', () => {
    const okAnswer = 'I held a grudge against my roommate for a year; we worked through it slowly.';
    expect(
      shouldForceMoment4ThresholdProbe({
        isMoment4: true,
        probeAlreadyAsked: false,
        lastAssistantContent: M4_GRUDGE_CARD,
        userAnswerText: okAnswer,
      })
    ).toBe(true);
    expect(
      shouldForceMoment4ThresholdProbe({
        isMoment4: true,
        probeAlreadyAsked: true,
        lastAssistantContent: M4_GRUDGE_CARD,
        userAnswerText: okAnswer,
      })
    ).toBe(false);
    expect(
      shouldForceMoment4ThresholdProbe({
        isMoment4: false,
        probeAlreadyAsked: false,
        lastAssistantContent: M4_GRUDGE_CARD,
        userAnswerText: okAnswer,
      })
    ).toBe(false);
  });

  it('does not force threshold when user asks to go back to a previous scenario', () => {
    expect(
      shouldForceMoment4ThresholdProbe({
        isMoment4: true,
        probeAlreadyAsked: false,
        lastAssistantContent: M4_GRUDGE_CARD,
        userAnswerText: 'Can we go back?',
      })
    ).toBe(false);
    expect(
      shouldForceMoment4ThresholdProbe({
        isMoment4: true,
        probeAlreadyAsked: false,
        lastAssistantContent: M4_GRUDGE_CARD,
        userAnswerText: 'Can we go back?',
        answeringSpecificityFollowUp: true,
      })
    ).toBe(false);
  });

  it('does not force threshold when last assistant was the threshold question (user answering follow-up)', () => {
    expect(
      shouldForceMoment4ThresholdProbe({
        isMoment4: true,
        probeAlreadyAsked: false,
        lastAssistantContent: M4_THRESHOLD,
        userAnswerText: 'I would leave when trust was gone for good.',
      })
    ).toBe(false);
  });

  it('does not force threshold when user answers Scenario C fiction instead of the grudge prompt (attempt 153)', () => {
    const misplaced =
      "I think they'd need to genuinely try everything first — probably including couples therapy — before calling it. One recurring argument isn't enough. But if Daniel kept leaving and never came back, or if Sophie kept escalating every time Daniel needed space and neither of them could shift their pattern even with help, that's when I'd say it's not working.";
    expect(looksLikeMisplacedNonGrudgeMoment4Answer(misplaced)).toBe(true);
    expect(
      shouldForceMoment4ThresholdProbe({
        isMoment4: true,
        probeAlreadyAsked: false,
        lastAssistantContent: M4_GRUDGE_CARD,
        userAnswerText: misplaced,
      })
    ).toBe(false);
  });

  describe('looksLikeUnassessableMoment4ThresholdAnswer', () => {
    it('flags mic-stop conditionals and partner-only replies that skip the stay/leave fork', () => {
      expect(looksLikeUnassessableMoment4ThresholdAnswer('If someone is willing')).toBe(true);
      expect(
        looksLikeUnassessableMoment4ThresholdAnswer(
          "If my partner is with me, I can't do anything about it.",
        ),
      ).toBe(true);
      expect(
        looksLikeUnassessableMoment4ThresholdAnswer(
          "If my partner is with me, I can't do anything about it. If my partner is with me, I can't do anything about it.",
        ),
      ).toBe(true);
    });

    it('accepts substantive threshold answers', () => {
      expect(
        looksLikeUnassessableMoment4ThresholdAnswer(
          'I would walk away when trust is broken and repair feels impossible.',
        ),
      ).toBe(false);
      expect(
        looksLikeUnassessableMoment4ThresholdAnswer(
          'when I switch from looking forward to meeting my partner every day to dreading the next time that I would have to see them',
        ),
      ).toBe(false);
      expect(
        looksLikeUnassessableMoment4ThresholdAnswer(
          "I think it depends on the person, but if you really love each other and you really need to work together, then it's worth saving.",
        ),
      ).toBe(false);
      expect(
        looksLikeUnassessableMoment4ThresholdAnswer(
          "I think if two partners are willing to do the work, no matter how hard it gets, it's worth saving if you really love each other.",
        ),
      ).toBe(false);
    });
  });
});

