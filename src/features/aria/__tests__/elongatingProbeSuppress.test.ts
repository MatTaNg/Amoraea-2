import {
  buildMoment5ClosingFallbackAfterSuppressedElongating,
  buildNeutralAckAfterSuppressedElongatingProbe,
  elongatingProbePlaybackBlockReason,
  isLenientInterviewCloseAfterClosingSpeech,
  isMoment5ReadyForInterviewClose,
  moment5AnswerIncludesResolutionOutcome,
  looksLikeInterviewClosingAssistantMessage,
  stripDuplicateInterviewClosingParagraphs,
  isIncompleteInterviewClosingLeadSentence,
  isInterviewClosingReflectiveAckFragment,
  isInterviewClosingStreamFragment,
  isInterviewClosingThanksFragment,
  applyConsecutiveStreamSentenceDedup,
  stripConsecutiveDuplicateSentencesWithinDraft,
  stripDuplicateInterviewClosingSentencesWithinDraft,
  stripInterviewClosingStreamingEcho,
  transcriptHasInterviewClosingAssistantMessage,
  transcriptHasInterviewClosingSpokenFragment,
  userTurnHasMultipleDistinctIdeasOrHypotheses,
  userTurnLooksLikeSingleSurfaceLabelOnly,
  userTurnSuppressesElongatingProbe,
} from '../elongatingProbe';

describe('userTurnSuppressesElongatingProbe', () => {
  it('suppresses for 25+ words (session log regression: 127-word hypotheses)', () => {
    const t =
      'What I said was either she is not communicating her wants and needs. Those are the three main readings I see.';
    expect(userTurnSuppressesElongatingProbe(t)).toBe(true);
  });

  it('suppresses when multiple hypotheses are enumerated in fewer than 25 words', () => {
    const t =
      'First hypothesis is poor communication. Second is gaslighting. Third is he never shows up. Those are the three.';
    expect(userTurnHasMultipleDistinctIdeasOrHypotheses(t)).toBe(true);
    expect(userTurnSuppressesElongatingProbe(t)).toBe(true);
  });

  it('suppresses for 15–24 words even without explicit enumeration', () => {
    const t = Array(18).fill('word').join(' ');
    expect(userTurnSuppressesElongatingProbe(t)).toBe(true);
  });

  it('does not suppress short single-surface label', () => {
    expect(userTurnLooksLikeSingleSurfaceLabelOnly("They're fighting")).toBe(true);
    expect(userTurnSuppressesElongatingProbe("They're fighting")).toBe(false);
  });

  it('does not suppress thin vague under 15 words that is not a single-label pattern', () => {
    expect(userTurnSuppressesElongatingProbe('I dont know')).toBe(false);
  });

  it('suppresses session-log Scenario A verbose answer (32 words)', () => {
    expect(
      userTurnSuppressesElongatingProbe(
        "Ryan shouldn't have took a 25 minute call during their date, that was disrespectful to Emma. Emma can be a little more open and honest instead of being condescending with her statement."
      )
    ).toBe(true);
  });
});

describe('elongatingProbePlaybackBlockReason', () => {
  it('blocks duplicate elongating lines after one already fired', () => {
    expect(
      elongatingProbePlaybackBlockReason({
        spokenSentence: 'Can you say more about that?',
        suppressForUserTurn: false,
        elongatingProbeAlreadyFired: true,
      }),
    ).toBe('already_fired_this_stretch');
  });

  it('blocks elongating when the user turn is substantive', () => {
    expect(
      elongatingProbePlaybackBlockReason({
        spokenSentence: 'Can you say more about that?',
        suppressForUserTurn: true,
        elongatingProbeAlreadyFired: false,
      }),
    ).toBe('user_turn_substantive');
  });

  it('allows the first elongating probe in a stretch', () => {
    expect(
      elongatingProbePlaybackBlockReason({
        spokenSentence: 'Can you say more about that?',
        suppressForUserTurn: false,
        elongatingProbeAlreadyFired: false,
      }),
    ).toBeNull();
  });
});

describe('suppressed elongating fallbacks', () => {
  it('buildMoment5ClosingFallbackAfterSuppressedElongating uses one thanks line and complete token', () => {
    const t = buildMoment5ClosingFallbackAfterSuppressedElongating('Matt');
    expect(t).toContain('Matt');
    expect(t).toContain('[INTERVIEW_COMPLETE]');
    expect(t).toMatch(/Thank you for being so open with me/i);
    expect(t).not.toMatch(/walking through/i);
    expect((t.match(/thank you/gi) ?? []).length).toBe(1);
  });

  it('isMoment5ReadyForInterviewClose blocks after first answer without resolution', () => {
    expect(
      isMoment5ReadyForInterviewClose({
        currentInterviewMoment: 5,
        moment5QuestionDelivered: true,
        postM5UserTurns: 1,
        accountabilityProbeFired: false,
        moment5CombinedUserText:
          'I snapped at him about it. It came out harsher than I intended.',
      }),
    ).toBe(false);
  });

  it('isMoment5ReadyForInterviewClose allows single turn when resolution is described', () => {
    expect(
      isMoment5ReadyForInterviewClose({
        currentInterviewMoment: 5,
        moment5QuestionDelivered: true,
        postM5UserTurns: 1,
        accountabilityProbeFired: false,
        moment5CombinedUserText:
          'We talked it through and apologized. Things are better now.',
      }),
    ).toBe(true);
  });

  it('moment5AnswerIncludesResolutionOutcome detects facilitated mutual listening and cool-now repair', () => {
    const conferenceAnswer =
      "I did raise my voice at him, but it was facilitated. I listened to him, he listened to me without interruption. That's okay, we're cool now.";
    expect(moment5AnswerIncludesResolutionOutcome(conferenceAnswer)).toBe(true);
    expect(
      moment5AnswerIncludesResolutionOutcome('I listened to him, he listened to me, and we are good now.'),
    ).toBe(true);
  });

  it('moment5AnswerIncludesResolutionOutcome stays false for blow-up-only narration', () => {
    expect(
      moment5AnswerIncludesResolutionOutcome(
        'He called me a bad coach and walked away. I was really angry and thought he was out of line.',
      ),
    ).toBe(false);
  });

  it('isMoment5ReadyForInterviewClose requires second turn after accountability probe', () => {
    expect(
      isMoment5ReadyForInterviewClose({
        currentInterviewMoment: 5,
        moment5QuestionDelivered: true,
        postM5UserTurns: 1,
        accountabilityProbeFired: true,
      }),
    ).toBe(false);
    expect(
      isMoment5ReadyForInterviewClose({
        currentInterviewMoment: 5,
        moment5QuestionDelivered: true,
        postM5UserTurns: 2,
        accountabilityProbeFired: true,
      }),
    ).toBe(true);
  });

  it('buildNeutralAckAfterSuppressedElongatingProbe is non-empty', () => {
    expect(buildNeutralAckAfterSuppressedElongatingProbe('Matt')).toContain('Matt');
  });

  it('looksLikeInterviewClosingAssistantMessage matches final thank-you lines', () => {
    expect(
      looksLikeInterviewClosingAssistantMessage(
        'Good work getting through all of this — what you said about making amends really stuck with me. Thank you for being so open with me.',
      ),
    ).toBe(true);
    expect(
      looksLikeInterviewClosingAssistantMessage('What if you were Ryan? How would you repair this situation?'),
    ).toBe(false);
  });

  it('isLenientInterviewCloseAfterClosingSpeech allows handoff after M5 anchor + closing thanks when close gate passes', () => {
    expect(
      isLenientInterviewCloseAfterClosingSpeech({
        closingText: 'Thank you for being so open with me.',
        hasMoment5PrimaryAnchorInTranscript: true,
        postM5UserTurns: 2,
        personalHandoffInjected: true,
        currentInterviewMoment: 5,
        moment5CloseAllowed: true,
      }),
    ).toBe(true);
  });

  it('isLenientInterviewCloseAfterClosingSpeech blocks when Moment 5 close gate fails', () => {
    expect(
      isLenientInterviewCloseAfterClosingSpeech({
        closingText: 'Thank you for being so open with me.',
        hasMoment5PrimaryAnchorInTranscript: true,
        postM5UserTurns: 1,
        personalHandoffInjected: true,
        currentInterviewMoment: 5,
        moment5CloseAllowed: false,
      }),
    ).toBe(false);
  });

  it('transcriptHasInterviewClosingAssistantMessage detects prior closing in transcript', () => {
    expect(
      transcriptHasInterviewClosingAssistantMessage([
        { role: 'assistant', content: 'Good work getting through all of this. Thank you for being so open with me.' },
        { role: 'user', content: 'We talked it through.' },
      ]),
    ).toBe(true);
    expect(
      transcriptHasInterviewClosingAssistantMessage([
        { role: 'assistant', content: 'What if you were Ryan? How would you repair this situation?' },
      ]),
    ).toBe(false);
  });

  it('stripDuplicateInterviewClosingParagraphs drops duplicate closing text', () => {
    const prior = [
      { role: 'assistant', content: 'Good work getting through all of this. Thank you for being so open with me.' },
    ];
    expect(
      stripDuplicateInterviewClosingParagraphs(
        'Thank you for being so open with me — that took real honesty.',
        prior,
      ),
    ).toBe('');
  });

  it('stripInterviewClosingStreamingEcho suppresses duplicate closing sentences', () => {
    expect(
      stripInterviewClosingStreamingEcho(
        'Thank you for being so open with me.',
        true,
      ),
    ).toBeNull();
    expect(
      stripInterviewClosingStreamingEcho(
        'Thanks for sticking with all of this — what you shared really comes through.',
        true,
      ),
    ).toBeNull();
    expect(stripInterviewClosingStreamingEcho('How would you repair this?', true)).toBe(
      'How would you repair this?',
    );
  });

  it('isIncompleteInterviewClosingLeadSentence detects ack before final thank-you', () => {
    expect(
      isIncompleteInterviewClosingLeadSentence(
        'Thanks for sticking with all of this — what you said about owning that comes through clearly.',
      ),
    ).toBe(true);
    expect(
      isIncompleteInterviewClosingLeadSentence(
        'Good work on sticking with all of this — what stands out is how you took ownership of snapping at your friend.',
      ),
    ).toBe(true);
    expect(
      isIncompleteInterviewClosingLeadSentence(
        'Thanks for sticking with all of this. Thank you for being so open with me.',
      ),
    ).toBe(false);
  });

  it('defers thanks for being open reflective lead before final thank-you', () => {
    const lead =
      'Thanks for being open about that — taking ownership of how the frustration came out while still addressing what was bothering you shows real clarity.';
    expect(isInterviewClosingReflectiveAckFragment(lead)).toBe(true);
    expect(isIncompleteInterviewClosingLeadSentence(lead)).toBe(true);
    expect(isInterviewClosingStreamFragment(lead)).toBe(true);
  });

  it('looksLikeInterviewClosingAssistantMessage matches good work on sticking variant', () => {
    expect(
      looksLikeInterviewClosingAssistantMessage(
        'Good work on sticking with all of this — what stands out is how you took ownership. Thank you for being so open with me.',
      ),
    ).toBe(true);
  });

  it('transcriptHasInterviewClosingSpokenFragment detects reflective ack without thank-you', () => {
    expect(
      transcriptHasInterviewClosingSpokenFragment([
        {
          role: 'assistant',
          content:
            'Good work on sticking with all of this — what stands out is how you took ownership of snapping at your friend.',
        },
      ]),
    ).toBe(true);
    expect(
      transcriptHasInterviewClosingSpokenFragment([
        { role: 'assistant', content: 'How would you repair this situation?' },
      ]),
    ).toBe(false);
  });

  it('isInterviewClosingStreamFragment detects reflective synthesis before final thank-you', () => {
    expect(
      isInterviewClosingStreamFragment(
        'It sounds like you recognized that letting things build up made it harder than it needed to be, and that you took responsibility for how you delivered it when things finally came out.',
      ),
    ).toBe(true);
    expect(
      isInterviewClosingStreamFragment('Thank you for being so open with me.'),
    ).toBe(true);
    expect(isInterviewClosingStreamFragment('How would you repair this situation?')).toBe(false);
  });

  it('stripInterviewClosingStreamingEcho suppresses reflective ack echo', () => {
    expect(
      stripInterviewClosingStreamingEcho(
        'Good work on sticking with all of this — what stands out is how you took ownership.',
        true,
      ),
    ).toBeNull();
  });

  it('stripDuplicateInterviewClosingSentencesWithinDraft collapses duplicate thanks in one turn', () => {
    const draft =
      'Thank you for walking through that with me, Matt. Thanks for sticking with all of this — you stayed with it. Thank you for being so open with me.';
    const out = stripDuplicateInterviewClosingSentencesWithinDraft(draft);
    expect(out).toContain('Thank you for being so open with me');
    expect(out).not.toContain('Thank you for walking through');
  });

  it('stripDuplicateInterviewClosingSentencesWithinDraft collapses duplicate good-work reflective openers', () => {
    const draft =
      'Good work getting through all of this — what you shared about listening really stuck with me. Good work getting through all of this — what you shared about listening without interrupting shows a lot about how you approach working things through. Thank you for being so open with me.';
    const out = stripDuplicateInterviewClosingSentencesWithinDraft(draft);
    const goodWorkMatches = out.match(/\bgood work getting through\b/gi) ?? [];
    expect(goodWorkMatches).toHaveLength(1);
    expect(out).toContain('Thank you for being so open with me');
    expect(out).toContain('without interrupting');
  });

  it('stripConsecutiveDuplicateSentencesWithinDraft collapses repeated scenario vignette beats', () => {
    const duplicateLine =
      "Sophie calls after him: 'that's exactly what I mean.' Sophie calls after him: 'that's exactly what I mean.' Thirty minutes later Daniel comes back.";
    const out = stripConsecutiveDuplicateSentencesWithinDraft(duplicateLine);
    expect(out.match(/sophie calls after him/gi)).toHaveLength(1);
    expect(out).toContain('Thirty minutes later Daniel comes back');
  });

  it('applyConsecutiveStreamSentenceDedup suppresses repeated flushed sentences', () => {
    const first =
      applyConsecutiveStreamSentenceDedup(
        "Sophie calls after him: 'that's exactly what I mean.'",
        null,
      );
    expect(first.text).toContain("that's exactly what I mean");
    const second = applyConsecutiveStreamSentenceDedup(
      "Sophie calls after him: 'that's exactly what I mean.'",
      first.lastSentenceNorm,
    );
    expect(second.text).toBe('');
  });

  it('isMoment5ReadyForInterviewClose blocks when resolution follow-up still required', () => {
    expect(
      isMoment5ReadyForInterviewClose({
        currentInterviewMoment: 5,
        moment5QuestionDelivered: true,
        postM5UserTurns: 1,
        accountabilityProbeFired: false,
        moment5CombinedUserText:
          'I snapped at him about it. It came out harsher than I intended.',
        resolutionFollowUpStillRequired: true,
      }),
    ).toBe(false);
  });

  it('isMoment5ReadyForInterviewClose allows close after resolution follow-up exchange', () => {
    expect(
      isMoment5ReadyForInterviewClose({
        currentInterviewMoment: 5,
        moment5QuestionDelivered: true,
        postM5UserTurns: 2,
        accountabilityProbeFired: false,
        moment5CombinedUserText:
          'I snapped at him about it. We talked it through the next day and apologized.',
        resolutionFollowUpStillRequired: false,
      }),
    ).toBe(true);
  });

  it('isMoment5ReadyForInterviewClose does not allow single turn with explicit self-accountability alone', () => {
    expect(
      isMoment5ReadyForInterviewClose({
        currentInterviewMoment: 5,
        moment5QuestionDelivered: true,
        postM5UserTurns: 1,
        accountabilityProbeFired: false,
        moment5CombinedUserText:
          'I apologize for how I said it. I should have brought it up sooner instead of letting it build.',
        resolutionFollowUpStillRequired: true,
      }),
    ).toBe(false);
  });
});
