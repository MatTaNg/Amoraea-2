import { finalizeStandardDeferredServerDelegate } from '@features/aria/finalizeStandardDeferredServerDelegate';
import { prepareStandardDeferredPersistSnapshot } from '@features/aria/prepareStandardDeferredPersistSnapshot';
import type {
  ScoreStandardDeferredPersistGateParams,
  ScoreStandardDeferredPersistGateResult,
} from '@features/aria/standardDeferredPersistGateTypes';
import { remoteLog } from '@utilities/remoteLog';

export type {
  ScoreStandardDeferredPersistGateParams,
  ScoreStandardDeferredPersistGateResult,
} from '@features/aria/standardDeferredPersistGateTypes';

/** Completion gate, holistic ego prefetch, row persist, edge delegate, and onboarding commit for standard deferred path. */
export async function runStandardDeferredPersistGate(
  params: ScoreStandardDeferredPersistGateParams,
): Promise<ScoreStandardDeferredPersistGateResult> {
  let scoringBaseline = params.scoringBaseline;
  let standardDeferredHolisticForEgoCache: import('@features/aria/interviewResultsTypes').InterviewResults | null =
    null;

  try {
    const snapshot = await prepareStandardDeferredPersistSnapshot(params);
    scoringBaseline = snapshot.scoringBaseline;
    standardDeferredHolisticForEgoCache = snapshot.standardDeferredHolisticForEgoCache;

    await finalizeStandardDeferredServerDelegate({
      supabase: params.supabase,
      deps: params.deps,
      rowPayload: snapshot.rowPayload,
      existingAttemptId: snapshot.existingAttemptId,
      completionGateOk: snapshot.completionGateOk,
      completionGateIncompleteReason: snapshot.completionGateIncompleteReason,
      nextAttemptNumber: params.nextAttemptNumber,
    });

    return {
      serverDelegateOk: true,
      standardDeferredHolisticForEgoCache,
      scoringBaseline,
    };
  } catch (err) {
    await remoteLog('[STANDARD] server delegate failed; using client scoring path', {
      message: err instanceof Error ? err.message : String(err),
    });
    return {
      serverDelegateOk: false,
      standardDeferredHolisticForEgoCache,
      scoringBaseline,
    };
  }
}
