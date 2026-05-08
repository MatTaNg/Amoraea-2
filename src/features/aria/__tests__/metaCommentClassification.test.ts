import {
  buildClientFrustrationMetaFallbackAssistantText,
  buildMetaCommentHandlingSuffix,
  buildSkipRequestConfirmationSpeech,
  classifyUserMetaComment,
  countsAsSubstantiveInterviewQuestionDelivery,
  getInabilitySubstantiveOverrideDetail,
  getMetaCommentCanonicalResponseSummary,
  getPriorSubstantiveNonMetaUserContentInMoment,
  hadPriorSubstantiveAnswerInScenarioForFrustration,
  isConfusionRepeatRequestText,
  isCheckingInFrustrationAdjacent,
  isSufficiencyChallengeFrustrationUtterance,
  looksLikeFrustrationSkipAcceptance,
  looksLikeFrustrationSkipConfirmationAffirmative,
  looksLikeProactiveScenarioSkipRequest,
  looksLikeSkipConfirmationConnectivityGreeting,
  looksLikeSkipConfirmationDecline,
  resolveMetaCommentForInterviewTurn,
} from '../metaCommentClassification';

describe('classifyUserMetaComment', () => {
  it('classifies frustration patterns', () => {
    const r = classifyUserMetaComment("I don't know what you want from me");
    expect(r?.type).toBe('frustration');
    expect(r?.confidence).toBeGreaterThanOrEqual(0.5);
  });

  it('classifies confusion', () => {
    const r = classifyUserMetaComment('What do you mean by that?');
    expect(r?.type).toBe('confusion');
    expect(r?.confusion_subtype).toBeUndefined();
  });

  it('classifies repeat-request lines as confusion with repeat_request subtype', () => {
    const a = classifyUserMetaComment('Can you repeat the question?');
    expect(a?.type).toBe('confusion');
    expect(a?.confusion_subtype).toBe('repeat_request');
    const b = classifyUserMetaComment("I didn't catch that");
    expect(b?.type).toBe('confusion');
    expect(b?.confusion_subtype).toBe('repeat_request');
    const c = classifyUserMetaComment('what was the question');
    expect(c?.confusion_subtype).toBe('repeat_request');
  });

  it('classifies checking in', () => {
    const r = classifyUserMetaComment('Was that enough?');
    expect(r?.type).toBe('checking_in');
  });

  it('classifies "Wasn\'t that enough?" as frustration (sufficiency pushback / skip path)', () => {
    const r = classifyUserMetaComment("Wasn't that enough?");
    expect(r?.type).toBe('frustration');
    expect(r?.confidence).toBeGreaterThanOrEqual(0.5);
  });

  it('classifies "Isn\'t that enough?" as frustration', () => {
    const r = classifyUserMetaComment("Isn't that enough?");
    expect(r?.type).toBe('frustration');
  });

  it('defaults very short non-matching text to ambiguous_short', () => {
    const r = classifyUserMetaComment('maybe');
    expect(r?.type).toBe('ambiguous_short');
  });

  it('returns null for substantive longer answers with no meta signals', () => {
    const r = classifyUserMetaComment(
      'I think Emma is feeling dismissed because Ryan keeps checking his phone during dinner.'
    );
    expect(r).toBeNull();
  });

  it('prefers frustration when stronger than confusion cues', () => {
    const r = classifyUserMetaComment("Why do you keep asking me the same thing — what do you mean?");
    expect(r?.type).toBe('frustration');
  });

  it('classifies skip_request — next question / advance asks', () => {
    expect(classifyUserMetaComment("What's the next question?")?.type).toBe('skip_request');
    expect(classifyUserMetaComment("What's next")?.type).toBe('skip_request');
    expect(classifyUserMetaComment('Can we move on to the next one')?.type).toBe('skip_request');
    expect(classifyUserMetaComment('What do we do next')?.type).toBe('skip_request');
    expect(classifyUserMetaComment('Next question please')?.type).toBe('skip_request');
    expect(classifyUserMetaComment('Just give me the next one')?.type).toBe('skip_request');
  });

  it('does not classify long narrative as skip_request (word-count guard)', () => {
    const longTurn =
      'Daniel walks out and Sophie follows him down the hall and they argue about the budget for fifteen minutes while I watch and then they come back to the table.';
    expect(classifyUserMetaComment(longTurn)).toBeNull();
  });

  it('classifies explicit skip/pass phrasing as skip_request', () => {
    expect(classifyUserMetaComment("I'll pass on this one")?.type).toBe('skip_request');
    expect(classifyUserMetaComment('skip this')?.type).toBe('skip_request');
    expect(classifyUserMetaComment("can we move on")?.type).toBe('skip_request');
  });

  it('classifies refusal language as skip_request', () => {
    expect(classifyUserMetaComment("I'd rather not answer")?.type).toBe('skip_request');
    expect(classifyUserMetaComment("that's personal")?.type).toBe('skip_request');
  });

  it('classifies inability (semantic)', () => {
    expect(classifyUserMetaComment("honestly I've got no idea what to say here")?.type).toBe('inability');
    expect(classifyUserMetaComment("I don't know")?.type).toBe('inability');
    expect(classifyUserMetaComment("I'm drawing a blank")?.type).toBe('inability');
  });

  it('does not classify inability when "that\'s a hard one" only hedges a long substantive answer', () => {
    const long =
      "That's a hard one because James showed up as best he could in that situation, I guess maybe just sharing her excitement and let her explain all those details when she's ready rather than asking about them and just listening to her excitement and reflecting that rather than asking detailed questions.";
    expect(classifyUserMetaComment(long)).toBe(null);
  });

  it('does not classify inability when uncertainty is distributed through substantive Scenario B content', () => {
    const hedged =
      "Again, not knowing the context, I'm not quite sure what else can you really do because I mean, he did show appreciation, he was genuine in his joy, and Sarah could maybe tell him she needed him to just stay with the excitement instead of questions, yeah man I'm not quite sure.";
    expect(classifyUserMetaComment(hedged)).toBeNull();
    expect(getInabilitySubstantiveOverrideDetail(hedged)).toMatchObject({
      inability_override_fired: true,
      override_trigger: 'word_count_fallback',
    });
    expect(getInabilitySubstantiveOverrideDetail(hedged)?.full_response_word_count).toBeGreaterThanOrEqual(40);
  });

  it('overrides inability when a hedged response includes a behavioral observation', () => {
    const hedged = "I'm not sure, but he did show appreciation and he was genuine in his joy.";
    expect(classifyUserMetaComment(hedged)).toBeNull();
    expect(getInabilitySubstantiveOverrideDetail(hedged)?.override_trigger).toBe(
      'behavioral_observation_detected'
    );
  });

  it('still classifies short "that\'s a hard one" as inability', () => {
    expect(classifyUserMetaComment("That's a hard one.")?.type).toBe('inability');
  });

  it('keeps frustration when user says "I don\'t know what you want"', () => {
    expect(classifyUserMetaComment("I don't know what you want from me")?.type).toBe('frustration');
  });

  it('classifies already_answered patterns', () => {
    expect(classifyUserMetaComment('I already answered that')?.type).toBe('already_answered');
    expect(classifyUserMetaComment('I think I covered that')?.type).toBe('already_answered');
  });

  it('priority: skip_request beats already_answered when both match', () => {
    const r = classifyUserMetaComment("skip — I already said that");
    expect(r?.type).toBe('skip_request');
  });
});

describe('buildSkipRequestConfirmationSpeech', () => {
  it('prefixes reflection when excerpt yields a clause', () => {
    const longPrior =
      'Emma seems dismissed because Ryan keeps prioritizing his mother over their plans together repeatedly during dinner.';
    const s = buildSkipRequestConfirmationSpeech({ priorSubstantiveNonMetaExcerpt: longPrior });
    expect(s).toContain('Are you sure you want to skip');
    expect(s.toLowerCase()).toContain('emma');
  });
});

describe('getPriorSubstantiveNonMetaUserContentInMoment', () => {
  it('returns content only when prior turn is long enough and not meta-classified', () => {
    const msgs = [
      {
        role: 'user',
        content:
          'Emma seems upset with Ryan because he took a long phone call during their dinner date together.',
        scenarioNumber: 1,
        interviewMoment: 2,
      },
      { role: 'user', content: 'I already said that', scenarioNumber: 1, interviewMoment: 2 },
    ];
    expect(
      getPriorSubstantiveNonMetaUserContentInMoment(msgs as never, 1, 2)
    ).toMatch(/Emma/);
  });

  it('excludes prior turns logged as meta-comments', () => {
    const msgs = [
      {
        role: 'user',
        content:
          'Why do you keep asking me the same thing over and over again when I already answered clearly?',
        scenarioNumber: 1,
        interviewMoment: 2,
      },
      { role: 'user', content: 'maybe', scenarioNumber: 1, interviewMoment: 2 },
    ];
    expect(getPriorSubstantiveNonMetaUserContentInMoment(msgs as never, 1, 2)).toBeNull();
  });
});

describe('isSufficiencyChallengeFrustrationUtterance', () => {
  it('matches sufficiency-challenge phrasing', () => {
    expect(isSufficiencyChallengeFrustrationUtterance("Wasn't that enough?")).toBe(true);
    expect(isSufficiencyChallengeFrustrationUtterance("Isn't that enough?")).toBe(true);
  });

  it('does not match softer checking phrasing', () => {
    expect(isSufficiencyChallengeFrustrationUtterance('Was that enough?')).toBe(false);
  });
});

describe('buildClientFrustrationMetaFallbackAssistantText', () => {
  it('sufficiency phrasing uses I need to know branch without reflection even with prior substantive flag', () => {
    const s = buildClientFrustrationMetaFallbackAssistantText({
      lastQuestionText: 'How do you think this situation could be repaired?',
      userTranscript: "Wasn't that enough?",
      hadPriorSubstantiveAnswerInMoment: true,
      priorSubstantiveUserExcerpt: 'Long prior answer about Daniel and Sophie.',
    });
    expect(s).toContain('I need to know');
    expect(s).toContain('We can skip this question but it may affect your score, do you still want to skip it?');
    expect(s).not.toMatch(/^Long prior/);
  });

  it('adds reflection when prior substantive and not sufficiency challenge', () => {
    const s = buildClientFrustrationMetaFallbackAssistantText({
      lastQuestionText: 'How do you think this situation could be repaired?',
      userTranscript: 'Why are you asking again?',
      hadPriorSubstantiveAnswerInMoment: true,
      priorSubstantiveUserExcerpt: 'He leaves because he is overwhelmed.',
    });
    expect(s).toContain('He leaves because he is overwhelmed.');
    expect(s).toContain('I need to know');
  });
});

describe('looksLikeSkipConfirmationConnectivityGreeting', () => {
  it('matches bare greetings only', () => {
    expect(looksLikeSkipConfirmationConnectivityGreeting('hello')).toBe(true);
    expect(looksLikeSkipConfirmationConnectivityGreeting('Hi')).toBe(true);
    expect(looksLikeSkipConfirmationConnectivityGreeting('hey there')).toBe(true);
    expect(looksLikeSkipConfirmationConnectivityGreeting('still there?')).toBe(false);
  });
});

describe('isConfusionRepeatRequestText', () => {
  it('detects phrasing', () => {
    expect(isConfusionRepeatRequestText('Can you say that again?')).toBe(true);
    expect(isConfusionRepeatRequestText('What do you mean by that?')).toBe(false);
  });
});

describe('buildMetaCommentHandlingSuffix', () => {
  it('uses repeat-request block when confusion_subtype is repeat_request', () => {
    const s = buildMetaCommentHandlingSuffix({
      classification: { type: 'confusion', confidence: 0.8, confusion_subtype: 'repeat_request' },
      repeatedFrustrationInMoment: false,
    });
    expect(s).toMatch(/verbatim|full|REPEAT REQUEST/i);
    expect(s).toMatch(/Do not.*say more about that|elongating/i);
  });

  it('omits reflection when omitPriorReflectionClause with prior substantive', () => {
    const s = buildMetaCommentHandlingSuffix({
      classification: { type: 'frustration', confidence: 0.67 },
      repeatedFrustrationInMoment: false,
      hadPriorSubstantiveAnswerInMoment: true,
      omitPriorReflectionClause: true,
    });
    expect(s).toContain('Sufficiency pushback');
    expect(s).not.toContain('one short reflective clause');
  });

  it('keeps reflection when prior substantive and no omit flag', () => {
    const s = buildMetaCommentHandlingSuffix({
      classification: { type: 'frustration', confidence: 0.67 },
      repeatedFrustrationInMoment: false,
      hadPriorSubstantiveAnswerInMoment: true,
    });
    expect(s).toContain('one short reflective clause');
    expect(s).not.toContain('Sufficiency pushback');
  });

  it('uses frustration-adjacent checking_in pivot instructions', () => {
    const s = buildMetaCommentHandlingSuffix({
      classification: { type: 'checking_in', confidence: 0.72 },
      repeatedFrustrationInMoment: false,
      checkingInFrustrationAdjacent: true,
      inMoment5AfterAccountabilityProbe: true,
    });
    expect(s).toContain('CHECKING-IN + FRUSTRATION ADJACENT');
    expect(s).toContain('Do not re-ask the same question');
    expect(s).toContain('Do **not** re-ask "What was your part in how it unfolded?"');
  });
});

describe('isCheckingInFrustrationAdjacent', () => {
  it('detects sharp checking-in phrasing', () => {
    expect(
      isCheckingInFrustrationAdjacent({
        checkingInText: 'Did you get all that?',
        priorSubstantiveText: 'short prior text',
      })
    ).toBe(true);
  });

  it('detects long prior substantive narrative', () => {
    expect(
      isCheckingInFrustrationAdjacent({
        checkingInText: 'Is that okay?',
        priorSubstantiveText:
          'There was a time my best friend and I had a serious argument and we stopped talking for months, then eventually repaired after long self-reflection and hard conversations.',
      })
    ).toBe(true);
  });

  it('stays false for neutral short prior + neutral checking-in', () => {
    expect(
      isCheckingInFrustrationAdjacent({
        checkingInText: 'Is that okay?',
        priorSubstantiveText: 'James should listen more.',
      })
    ).toBe(false);
  });
});

describe('resolveMetaCommentForInterviewTurn', () => {
  it('keeps frustration effective when last question contains "no" in prose (not a yes/no moment)', () => {
    const resolved = resolveMetaCommentForInterviewTurn("Wasn't that enough?", {
      lastQuestionText: "There's no right or wrong answer — what stood out to you?",
      priorUserUtteranceCount: 2,
      isInterviewAppRoute: true,
      hasProfileFirstName: true,
    });
    expect(resolved.exemptMetaCommentTurn).toBe(false);
    expect(resolved.effective?.type).toBe('frustration');
  });

  it('suppresses classification only while post-meta-ack window is active', () => {
    const resolved = resolveMetaCommentForInterviewTurn('Was that enough?', {
      lastQuestionText: 'And if you were James, how would you repair?',
      priorUserUtteranceCount: 3,
      isInterviewAppRoute: true,
      hasProfileFirstName: true,
      suppressMetaClassificationPostMetaAckAwaitingSubstantive: true,
    });
    expect(resolved.exemptMetaCommentTurn).toBe(true);
    expect(resolved.effective).toBeNull();
    expect(resolved.exemptMetaCommentTurnReason).toBe('seq_not_advanced_since_last_ack');
  });

  it('does not exempt post-meta-ack window when response is 8+ words', () => {
    const resolved = resolveMetaCommentForInterviewTurn(
      'Was that enough detail about Emma or do you need even more from me?',
      {
        lastQuestionText: 'And if you were James, how would you repair?',
        priorUserUtteranceCount: 3,
        isInterviewAppRoute: true,
        hasProfileFirstName: true,
        suppressMetaClassificationPostMetaAckAwaitingSubstantive: true,
        spokenWordCount: 12,
      },
    );
    expect(resolved.exemptMetaCommentTurn).toBe(false);
    expect(resolved.exemptMetaCommentTurnReason).toBe('no_exemption_condition_met');
    expect(resolved.effective?.type).toBe('checking_in');
  });

  it('does not wipe checking_in after ratio-recovery copy on lastQuestionText', () => {
    const resolved = resolveMetaCommentForInterviewTurn('Was that enough?', {
      lastQuestionText:
        'I only caught part of that — could you answer again in a full sentence?',
      priorUserUtteranceCount: 2,
      isInterviewAppRoute: true,
      hasProfileFirstName: true,
    });
    expect(resolved.exemptMetaCommentTurn).toBe(false);
    expect(resolved.effective?.type).toBe('checking_in');
  });

  it('keeps frustration effective when lastQuestionText is still resume welcome (stale ref)', () => {
    const resumeLine =
      "Welcome back — we can continue where we left off. When you're ready, say so, or I can repeat what I said and get ready for your response.";
    const resolved = resolveMetaCommentForInterviewTurn("Wasn't that enough?", {
      lastQuestionText: resumeLine,
      priorUserUtteranceCount: 2,
      isInterviewAppRoute: true,
      hasProfileFirstName: true,
    });
    expect(resolved.exemptMetaCommentTurn).toBe(false);
    expect(resolved.raw?.type).toBe('frustration');
    expect(resolved.effective?.type).toBe('frustration');
  });

  it('does not exempt resume welcome replies — classify ambiguous_short for telemetry/routing', () => {
    const resumeLine =
      "Welcome back — we can continue where we left off. When you're ready, say so, or I can repeat what I said and get ready for your response.";
    const resolved = resolveMetaCommentForInterviewTurn('yeah', {
      lastQuestionText: resumeLine,
      priorUserUtteranceCount: 2,
      isInterviewAppRoute: true,
      hasProfileFirstName: true,
    });
    expect(resolved.raw?.type).toBe('ambiguous_short');
    expect(resolved.exemptMetaCommentTurn).toBe(false);
    expect(resolved.exemptMetaCommentTurnReason).toBe('no_exemption_condition_met');
    expect(resolved.effective?.type).toBe('ambiguous_short');
  });
});

describe('hadPriorSubstantiveAnswerInScenarioForFrustration', () => {
  it('is false when only one user turn exists in scenario', () => {
    expect(
      hadPriorSubstantiveAnswerInScenarioForFrustration(
        [{ role: 'user', content: 'x '.repeat(12), scenarioNumber: 1 }],
        1
      )
    ).toBe(false);
  });

  it('is true when an earlier user turn in scenario had enough words', () => {
    expect(
      hadPriorSubstantiveAnswerInScenarioForFrustration(
        [
          { role: 'user', content: 'word '.repeat(15), scenarioNumber: 2 },
          { role: 'user', content: 'skip', scenarioNumber: 2 },
        ],
        2
      )
    ).toBe(true);
  });
});

describe('looksLikeFrustrationSkipAcceptance', () => {
  it('matches common skip phrases', () => {
    expect(looksLikeFrustrationSkipAcceptance("Let's skip")).toBe(true);
    expect(looksLikeFrustrationSkipAcceptance('skip')).toBe(true);
    expect(looksLikeFrustrationSkipAcceptance("don't skip")).toBe(false);
    expect(looksLikeFrustrationSkipAcceptance('no skip')).toBe(false);
  });
});

describe('looksLikeProactiveScenarioSkipRequest', () => {
  it('aliases frustration skip acceptance', () => {
    expect(looksLikeProactiveScenarioSkipRequest("Let's skip this question.")).toBe(true);
    expect(looksLikeProactiveScenarioSkipRequest('whatever')).toBe(false);
  });
});

describe('looksLikeFrustrationSkipConfirmationAffirmative', () => {
  it('includes plain affirmatives and skip phrases', () => {
    expect(looksLikeFrustrationSkipConfirmationAffirmative('yes')).toBe(true);
    expect(looksLikeFrustrationSkipConfirmationAffirmative('okay')).toBe(true);
    expect(looksLikeFrustrationSkipConfirmationAffirmative('skip')).toBe(true);
    expect(looksLikeFrustrationSkipConfirmationAffirmative('no skip')).toBe(false);
  });
});

describe('looksLikeSkipConfirmationDecline', () => {
  it('matches common decline phrases', () => {
    expect(looksLikeSkipConfirmationDecline('no')).toBe(true);
    expect(looksLikeSkipConfirmationDecline("don't skip")).toBe(true);
    expect(looksLikeSkipConfirmationDecline('no skip')).toBe(true);
    expect(looksLikeSkipConfirmationDecline('skip')).toBe(false);
    expect(looksLikeSkipConfirmationDecline('yes')).toBe(false);
  });
});

describe('countsAsSubstantiveInterviewQuestionDelivery', () => {
  it('treats bridge + next question as substantive', () => {
    expect(
      countsAsSubstantiveInterviewQuestionDelivery(
        "Got it — let's keep going. And if you were James, how would you repair?"
      )
    ).toBe(true);
  });

  it('treats meta-only ack without a question as non-substantive', () => {
    expect(countsAsSubstantiveInterviewQuestionDelivery('Yes — got it. That works perfectly.')).toBe(false);
  });

  it('treats infra recovery prompts as non-substantive', () => {
    expect(
      countsAsSubstantiveInterviewQuestionDelivery(
        'I only caught part of that — could you answer again in a full sentence?'
      )
    ).toBe(false);
  });
});

describe('getMetaCommentCanonicalResponseSummary', () => {
  it('returns skip confirmation line for skip_request', () => {
    expect(getMetaCommentCanonicalResponseSummary('skip_request', false)).toContain(
      'Are you sure you want to skip this one'
    );
  });

  it('returns repeat-request summary when confusion_subtype is repeat_request', () => {
    expect(getMetaCommentCanonicalResponseSummary('confusion', false, 'repeat_request')).toMatch(/verbatim|full/i);
  });

  it('returns repeated-frustration line when flagged', () => {
    expect(getMetaCommentCanonicalResponseSummary('frustration', true)).toContain('No pressure');
  });

  it('returns checking_in pivot summary when frustration-adjacent flag is set', () => {
    expect(getMetaCommentCanonicalResponseSummary('checking_in', false, undefined, true)).toContain('pivot');
  });
});
