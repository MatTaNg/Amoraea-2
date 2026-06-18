/**
 * Shared post-parse pipeline for per-scenario Claude scoring (live interview + batch rescore scripts).
 */
import {
  applyContemptExpressionHeuristicToScenarioScores,
  userTurnTextForInterviewScenario,
} from './contemptExpressionScenarioHeuristic';
import {
  applyElaborationAbsencePenaltiesToScenarioScores,
  computeAvgUserWordsPerTurnScenario,
  countUserTurnsForScenario,
  scenarioDepthModifierThreshold,
} from './elaborationAbsencePenaltiesHeuristic';
import {
  coerceScenarioScoreParsedModelRecord,
  coerceScoreToFiniteNumber,
  fillScenarioKeyEvidenceWhenNumericScoreButMissingQuote,
  mergeSalvagedScenarioKeyEvidenceFromRaw,
  mergeSalvagedScenarioPillarScoresIntoParsed,
  normalizeScoresByEvidence,
} from './probeAndScoringUtils';

export const SCENARIO_SCORE_MARKER_IDS: Record<1 | 2 | 3, readonly string[]> = {
  1: ['mentalizing', 'accountability', 'contempt_recognition', 'contempt_expression', 'repair', 'attunement', 'appreciation'],
  2: ['appreciation', 'attunement', 'mentalizing', 'repair', 'accountability', 'contempt_expression'],
  3: ['regulation', 'repair', 'mentalizing', 'attunement', 'accountability', 'contempt_expression'],
};

function ensureNumericScoreMap(
  candidate: unknown,
  markerIds: readonly string[],
): Record<string, number | null> {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return {};
  const out: Record<string, number | null> = {};
  for (const markerId of markerIds) {
    const n = coerceScoreToFiniteNumber((candidate as Record<string, unknown>)[markerId]);
    if (n !== undefined) out[markerId] = n;
  }
  return out;
}

function extractNumericScoresFromRawModelText(
  rawText: string,
  markerIds: readonly string[],
): Record<string, number | null> {
  const out: Record<string, number | null> = {};
  for (const markerId of markerIds) {
    const escaped = markerId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const keyValuePattern = new RegExp(`["']?${escaped}["']?\\s*[:=]\\s*(-?\\d+(?:\\.\\d+)?)`, 'i');
    const slashTenPattern = new RegExp(`["']?${escaped}["']?[^\\d\\n]{0,20}(\\d+(?:\\.\\d+)?)\\s*\\/\\s*10`, 'i');
    const m = rawText.match(keyValuePattern) ?? rawText.match(slashTenPattern);
    if (!m) continue;
    const n = Number(m[1]);
    if (Number.isFinite(n)) out[markerId] = n;
  }
  return out;
}

function hasNumericPillarScores(pillarScores: unknown): boolean {
  if (pillarScores == null || typeof pillarScores !== 'object' || Array.isArray(pillarScores)) return false;
  return Object.values(pillarScores as Record<string, unknown>).some(
    (v) => typeof v === 'number' && Number.isFinite(v),
  );
}

export type ScenarioScorePostParseInput = {
  scenarioNumber: 1 | 2 | 3;
  rawModelText: string;
  parsed: Record<string, unknown>;
  scoringMessages: Array<{ role: string; content: string; scenarioNumber?: number }>;
};

function finalizeScenarioPillarScores(pillarScores: unknown): Record<string, number | null> {
  if (pillarScores == null || typeof pillarScores !== 'object' || Array.isArray(pillarScores)) return {};
  const out: Record<string, number | null> = {};
  for (const [key, raw] of Object.entries(pillarScores as Record<string, unknown>)) {
    const n = coerceScoreToFiniteNumber(raw);
    if (n !== undefined) out[key] = n;
    else if (raw === null) out[key] = null;
  }
  return out;
}

/** Mutates `parsed` in place — mirrors live {@link AriaScreen} scenario scoring salvage paths. */
export function postProcessScenarioScoreFromModelText(input: ScenarioScorePostParseInput): void {
  const { scenarioNumber, rawModelText, parsed, scoringMessages } = input;
  const markerIds = SCENARIO_SCORE_MARKER_IDS[scenarioNumber];

  const coerced = coerceScenarioScoreParsedModelRecord(parsed);
  parsed.pillarScores = coerced.pillarScores;
  parsed.keyEvidence = coerced.keyEvidence;
  if (Object.keys(coerced.pillarConfidence).length > 0) {
    parsed.pillarConfidence = coerced.pillarConfidence;
  }

  parsed.pillarScores = mergeSalvagedScenarioPillarScoresIntoParsed(
    rawModelText,
    markerIds,
    parsed.pillarScores as Record<string, unknown>,
  );
  parsed.keyEvidence = mergeSalvagedScenarioKeyEvidenceFromRaw(
    rawModelText,
    markerIds,
    (parsed.keyEvidence as Record<string, string>) ?? {},
  );

  const scenarioUserText = userTurnTextForInterviewScenario(scoringMessages, scenarioNumber);
  fillScenarioKeyEvidenceWhenNumericScoreButMissingQuote(markerIds, parsed, scenarioUserText);

  const psRaw = parsed.pillarScores;
  if (psRaw && typeof psRaw === 'object' && !Array.isArray(psRaw)) {
    for (const key of Object.keys(psRaw as Record<string, unknown>)) {
      const n = coerceScoreToFiniteNumber((psRaw as Record<string, unknown>)[key]);
      if (n !== undefined) (psRaw as Record<string, number>)[key] = n;
    }
  }

  const primaryRawNumericScores = ensureNumericScoreMap(parsed.pillarScores, markerIds);

  parsed.pillarScores = normalizeScoresByEvidence(
    parsed.pillarScores as Record<string, unknown>,
    parsed.keyEvidence as Record<string, string>,
  );

  if (!hasNumericPillarScores(parsed.pillarScores) && Object.keys(primaryRawNumericScores).length > 0) {
    parsed.pillarScores = primaryRawNumericScores;
    fillScenarioKeyEvidenceWhenNumericScoreButMissingQuote(markerIds, parsed, scenarioUserText);
  }

  if (!hasNumericPillarScores(parsed.pillarScores)) {
    const fallbackFromRaw = extractNumericScoresFromRawModelText(rawModelText, markerIds);
    if (Object.keys(fallbackFromRaw).length > 0) {
      parsed.pillarScores = fallbackFromRaw;
      fillScenarioKeyEvidenceWhenNumericScoreButMissingQuote(markerIds, parsed, scenarioUserText);
      const normalized = normalizeScoresByEvidence(
        parsed.pillarScores as Record<string, unknown>,
        parsed.keyEvidence as Record<string, string>,
      );
      parsed.pillarScores =
        Object.keys(normalized).length > 0 ? normalized : fallbackFromRaw;
    }
  }

  const heur = applyContemptExpressionHeuristicToScenarioScores(
    scenarioUserText,
    (parsed.pillarScores as Record<string, number | null>) ?? {},
    (parsed.keyEvidence as Record<string, string>) ?? {},
  );
  parsed.pillarScores = heur.pillarScores;
  parsed.keyEvidence = heur.keyEvidence;

  const avgWords = computeAvgUserWordsPerTurnScenario(scoringMessages, scenarioNumber);
  const scenarioUserTurnCount = countUserTurnsForScenario(scoringMessages, scenarioNumber);
  const elabor = applyElaborationAbsencePenaltiesToScenarioScores(
    scenarioNumber,
    scenarioUserText,
    (parsed.pillarScores as Record<string, number | null>) ?? {},
    (parsed.keyEvidence as Record<string, string>) ?? {},
    avgWords,
    {
      depthModifierThreshold: scenarioDepthModifierThreshold(scenarioUserTurnCount),
      wordCountSource: 'live_transcript',
    },
  );
  parsed.pillarScores = elabor.pillarScores;
  parsed.keyEvidence = elabor.keyEvidence;
  parsed.pillarScores = finalizeScenarioPillarScores(parsed.pillarScores);
  parsed.mentalizing_overcertainty = parsed.mentalizing_overcertainty === true;
  parsed.scenarioNumber = scenarioNumber;
}
