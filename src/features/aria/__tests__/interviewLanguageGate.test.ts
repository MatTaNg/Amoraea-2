import {
  computeWhisperRatioReaskState,
  getWhisperRatioReaskSuppressionReason,
  getWhisperReaskTurnContext,
  isNamePromptInterviewMoment,
  isScenarioModalEligibleScenarioQuestionPrompt,
  isScenarioModalExcludedAssistantPrompt,
  isScenarioModalFollowUpProbe,
  getLastSubstantiveScenarioModalQuestion,
  assistantSpeechShouldRefreshScenarioModalPrompt,
  resolveMoment4ShowScenarioReferenceCard,
  resolveScenarioModalPromptInScope,
  resolveScenarioModalDisplayParts,
  extractScenarioModalQuestionFromAssistantText,
  isShortAnswerOkForWhisperRatioGate,
  isSimpleYesNoInterviewMoment,
  looksLikeReadinessAffirmation,
  looksLikeReadinessYesHomophone,
  normalizeReadinessHomophoneTranscript,
  isInterviewExitConfirmationMoment,
  isResumeReentryWelcomePrompt,
  looksLikeInterviewExitDecline,
  userIsAnsweringInterviewReadinessPrompt,
  shouldFireWhisperRatioReask,
  shouldRecordInterviewResponseTiming,
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

  it('matches split-stream opener before the name question sentence', () => {
    expect(isNamePromptInterviewMoment("Hi, I'm Amoraea.")).toBe(true);
  });

  it('still matches legacy phrasings', () => {
    expect(isNamePromptInterviewMoment("What's your name?")).toBe(true);
    expect(isNamePromptInterviewMoment('How should I call you?')).toBe(true);
  });

  it('matches name re-ask lines', () => {
    expect(
      isNamePromptInterviewMoment(
        "Sorry, I didn't quite catch that — what name would you like me to use?"
      )
    ).toBe(true);
  });
});

describe('shouldRecordInterviewResponseTiming', () => {
  it('excludes greeting and preamble turns', () => {
    expect(shouldRecordInterviewResponseTiming("Hi, I'm Amoraea. What can I call you?")).toBe(
      false,
    );
    expect(
      shouldRecordInterviewResponseTiming(
        'Good to meet you, Matt. The way this works is we will go through five parts… Are you ready?',
      ),
    ).toBe(false);
    expect(shouldRecordInterviewResponseTiming('Are you ready to begin?')).toBe(false);
  });

  it('includes substantive scenario questions', () => {
    expect(
      shouldRecordInterviewResponseTiming('If you were Ryan, how would you repair this situation?'),
    ).toBe(true);
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

describe('looksLikeReadinessAffirmation', () => {
  it('matches common readiness assents', () => {
    expect(looksLikeReadinessAffirmation('Yes')).toBe(true);
    expect(looksLikeReadinessAffirmation('Yeah.')).toBe(true);
    expect(looksLikeReadinessAffirmation("I'm ready")).toBe(true);
    expect(looksLikeReadinessAffirmation("Let's go")).toBe(true);
    expect(looksLikeReadinessAffirmation('S.')).toBe(true);
    expect(looksLikeReadinessAffirmation('Y')).toBe(true);
  });

  it('treats Whisper yes homophones as readiness assent', () => {
    expect(looksLikeReadinessAffirmation('Bye.')).toBe(true);
    expect(looksLikeReadinessAffirmation('Bye. Bye.')).toBe(true);
    expect(looksLikeReadinessAffirmation('Bye-bye.')).toBe(true);
    expect(looksLikeReadinessYesHomophone('Bye. Bye.')).toBe(true);
    expect(looksLikeReadinessYesHomophone('Bye-bye.')).toBe(true);
  });

  it('rejects declines and long answers', () => {
    expect(looksLikeReadinessAffirmation('No')).toBe(false);
    expect(looksLikeReadinessAffirmation('Not yet')).toBe(false);
    expect(looksLikeReadinessAffirmation('Yes, repeat')).toBe(false);
    expect(
      looksLikeReadinessAffirmation(
        'Yes I am ready to begin the interview now and I have privacy',
      ),
    ).toBe(false);
  });
});

describe('normalizeReadinessHomophoneTranscript', () => {
  it('maps bye homophones to Yes only on readiness prompts', () => {
    expect(
      normalizeReadinessHomophoneTranscript('Bye. Bye.', ['Are you ready to start?']),
    ).toBe('Yes');
    expect(
      normalizeReadinessHomophoneTranscript('Bye-bye.', ['Are you ready to start?']),
    ).toBe('Yes');
    expect(
      normalizeReadinessHomophoneTranscript('Bye. Bye.', ["What's going on between these two?"]),
    ).toBe('Bye. Bye.');
  });

  it('maps bye homophones on resume welcome when resume gate is pending', () => {
    expect(
      normalizeReadinessHomophoneTranscript(
        'Bye-bye.',
        ["What's going on between these two?"],
        { resumeGatePending: true },
      ),
    ).toBe('Yes');
  });

  it('does not normalize bye homophones on the name question', () => {
    expect(
      normalizeReadinessHomophoneTranscript('Bye.', ['What should I call you?']),
    ).toBe('Bye.');
    expect(
      normalizeReadinessHomophoneTranscript('Bye-bye.', [
        "Please say just your first name clearly — what should I call you?",
      ]),
    ).toBe('Bye-bye.');
  });
});

describe('interview exit confirmation helpers', () => {
  it('detects exit confirmation assistant lines', () => {
    expect(
      isInterviewExitConfirmationMoment(
        'I hear you. If you leave now, it may affect your score. Are you sure you want to stop?',
      ),
    ).toBe(true);
    expect(isInterviewExitConfirmationMoment('Are you ready to begin?')).toBe(false);
  });

  it('detects participant stay / continue replies', () => {
    expect(looksLikeInterviewExitDecline('No, I want you to stay.')).toBe(true);
    expect(looksLikeInterviewExitDecline("I don't want to leave")).toBe(true);
    expect(looksLikeInterviewExitDecline('Yes')).toBe(false);
  });
});

describe('userIsAnsweringInterviewReadinessPrompt', () => {
  it('detects briefing and readiness prompts from refs or transcript', () => {
    expect(
      userIsAnsweringInterviewReadinessPrompt([
        "Good to meet you, Max. The way this works is I'll give you three situations. Are you ready?",
      ]),
    ).toBe(true);
    expect(userIsAnsweringInterviewReadinessPrompt(['Are you ready?'])).toBe(true);
    expect(
      userIsAnsweringInterviewReadinessPrompt(["What's going on between these two?"]),
    ).toBe(false);
  });
});

describe('isResumeReentryWelcomePrompt', () => {
  it('detects standard resume welcome copy', () => {
    expect(
      isResumeReentryWelcomePrompt(
        "Welcome back — we'll pick up where we left off. If you'd like me to repeat what I said, let me know.",
      ),
    ).toBe(true);
  });
});

describe('isShortAnswerOkForWhisperRatioGate', () => {
  it('treats opening name question as short-answer OK', () => {
    expect(
      isShortAnswerOkForWhisperRatioGate("Hi, I'm Amoraea. What can I call you?")
    ).toBe(true);
  });

  it('treats post-name preamble briefing as short-answer OK', () => {
    expect(
      isShortAnswerOkForWhisperRatioGate(
        "Good to meet you, Matt. The way this works is I'll first give you three situations. Are you ready?"
      )
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
  it('treats procedural single-word assent/refusal as valid_hard_stop', () => {
    expect(getWhisperRatioReaskSuppressionReason('Nope', 1)).toBe('valid_hard_stop');
    expect(getWhisperRatioReaskSuppressionReason('Yes', 1)).toBe('valid_hard_stop');
    expect(getWhisperRatioReaskSuppressionReason('fine', 1)).toBe('valid_hard_stop');
  });

  it('does not treat mid-sentence single-word fragments as valid_hard_stop', () => {
    expect(getWhisperRatioReaskSuppressionReason("That's", 1)).toBe(null);
    expect(getWhisperRatioReaskSuppressionReason('So', 1)).toBe(null);
  });

  it('returns null for empty or zero word count', () => {
    expect(getWhisperRatioReaskSuppressionReason('   ', 0)).toBe(null);
    expect(getWhisperRatioReaskSuppressionReason('hello', 0)).toBe(null);
  });

  it('suppresses multi-word readiness affirmations', () => {
    expect(getWhisperRatioReaskSuppressionReason('Yes, yes.', 2)).toBe('valid_hard_stop');
  });

  it('suppresses ratio re-ask for complete short auxiliary replies like "I did"', () => {
    expect(getWhisperRatioReaskSuppressionReason('I did.', 2)).toBe('valid_hard_stop');
    expect(getWhisperRatioReaskSuppressionReason('I have', 2)).toBe('valid_hard_stop');
    expect(getWhisperRatioReaskSuppressionReason('I already did.', 3)).toBe('valid_hard_stop');
    expect(getWhisperRatioReaskSuppressionReason('I already did it.', 4)).toBe('valid_hard_stop');
    expect(
      shouldFireWhisperRatioReask({
        turnContext: 'substantive',
        transcriptText: 'I did.',
        wordCount: 2,
        wordsPerSecond: 0,
        shortAnswerOk: false,
      }),
    ).toBe(false);
  });
});

describe('computeWhisperRatioReaskState — fragment single words', () => {
  it('ratio re-asks substantive turns when Whisper returns a one-word fragment', () => {
    expect(
      computeWhisperRatioReaskState({
        turnContext: 'substantive',
        transcriptText: "That's",
        wordCount: 1,
        wordsPerSecond: 0.641,
        shortAnswerOk: false,
      })
    ).toEqual({ shouldFire: true, logSuppressedReason: null });
  });
});

describe('getWhisperReaskTurnContext', () => {
  it('classifies name and readiness prompts as exempt contexts', () => {
    expect(getWhisperReaskTurnContext("Hi, I'm Amoraea. What can I call you?")).toBe(
      'name_collection'
    );
    expect(getWhisperReaskTurnContext("Hi, I'm Amoraea.")).toBe('name_collection');
    expect(getWhisperReaskTurnContext('Are you ready to begin?')).toBe(
      'readiness_confirmation'
    );
    expect(
      getWhisperReaskTurnContext(
        "Good to meet you, Matt. The way this works is I'll first give you three situations. Are you ready?"
      )
    ).toBe('readiness_confirmation');
  });

  it('keeps name collection active after ratio recovery while profile name is unset', () => {
    expect(
      getWhisperReaskTurnContext(
        'I only caught part of that — could you answer again in a full sentence?',
        {
          interviewName: null,
          lastQuestionText:
            'I only caught part of that — could you answer again in a full sentence?',
        },
      ),
    ).toBe('name_collection');
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

describe('isScenarioModalFollowUpProbe', () => {
  it('flags elongating and clarification probes', () => {
    expect(isScenarioModalFollowUpProbe('Can you say more about that?')).toBe(true);
    expect(isScenarioModalFollowUpProbe('Just say whatever comes to mind.')).toBe(true);
    expect(isScenarioModalFollowUpProbe('Take your time — just say whatever comes to mind.')).toBe(true);
    expect(
      isScenarioModalFollowUpProbe(
        'It sounds like something may have cut you off there — want to give that one another try?',
      ),
    ).toBe(true);
  });

  it('flags irrelevant-answer cut-off retry infra', () => {
    expect(
      isScenarioModalFollowUpProbe(
        "I wasn't able to understand that — you may have gotten cut off. Can you try again?",
      ),
    ).toBe(true);
  });

  it('does not flag substantive scenario questions', () => {
    expect(
      isScenarioModalFollowUpProbe(
        "When Ryan takes a call from his mother during dinner — what's going on for Emma?"
      )
    ).toBe(false);
  });

  it('flags forbidden Scenario C Sophie prescriptive follow-up', () => {
    expect(
      isScenarioModalFollowUpProbe(
        'And what do you think Sophie should do when Daniel comes back?',
      ),
    ).toBe(true);
  });
});

describe('getLastSubstantiveScenarioModalQuestion', () => {
  it('skips probe after user thin answer (Nancy-style transcript)', () => {
    const emmaQuestion =
      "When Ryan takes a call from his mother during dinner with Emma, and Emma says she is done — what do you think is going on for Emma?";
    const transcript = [
      { role: 'assistant', content: emmaQuestion },
      { role: 'user', content: 'She is upset about boundaries.' },
      { role: 'assistant', content: 'Can you say more about that?' },
      { role: 'user', content: 'Thank you.' },
      { role: 'assistant', content: 'Good — and what would you want Ryan to do differently?' },
    ];
    expect(getLastSubstantiveScenarioModalQuestion(transcript)).toBe(
      'Good — and what would you want Ryan to do differently?'
    );
    const transcriptProbeLast = transcript.slice(0, 4);
    expect(getLastSubstantiveScenarioModalQuestion(transcriptProbeLast)).toBe(emmaQuestion);
  });

  it('keeps compound transition turns that introduce the next scenario question', () => {
    const compound =
      "That's the end of this scenario — Nice work. Here's the next situation:\n\nSarah has been job hunting for four months. She gets an offer and calls James from the street, too emotional to go inside. What's going on for Sarah?";
    const transcript = [
      { role: 'assistant', content: 'What do you think James should do first?' },
      { role: 'user', content: 'Listen.' },
      { role: 'assistant', content: compound },
    ];
    expect(getLastSubstantiveScenarioModalQuestion(transcript)).toBe(
      "What's going on for Sarah?"
    );
  });

  it('resolveScenarioModalPromptInScope uses current situation opening, not prior repair question', () => {
    const detect = (c: string) => {
      if (c.includes('Sarah has been job hunting')) return { label: 'Situation 2' };
      if (c.includes('Emma and Ryan')) return { label: 'Situation 1' };
      return null;
    };
    const transcript = [
      { role: 'assistant', content: 'What if you were Ryan? How would you repair this situation?' },
      { role: 'user', content: 'Apologize and set boundaries.' },
      {
        role: 'assistant',
        content:
          "That's the end of this scenario — nice work. Here's the next situation:\n\nSarah has been job hunting for four months. She gets an offer and calls James from the street.",
      },
    ];
    expect(
      resolveScenarioModalPromptInScope(transcript, {
        scenarioLabel: 'Situation 2',
        detectScenarioFromContent: detect,
        openingQuestionForLabel: (label) =>
          label === 'Situation 2' ? 'What do you think is going on here?' : null,
      })
    ).toBe('What do you think is going on here?');
    expect(getLastSubstantiveScenarioModalQuestion(transcript)).toBe(
      'How would you repair this situation?'
    );
  });

  it('skips pure transition closings without a question', () => {
    const transcript = [
      { role: 'assistant', content: 'How would you repair this if you were Ryan?' },
      { role: 'user', content: 'Apologize and set boundaries.' },
      {
        role: 'assistant',
        content: "That's the end of this scenario — nice work, you focused on boundaries.",
      },
    ];
    expect(getLastSubstantiveScenarioModalQuestion(transcript)).toBe(
      'If you were Ryan, how would you repair this?',
    );
  });
});

describe('assistantSpeechShouldRefreshScenarioModalPrompt', () => {
  it('returns true for accountability and repair follow-ups', () => {
    expect(
      assistantSpeechShouldRefreshScenarioModalPrompt(
        'What could James have done differently before the fight?'
      )
    ).toBe(true);
    expect(
      assistantSpeechShouldRefreshScenarioModalPrompt('If you were James, how would you repair this situation?')
    ).toBe(true);
    expect(
      assistantSpeechShouldRefreshScenarioModalPrompt('And if you were James, how would you repair?')
    ).toBe(true);
  });

  it('returns false for elongating probes', () => {
    expect(assistantSpeechShouldRefreshScenarioModalPrompt('Can you say more about that?')).toBe(false);
  });
});

describe('resolveScenarioModalDisplayParts', () => {
  const vignette =
    "Emma and Ryan have dinner plans. Ryan takes a call from his mother halfway through. It runs 25 minutes. Emma pays the bill but seems flustered. Later Ryan asks what's wrong. Emma says 'I just think you always put your family first before us.' Ryan says 'I can't just ignore my mother.' Emma says 'I know, you've made that very clear.'";
  const opening = "What's going on between these two?";

  it('splits combined vignette+question into transcript and footer', () => {
    expect(resolveScenarioModalDisplayParts(`${vignette}\n\n${opening}`, null)).toEqual({
      transcript: vignette,
      footerQuestion: opening,
    });
  });

  it('strips footer question from body when prompt is provided separately', () => {
    expect(resolveScenarioModalDisplayParts(`${vignette}\n\n${opening}`, opening)).toEqual({
      transcript: vignette,
      footerQuestion: opening,
    });
  });

  it('footer shows only the question when vignette dialogue was wrongly included in prompt', () => {
    const bloatedPrompt = `${vignette.slice(vignette.indexOf("Emma says"))} ${opening}`;
    expect(resolveScenarioModalDisplayParts(vignette, bloatedPrompt)).toEqual({
      transcript: vignette,
      footerQuestion: opening,
    });
  });

  it('extractScenarioModalQuestionFromAssistantText skips vignette dialogue before opening', () => {
    const inline = `${vignette} ${opening}`;
    expect(extractScenarioModalQuestionFromAssistantText(inline)).toBe(opening);
  });

  it('keeps question-only body in the scroll area with no footer (Moment 4/5)', () => {
    const questionOnly = 'Have you ever held a grudge against someone?';
    expect(resolveScenarioModalDisplayParts(questionOnly, null)).toEqual({
      transcript: questionOnly,
      footerQuestion: null,
    });
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

  it('rejects elongating probes even when they contain a question mark', () => {
    expect(isScenarioModalEligibleScenarioQuestionPrompt('Can you say more about that?')).toBe(false);
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

  it('rejects intro briefing readiness questions', () => {
    expect(isScenarioModalEligibleScenarioQuestionPrompt('Are you ready?')).toBe(false);
    expect(
      isScenarioModalEligibleScenarioQuestionPrompt(
        "Good to meet you, Matt. The way this works is I'll first give you three situations. Are you ready?",
      ),
    ).toBe(false);
  });
});

describe('resolveMoment4ShowScenarioReferenceCard', () => {
  const grudgeCardBody =
    "Have you ever held a grudge against someone, or had someone in your life you really didn't like? How did that happen, and where are you with it now?";
  const grudgeHandoff =
    "Now we'll shift to something more personal. Have you ever held a grudge against someone, or had someone in your life you really didn't like?";
  const thresholdProbe =
    'Thanks for sharing that. At what point do you decide when a relationship is something to work through versus something you need to walk away from?';
  const situation3Repair = 'How would you repair this situation if you were Daniel?';

  it('replaces grudge card with walk-away question in card body (client inject path)', () => {
    const transcript = [
      { role: 'assistant', content: situation3Repair },
      { role: 'assistant', content: grudgeHandoff },
      { role: 'user', content: 'I had a grudge with my friend.' },
    ];
    const resolved = resolveMoment4ShowScenarioReferenceCard(transcript, {
      grudgeCardBody,
      currentSpokenContent: thresholdProbe,
    });
    expect(resolved).toEqual({
      active: true,
      cardBodyText:
        'At what point do you decide when a relationship is something to work through versus something you need to walk away from?',
    });
  });

  it('returns inactive for fiction-only transcript', () => {
    expect(
      resolveMoment4ShowScenarioReferenceCard(
        [{ role: 'assistant', content: situation3Repair }],
        { grudgeCardBody },
      ),
    ).toEqual({ active: false });
  });

  it('uses grudge card body during grudge-only phase', () => {
    expect(
      resolveMoment4ShowScenarioReferenceCard([{ role: 'assistant', content: grudgeHandoff }], {
        grudgeCardBody,
      }),
    ).toEqual({ active: true, cardBodyText: grudgeCardBody });
  });

  it('uses canonical threshold card body when streaming paraphrase is incomplete', () => {
    const truncated = 'When you think about what it takes to fully work through something';
    const transcript = [
      { role: 'assistant', content: grudgeHandoff },
      { role: 'user', content: 'I had a grudge with my friend.' },
    ];
    expect(
      resolveMoment4ShowScenarioReferenceCard(transcript, {
        grudgeCardBody,
        currentSpokenContent: truncated,
      }),
    ).toEqual({
      active: true,
      cardBodyText:
        'At what point do you decide when a relationship is something to work through versus something you need to walk away from?',
    });
  });

  it('uses canonical threshold card body for complete model paraphrase', () => {
    const paraphrase = "Got it. When do you decide it's worth working through versus walking away?";
    expect(
      resolveMoment4ShowScenarioReferenceCard([{ role: 'assistant', content: paraphrase }], {
        grudgeCardBody,
      }),
    ).toEqual({
      active: true,
      cardBodyText:
        'At what point do you decide when a relationship is something to work through versus something you need to walk away from?',
    });
  });

  it('uses canonical threshold card body for trust-broken friendship threshold paraphrase (session log)', () => {
    const paraphrase =
      "When something like that comes up — where trust gets broken and the friendship changes — what's your threshold for working through it versus walking away entirely?";
    expect(
      resolveMoment4ShowScenarioReferenceCard([{ role: 'assistant', content: paraphrase }], {
        grudgeCardBody,
      }),
    ).toEqual({
      active: true,
      cardBodyText:
        'At what point do you decide when a relationship is something to work through versus something you need to walk away from?',
    });
  });

  it('returns inactive when a later Moment 5 conflict anchor is in the transcript', () => {
    const m5 =
      'Think of a time when you had a conflict with someone important to you. What happened, and how did things get resolved between you two?';
    const threshold =
      'Thanks for sharing that. At what point do you decide when a relationship is something to work through versus something you need to walk away from?';
    expect(
      resolveMoment4ShowScenarioReferenceCard(
        [
          { role: 'assistant', content: threshold },
          { role: 'user', content: 'When trust is gone I leave.' },
          { role: 'assistant', content: m5 },
        ],
        { grudgeCardBody },
      ),
    ).toEqual({ active: false });
  });
});
