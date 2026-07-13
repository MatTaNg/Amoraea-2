import { parseContemptTierBreakdown } from '@features/aria/contemptExpressionScoringRubric';
import { applyContemptExpressionHeuristicToScenarioScores } from '@features/aria/contemptExpressionScenarioHeuristic';
import {
  applyElaborationAbsencePenaltiesToScenarioScores,
  computeAvgUserWordsPerTurnPersonalSlice,
  computeAvgUserWordsPerTurnScenario,
  countUserTurnsForScenario,
  extractScenarioHolisticEvidenceLevelsFromScoringMetadata,
  scenarioDepthModifierThreshold,
} from '@features/aria/elaborationAbsencePenaltiesHeuristic';
import { SCENARIO_FRUSTRATION_SKIP_NULL_MARKER_IDS } from '@features/aria/interviewSkipPenalties';
import { MOMENT4_SCORE_RECOVERED_EVIDENCE_LINE } from '@features/aria/moment4ScoringParse';
import { SKIPPED_BY_USER_FRUSTRATION_EVIDENCE, isNoEvidenceText, isPillarConfidenceOnlyEvidence, normalizeScoresByEvidence } from '@features/aria/probeEvidenceUtils';
import {
  coerceScenarioScoreParsedModelRecord,
  finalizeScenarioKeyEvidenceAfterHeuristics,
  logScenarioScoreParseRecovery,
  prepareScenarioKeyEvidenceFromModelOutput,
  scenarioScoreRecoveryStats,
} from '@features/aria/scenarioScoringParse';
import type { ScenarioScoreResult } from '@features/aria/scoreInterviewScoringHelpers';
import {
  finalizeScenarioMentalizingOvercertaintyFromModel,
  normalizeMentalizingInferenceSource,
} from '@features/aria/scoreInterviewScoringHelpers';
import { remoteLog } from '@utilities/remoteLog';

import { defaultScenarioDisplayName } from '@features/aria/scenarioDisplayNames';

function defaultScenarioPillarConfidence(
  score: number | null | undefined,
  evidence: string | undefined,
  existing: string | undefined,
): string {
  const trimmedExisting = existing?.trim();
  if (trimmedExisting) return trimmedExisting;
  if (typeof score !== 'number' || !Number.isFinite(score)) return 'not_assessed';
  const ev = evidence?.trim() ?? '';
  if (isNoEvidenceText(ev)) return 'low';
  if (!ev || isPillarConfidenceOnlyEvidence(ev)) return 'high';
  return 'high';
}
import {
  ensureNumericScoreMap,
  ensureNumericScoreMapDeep,
  extractNumericScoresFromRawModelText,
} from '@features/aria/scenarioScoreSalvageUtils';

export function postProcessScenarioModelScore(params: {
  parsedScenario: ScenarioScoreResult;
  raw: string;
  scenarioNumber: 1 | 2 | 3;
  scoringMessages: { role: string; content: string }[];
  scenarioUserTextPreNormalize: string;
  frustrationSkipNullMarkers: { 1?: boolean; 2?: boolean; 3?: boolean };
  parseError?: string;
  attemptId?: string | null;
}): ScenarioScoreResult {
  const {
    raw,
    scenarioNumber,
    scoringMessages,
    scenarioUserTextPreNormalize,
    frustrationSkipNullMarkers,
    parseError,
    attemptId,
  } = params;
  const parsedScenario = params.parsedScenario;

  const coercedShape = coerceScenarioScoreParsedModelRecord(parsedScenario);
  parsedScenario.pillarScores = coercedShape.pillarScores as ScenarioScoreResult['pillarScores'];
  parsedScenario.keyEvidence = coercedShape.keyEvidence as ScenarioScoreResult['keyEvidence'];
  if (Object.keys(coercedShape.pillarConfidence).length > 0) {
    parsedScenario.pillarConfidence = coercedShape.pillarConfidence as ScenarioScoreResult['pillarConfidence'];
  }

  try {
    console.log('[Overcertainty] raw model response excerpt:', JSON.stringify(parsedScenario).slice(0, 800));
  } catch {
    console.log('[Overcertainty] raw model response excerpt: <stringify failed>');
  }
  console.log(
    '[Overcertainty] mentalizing_overcertainty field:',
    (parsedScenario as { mentalizing_overcertainty?: unknown }).mentalizing_overcertainty,
  );
  console.log(
    '[Overcertainty] keyEvidence.mentalizing_overcertainty:',
    (parsedScenario.keyEvidence as Record<string, unknown> | undefined)?.mentalizing_overcertainty,
  );
  console.log(
    '[Overcertainty] scoringMetadata.mentalizing_overcertainty:',
    (parsedScenario as { scoringMetadata?: Record<string, unknown> }).scoringMetadata?.mentalizing_overcertainty,
  );

  parsedScenario.scenarioNumber = scenarioNumber;
  if (typeof parsedScenario.scenarioName !== 'string' || !parsedScenario.scenarioName.trim()) {
    parsedScenario.scenarioName = defaultScenarioDisplayName(scenarioNumber);
  }

  const scenarioMarkerIds = SCENARIO_FRUSTRATION_SKIP_NULL_MARKER_IDS[scenarioNumber];
  const psRaw = parsedScenario.pillarScores;
  if (psRaw && typeof psRaw === 'object' && !Array.isArray(psRaw)) {
    for (const key of Object.keys(psRaw as Record<string, unknown>)) {
      const v = (psRaw as Record<string, unknown>)[key];
      if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) {
        (psRaw as Record<string, number | null>)[key] = Number(v);
      }
    }
  }
  const primaryRawNumericScores = ensureNumericScoreMap(scenarioMarkerIds, parsedScenario.pillarScores);
  prepareScenarioKeyEvidenceFromModelOutput(
    scenarioMarkerIds,
    parsedScenario,
    scenarioUserTextPreNormalize,
    raw,
  );
  const pillarScoresBeforeNormalize = { ...(parsedScenario.pillarScores ?? {}) };
  parsedScenario.pillarScores = normalizeScoresByEvidence(
    parsedScenario.pillarScores,
    parsedScenario.keyEvidence,
  );
  if (
    Object.keys(primaryRawNumericScores).length > 0 &&
    Object.keys(parsedScenario.pillarScores ?? {}).length === 0
  ) {
    logScenarioScoreParseRecovery({
      scenarioNumber,
      attemptId,
      reason: 'normalizeScoresByEvidence_dropped_all_pillar_scores',
      parseError: parseError ?? null,
      rawModelText: raw,
    });
  }

  const scenarioUserText = scenarioUserTextPreNormalize;
  const holisticEvidenceLevels = extractScenarioHolisticEvidenceLevelsFromScoringMetadata(
    parsedScenario.scoringMetadata ?? null,
  );
  const heur = applyContemptExpressionHeuristicToScenarioScores(
    scenarioUserText,
    parsedScenario.pillarScores ?? {},
    parsedScenario.keyEvidence,
  );
  parsedScenario.pillarScores = heur.pillarScores as ScenarioScoreResult['pillarScores'];
  parsedScenario.keyEvidence = heur.keyEvidence as ScenarioScoreResult['keyEvidence'];

  const avgWords = computeAvgUserWordsPerTurnScenario(scoringMessages, scenarioNumber);
  const scenarioUserTurnCount = countUserTurnsForScenario(scoringMessages, scenarioNumber);
  const depthModifierThreshold = scenarioDepthModifierThreshold(scenarioUserTurnCount);
  const communicationAvgResponseLength = computeAvgUserWordsPerTurnPersonalSlice(scoringMessages);
  const elabor = applyElaborationAbsencePenaltiesToScenarioScores(
    scenarioNumber,
    scenarioUserText,
    parsedScenario.pillarScores ?? {},
    parsedScenario.keyEvidence,
    avgWords,
    {
      depthModifierThreshold,
      wordCountSource: 'live_transcript',
      communicationAvgResponseLength,
      scoringMetadata: parsedScenario.scoringMetadata ?? null,
    },
  );
  void remoteLog('[SCENARIO_EVIDENCE_LEVEL_BASIS]', {
    scoring_slice: `scenario_${scenarioNumber}`,
    evidence_level_source: 'full_scenario_user_text',
    scenario_user_text_excerpt:
      scenarioUserText.length > 400 ? `${scenarioUserText.slice(0, 400)}…` : scenarioUserText,
    model_holistic_evidence_levels: holisticEvidenceLevels,
    model_key_evidence_levels: {
      mentalizing: parsedScenario.keyEvidence?.mentalizing ?? null,
      attunement: parsedScenario.keyEvidence?.attunement ?? null,
    },
  });
  void remoteLog('[SCORING_DEPTH_MODIFIER]', {
    scoring_slice: `scenario_${scenarioNumber}`,
    user_turn_count: scenarioUserTurnCount,
    ...elabor.depthModifierMeta,
  });
  parsedScenario.pillarScores = elabor.pillarScores as ScenarioScoreResult['pillarScores'];
  parsedScenario.keyEvidence = elabor.keyEvidence as ScenarioScoreResult['keyEvidence'];

  if (frustrationSkipNullMarkers[scenarioNumber]) {
    const ids = SCENARIO_FRUSTRATION_SKIP_NULL_MARKER_IDS[scenarioNumber];
    const ps = { ...(parsedScenario.pillarScores ?? {}) };
    const ke = { ...(parsedScenario.keyEvidence ?? {}) };
    const pc = { ...(parsedScenario.pillarConfidence ?? {}) };
    for (const id of ids) {
      ps[id] = null;
      ke[id] = SKIPPED_BY_USER_FRUSTRATION_EVIDENCE;
      pc[id] = 'not_assessed';
    }
    parsedScenario.pillarScores = ps;
    parsedScenario.keyEvidence = ke;
    parsedScenario.pillarConfidence = pc;
    frustrationSkipNullMarkers[scenarioNumber] = false;
  }

  if (Object.keys(parsedScenario.pillarScores ?? {}).length === 0 && Object.keys(primaryRawNumericScores).length > 0) {
    parsedScenario.pillarScores = primaryRawNumericScores;
    void remoteLog('[SCENARIO_SCORE_FALLBACK] restored raw numeric scores after evidence normalization', {
      scenarioNumber,
      recoveredKeys: Object.keys(primaryRawNumericScores),
    });
  }

  if (Object.keys(parsedScenario.pillarScores ?? {}).length === 0) {
    logScenarioScoreParseRecovery({
      scenarioNumber,
      attemptId,
      reason: 'no_assessable_pillarScores_in_model_json',
      parseError: parseError ?? null,
      rawModelText: raw,
    });
    const parsedScenarioAny = parsedScenario as unknown as Record<string, unknown>;
    const alternateCandidates: unknown[] = [
      parsedScenarioAny,
      parsedScenarioAny.pillarScores,
      parsedScenarioAny.scores,
      parsedScenarioAny.scorecard,
      (parsedScenarioAny.scorecard as Record<string, unknown> | undefined)?.pillarScores,
    ];
    let fallbackFromAlternateShape: Record<string, number | null> = {};
    for (const candidate of alternateCandidates) {
      const extracted = ensureNumericScoreMapDeep(scenarioMarkerIds, candidate);
      if (Object.keys(extracted).length > 0) {
        fallbackFromAlternateShape = extracted;
        break;
      }
    }
    if (Object.keys(fallbackFromAlternateShape).length > 0) {
      const normalizedFromAlternate = normalizeScoresByEvidence(
        fallbackFromAlternateShape,
        parsedScenario.keyEvidence,
      );
      parsedScenario.pillarScores =
        Object.keys(normalizedFromAlternate).length > 0 ? normalizedFromAlternate : fallbackFromAlternateShape;
      void remoteLog('[SCENARIO_SCORE_FALLBACK] adopted alternate model score shape', {
        scenarioNumber,
        recoveredKeys: Object.keys(parsedScenario.pillarScores ?? {}),
        usedRawNumericFallback: Object.keys(normalizedFromAlternate).length === 0,
      });
    }
  }

  if (Object.keys(parsedScenario.pillarScores ?? {}).length === 0) {
    const fallbackFromRawModelText = extractNumericScoresFromRawModelText(scenarioMarkerIds, raw);
    if (Object.keys(fallbackFromRawModelText).length > 0) {
      parsedScenario.pillarScores = fallbackFromRawModelText;
      void remoteLog('[SCENARIO_SCORE_FALLBACK] extracted numeric marker scores from raw model text', {
        scenarioNumber,
        recoveredKeys: Object.keys(fallbackFromRawModelText),
      });
    }
  }

  if (Object.keys(parsedScenario.pillarScores ?? {}).length === 0) {
    const neutralFallbackScores: Record<string, number | null> = {};
    const neutralFallbackEvidence: Record<string, string> = { ...(parsedScenario.keyEvidence ?? {}) };
    const neutralFallbackConfidence: Record<string, string> = { ...(parsedScenario.pillarConfidence ?? {}) };
    for (const markerId of scenarioMarkerIds) {
      neutralFallbackScores[markerId] = 5;
      if (!neutralFallbackEvidence[markerId]) {
        neutralFallbackEvidence[markerId] = 'Score fallback applied after malformed model score payload.';
      }
      if (!neutralFallbackConfidence[markerId]) {
        neutralFallbackConfidence[markerId] = 'low';
      }
    }
    parsedScenario.pillarScores = neutralFallbackScores;
    parsedScenario.keyEvidence = neutralFallbackEvidence;
    parsedScenario.pillarConfidence = neutralFallbackConfidence;
    void remoteLog('[SCENARIO_SCORE_FALLBACK] using neutral fallback marker scores', {
      scenarioNumber,
      markerCount: scenarioMarkerIds.length,
    });
  }

  finalizeScenarioKeyEvidenceAfterHeuristics(
    scenarioMarkerIds,
    parsedScenario,
    scenarioUserText,
  );

  const existingEvidence = { ...(parsedScenario.keyEvidence ?? {}) };
  const existingConfidence = { ...(parsedScenario.pillarConfidence ?? {}) };
  const scoredKeys = Object.keys(parsedScenario.pillarScores ?? {});
  for (const markerId of scoredKeys) {
    const ev = existingEvidence[markerId]?.trim();
    if (!ev) {
      logScenarioScoreParseRecovery({
        scenarioNumber,
        attemptId,
        reason: `missing_keyEvidence_for_${markerId}`,
        parseError: parseError ?? null,
        rawModelText: raw,
      });
      existingEvidence[markerId] = MOMENT4_SCORE_RECOVERED_EVIDENCE_LINE;
    }
    existingConfidence[markerId] = defaultScenarioPillarConfidence(
      parsedScenario.pillarScores?.[markerId],
      existingEvidence[markerId],
      existingConfidence[markerId],
    );
  }
  parsedScenario.keyEvidence = existingEvidence;
  parsedScenario.pillarConfidence = existingConfidence;
  parsedScenario.mentalizing_inference_source = normalizeMentalizingInferenceSource(
    (parsedScenario as { mentalizing_inference_source?: unknown }).mentalizing_inference_source,
  );
  finalizeScenarioMentalizingOvercertaintyFromModel(parsedScenario);
  console.log(
    '[Overcertainty] resolved value:',
    parsedScenario.mentalizing_overcertainty,
    'for scenario:',
    scenarioNumber,
  );

  if (parsedScenario.pillarScores?.contempt_expression == null) {
    parsedScenario.contempt_tier_breakdown = null;
  } else {
    parsedScenario.contempt_tier_breakdown = parseContemptTierBreakdown(
      (parsedScenario as { contempt_tier_breakdown?: unknown }).contempt_tier_breakdown,
    );
  }

  if (scenarioNumber === 3) {
    const stripCommitmentThreshold = (o: Record<string, unknown> | undefined | null) => {
      if (!o) return;
      delete o.commitment_threshold;
    };
    stripCommitmentThreshold(parsedScenario.pillarScores as Record<string, unknown>);
    stripCommitmentThreshold(parsedScenario.keyEvidence as Record<string, unknown>);
    stripCommitmentThreshold(parsedScenario.pillarConfidence as Record<string, unknown>);
  }

  if (parsedScenario.mentalizing_overcertainty === true) {
    const m = parsedScenario.pillarScores?.mentalizing;
    if (typeof m === 'number' && Number.isFinite(m) && m > 7) {
      console.log('[Overcertainty] capping mentalizing from', m, 'to 7');
      parsedScenario.pillarScores = {
        ...(parsedScenario.pillarScores ?? {}),
        mentalizing: 7,
      };
    }
  }

  if (scenarioNumber === 1) {
    const appreciationScore = parsedScenario.pillarScores?.appreciation;
    const appreciationEvidence = parsedScenario.keyEvidence?.appreciation;
    console.log(
      '[S1_APPRECIATION_DEBUG] score:',
      appreciationScore,
      '| evidence:',
      typeof appreciationEvidence === 'string' ? appreciationEvidence.slice(0, 150) : appreciationEvidence,
    );
  }

  const recoveryStats = scenarioScoreRecoveryStats(parsedScenario, scenarioMarkerIds);
  if (recoveryStats.usedRecoveryPath || parseError) {
    logScenarioScoreParseRecovery({
      scenarioNumber,
      attemptId,
      reason: parseError ? 'post_process_after_parse_failure' : 'post_process_majority_recovered_evidence',
      parseError: parseError ?? null,
      rawModelText: raw,
    });
  }

  return parsedScenario;
}
