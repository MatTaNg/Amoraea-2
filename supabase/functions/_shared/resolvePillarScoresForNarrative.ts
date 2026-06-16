import { aggregatePillarScoresWithCommitmentMergeDetailed } from './aggregateMarkerScoresFromSlices.ts';
import { markerSlicesFromAttemptRow } from './attemptScoreSliceParsing.ts';
import { scenarioEmotionalVocabDensityPercentFromTranscript } from './personalMomentEmotionalVocab.ts';

type AttemptRowForRollup = {
  transcript?: unknown;
  scenario_1_scores?: unknown;
  scenario_2_scores?: unknown;
  scenario_3_scores?: unknown;
  scenario_specific_patterns?: unknown;
  ego_development_level?: unknown;
};

function finiteNumber(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/** Rollup pillar scores from stored slices when `pillar_scores` was never persisted. */
export function rollupPillarScoresFromStoredAttemptRow(
  row: AttemptRowForRollup,
): Record<string, number> | null {
  const slices = markerSlicesFromAttemptRow(row);
  const hasScenarioData = slices
    .slice(0, 3)
    .some((s) => s?.pillarScores && Object.keys(s.pillarScores).length > 0);
  if (!hasScenarioData) return null;

  const transcript = Array.isArray(row.transcript)
    ? (row.transcript as Array<{ role?: string; content?: string; interviewMoment?: number }>)
    : [];

  const agg = aggregatePillarScoresWithCommitmentMergeDetailed(slices, {
    egoDevelopmentLevel: finiteNumber(row.ego_development_level),
    defensePatternTranscript: transcript,
    disclosureCalibrationTranscript: transcript,
    scenarioEmotionalVocabDensityPercent: scenarioEmotionalVocabDensityPercentFromTranscript(transcript),
    communicationStyleEmotionalVocabDensityPercent: null,
  });

  const scores = agg.scores;
  if (!scores || Object.keys(scores).length === 0) return null;
  return scores;
}
