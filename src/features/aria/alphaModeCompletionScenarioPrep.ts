import type { MarkerScoreSlice } from '@features/aria/aggregateMarkerScoresFromSlices';
import { calculateScoreConsistency } from '@features/aria/alphaAssessmentUtils';
import {
  enrichScenarioSliceWithContemptHeuristic,
  userTurnTextForInterviewScenario,
} from '@features/aria/contemptExpressionScenarioHeuristic';
import {
  evaluateInterviewCompletionGate,
  type InterviewCompletionGateResult,
} from '@features/aria/interviewCompletionGate';
import { attachSkipPenaltyGateOptions } from '@features/aria/interviewSessionUtilities';
import type { MessageWithScenario } from '@features/aria/interviewScenarioScoringSlice';
import { countMentalizingOvercertaintyInMarkerSlices } from '@features/aria/mentalizingOvercertaintyFromTranscript';
import { normalizeResponseConcreteness } from '@features/aria/personalMomentConcreteness';
import { fullScenarioReconciliation } from '@features/aria/reconcileScenarioScoresTranscript';
import type { ScenarioScoreResult } from '@features/aria/scoreInterviewScoringHelpers';
import type { ScoreInterviewDeps } from '@features/aria/scoreInterviewTypes';
import { remoteLog } from '@utilities/remoteLog';

export type AlphaPersonalMomentAggregate = {
  pillarScores: Record<string, number | null | undefined>;
  keyEvidence: Record<string, string>;
  mentalizing_overcertainty?: boolean;
  response_concreteness?: string | null;
} | null;

export function prepareAlphaScenarioScoresAtCompletion(
  deps: ScoreInterviewDeps,
  finalMessages: MessageWithScenario[],
): { scoreConsistency: ReturnType<typeof calculateScoreConsistency> } {
  const enrichScenarioSliceAtCompletion = (n: 1 | 2 | 3) => {
    const bundle = deps.scenarioScoresRef.current[n];
    if (!bundle) return null;
    return enrichScenarioSliceWithContemptHeuristic(
      { pillarScores: bundle.pillarScores, keyEvidence: bundle.keyEvidence },
      userTurnTextForInterviewScenario(finalMessages, n),
    );
  };
  const mergeEnrichedIntoScenarioRef = (
    n: 1 | 2 | 3,
    enr: ReturnType<typeof enrichScenarioSliceAtCompletion>,
  ) => {
    if (!enr?.pillarScores || !deps.scenarioScoresRef.current[n]) return;
    const prev = deps.scenarioScoresRef.current[n]!;
    deps.scenarioScoresRef.current[n] = {
      ...prev,
      pillarScores: {
        ...prev.pillarScores,
        ...(enr.pillarScores as Record<string, number | null>),
      } as typeof prev.pillarScores,
      keyEvidence: { ...prev.keyEvidence, ...enr.keyEvidence },
    };
  };
  mergeEnrichedIntoScenarioRef(1, enrichScenarioSliceAtCompletion(1));
  mergeEnrichedIntoScenarioRef(2, enrichScenarioSliceAtCompletion(2));
  mergeEnrichedIntoScenarioRef(3, enrichScenarioSliceAtCompletion(3));

  const runScenarioReconciliation = (n: 1 | 2 | 3) => {
    const b = deps.scenarioScoresRef.current[n];
    if (!b) return;
    const reconciled = fullScenarioReconciliation(
      {
        scenarioNumber: n,
        pillarScores: b.pillarScores as Record<string, number | null | undefined>,
        pillarConfidence: b.pillarConfidence,
        keyEvidence: b.keyEvidence,
      },
      finalMessages,
    );
    deps.scenarioScoresRef.current[n] = {
      ...b,
      pillarScores: reconciled.pillarScores as ScenarioScoreResult['pillarScores'],
      pillarConfidence: reconciled.pillarConfidence,
      keyEvidence: reconciled.keyEvidence,
    };
  };
  runScenarioReconciliation(1);
  runScenarioReconciliation(2);
  runScenarioReconciliation(3);

  const s1Ps = deps.scenarioScoresRef.current[1]?.pillarScores;
  const s2Ps = deps.scenarioScoresRef.current[2]?.pillarScores;
  const s3Ps = deps.scenarioScoresRef.current[3]?.pillarScores;
  const s1Ke = deps.scenarioScoresRef.current[1]?.keyEvidence;
  const s2Ke = deps.scenarioScoresRef.current[2]?.keyEvidence;
  const s3Ke = deps.scenarioScoresRef.current[3]?.keyEvidence;
  return {
    scoreConsistency: calculateScoreConsistency(s1Ps, s2Ps, s3Ps, s1Ke, s2Ke, s3Ke),
  };
}

export function buildAlphaMarkerSlicesForAggregate(
  deps: ScoreInterviewDeps,
  moment4ForAggregate: AlphaPersonalMomentAggregate,
  moment5ForAggregate: AlphaPersonalMomentAggregate,
): MarkerScoreSlice[] {
  const sliceFromRef = (n: 1 | 2 | 3): MarkerScoreSlice | null => {
    const b = deps.scenarioScoresRef.current[n];
    if (!b) return null;
    return {
      pillarScores: b.pillarScores,
      keyEvidence: b.keyEvidence,
      mentalizing_overcertainty: b.mentalizing_overcertainty === true,
    };
  };
  return [
    sliceFromRef(1),
    sliceFromRef(2),
    sliceFromRef(3),
    moment4ForAggregate
      ? {
          pillarScores: moment4ForAggregate.pillarScores,
          keyEvidence: moment4ForAggregate.keyEvidence,
          mentalizing_overcertainty: moment4ForAggregate.mentalizing_overcertainty === true,
          response_concreteness: normalizeResponseConcreteness(moment4ForAggregate.response_concreteness),
        }
      : null,
    moment5ForAggregate
      ? {
          pillarScores: moment5ForAggregate.pillarScores,
          keyEvidence: moment5ForAggregate.keyEvidence,
          mentalizing_overcertainty: moment5ForAggregate.mentalizing_overcertainty === true,
          response_concreteness: normalizeResponseConcreteness(moment5ForAggregate.response_concreteness),
        }
      : null,
  ];
}

export function evaluateAlphaCompletionGate(
  deps: ScoreInterviewDeps,
  moment4ForAggregate: AlphaPersonalMomentAggregate,
  moment5ForAggregate?: AlphaPersonalMomentAggregate,
  transcript?: readonly MessageWithScenario[],
): InterviewCompletionGateResult {
  return evaluateInterviewCompletionGate({
    scenario1: deps.scenarioScoresRef.current[1],
    scenario2: deps.scenarioScoresRef.current[2],
    scenario3: deps.scenarioScoresRef.current[3],
    moment4: moment4ForAggregate,
    moment5: moment5ForAggregate,
    transcript,
  });
}

export async function logAlphaCompletionGateFailure(
  completionGateAlpha: InterviewCompletionGateResult,
): Promise<void> {
  await remoteLog('[COMPLETION_GATE_FAIL]', {
    path: 'alpha_pre_aggregate',
    incomplete_reason: completionGateAlpha.incomplete_reason,
    missingScenarioNumbers: completionGateAlpha.missingScenarioNumbers,
    missingMoment4: completionGateAlpha.missingMoment4,
    missingMoment5: completionGateAlpha.missingMoment5,
    detail: completionGateAlpha.detail,
    why: 'Alpha save: withhold aggregation and narrative until all scenarios and personal moments are scored',
  });
}

export function alphaSkipPenaltyGateOptions(deps: ScoreInterviewDeps) {
  return attachSkipPenaltyGateOptions(deps.scenarioSkipConfirmedCountRef.current);
}

export function countAlphaMentalizingOvercertainty(
  markerSlicesForAggregate: MarkerScoreSlice[],
  finalMessages: MessageWithScenario[],
): number {
  return countMentalizingOvercertaintyInMarkerSlices(markerSlicesForAggregate, finalMessages);
}
