import { SCENARIO_B_VIGNETTE } from '@/constants/scenarioBVignette';
import { MOMENT_4_GRUDGE_QUESTION_TEXT } from '@features/aria/moment4ProbeLogic';
import { MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT } from '@features/aria/moment5ProbeCopy';
import { SCENARIO_2_OPENING } from '@features/aria/interviewScenarioOpeningStreamGate';
import { SCENARIO_1_VIGNETTE } from '@features/aria/interviewScenarioVignetteCopy';
import { SCENARIO_1_OPENING } from '@features/aria/interviewScenarioOpeningStreamGate';
import { SHOW_SCENARIO_3_VIGNETTE_EXACT } from '@features/aria/interviewShowScenarioExactCopy';
import {
  buildCanonicalShowScenarioCardTtsBody,
  buildCanonicalShowScenarioCardTtsFromStream,
  detectShowScenarioCardKind,
  isExactShowScenario2FullText,
  isExactShowScenario2VignetteText,
  isShowScenarioCardCanonicalDeliveryText,
  isShowScenarioCardCanonicalPlaybackConfirmed,
  shouldArmShowScenarioCardStreamMute,
  shouldSkipPersonalMomentCanonicalReplay,
  shouldSkipSituation1CanonicalReplay,
  shouldSkipSituation3CanonicalReplay,
  shouldSuppressParallelStreamNonExactShowScenarioCardSpeech,
  shouldTreatShowScenarioCardCanonicalAsAlreadyDelivered,
  composeShowScenarioCardTtsWithTransitionPrefix,
  mergeShowScenarioCardTransitionPrefixWithSpoken,
  parallelStreamDeliveredBundledHandoffViaCanonicalCard,
  resolveClientScenarioBoundaryPrefixForCanonicalTts,
  resolveShowScenarioCardTransitionAlreadySpoken,
  resolveCanonicalShowScenarioCardTransitionSpeakDecision,
  resolveShowScenarioCardKindForInterview,
  streamAlreadySpokeScenarioBoundaryClosingLead,
  streamSpokenTextAlreadyMatchesCanonicalCard,
  showScenarioCardPrefetchBufferMatchesSpeakText,
} from '@features/aria/showScenarioCardCanonicalTts';
import { SHOW_SCENARIO_2_VIGNETTE_EXACT } from '@features/aria/interviewShowScenarioExactCopy';
import { SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY } from '@features/aria/scenarioAContemptProbeTtsStrip';
import { SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL } from '@features/aria/scenarioBProbeLogic';

describe('showScenarioCardCanonicalTts', () => {
  it('suppresses paraphrased Scenario 1 vignette until canonical card speaks', () => {
    const paraphrased =
      "Here's the first situation. Emma and Ryan are at dinner and Ryan takes a long call. What's going on between these two?";
    expect(
      shouldSuppressParallelStreamNonExactShowScenarioCardSpeech({
        spokenForTts: paraphrased,
        interviewMoment: 1,
        interviewScenario: 1,
        showScenarioCardCanonicalSpokenThisStream: false,
      }),
    ).toBe(true);
    expect(
      shouldSuppressParallelStreamNonExactShowScenarioCardSpeech({
        spokenForTts: `${SCENARIO_1_VIGNETTE}\n\n${SCENARIO_1_OPENING}`,
        interviewMoment: 1,
        interviewScenario: 1,
        showScenarioCardCanonicalSpokenThisStream: false,
      }),
    ).toBe(false);
  });

  it('suppresses Scenario 2 vignette during S1→S2 handoff so canonical card speaks once', () => {
    const handoffStream =
      "That's a wrap on this situation. Nice work, Matt — you read Emma's frustration. Here's the next situation. Sarah and James have been arguing more than usual lately.";
    const canonicalVignette = `${SHOW_SCENARIO_2_VIGNETTE_EXACT}\n\n${SCENARIO_2_OPENING}`;
    expect(
      shouldSuppressParallelStreamNonExactShowScenarioCardSpeech({
        spokenForTts: canonicalVignette,
        fullStream: handoffStream,
        interviewMoment: 1,
        interviewScenario: 1,
        showScenarioCardCanonicalSpokenThisStream: false,
      }),
    ).toBe(true);
    expect(
      shouldSuppressParallelStreamNonExactShowScenarioCardSpeech({
        spokenForTts: 'Sarah and James have been arguing more than usual lately.',
        fullStream: handoffStream,
        interviewMoment: 1,
        interviewScenario: 1,
        showScenarioCardCanonicalSpokenThisStream: false,
      }),
    ).toBe(true);
  });

  it('mergeShowScenarioCardTransitionPrefixWithSpoken replaces streamed canned boundary reflection', () => {
    const clientPrefix =
      "That's a wrap on that one. Nice work, Matt — You focused on guarding date time with structural limits on calls, not just a one-time promise. We've got two more situations to get through.";
    const streamedCanned =
      "That's a wrap on that one. Nice work, Matt — You focused on putting concrete limits on calls during dates so the same interruption does not repeat.";
    expect(mergeShowScenarioCardTransitionPrefixWithSpoken(clientPrefix, streamedCanned)).toBe(
      clientPrefix,
    );
  });

  it('resolveClientScenarioBoundaryPrefixForCanonicalTts ignores model paraphrase prefix', () => {
    const prefix = resolveClientScenarioBoundaryPrefixForCanonicalTts({
      kind: 'situation_2',
      messages: [
        {
          role: 'user',
          content: 'If I were Ryan, I would apologize and follow through.',
          scenarioNumber: 1,
        },
      ],
      firstName: 'Matt',
      extractedPrefix:
        "That's a wrap on this situation. Nice work, Matt — You recognized Daniel's genuine confusion about how to communicate and how Sophie felt dismissed.",
    });
    expect(prefix).toMatch(/that's the end of this scenario|here'?s the next situation/i);
    expect(prefix).not.toMatch(/Daniel|Sophie/i);
  });

  it('detects and rebuilds paraphrased Scenario 2 opening with transition prefix', () => {
    const paraphrased =
      "Nice work on that first situation. Sarah has been looking for work for months and James misses the celebration. What do you think is happening here?";
    expect(detectShowScenarioCardKind(paraphrased)).toBe('situation_2');
    const rebuilt = buildCanonicalShowScenarioCardTtsFromStream(paraphrased)!;
    expect(rebuilt).toContain('Nice work on that first situation.');
    expect(rebuilt).toContain('She gets an offer');
    expect(rebuilt).toContain(SCENARIO_2_OPENING);
    expect(rebuilt).not.toMatch(/What do you think is happening here\?/);
  });

  it('does not rebuild S2 closing reflection into Situation 2 card without vignette body', () => {
    const reflection =
      "Nice work, Matt — you recognized that James's instinct to ask practical questions missed what Sarah actually needed in that moment, which was for him to just be present and celebrate her.";
    expect(buildCanonicalShowScenarioCardTtsFromStream(reflection)).toBeNull();
  });

  it('builds canonical Scenario 3 body', () => {
    const body = buildCanonicalShowScenarioCardTtsBody('situation_3');
    expect(body).toContain('same argument');
    expect(body).toContain("When Daniel comes back and says 'I didn't know what to say'");
  });

  it('builds canonical Moment 4 and 5 card copy', () => {
    expect(buildCanonicalShowScenarioCardTtsBody('moment_4')).toBe(MOMENT_4_GRUDGE_QUESTION_TEXT);
    expect(buildCanonicalShowScenarioCardTtsBody('moment_5')).toBe(MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT);
  });

  it('skips Moment 5 canonical replay when stream already spoke the conflict question', () => {
    const spoken =
      "I'm with you. Here's one more question about you. " + MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT;
    const fullStream =
      "I'm with you. Here's one more question about you.\n\nTell me about a time you had a conflict with someone close to you — how did it start, and how did it get resolved?";
    expect(streamSpokenTextAlreadyMatchesCanonicalCard(spoken, fullStream, 'moment_5')).toBe(true);
    expect(
      shouldSkipPersonalMomentCanonicalReplay({
        kind: 'moment_5',
        spokenCompleteText: spoken,
        fullStream,
        playbackConfirmedKinds: {},
      }),
    ).toBe(true);
  });

  it('does not treat transcript-only canonical as delivered without playback confirmation', () => {
    const canonical = buildCanonicalShowScenarioCardTtsBody('situation_1');
    expect(
      shouldTreatShowScenarioCardCanonicalAsAlreadyDelivered({
        messages: [{ role: 'assistant', content: canonical }],
        kind: 'situation_1',
        playbackConfirmedKinds: {},
      }),
    ).toBe(false);
    expect(
      shouldTreatShowScenarioCardCanonicalAsAlreadyDelivered({
        messages: [{ role: 'assistant', content: canonical }],
        kind: 'situation_1',
        playbackConfirmedKinds: { situation_1: true },
      }),
    ).toBe(true);
  });

  it('detects canonical show-scenario-card delivery text', () => {
    const canonical = buildCanonicalShowScenarioCardTtsBody('situation_1');
    expect(isShowScenarioCardCanonicalDeliveryText(canonical)).toBe('situation_1');
    expect(isShowScenarioCardCanonicalDeliveryText("Here's the first situation.")).toBe(null);
    expect(isShowScenarioCardCanonicalPlaybackConfirmed({ situation_1: true }, 'situation_1')).toBe(
      true,
    );
  });

  it('does not arm stream mute for Scenario A repair follow-up', () => {
    const repair = 'So if you were Ryan, how would you go about repairing this situation?';
    expect(
      shouldArmShowScenarioCardStreamMute({
        sentence: repair,
        fullStream: repair,
        messagesToUse: [],
        streamShowScenarioCardMuteActive: false,
        showScenarioCardCanonicalSpokenThisStream: false,
        streamContemptProbeMuteActive: false,
      }),
    ).toBe(false);
  });

  it('detects exact Scenario 2 vignette copy verbatim', () => {
    expect(isExactShowScenario2VignetteText(SHOW_SCENARIO_2_VIGNETTE_EXACT)).toBe(true);
    expect(isExactShowScenario2FullText(buildCanonicalShowScenarioCardTtsBody('situation_2'))).toBe(true);
    expect(
      isExactShowScenario2VignetteText(
        'Sarah has been looking for work for months and James misses the celebration.',
      ),
    ).toBe(false);
  });

  it('arms stream mute for Scenario 2 via interview moment/scenario context', () => {
    const paraphrased =
      "Nice work on that first situation. Sarah has been looking for work for months and James misses the celebration. What do you think is happening here?";
    expect(
      shouldArmShowScenarioCardStreamMute({
        sentence: 'Sarah has been looking for work for months and James misses the celebration.',
        fullStream: paraphrased,
        messagesToUse: [],
        streamShowScenarioCardMuteActive: false,
        showScenarioCardCanonicalSpokenThisStream: false,
        streamContemptProbeMuteActive: false,
        interviewMoment: 2,
        interviewScenario: 2,
      }),
    ).toBe(true);
  });

  it('does not arm stream mute for wrong-scenario confusion redirect during Scenario 2', () => {
    const redirect =
      "Fair point — I'm looking for your read on what's happening emotionally between Emma and Ryan. Why do you think she's tearing up?";
    expect(
      resolveShowScenarioCardKindForInterview({
        fullStream: redirect,
        interviewMoment: 2,
        interviewScenario: 2,
      }),
    ).toBeNull();
    expect(
      shouldArmShowScenarioCardStreamMute({
        sentence:
          "Fair point — I'm looking for your read on what's happening emotionally between Emma and Ryan.",
        fullStream: redirect,
        messagesToUse: [],
        streamShowScenarioCardMuteActive: false,
        showScenarioCardCanonicalSpokenThisStream: false,
        streamContemptProbeMuteActive: false,
        interviewMoment: 2,
        interviewScenario: 2,
      }),
    ).toBe(false);
  });

  it('does not arm stream mute for mid-scenario Sarah mention without boundary handoff', () => {
    const redirect =
      "Fair enough — I'm looking for your read on what's happening between Sarah and James emotionally. What do you think is going on here?";
    expect(
      resolveShowScenarioCardKindForInterview({
        fullStream: redirect,
        interviewMoment: 2,
        interviewScenario: 2,
      }),
    ).toBeNull();
    expect(
      shouldArmShowScenarioCardStreamMute({
        sentence: redirect,
        fullStream: redirect,
        messagesToUse: [],
        streamShowScenarioCardMuteActive: false,
        showScenarioCardCanonicalSpokenThisStream: false,
        streamContemptProbeMuteActive: false,
        interviewMoment: 2,
        interviewScenario: 2,
      }),
    ).toBe(false);
  });

  it('suppresses parallel stream when Scenario 1 includes Ryan repair before canonical card', () => {
    expect(
      shouldSuppressParallelStreamNonExactShowScenarioCardSpeech({
        spokenForTts: 'If you were Ryan in that moment, what would you do?',
        interviewMoment: 1,
        interviewScenario: 1,
        showScenarioCardCanonicalSpokenThisStream: false,
      }),
    ).toBe(true);
  });

  it('does not suppress canonical Scenario 1 repair question after contempt', () => {
    expect(
      shouldSuppressParallelStreamNonExactShowScenarioCardSpeech({
        spokenForTts: SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY,
        interviewMoment: 1,
        interviewScenario: 1,
        showScenarioCardCanonicalSpokenThisStream: false,
      }),
    ).toBe(false);
  });

  it('skips Situation 1 canonical replay after contempt spoke in stream', () => {
    expect(
      shouldSkipSituation1CanonicalReplay({
        playbackConfirmedKinds: {},
        delivery: { contemptProbeAsked: false, repairQuestionAsked: false },
        contemptSpokeThisStream: true,
      }),
    ).toBe(true);
  });

  it('skips Situation 1 canonical replay when opening playback already confirmed', () => {
    expect(
      shouldSkipSituation1CanonicalReplay({
        playbackConfirmedKinds: { situation_1: true },
        delivery: { contemptProbeAsked: false, repairQuestionAsked: false },
      }),
    ).toBe(true);
  });

  it('skips Situation 1 canonical replay during contempt follow-up phase', () => {
    expect(
      shouldSkipSituation1CanonicalReplay({
        playbackConfirmedKinds: {},
        delivery: { contemptProbeAsked: true, repairQuestionAsked: false },
      }),
    ).toBe(true);
  });

  it('skips Situation 3 canonical replay when Sophie/Daniel vignette is already in transcript', () => {
    expect(
      shouldSkipSituation3CanonicalReplay({
        currentScenario: 3,
        messages: [{ role: 'assistant', content: SHOW_SCENARIO_3_VIGNETTE_EXACT }],
        playbackConfirmedKinds: {},
      }),
    ).toBe(true);
    expect(
      shouldSkipSituation3CanonicalReplay({
        currentScenario: 2,
        messages: [],
        playbackConfirmedKinds: { situation_3: true },
      }),
    ).toBe(true);
    expect(
      shouldSkipSituation3CanonicalReplay({
        currentScenario: 2,
        messages: [],
        playbackConfirmedKinds: {},
      }),
    ).toBe(false);
  });

  it('suppresses parallel stream when Scenario 2 vignette is paraphrased', () => {
    expect(
      shouldSuppressParallelStreamNonExactShowScenarioCardSpeech({
        spokenForTts:
          "That's a wrap on Situation 1. Sarah has been looking for work for months. What do you think is going on here?",
        interviewMoment: 2,
        interviewScenario: 2,
        showScenarioCardCanonicalSpokenThisStream: false,
      }),
    ).toBe(true);
    expect(
      shouldSuppressParallelStreamNonExactShowScenarioCardSpeech({
        spokenForTts: buildCanonicalShowScenarioCardTtsBody('situation_2'),
        interviewMoment: 2,
        interviewScenario: 2,
        showScenarioCardCanonicalSpokenThisStream: false,
      }),
    ).toBe(false);
  });

  it('does not suppress Scenario B James-differently Q2 even when Sarah/James/appreciated appear', () => {
    expect(
      shouldSuppressParallelStreamNonExactShowScenarioCardSpeech({
        spokenForTts: SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL,
        interviewMoment: 2,
        interviewScenario: 2,
        showScenarioCardCanonicalSpokenThisStream: false,
      }),
    ).toBe(false);
  });

  it('composeShowScenarioCardTtsWithTransitionPrefix prepends uns spoken boundary reflection', () => {
    const prefix =
      "That's a wrap on this situation. Nice work, Matt — you read the recurring pattern clearly.";
    const canonical = buildCanonicalShowScenarioCardTtsBody('situation_2');
    const out = composeShowScenarioCardTtsWithTransitionPrefix({
      prefix,
      canonicalText: canonical,
      spokenSoFar: 'Makes sense.',
      transitionAlreadySpoken: false,
    });
    expect(out).toContain(prefix);
    expect(out).toContain(SHOW_SCENARIO_2_VIGNETTE_EXACT);
    expect(out.startsWith('Makes sense.')).toBe(false);
  });

  it('composeShowScenarioCardTtsWithTransitionPrefix keeps wrap when cancelled stream text must be ignored', () => {
    const prefix =
      "That's a wrap on that one. Nice work, Matt — You framed emotional acknowledgment before fixes. We've got two more situations to get through.";
    const canonical = buildCanonicalShowScenarioCardTtsBody('situation_2');
    /**
     * After cancel, callers clear spokenCompleteText and force transitionAlreadySpoken:false
     * so merge does not treat the killed audio as already delivered.
     */
    const out = composeShowScenarioCardTtsWithTransitionPrefix({
      prefix,
      canonicalText: canonical,
      spokenSoFar: '',
      transitionAlreadySpoken: false,
    });
    expect(out).toContain("That's a wrap on that one");
    expect(out).toContain(SHOW_SCENARIO_2_VIGNETTE_EXACT);
    expect(
      resolveShowScenarioCardTransitionAlreadySpoken({
        prefix,
        spokenSoFar: '',
        scenarioJustCompleted: 1,
      }),
    ).toBe(false);
  });

  it('mergeShowScenarioCardTransitionPrefixWithSpoken strips transition phrase already spoken in stream', () => {
    const prefix =
      "That's a wrap on this situation. Nice work, Matt — you read the recurring pattern clearly. Here's the next situation.";
    const merged = mergeShowScenarioCardTransitionPrefixWithSpoken(
      prefix,
      'Makes sense. Here\'s the next situation.',
    );
    expect(merged).toContain('Nice work, Matt');
    expect(merged).not.toMatch(/here'?s the next situation/i);
    expect(merged).not.toMatch(/^Makes sense/i);
  });

  it('mergeShowScenarioCardTransitionPrefixWithSpoken drops reflection when stream already spoke positive-address reflection', () => {
    const prefix =
      "That's a wrap on that one. Nice work, Matt — You focused on putting concrete limits on calls during dates. We've got two more situations to get through.";
    const merged = mergeShowScenarioCardTransitionPrefixWithSpoken(
      prefix,
      "Got it. Nice work, Matt — you focused on getting to an agreement about what's okay rather than staying in the back-and-forth of hurt comments.",
    );
    expect(merged.toLowerCase()).not.toMatch(/nice work,\s*matt/);
    expect(merged).toContain("That's a wrap on that one");
    expect(merged).toContain('two more situations');
  });

  it('parallelStreamDeliveredBundledHandoffViaCanonicalCard is true when S2 playback confirmed', () => {
    const bundle =
      "That's a wrap on this situation. Here's the next situation.\n\n" +
      buildCanonicalShowScenarioCardTtsBody('situation_2');
    expect(
      parallelStreamDeliveredBundledHandoffViaCanonicalCard({ situation_2: true }, bundle),
    ).toBe(true);
    expect(parallelStreamDeliveredBundledHandoffViaCanonicalCard({}, bundle)).toBe(false);
  });

  it('parallelStreamDeliveredBundledHandoffViaCanonicalCard is true when M4 playback confirmed', () => {
    const bundle =
      "That's the end of the three described situations. There are only two questions left.\n\n" +
      MOMENT_4_GRUDGE_QUESTION_TEXT;
    expect(
      parallelStreamDeliveredBundledHandoffViaCanonicalCard({ moment_4: true }, bundle),
    ).toBe(true);
  });

  it('resolveClientScenarioBoundaryPrefixForCanonicalTts injects short wrap lead when model prefix is empty', () => {
    const prefix = resolveClientScenarioBoundaryPrefixForCanonicalTts({
      kind: 'situation_2',
      messages: [
        {
          role: 'user',
          content:
            'I would make sure all calls go to voicemail during dates and commit to not taking mom calls unless it is an emergency.',
          scenarioNumber: 1,
        },
      ],
      firstName: 'Vaishnava',
      extractedPrefix: '',
    });
    expect(prefix).toContain("Good work — that's the end of this scenario.");
    expect(prefix).not.toContain('Nice work, Vaishnava');
    expect(prefix).not.toMatch(/You (focused on|named|framed)/i);
    expect(prefix).toContain("Here's the next situation.");
  });

  it('showScenarioCardPrefetchBufferMatchesSpeakText requires exact line (not vignette substring)', () => {
    const vignetteOnly = buildCanonicalShowScenarioCardTtsBody('situation_2');
    const wrap =
      "Good work — that's the end of this scenario. Here's the next situation.";
    const wrapPlusVignette = `${wrap}\n\n${vignetteOnly}`;
    expect(showScenarioCardPrefetchBufferMatchesSpeakText(wrapPlusVignette, vignetteOnly)).toBe(
      false,
    );
    expect(showScenarioCardPrefetchBufferMatchesSpeakText(wrapPlusVignette, wrapPlusVignette)).toBe(
      true,
    );
    expect(showScenarioCardPrefetchBufferMatchesSpeakText(vignetteOnly, vignetteOnly)).toBe(true);
  });

  it('shouldSuppressParallelStreamNonExactShowScenarioCardSpeech mutes S1 wrap lead during S2 handoff', () => {
    const wrap = "That's a wrap on this situation. Nice work, Matz — you picked up on Emma's frustration.";
    expect(
      shouldSuppressParallelStreamNonExactShowScenarioCardSpeech({
        spokenForTts: wrap,
        interviewMoment: 1,
        interviewScenario: 1,
        showScenarioCardCanonicalSpokenThisStream: false,
        fullStream: `${wrap}\n\nSarah has been job hunting for four months.`,
      }),
    ).toBe(true);
  });

  it('resolveShowScenarioCardKindForInterview detects S2 during S1 handoff with wrap lead only', () => {
    expect(
      resolveShowScenarioCardKindForInterview({
        fullStream: "That's a wrap on this situation. Nice work, Matz.",
        interviewMoment: 1,
        interviewScenario: 1,
      }),
    ).toBe('situation_2');
  });

  it('resolveShowScenarioCardKindForInterview detects S2 during S1 handoff with Sarah and James paraphrase', () => {
    const paraphrased =
      "That's a wrap on this situation. Here's the next situation: Sarah and James have been together for two years.";
    expect(
      resolveShowScenarioCardKindForInterview({
        fullStream: paraphrased,
        interviewMoment: 1,
        interviewScenario: 1,
      }),
    ).toBe('situation_2');
  });

  it('resolveShowScenarioCardKindForInterview detects M4 during S3 closing handoff', () => {
    const closing =
      "That's the end of the three described situations. Good work, Matt — You recognized that the pattern won't shift without both of them staying in the room for an honest conversation.";
    expect(
      resolveShowScenarioCardKindForInterview({
        fullStream: closing,
        interviewMoment: 3,
        interviewScenario: 3,
      }),
    ).toBe('moment_4');
  });

  it('shouldSuppressParallelStreamNonExactShowScenarioCardSpeech mutes S3 closing lead during M4 handoff', () => {
    const closing =
      "That's the end of the three described situations. Good work, Matt — You recognized that the pattern won't shift.";
    expect(
      shouldSuppressParallelStreamNonExactShowScenarioCardSpeech({
        spokenForTts: closing,
        interviewMoment: 3,
        interviewScenario: 3,
        showScenarioCardCanonicalSpokenThisStream: false,
        fullStream: `${closing}\n\nThink of someone you've had a really hard time with.`,
      }),
    ).toBe(true);
  });

  it('shouldSuppressParallelStreamNonExactShowScenarioCardSpeech mutes premature standalone M4 personal bridge', () => {
    const prematureBridge = 'Now for something a bit more personal.';
    expect(
      shouldSuppressParallelStreamNonExactShowScenarioCardSpeech({
        spokenForTts: prematureBridge,
        interviewMoment: 3,
        interviewScenario: 3,
        showScenarioCardCanonicalSpokenThisStream: false,
        fullStream: prematureBridge,
      }),
    ).toBe(true);
  });

  it('shouldSuppressParallelStreamNonExactShowScenarioCardSpeech mutes standalone two-questions-left cue', () => {
    const twoLeft = 'There are only two questions left.';
    expect(
      shouldSuppressParallelStreamNonExactShowScenarioCardSpeech({
        spokenForTts: twoLeft,
        interviewMoment: 3,
        interviewScenario: 3,
        showScenarioCardCanonicalSpokenThisStream: false,
        fullStream: twoLeft,
      }),
    ).toBe(true);
  });

  it('shouldSuppressParallelStreamNonExactShowScenarioCardSpeech mutes S2 wrap lead during S3 handoff', () => {
    const wrap =
      "That's a wrap on this situation. Nice work, Matz — you recognized that James missed what Sarah needed in the moment.";
    const handoffStream = `${wrap}\n\nSophie and Daniel have had the same argument for the third time.`;
    expect(
      shouldSuppressParallelStreamNonExactShowScenarioCardSpeech({
        spokenForTts: wrap,
        interviewMoment: 2,
        interviewScenario: 2,
        showScenarioCardCanonicalSpokenThisStream: false,
        fullStream: handoffStream,
      }),
    ).toBe(true);
    expect(
      shouldSuppressParallelStreamNonExactShowScenarioCardSpeech({
        spokenForTts: "Here's the next situation.",
        interviewMoment: 2,
        interviewScenario: 2,
        showScenarioCardCanonicalSpokenThisStream: false,
        fullStream: handoffStream,
      }),
    ).toBe(true);
  });

  it('resolveShowScenarioCardKindForInterview detects S3 during S2 handoff with wrap lead only', () => {
    expect(
      resolveShowScenarioCardKindForInterview({
        fullStream:
          "That scenario is complete. Nice work, Matz — You saw James's focus on logistics. Here's the third situation.",
        interviewMoment: 2,
        interviewScenario: 2,
      }),
    ).toBe('situation_3');
  });

  it('resolveShowScenarioCardKindForInterview detects M4 during S3 closing handoff after repair satisfied', () => {
    const closing =
      "That's the end of the three described situations. Good work, Matt — You recognized Daniel's confusion.";
    expect(
      resolveShowScenarioCardKindForInterview({
        fullStream: `${closing}\n\nThink of someone you've had a really hard time with.`,
        interviewMoment: 3,
        interviewScenario: 3,
      }),
    ).toBe('moment_4');
  });

  it('composeShowScenarioCardTtsWithTransitionPrefix includes S3 closing when stream only spoke M4 grudge body', () => {
    const prefix =
      "That's the end of the three described situations. Good work, Matt — You recognized Daniel's genuine confusion. There are only two questions left. Now I want to ask you about something a bit more personal.";
    const canonical =
      "Think of someone you've had a really hard time with — maybe a falling out, a grudge, or just someone who got under your skin. Tell me what happened there, and where things stand now.";
    const spokenSoFar =
      "Think of someone you've had a really hard time with — maybe a falling out, a grudge, or just someone who got under your skin.";
    expect(
      resolveShowScenarioCardTransitionAlreadySpoken({ prefix, spokenSoFar }),
    ).toBe(false);
    const out = composeShowScenarioCardTtsWithTransitionPrefix({
      prefix,
      canonicalText: canonical,
      spokenSoFar,
      transitionAlreadySpoken: false,
    });
    expect(out).toContain('end of the three described situations');
    expect(out).toContain('Think of someone');
  });

  it('mergeShowScenarioCardTransitionPrefixWithSpoken keeps client lead after generic model reflection', () => {
    const clientLead =
      "That's a wrap on that one. Nice work, Matt — You saw that Ryan needed concrete limits on calls during their time together — not just a one-time apology. We've got two more situations to get through.";
    const spokenGeneric =
      "That's a wrap on that one. Nice work, Matt — You picked up on the tension between staying connected and maintaining boundaries with family.";
    const merged = mergeShowScenarioCardTransitionPrefixWithSpoken(clientLead, spokenGeneric);
    expect(merged).toContain('limits on calls');
    expect(merged).not.toMatch(/staying connected and maintaining boundaries/i);
  });

  it('streamAlreadySpokeScenarioBoundaryClosingLead is false for generic vignette-theme reflection', () => {
    expect(
      streamAlreadySpokeScenarioBoundaryClosingLead(
        "That's a wrap on that one. Nice work, Matt — You picked up on the tension between staying connected and maintaining boundaries with family. We've got two more situations to get through.",
        1,
      ),
    ).toBe(false);
  });

  it('streamAlreadySpokeScenarioBoundaryClosingLead ignores M4 grudge-only stream for S3', () => {
    expect(
      streamAlreadySpokeScenarioBoundaryClosingLead(
        "Think of someone you've had a really hard time with — maybe a falling out.",
        3,
      ),
    ).toBe(false);
    expect(
      streamAlreadySpokeScenarioBoundaryClosingLead(
        "That's the end of the three described situations. Good work, Matt — You recognized Daniel's confusion.",
        3,
      ),
    ).toBe(false);
    expect(
      streamAlreadySpokeScenarioBoundaryClosingLead(
        "That's the end of the three described situations. Good work, Matt — You named Daniel not knowing what to say and how Sophie felt dismissed when he left. There are only two questions left.",
        3,
      ),
    ).toBe(true);
  });

  it('resolveCanonicalShowScenarioCardTransitionSpeakDecision forces wrap after cancelled parallel audio', () => {
    for (const kind of ['situation_2', 'situation_3', 'moment_4'] as const) {
      const decision = resolveCanonicalShowScenarioCardTransitionSpeakDecision({
        kind,
        effectivePrefix: "That's a wrap on this situation. Here's the next situation.",
        spokenLive: "That's a wrap on this situation. Here's the next situation.",
        cancelledParallelPlayback: true,
      });
      expect(decision.transitionAlreadySpoken).toBe(false);
      expect(decision.spokenSoFarForCompose).toBe('');
    }
  });

  it('resolveCanonicalShowScenarioCardTransitionSpeakDecision skips wrap only when full boundary lead already played', () => {
    const s2Decision = resolveCanonicalShowScenarioCardTransitionSpeakDecision({
      kind: 'situation_2',
      effectivePrefix:
        "That's a wrap on that one. Nice work, Matt — reflection. We've got two more situations to get through.",
      spokenLive:
        "That's a wrap on that one. Nice work, Matt — reflection. We've got two more situations to get through.",
      cancelledParallelPlayback: false,
    });
    expect(s2Decision.transitionAlreadySpoken).toBe(true);

    const s3Decision = resolveCanonicalShowScenarioCardTransitionSpeakDecision({
      kind: 'situation_3',
      effectivePrefix:
        "That scenario is complete. Nice work, Matt — reflection. Here's the third situation.",
      spokenLive:
        "That scenario is complete. Nice work, Matt — reflection. Here's the third situation.",
      cancelledParallelPlayback: false,
    });
    expect(s3Decision.transitionAlreadySpoken).toBe(true);

    const m4Decision = resolveCanonicalShowScenarioCardTransitionSpeakDecision({
      kind: 'moment_4',
      effectivePrefix:
        "That's the end of the three described situations. Good work, Matt — reflection. There are only two questions left.",
      spokenLive: 'Sarah has been job hunting for four months.',
      cancelledParallelPlayback: false,
    });
    expect(m4Decision.transitionAlreadySpoken).toBe(false);
    expect(m4Decision.spokenSoFarForCompose).toContain('Sarah');
  });

  it('streamAlreadySpokeScenarioBoundaryClosingLead recognizes model S3 close without described wording', () => {
    expect(
      streamAlreadySpokeScenarioBoundaryClosingLead(
        "That's the end of the three situations. Good work, Matt — you highlighted Sophie reassuring Daniel that it's safe to stay. Now for the personal questions.",
        3,
      ),
    ).toBe(true);
  });

  it('streamAlreadySpokeScenarioBoundaryClosingLead recognizes end-of-this-situation model S1 close', () => {
    const streamClose =
      "That's the end of this situation. Nice work, Matt — you framed Emma's line as a snide reaction rather than a conversation opener, and pointed to Ryan needing to invite a real talk about what works for both of them.";
    expect(streamAlreadySpokeScenarioBoundaryClosingLead(streamClose, 1)).toBe(true);
    expect(
      resolveShowScenarioCardTransitionAlreadySpoken({
        prefix:
          "That's a wrap on that one. Nice work, Matt — You focused on putting concrete limits on calls during dates so the same interruption does not repeat. We've got two more situations to get through.",
        spokenSoFar: streamClose,
        scenarioJustCompleted: 1,
      }),
    ).toBe(true);
  });

  it('streamAlreadySpokeScenarioBoundaryClosingLead recognizes canonical short S1→S2 close', () => {
    expect(
      streamAlreadySpokeScenarioBoundaryClosingLead(
        "Good work — that's the end of this scenario. Here's the next situation.",
        1,
      ),
    ).toBe(true);
  });

  it('streamAlreadySpokeScenarioBoundaryClosingLead recognizes LLM S2→S3 wrap phrasing', () => {
    expect(
      streamAlreadySpokeScenarioBoundaryClosingLead(
        "That's the second situation wrapped up. On to the next one.",
        2,
      ),
    ).toBe(true);
    expect(
      streamAlreadySpokeScenarioBoundaryClosingLead(
        'That wraps up Sarah and James. On to the third and final situation.',
        2,
      ),
    ).toBe(true);
  });

  it('composeShowScenarioCardTtsWithTransitionPrefix omits duplicate S3 close when stream already spoke it', () => {
    const prefix =
      "That's the end of the three described situations. Good work, Matt — You named leaving as on the table when things do not shift. There are only two questions left. Now I want to ask you about something a bit more personal.";
    const canonical = MOMENT_4_GRUDGE_QUESTION_TEXT;
    const spokenSoFar =
      "That's the end of the three situations. Good work, Matt — you highlighted Sophie reassuring Daniel that it's safe to stay. Now for the personal questions.";
    const out = composeShowScenarioCardTtsWithTransitionPrefix({
      prefix,
      canonicalText: canonical,
      spokenSoFar,
      transitionAlreadySpoken: true,
    });
    expect(out).toBe(canonical);
    expect(out).not.toContain('end of the three');
  });
});
