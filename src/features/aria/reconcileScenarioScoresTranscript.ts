import {
  isNotAssessedDueToTechnicalInterruption,
  isScenarioCRepairAssistantPrompt,
  NOT_ASSESSED_SESSION_ENDED_TECHNICAL_EVIDENCE,
} from '@features/aria/probeAndScoringUtils';
import {
  isScenarioBJamesDifferentlyOrAppreciationPathQuestion,
  messagesForScenarioNumber,
  scenarioBAssistantSignalsRepairConstructHandled,
} from '@features/aria/scenarioBTranscriptGates';

export type ReconcilableScenarioSlice = {
  scenarioNumber: number;
  pillarScores: Record<string, number | null | undefined>;
  pillarConfidence: Record<string, string>;
  keyEvidence: Record<string, string>;
};

const SCENARIO_2_MARKER_IDS = [
  'appreciation',
  'attunement',
  'mentalizing',
  'repair',
  'accountability',
  'contempt_expression',
] as const;

const SCENARIO_1_MARKER_IDS = [
  'mentalizing',
  'accountability',
  'contempt_recognition',
  'contempt_expression',
  'repair',
  'attunement',
] as const;

const SCENARIO_3_MARKER_IDS = [
  'regulation',
  'repair',
  'mentalizing',
  'attunement',
  'accountability',
  'contempt_expression',
] as const;

/**
 * Infers which markers were never elicited by the interview flow in this slice (e.g. dropout
 * before mandatory prompts). Returns marker ids to set to null with technical-not-assessed evidence.
 */
export function inferUnassessedMarkerKeysFromTranscript(
  scenarioNumber: 1 | 2 | 3,
  allMessages: ReadonlyArray<{
    role: string;
    content?: string;
    scenarioNumber?: number | null;
  }>
): string[] {
  if (scenarioNumber === 1) {
    const s1 = messagesForScenarioNumber(allMessages, 1);
    const userN = s1.filter((m) => m.role === 'user').length;
    if (userN < 1) return [...SCENARIO_1_MARKER_IDS];
    return [];
  }

  if (scenarioNumber === 2) {
    const s2 = messagesForScenarioNumber(allMessages, 2);
    const s2Asst = s2.filter((m) => m.role === 'assistant');
    const s2User = s2.filter((m) => m.role === 'user');
    const hasRepairPath = s2Asst.some((m) => scenarioBAssistantSignalsRepairConstructHandled(m.content));
    const hasJamesDifferently = s2Asst.some((m) => isScenarioBJamesDifferentlyOrAppreciationPathQuestion(m.content));

    if (s2User.length === 0) return [...SCENARIO_2_MARKER_IDS];

    const out = new Set<string>();
    if (s2User.length < 2) {
      if (!hasJamesDifferently) {
        out.add('repair');
        out.add('accountability');
      } else if (!hasRepairPath) {
        out.add('repair');
      }
    } else if (!hasRepairPath && s2User.length < 3) {
      out.add('repair');
    }
    return [...out];
  }

  if (scenarioNumber === 3) {
    const s3 = messagesForScenarioNumber(allMessages, 3);
    const s3Asst = s3.filter((m) => m.role === 'assistant');
    const s3User = s3.filter((m) => m.role === 'user');
    const hasRepairQ = s3Asst.some((m) => isScenarioCRepairAssistantPrompt(m.content ?? ''));
    if (s3User.length === 0) return [...SCENARIO_3_MARKER_IDS];
    const out = new Set<string>();
    if (s3User.length < 2 && !hasRepairQ) {
      out.add('repair');
      out.add('accountability');
    }
    return [...out];
  }
  return [];
}

/**
 * Sets null + canonical evidence + not_assessed confidence for markers the transcript shows were
 * never elicited; also converts 0 to null for those same markers (legacy mis-scored zeros).
 */
export function reconcileScenarioSliceForTechnicalGaps(
  slice: ReconcilableScenarioSlice,
  allMessages: ReadonlyArray<{
    role: string;
    content?: string;
    scenarioNumber?: number | null;
  }>
): ReconcilableScenarioSlice {
  const sn = slice.scenarioNumber as 1 | 2 | 3;
  if (sn !== 1 && sn !== 2 && sn !== 3) return slice;

  const inferred = inferUnassessedMarkerKeysFromTranscript(sn, allMessages);
  if (inferred.length === 0) return slice;

  const pillarScores: Record<string, number | null | undefined> = { ...slice.pillarScores };
  const keyEvidence: Record<string, string> = { ...slice.keyEvidence };
  const pillarConfidence: Record<string, string> = { ...slice.pillarConfidence };

  for (const m of inferred) {
    pillarScores[m] = null;
    keyEvidence[m] = NOT_ASSESSED_SESSION_ENDED_TECHNICAL_EVIDENCE;
    pillarConfidence[m] = 'not_assessed';
  }
  return { ...slice, pillarScores, keyEvidence, pillarConfidence };
}

/**
 * If inference marks a marker as unassessed but a legacy row stored 0 with low confidence,
 * apply the same null + evidence (retroactive fix for the same session shape).
 */
export function applyRetroactiveNullForMisclassifiedZeros(
  slice: ReconcilableScenarioSlice,
  allMessages: ReadonlyArray<{
    role: string;
    content?: string;
    scenarioNumber?: number | null;
  }>
): ReconcilableScenarioSlice {
  const sn = slice.scenarioNumber as 1 | 2 | 3;
  if (sn !== 1 && sn !== 2 && sn !== 3) return slice;
  const inferred = new Set(inferUnassessedMarkerKeysFromTranscript(sn, allMessages));
  const pillarScores: Record<string, number | null | undefined> = { ...slice.pillarScores };
  const keyEvidence: Record<string, string> = { ...slice.keyEvidence };
  const pillarConfidence: Record<string, string> = { ...slice.pillarConfidence };
  let changed = false;
  for (const m of inferred) {
    const v = pillarScores[m];
    const conf = (pillarConfidence[m] ?? '').toLowerCase();
    if (
      v === 0 &&
      (conf === 'low' || conf === 'moderate') &&
      !isNotAssessedDueToTechnicalInterruption(keyEvidence[m])
    ) {
      pillarScores[m] = null;
      keyEvidence[m] = NOT_ASSESSED_SESSION_ENDED_TECHNICAL_EVIDENCE;
      pillarConfidence[m] = 'not_assessed';
      changed = true;
    }
  }
  if (!changed) return slice;
  return { ...slice, pillarScores, keyEvidence, pillarConfidence };
}

export function fullScenarioReconciliation(
  slice: ReconcilableScenarioSlice,
  allMessages: ReadonlyArray<{
    role: string;
    content?: string;
    scenarioNumber?: number | null;
  }>
): ReconcilableScenarioSlice {
  return applyRetroactiveNullForMisclassifiedZeros(reconcileScenarioSliceForTechnicalGaps(slice, allMessages), allMessages);
}
