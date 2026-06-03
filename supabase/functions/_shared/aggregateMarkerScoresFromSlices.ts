/**
 * Depth-signal aggregation from stored marker slices (Edge completion path).
 * Keep aligned with `aggregatePillarScoresWithCommitmentMergeDetailed` in
 * `src/features/aria/aggregateMarkerScoresFromSlices.ts`.
 */
import {
  detectDefensePatterns,
  DEFAULT_DEFENSE_PATTERNS,
  type DefensePatternsJson,
} from './defensePatternsDetection.ts';
import {
  normalizeResponseConcreteness,
  type ResponseConcretenessLevel,
} from './personalMomentConcreteness.ts';
import {
  aggregatePersonalMomentEmotionalVocab,
  depthEnrichedMarkerSlices,
  scenarioEmotionalVocabDensityPercentFromTranscript,
} from './personalMomentEmotionalVocab.ts';
import {
  disclosureCalibrationFromMarkerSlices,
  type DisclosureCalibration,
  type DisclosureCalibrationTurn,
} from './disclosureCalibration.ts';
import { countMentalizingOvercertaintyInMarkerSlices } from './mentalizingOvercertaintyFromTranscript.ts';

export type MarkerScoreSliceForAggregate = {
  pillarScores?: Record<string, number | null>;
  keyEvidence?: Record<string, string>;
  mentalizing_overcertainty?: boolean;
  response_concreteness?: string | null;
  specificity?: string | null;
  user_slice_word_count?: number;
  emotional_vocab_count?: number;
  emotional_vocab_words?: string[];
};

/** Depth + gate inputs produced from marker slices (subset of full pillar aggregate). */
export type PillarAggregateWithCommitmentDetailed = {
  egoDevelopmentLevel: number | null;
  mentalizingOvercertaintyCount: number;
  defensePatterns: DefensePatternsJson;
  moment4Concreteness: ResponseConcretenessLevel | null;
  moment5Concreteness: ResponseConcretenessLevel | null;
  personal_moment_emotional_vocab_density: number | null;
  personal_moment_emotional_vocab_low: boolean;
  disclosureCalibration: DisclosureCalibration;
};

export type PillarAggregateHolisticMeta = {
  egoDevelopmentLevel?: number | null;
  defensePatternTranscript?: readonly { role?: string; content?: string; scenarioNumber?: number | null; interviewMoment?: number }[] | null;
  disclosureCalibrationTranscript?: readonly DisclosureCalibrationTurn[] | null;
  scenarioEmotionalVocabDensityPercent?: number | null;
  communicationStyleEmotionalVocabDensityPercent?: number | null;
};

function coerceHolisticEgoLevel(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  const n =
    typeof raw === 'number'
      ? raw
      : typeof raw === 'string' && String(raw).trim() !== ''
        ? Number(String(raw).trim())
        : NaN;
  if (!Number.isFinite(n)) return null;
  const r = Math.round(n);
  if (r < 1 || r > 5) return null;
  return r;
}

/**
 * Aggregate depth signals from stored scenario + personal-moment slices (client parity).
 */
export function aggregatePillarScoresWithCommitmentMergeDetailed(
  slices: Array<MarkerScoreSliceForAggregate | null | undefined>,
  holisticMeta?: PillarAggregateHolisticMeta | null,
): PillarAggregateWithCommitmentDetailed {
  const discTx =
    (holisticMeta?.disclosureCalibrationTranscript ?? holisticMeta?.defensePatternTranscript) ?? [];
  const transcript = Array.isArray(discTx) ? discTx : [];
  const depthSlices = depthEnrichedMarkerSlices(slices, transcript);

  const moment4Concreteness = normalizeResponseConcreteness(depthSlices[3]?.response_concreteness);
  const moment5Concreteness = normalizeResponseConcreteness(depthSlices[4]?.response_concreteness);

  const mentalizingOvercertaintyCount = countMentalizingOvercertaintyInMarkerSlices(slices, transcript);

  const defensePatterns =
    slices[0]?.pillarScores && slices[1]?.pillarScores && slices[2]?.pillarScores
      ? detectDefensePatterns(
          [slices[0], slices[1], slices[2]],
          depthSlices[3] ?? null,
          depthSlices[4] ?? null,
          holisticMeta?.defensePatternTranscript ?? null,
        )
      : { ...DEFAULT_DEFENSE_PATTERNS };

  const scenarioEv =
    holisticMeta?.scenarioEmotionalVocabDensityPercent ??
    scenarioEmotionalVocabDensityPercentFromTranscript(transcript);
  const evAgg = aggregatePersonalMomentEmotionalVocab(depthSlices[3], depthSlices[4], {
    scenarioEmotionalVocabDensityPercent: scenarioEv,
    communicationStyleEmotionalVocabDensityPercent:
      holisticMeta?.communicationStyleEmotionalVocabDensityPercent ?? null,
  });

  const disclosureCalibration = disclosureCalibrationFromMarkerSlices(depthSlices, transcript);

  const egoIn =
    holisticMeta?.egoDevelopmentLevel !== undefined && holisticMeta?.egoDevelopmentLevel !== null
      ? coerceHolisticEgoLevel(holisticMeta.egoDevelopmentLevel)
      : null;

  console.log('[Disclosure] aggregation result:', disclosureCalibration);
  console.log('[EdgeAggregate] depth signals:', {
    egoDevelopmentLevel: egoIn,
    moment4Concreteness,
    moment5Concreteness,
    personal_moment_emotional_vocab_density: evAgg.personal_moment_emotional_vocab_density,
    personal_moment_emotional_vocab_low: evAgg.personal_moment_emotional_vocab_low,
    mentalizingOvercertaintyCount,
  });

  return {
    egoDevelopmentLevel: egoIn,
    mentalizingOvercertaintyCount,
    defensePatterns,
    moment4Concreteness,
    moment5Concreteness,
    personal_moment_emotional_vocab_density: evAgg.personal_moment_emotional_vocab_density,
    personal_moment_emotional_vocab_low: evAgg.personal_moment_emotional_vocab_low,
    disclosureCalibration,
  };
}
