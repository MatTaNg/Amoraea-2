import {
  aiReasoningContradictsAttemptVerdict,
  buildPostRecalculationGateOutcomePatch,
  buildRecalculationConsistencyPatch,
  detectLlmRescoreEvidenceDegradation,
  detectSliceEvidenceDegradation,
  gateVerdictFlippedStored,
  keyEvidenceLineIsRecoveredPlaceholder,
  resolveFinalGatePassAfterInterviewRecalc,
  SCORE_RECOMPUTE_GATE_FLIP_REVIEW_FLAG,
  shouldInvalidateAiReasoningAfterRecalculation,
} from '../recalculationPersistConsistency';

describe('recalculationPersistConsistency', () => {
  it('detects recovered placeholder evidence lines', () => {
    expect(keyEvidenceLineIsRecoveredPlaceholder('Score recovered from model output.')).toBe(true);
    expect(keyEvidenceLineIsRecoveredPlaceholder('User named Emma and described repair.')).toBe(false);
  });

  it('detects slice evidence degradation', () => {
    const prior = {
      keyEvidence: {
        repair: 'User apologized and named what they did wrong.',
        attunement: 'Named Emma feeling dismissed.',
        mentalizing: 'Explained her perspective on the trip.',
      },
    };
    const next = {
      keyEvidence: {
        repair: 'Score recovered from model output.',
        attunement: 'Score recovered from model output.',
        mentalizing: 'Score recovered from model output.',
      },
    };
    expect(detectSliceEvidenceDegradation('scenario_1', prior, next).degraded).toBe(true);
  });

  it('flags pass/fail contradiction in ai_reasoning', () => {
    expect(
      aiReasoningContradictsAttemptVerdict(
        { passed: true, weighted_score: 7 },
        false,
        6.5,
      ),
    ).toBe(true);
  });

  it('does not flag minor weight drift on pending backup stubs', () => {
    expect(
      aiReasoningContradictsAttemptVerdict(
        { passed: true, weighted_score: 7.6, note: 'queued' },
        true,
        7.4,
      ),
    ).toBe(false);
  });

  it('flags large weight drift on backup stubs', () => {
    expect(
      aiReasoningContradictsAttemptVerdict(
        { passed: true, weighted_score: 7 },
        true,
        6.5,
      ),
    ).toBe(true);
  });

  it('invalidates ai_reasoning when pass flips on recalc', () => {
    expect(
      shouldInvalidateAiReasoningAfterRecalculation({
        aiReasoning: { passed: true, weighted_score: 7 },
        oldPassed: null,
        oldWeightedScore: null,
        newPassed: false,
        newWeightedScore: 6.5,
      }),
    ).toBe(true);
  });

  it('builds consistency patch with aligned stub and reasoning_pending', () => {
    const patch = buildRecalculationConsistencyPatch({
      attempt: {
        ai_reasoning: { passed: true, weighted_score: 7, last_error: 'timeout' },
        passed: false,
        weighted_score: 6.5,
        final_gate_pass: true,
        review_flags: [],
      },
      newPassed: false,
      newWeightedScore: 6.5,
      newPillarScores: { repair: 6 },
      recalculatedAt: '2026-07-13T04:00:00.000Z',
    });
    expect(patch.reasoning_pending).toBe(true);
    expect(patch.ai_reasoning?.passed).toBe(false);
    expect(patch.ai_reasoning?.weighted_score).toBe(6.5);
    expect(patch.ai_reasoning?._supersededAiReasoning).toEqual({
      passed: true,
      weighted_score: 7,
      last_error: 'timeout',
    });
    expect(patch.final_gate_pass).toBe(false);
  });

  it('leaves final_gate_pass unchanged when psychometrics finalized', () => {
    expect(
      resolveFinalGatePassAfterInterviewRecalc({
        passed: false,
        final_gate_pass: true,
        gate_result_finalized_at: '2026-01-01T00:00:00Z',
      }),
    ).toBe('unchanged');
  });

  it('syncs final_gate_pass on admin recalc even when psychometrics finalized', () => {
    expect(
      resolveFinalGatePassAfterInterviewRecalc({
        passed: false,
        final_gate_pass: true,
        gate_result_finalized_at: '2026-01-01T00:00:00Z',
        forceSync: true,
      }),
    ).toBe(false);
  });

  it('detects gate verdict flips from stored booleans', () => {
    expect(gateVerdictFlippedStored(true, true, false, false)).toBe(true);
    expect(gateVerdictFlippedStored(true, true, true, false)).toBe(true);
    expect(gateVerdictFlippedStored(true, true, true, true)).toBe(false);
  });

  it('builds post-recalc patch with gate flip flag and narrative invalidation', () => {
    const patch = buildPostRecalculationGateOutcomePatch({
      attempt: {
        ai_reasoning: { passed: true, weighted_score: 7.2, overall_summary: 'Strong repair.' },
        review_flags: [],
        weighted_score: 7.2,
      },
      oldPassed: true,
      oldFinalGatePass: true,
      newPassed: false,
      newFinalGatePass: false,
      newWeightedScore: 6.4,
      newPillarScores: { repair: 6 },
      recalculatedAt: '2026-07-13T04:00:00.000Z',
    });
    expect(patch?.review_flags).toContain(SCORE_RECOMPUTE_GATE_FLIP_REVIEW_FLAG);
    expect(patch?.reasoning_pending).toBe(true);
    expect(patch?.ai_reasoning?.passed).toBe(false);
  });

  it('buildRecalculationConsistencyPatch honors forceFinalGateSync', () => {
    const patch = buildRecalculationConsistencyPatch({
      attempt: {
        passed: true,
        final_gate_pass: true,
        gate_result_finalized_at: '2026-01-01T00:00:00Z',
        review_flags: [],
      },
      newPassed: false,
      newWeightedScore: 6.5,
      newPillarScores: { repair: 6 },
      recalculatedAt: '2026-07-13T04:00:00.000Z',
      forceFinalGateSync: true,
    });
    expect(patch.final_gate_pass).toBe(false);
  });

  it('blocks LLM rescore commit when scenario evidence degrades', () => {
    const attempt = {
      scenario_1_scores: {
        keyEvidence: {
          repair: 'User apologized and named what they did wrong.',
          attunement: 'Named Emma feeling dismissed.',
        },
      },
      scenario_2_scores: null,
      scenario_3_scores: null,
      scenario_specific_patterns: {
        moment_4_scores: {
          keyEvidence: { accountability: 'Owned the lateness without excuses.' },
        },
      },
    };
    const llmPersist = {
      scenario_1_scores: {
        keyEvidence: {
          repair: 'Score recovered from model output.',
          attunement: 'Score recovered from model output.',
        },
      },
      scenario_specific_patterns: {
        moment_4_scores: { keyEvidence: {} },
      },
    };
    const result = detectLlmRescoreEvidenceDegradation(attempt, llmPersist);
    expect(result.blocked).toBe(true);
    expect(result.reasons.length).toBeGreaterThanOrEqual(1);
  });
});
