import { SCENARIO_B_VIGNETTE } from '@/constants/scenarioBVignette';
import { SCENARIO_1_TO_2_TRANSITION_FALLBACK } from '../interviewTransitionBundles';
import {
  emotionRecognitionCorrectCount,
  isEmotionItemAnsweredAt,
  listUnansweredEmotionModalIndices,
  mergeEmotionResponses,
  hydrateEmotionResponsesFromSources,
  scoreEmotionItems,
  setEmotionResponseAtIndex,
  buildEmotionRecognitionPersistPayload,
  emotionRecognitionPersistScoresFromResponses,
  emotionRecognitionPersistSpreadIfComplete,
  hydrateEmotionResponsesFromStorage,
  emotionRecognitionDisplayScoreFromRaw,
  emotionRecognitionDisplayPercentFromAttemptsRow,
  resolveEmotionRecognitionRawScoreForGate,
  isLegacyEmotionRecognitionFloorOnlyFail,
  emotionResponsesForStorage,
  extractEmotionAfterModalForResumeCatchUp,
  splitScenarioTransitionForEmotionModal,
  reconcileCompletedScenarioForEmotionModal,
  completedScenarioForEmotionModalFromTransition,
  emotionModalIndexForCompletedScenario,
  shouldDeferEmotionModalForTransitionText,
  isNaturalLanguageScenarioHandoffTransition,
  isScenarioThreeToMoment4EmotionModalHandoff,
  resolveNaturalLanguageEmotionModalGate,
} from '../emotionRecognitionInterview';
import { resolveHandoffPriorScenario } from '../emotionScenarioTransitionInference';

describe('emotionRecognitionInterview', () => {
  it('scoreEmotionItems returns proportion for three answers', () => {
    expect(scoreEmotionItems(['B', 'C', 'C'])).toBe(1);
    expect(scoreEmotionItems(['A', 'C', 'C'])).toBeCloseTo(2 / 3);
    expect(scoreEmotionItems(['A', 'A', 'A'])).toBe(0);
  });

  it('scoreEmotionItems returns 0 when battery incomplete (no partial scoring)', () => {
    expect(scoreEmotionItems(['B', 'C'])).toBe(0);
    expect(scoreEmotionItems(['B'])).toBe(0);
  });

  it('listUnansweredEmotionModalIndices only includes missing items', () => {
    expect(listUnansweredEmotionModalIndices([], 2)).toEqual([0, 1]);
    expect(listUnansweredEmotionModalIndices(['B'], 2)).toEqual([1]);
    expect(listUnansweredEmotionModalIndices(['B', 'C'], 2)).toEqual([]);
    expect(isEmotionItemAnsweredAt(['B'], 0)).toBe(true);
    expect(isEmotionItemAnsweredAt(['B'], 1)).toBe(false);
  });

  it('mergeEmotionResponses keeps the longest sequential prefix', () => {
    expect(mergeEmotionResponses([], ['B'])).toEqual(['B']);
    expect(mergeEmotionResponses(['B'], ['B', 'C'])).toEqual(['B', 'C']);
  });

  it('hydrateEmotionResponsesFromSources merges DB and storage shapes', () => {
    expect(hydrateEmotionResponsesFromSources(['B'], ['B', 'C', 'C'])).toEqual(['B', 'C', 'C']);
    expect(hydrateEmotionResponsesFromSources(null, ['B', 'C', 'C'])).toEqual(['B', 'C', 'C']);
  });

  it('emotionRecognitionCorrectCount supports complete batteries only', () => {
    expect(emotionRecognitionCorrectCount([])).toBeNull();
    expect(emotionRecognitionCorrectCount(['B'])).toBeNull();
    expect(emotionRecognitionCorrectCount(['B', 'C'])).toBeNull();
    expect(emotionRecognitionCorrectCount(['b', 'c', 'c'])).toBe(3);
    expect(emotionRecognitionCorrectCount(['A', 'C', 'C'])).toBe(2);
  });

  it('buildEmotionRecognitionPersistPayload nulls all fields for incomplete batteries', () => {
    expect(buildEmotionRecognitionPersistPayload(['B', 'C'])).toEqual({
      emotion_recognition_responses: null,
      emotion_recognition_raw_score: null,
      emotion_recognition_score: null,
    });
    expect(buildEmotionRecognitionPersistPayload(['B'])).toEqual({
      emotion_recognition_responses: null,
      emotion_recognition_raw_score: null,
      emotion_recognition_score: null,
    });
    expect(buildEmotionRecognitionPersistPayload([])).toEqual({
      emotion_recognition_responses: null,
      emotion_recognition_raw_score: null,
      emotion_recognition_score: null,
    });
  });

  it('buildEmotionRecognitionPersistPayload scores complete batteries', () => {
    const payload = buildEmotionRecognitionPersistPayload(['B', 'C', 'C']);
    expect(payload.emotion_recognition_responses).toEqual(['B', 'C', 'C']);
    expect(payload.emotion_recognition_raw_score).toBe(3);
    expect(payload.emotion_recognition_score).toBe(100);
  });

  it('buildEmotionRecognitionPersistPayload maps partial correct to count and percent', () => {
    const payload = buildEmotionRecognitionPersistPayload(['B', 'C', 'A']);
    expect(payload.emotion_recognition_raw_score).toBe(2);
    expect(payload.emotion_recognition_score).toBe(67);
  });

  it('buildEmotionRecognitionPersistPayload one of three correct', () => {
    const payload = buildEmotionRecognitionPersistPayload(['B', 'A', 'A']);
    expect(payload.emotion_recognition_raw_score).toBe(1);
    expect(payload.emotion_recognition_score).toBe(33);
  });

  it('resolveEmotionRecognitionRawScoreForGate ignores stale raw when battery incomplete', () => {
    expect(
      resolveEmotionRecognitionRawScoreForGate({
        emotionRecognitionRawScore: 1,
        emotionRecognitionResponses: ['B'],
      }),
    ).toBeNull();
  });

  it('resolveEmotionRecognitionRawScoreForGate prefers responses over stored count', () => {
    expect(
      resolveEmotionRecognitionRawScoreForGate({
        emotionRecognitionRawScore: 1,
        emotionRecognitionResponses: ['B', 'A', 'A'],
      }),
    ).toBeCloseTo(1 / 3);
  });

  it('resolveEmotionRecognitionRawScoreForGate interprets legacy stored count without responses', () => {
    expect(
      resolveEmotionRecognitionRawScoreForGate({
        emotionRecognitionRawScore: 2,
      }),
    ).toBeCloseTo(2 / 3);
  });

  it('resolveEmotionRecognitionRawScoreForGate treats integer raw 1 as one correct not 100%', () => {
    expect(
      resolveEmotionRecognitionRawScoreForGate({
        emotionRecognitionRawScore: 1,
      }),
    ).toBeCloseTo(1 / 3);
    expect(
      resolveEmotionRecognitionRawScoreForGate({
        emotionRecognitionRawScore: 1,
        emotionRecognitionResponses: ['B', 'A', 'A'],
      }),
    ).toBeCloseTo(1 / 3);
    expect(
      resolveEmotionRecognitionRawScoreForGate({
        emotionRecognitionRawScore: 1,
        emotionRecognitionResponses: ['B', 'C', 'C'],
      }),
    ).toBe(1);
  });

  it('isLegacyEmotionRecognitionFloorOnlyFail detects removed hard-floor-only fails', () => {
    expect(
      isLegacyEmotionRecognitionFloorOnlyFail({
        passed: false,
        weighted_score: 7.5,
        gate_fail_reasons: ['emotion_recognition_floor'],
      }),
    ).toBe(true);
    expect(
      isLegacyEmotionRecognitionFloorOnlyFail({
        passed: false,
        weighted_score: 7.5,
        gate_fail_reasons: ['emotion_recognition_floor', 'weighted_score'],
      }),
    ).toBe(false);
  });

  it('setEmotionResponseAtIndex stores answers at modal index', () => {
    expect(setEmotionResponseAtIndex([], 1, 'c')).toEqual(['', 'C']);
    expect(setEmotionResponseAtIndex(['B'], 2, 'c')).toEqual(['B', '', 'C']);
    expect(setEmotionResponseAtIndex(['B', 'C'], 2, 'c')).toEqual(['B', 'C', 'C']);
  });

  it('emotionResponsesForStorage preserves gaps when earlier items were skipped', () => {
    expect(emotionResponsesForStorage(['', 'C', 'C'])).toEqual([null, 'C', 'C']);
    expect(emotionResponsesForStorage(['B', 'C'])).toEqual(['B', 'C']);
  });

  it('buildEmotionRecognitionPersistPayload does not persist partial response arrays', () => {
    const payload = buildEmotionRecognitionPersistPayload(['B', 'C']);
    expect(payload.emotion_recognition_responses).toBeNull();
    expect(payload.emotion_recognition_raw_score).toBeNull();
    expect(payload.emotion_recognition_score).toBeNull();
  });

  it('emotionResponsesForStorage uses fixed slots when battery complete', () => {
    expect(emotionResponsesForStorage(['B', 'C', 'C'])).toEqual(['B', 'C', 'C']);
  });

  it('emotionRecognitionDisplayPercentFromAttemptsRow scales 0-100 from per-index correct count', () => {
    expect(
      emotionRecognitionDisplayPercentFromAttemptsRow({
        emotion_recognition_raw_score: 1,
        emotion_recognition_responses: ['B', 'A', 'A'],
      }),
    ).toBe(33);
    expect(
      emotionRecognitionDisplayPercentFromAttemptsRow({
        emotion_recognition_raw_score: 1,
        emotion_recognition_responses: ['B', 'C', 'C'],
      }),
    ).toBe(33);
    expect(
      emotionRecognitionDisplayPercentFromAttemptsRow({
        emotion_recognition_raw_score: 2,
        emotion_recognition_responses: ['B', 'C', 'A'],
      }),
    ).toBe(67);
    expect(
      emotionRecognitionDisplayPercentFromAttemptsRow({
        emotion_recognition_raw_score: 3,
        emotion_recognition_responses: ['B', 'C', 'C'],
      }),
    ).toBe(100);
    expect(
      emotionRecognitionDisplayPercentFromAttemptsRow({
        emotion_recognition_raw_score: 0,
        emotion_recognition_responses: ['A', 'A', 'A'],
      }),
    ).toBe(0);
    expect(
      emotionRecognitionDisplayPercentFromAttemptsRow({
        emotion_recognition_raw_score: 1,
        emotion_recognition_responses: null,
      }),
    ).toBe(33);
  });

  it('buildEmotionRecognitionPersistPayload maps zero correct to 0 percent', () => {
    const payload = buildEmotionRecognitionPersistPayload(['A', 'A', 'A']);
    expect(payload.emotion_recognition_raw_score).toBe(0);
    expect(payload.emotion_recognition_score).toBe(0);
  });

  it('emotion recognition scaling: 0/1/2/3 correct map to 0/33/67/100', () => {
    expect(buildEmotionRecognitionPersistPayload(['B', 'A', 'A'])).toMatchObject({
      emotion_recognition_raw_score: 1,
      emotion_recognition_score: 33,
    });
    expect(buildEmotionRecognitionPersistPayload(['B', 'C', 'C'])).toMatchObject({
      emotion_recognition_raw_score: 3,
      emotion_recognition_score: 100,
    });
    expect(buildEmotionRecognitionPersistPayload(['A', 'A', 'A'])).toMatchObject({
      emotion_recognition_raw_score: 0,
      emotion_recognition_score: 0,
    });
    expect(buildEmotionRecognitionPersistPayload(['B', 'C', 'A'])).toMatchObject({
      emotion_recognition_raw_score: 2,
      emotion_recognition_score: 67,
    });
  });

  it('emotionRecognitionPersistScoresFromResponses keeps raw and score aligned', () => {
    expect(emotionRecognitionPersistScoresFromResponses(['B', 'A', 'A'])).toEqual({
      rawCount: 1,
      displayPercent: 33,
    });
    expect(emotionRecognitionPersistScoresFromResponses(['B', 'C', 'C'])).toEqual({
      rawCount: 3,
      displayPercent: 100,
    });
  });

  it('reconciles stale emotion_recognition_score 100 when raw count is 1', () => {
    expect(
      emotionRecognitionDisplayPercentFromAttemptsRow({
        emotion_recognition_raw_score: 1,
        emotion_recognition_score: 100,
        emotion_recognition_responses: ['B', 'C', 'C'],
      }),
    ).toBe(33);
  });

  it('hydrateEmotionResponsesFromStorage preserves index for full 3-slot arrays', () => {
    expect(hydrateEmotionResponsesFromStorage(['B', 'C', 'C'])).toEqual(['B', 'C', 'C']);
    expect(hydrateEmotionResponsesFromStorage(['B', null, 'C'])).toEqual(['B', '', 'C']);
    expect(hydrateEmotionResponsesFromStorage(['B', 'C'])).toEqual(['B', 'C']);
  });

  it('emotionRecognitionDisplayScoreFromRaw never maps integer count 1 to 100', () => {
    expect(emotionRecognitionDisplayScoreFromRaw(1)).toBe(33);
    expect(emotionRecognitionDisplayScoreFromRaw(2)).toBe(67);
    expect(emotionRecognitionDisplayScoreFromRaw(3)).toBe(100);
  });

  it('emotionRecognitionDisplayScoreFromRaw maps correct count to 0-100 percent', () => {
    expect(emotionRecognitionDisplayScoreFromRaw(1)).toBe(33);
    expect(emotionRecognitionDisplayScoreFromRaw(2)).toBe(67);
    expect(emotionRecognitionDisplayScoreFromRaw(3)).toBe(100);
    expect(emotionRecognitionDisplayScoreFromRaw(1 / 3)).toBe(33);
  });

  it('extractEmotionAfterModalForResumeCatchUp returns grudge segment only for index 2 catch-up', () => {
    const handoff =
      "That's the end of the three described situations. Great work.\n\nThe last two questions are more personal. Have you ever held a grudge against someone?";
    const after = extractEmotionAfterModalForResumeCatchUp(
      [{ role: 'assistant', content: handoff }],
      [2],
    );
    expect(after).toContain('grudge');
    expect(after).not.toContain('three described situations');
    expect(extractEmotionAfterModalForResumeCatchUp([{ role: 'assistant', content: handoff }], [1])).toBeNull();
  });

  it('splitScenarioTransitionForEmotionModal splits on first blank line', () => {
    const s = "Lead paragraph.\n\nRest of vignette.";
    expect(splitScenarioTransitionForEmotionModal(s)).toEqual({
      beforeModal: 'Lead paragraph.',
      afterModal: 'Rest of vignette.',
    });
  });

  it('splitScenarioTransitionForEmotionModal falls back when only single newline before vignette', () => {
    const lead = "Nice work — that's a wrap on that situation.";
    const combined = `${lead}\n${SCENARIO_B_VIGNETTE}`;
    const sp = splitScenarioTransitionForEmotionModal(combined);
    expect(sp.beforeModal).toContain('Nice work');
    expect(sp.afterModal).toContain('Sarah has been');
  });

  it('splitScenarioTransitionForEmotionModal splits inline handoff without blank line', () => {
    const combined =
      "That's the end of this scenario — great work! Nice work, Matt — you saw Emma's frustration. Here's the next situation: Sarah has been job hunting for four months.";
    const sp = splitScenarioTransitionForEmotionModal(combined);
    expect(sp.beforeModal).toContain("That's the end of this scenario");
    expect(sp.beforeModal).not.toContain('Sarah has been');
    expect(sp.afterModal).toMatch(/here'?s the next situation/i);
    expect(sp.afterModal).toContain('Sarah has been');
    expect(shouldDeferEmotionModalForTransitionText(combined)).toBe(false);
  });

  it('emotionModalIndexForCompletedScenario maps scenario to modal index', () => {
    expect(emotionModalIndexForCompletedScenario(1)).toBe(0);
    expect(emotionModalIndexForCompletedScenario(2)).toBe(1);
    expect(emotionModalIndexForCompletedScenario(3)).toBe(2);
  });

  it('reconcileCompletedScenarioForEmotionModal fixes wrong token when entering Situation 2', () => {
    const transition = `${SCENARIO_1_TO_2_TRANSITION_FALLBACK}\n\n${SCENARIO_B_VIGNETTE}`;
    expect(
      reconcileCompletedScenarioForEmotionModal({
        declaredComplete: 2,
        transitionText: transition,
        priorScenario: 1,
      }),
    ).toBe(1);
  });

  it('completedScenarioForEmotionModalFromTransition maps vignette intro to prior segment', () => {
    const s1ToS2 = `${SCENARIO_1_TO_2_TRANSITION_FALLBACK}\n\n${SCENARIO_B_VIGNETTE}`;
    expect(
      completedScenarioForEmotionModalFromTransition({
        declaredComplete: 2,
        transitionText: s1ToS2,
        priorScenario: 2,
      }),
    ).toBe(1);
    expect(emotionModalIndexForCompletedScenario(1)).toBe(0);

    const s2ToS3 =
      "Great work — that's the end of this one, too.\n\nSophie and Daniel have had the same argument. Daniel says \"I need ten minutes.\" Sophie says he didn't know what to say and she's still upset.";
    expect(
      completedScenarioForEmotionModalFromTransition({
        declaredComplete: 2,
        transitionText: s2ToS3,
        priorScenario: 2,
      }),
    ).toBe(2);
    expect(emotionModalIndexForCompletedScenario(2)).toBe(1);
  });

  it('reconcileCompletedScenarioForEmotionModal keeps Situation 2 complete when body introduces Sophie/Daniel', () => {
    const transition =
      "Great work — that's the end of this one, too.\n\nSophie and Daniel have had the same argument. Daniel says \"I need ten minutes.\" Sophie says he didn't know what to say and she's still upset.";
    expect(
      reconcileCompletedScenarioForEmotionModal({
        declaredComplete: 2,
        transitionText: transition,
        priorScenario: 2,
      }),
    ).toBe(2);
  });

  it('isNaturalLanguageScenarioHandoffTransition detects S2→S3 wrap with personal shift lead-in', () => {
    const combined =
      "That's the end of this scenario — Great work, Matt — you saw that James led with logistics. Here's the third situation, and after this we'll shift to something more personal: Sophie and Daniel have had the same argument.";
    expect(isNaturalLanguageScenarioHandoffTransition(combined)).toBe(true);
    const gate = resolveNaturalLanguageEmotionModalGate({
      displayText: combined,
      priorScenario: 2,
      detectedScenario: 3,
    });
    expect(gate.emotionNaturalForward).toBe(true);
    expect(gate.completedScenario).toBe(2);
  });

  it('isNaturalLanguageScenarioHandoffTransition detects inline S1→S2 wrap', () => {
    const combined =
      "That's the end of this scenario — great work! Nice work, Matt — you saw Emma's frustration. Here's the next situation: Sarah has been job hunting for four months.";
    expect(isNaturalLanguageScenarioHandoffTransition(combined)).toBe(true);
    expect(isNaturalLanguageScenarioHandoffTransition('How would you repair this if you were Ryan?')).toBe(false);
  });

  it('detects canonical short S1→S2 wrap alone and opens emotion modal at scenario 1', () => {
    const wrapOnly =
      "Good work — that's the end of this scenario. Here's the next situation.";
    expect(isNaturalLanguageScenarioHandoffTransition(wrapOnly)).toBe(true);
    const split = splitScenarioTransitionForEmotionModal(wrapOnly);
    expect(split.afterModal).toBe('');
    expect(split.beforeModal).toBe(wrapOnly);
    const gate = resolveNaturalLanguageEmotionModalGate({
      displayText: wrapOnly,
      priorScenario: 1,
      detectedScenario: 1,
    });
    expect(gate.emotionNaturalForward).toBe(true);
    expect(gate.completedScenario).toBe(1);
  });

  it('detects S1 wrap-only with Situation 1 phrasing and opens emotion modal at scenario 1', () => {
    const wrapOnly =
      "That's a wrap on Situation 1 — thanks for working through that one. Nice work, Matt — you read Emma's closing line as condescending and dismissive.";
    expect(isNaturalLanguageScenarioHandoffTransition(wrapOnly)).toBe(true);
    const gate = resolveNaturalLanguageEmotionModalGate({
      displayText: wrapOnly,
      priorScenario: 1,
      detectedScenario: 1,
    });
    expect(gate.emotionNaturalForward).toBe(true);
    expect(gate.completedScenario).toBe(1);
  });

  it('detects S1 wrap when model glues duplicate repair ask after reflection', () => {
    const glued =
      "That's a wrap on Situation 1 — thanks for working through that one. Nice work, Matt — you read Emma's closing line as condescending and dismissive. How would you repair this situation if you were Ryan?";
    expect(isNaturalLanguageScenarioHandoffTransition(glued)).toBe(true);
  });

  it('resolveNaturalLanguageEmotionModalGate blocks premature S1 handoff after Q1 only', () => {
    const handoff =
      "That's a wrap on that one. Nice work, Matt — You focused on putting concrete limits on calls during dates so the same interruption does not repeat. We've got two more situations to get through.\n\nSarah has been job hunting for four months.";
    const messages = [
      { role: 'assistant', content: 'What do you think is going on between these two?' },
      {
        role: 'user',
        content:
          'They need clearer boundaries about phone use on dates and agreement on what is okay.',
      },
    ];
    const gate = resolveNaturalLanguageEmotionModalGate({
      displayText: handoff,
      priorScenario: 1,
      detectedScenario: 2,
      messages,
    });
    expect(gate.emotionNaturalForward).toBe(false);
    expect(gate.completedScenario).toBeNull();
  });

  it('resolveNaturalLanguageEmotionModalGate allows S1→S2 when Situation 2 playback already confirmed', () => {
    const handoff =
      "That's a wrap on that one. Nice work, Matt. Here's the next situation.\n\nSarah has been job hunting for four months.";
    const messages = [
      {
        role: 'user',
        content: 'Emma feels secondary to his mother.',
      },
    ];
    const blocked = resolveNaturalLanguageEmotionModalGate({
      displayText: handoff,
      priorScenario: 1,
      detectedScenario: 2,
      messages,
    });
    expect(blocked.emotionNaturalForward).toBe(false);
    const gate = resolveNaturalLanguageEmotionModalGate({
      displayText: handoff,
      priorScenario: 1,
      detectedScenario: 2,
      messages,
      situation2PlaybackConfirmed: true,
    });
    expect(gate.emotionNaturalForward).toBe(true);
    expect(gate.completedScenario).toBe(1);
  });

  it('resolveNaturalLanguageEmotionModalGate opens S3 modal on M4 handoff without detectedScenario', () => {
    const combined =
      "That's the end of the three described situations. Good work, Max — you focused on Daniel's pattern. Now let's shift to something more personal.\n\nHave you ever held a grudge against someone?";
    expect(isScenarioThreeToMoment4EmotionModalHandoff(combined)).toBe(true);
    const gate = resolveNaturalLanguageEmotionModalGate({
      displayText: combined,
      priorScenario: 2,
      detectedScenario: null,
    });
    expect(gate.emotionNaturalForward).toBe(true);
    expect(gate.completedScenario).toBe(3);
    expect(gate.deferBlocked).toBe(false);
  });

  it('resolveNaturalLanguageEmotionModalGate blocks stale S1→S2 handoff when priorScenario is already 3', () => {
    const staleS1Bundle =
      "That's a wrap on that one. Nice work, Matt — You focused on putting concrete limits on calls during dates so the same interruption does not repeat. We've got two more situations to get through.\n\nSarah has been job hunting for four months.";
    const gate = resolveNaturalLanguageEmotionModalGate({
      displayText: staleS1Bundle,
      priorScenario: 3,
      detectedScenario: 2,
    });
    expect(gate.emotionNaturalForward).toBe(false);
    expect(gate.completedScenario).toBeNull();
  });

  it('resolveNaturalLanguageEmotionModalGate runs when prior already equals detected (parallel stream)', () => {
    const combined =
      "That's the end of this scenario — great work! Here's the next situation: Sarah has been job hunting for four months.";
    const gate = resolveNaturalLanguageEmotionModalGate({
      displayText: combined,
      priorScenario: 2,
      detectedScenario: 2,
    });
    expect(gate.emotionNaturalForward).toBe(true);
    expect(gate.completedScenario).toBe(1);
    expect(gate.deferBlocked).toBe(false);
  });

  it('shouldDeferEmotionModalForTransitionText defers when beforeModal still asks an in-scenario question', () => {
    const s2LastQuestionThenS3 =
      'If you were James, how would you repair this situation?\n\nGreat work — that\'s the end of this scenario.\n\nSophie and Daniel have had the same argument. Daniel says "I need ten minutes." Sophie says he didn\'t know what to say and she\'s still upset.';
    expect(shouldDeferEmotionModalForTransitionText(s2LastQuestionThenS3)).toBe(true);

    const pureWrap =
      "Great work — that's the end of this scenario — nice work.\n\nSophie and Daniel have had the same argument. Daniel says \"I need ten minutes.\" Sophie says he didn't know what to say and she's still upset.";
    expect(shouldDeferEmotionModalForTransitionText(pureWrap)).toBe(false);

    const repairOnly = 'If you were James, how would you repair this situation?';
    expect(shouldDeferEmotionModalForTransitionText(repairOnly)).toBe(true);
  });

  it('resolveNaturalLanguageEmotionModalGate does not forward when repair is bundled before handoff', () => {
    const s2RepairThenS3 =
      "And if you were James, how would you repair?\n\nGreat work — that's the end of this one, too. Here's the third situation — after this we'll move to something more personal.\n\nSophie and Daniel have had the same argument for the third time.";
    expect(shouldDeferEmotionModalForTransitionText(s2RepairThenS3)).toBe(true);
    const gate = resolveNaturalLanguageEmotionModalGate({
      displayText: s2RepairThenS3,
      priorScenario: 2,
      detectedScenario: 3,
    });
    expect(gate.emotionNaturalForward).toBe(false);
    expect(gate.completedScenario).toBeNull();
    expect(gate.deferBlocked).toBe(false);
  });

  it('resolveNaturalLanguageEmotionModalGate infers scenario 2 completed when prior ref lags at S2→S3', () => {
    const combined =
      "That's a wrap on this situation. Nice work, Matt — you recognized that James's gesture landed wrong because Sarah had been running on empty. Here's the next situation. Sophie and Daniel have had the same argument for the third time. Sophie feels unheard because Daniel goes silent or leaves. Daniel says \"I need ten minutes.\" Sophie says he didn't know what to say and she's still upset.";
    const gate = resolveNaturalLanguageEmotionModalGate({
      displayText: combined,
      priorScenario: 1,
      detectedScenario: 3,
    });
    expect(gate.emotionNaturalForward).toBe(true);
    expect(gate.completedScenario).toBe(2);
  });

  it('resolveHandoffPriorScenario uses transcript user tags when currentScenarioRef lags', () => {
    const prior = resolveHandoffPriorScenario(
      1,
      1,
      [{ role: 'user', content: 'repair answer', scenarioNumber: 2 }],
      "Here's the next situation. Sophie and Daniel have had the same argument. Daniel says \"I need ten minutes.\" Sophie says he didn't know what to say and she's still upset.",
    );
    expect(prior).toBe(2);
  });

  it('resolveHandoffPriorScenario keeps S1 prior when refs already advanced past S2 vignette', () => {
    const prior = resolveHandoffPriorScenario(
      2,
      2,
      [{ role: 'user', content: 'repair answer', scenarioNumber: 1 }],
      "That's a wrap on that one. Nice work, Matt — reflection.\n\nSarah has been job hunting for four months. She gets an offer and calls James from the street. James is on a deadline. Sarah never feels appreciated. A fight starts.",
    );
    expect(prior).toBe(1);
  });
});
