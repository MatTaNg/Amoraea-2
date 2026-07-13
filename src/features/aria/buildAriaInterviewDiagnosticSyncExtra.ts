import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsRefs';
import {
  createAdminScoreCardRenderLogSyncExtra,
  createElongatingProbeFromMessagesSyncExtra,
  createInterviewNetworkStatusCheckSyncExtra,
  createReasoningProgressResetSyncExtra,
  createSyncCurrentMessagesRefSyncExtra,
  createTranscriptScenarioLogSyncExtra,
} from '@features/aria/createInterviewDiagnosticSyncExtras';

export type AriaInterviewDiagnosticLocalScope = Pick<
  AriaInterviewDepsSyncContext,
  | 'elongatingProbeFiredRef'
  | 'isApprovedElongatingProbeOnly'
  | 'transcriptScenarioLogCursorRef'
  | 'currentInterviewMomentRef'
  | 'isMoment5AssistantAnchor'
  | 'looksLikeMoment5AccountabilityProbeAssistantPrompt'
  | 'looksLikeMoment4ThresholdQuestion'
  | 'looksLikeMoment4SpecificityFollowUpPrompt'
  | 'looksLikeMoment4GrudgePrompt'
  | 'lastAdminScoreCardCountRef'
  | 'messageLooksLikeScoreCard'
  | 'setReasoningProgress'
  | 'getResolvedSupabaseUrl'
  | 'getResolvedSupabaseAnonKey'
  | 'setNetworkStatus'
>;

export function buildAriaInterviewDiagnosticLocalSyncExtra(
  scope: AriaInterviewDiagnosticLocalScope,
): AriaInterviewDepsSyncContext {
  return scope;
}

/** Pick diagnostic effect dep-sync fields from a merged interview sync context. */
export function buildAriaInterviewDiagnosticSyncExtra(
  params: AriaInterviewDepsSyncContext,
): AriaInterviewDepsSyncContext {
  return Object.assign(
    {},
    createSyncCurrentMessagesRefSyncExtra(params),
    createElongatingProbeFromMessagesSyncExtra(params),
    createTranscriptScenarioLogSyncExtra(params),
    createAdminScoreCardRenderLogSyncExtra(params),
    createReasoningProgressResetSyncExtra(params),
    createInterviewNetworkStatusCheckSyncExtra(params),
  );
}
