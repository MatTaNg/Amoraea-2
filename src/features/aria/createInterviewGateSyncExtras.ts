import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsRefs';



type SyncExtraParams = AriaInterviewDepsSyncContext;



export function createResetScenarioCClientGatesSyncExtra(params: SyncExtraParams): SyncExtraParams {

  return {

    scenarioCRepairOnlyEvidenceRef: params.scenarioCRepairOnlyEvidenceRef,

    scenarioCSophiePerspectiveProbeFiredRef: params.scenarioCSophiePerspectiveProbeFiredRef,

  };

}



export function createClosingQuestionActionsSyncExtra(params: SyncExtraParams): SyncExtraParams {

  return params;

}



export function createInterviewAssistantMetaExemptionSyncExtra(params: SyncExtraParams): SyncExtraParams {

  return params;

}



export function createResetInterviewProgressSyncExtra(params: SyncExtraParams): SyncExtraParams {

  return params;

}

