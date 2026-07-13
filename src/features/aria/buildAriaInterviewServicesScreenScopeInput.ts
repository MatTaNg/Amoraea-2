import type { AriaInterviewServicesScreenScopeInput } from '@features/aria/buildAriaInterviewServicesSyncCtxFromScreen';
import type {
  AriaInterviewServicesBootstrapLocalScope,
  AriaInterviewServicesIdentityLocalScope,
  AriaInterviewServicesLiveStateLocalScope,
  AriaInterviewServicesSessionRefsLocalScope,
  AriaInterviewServicesStoragePipelineLocalScope,
  AriaInterviewServicesTranscriptHelpersLocalScope,
  AriaInterviewServicesUiSettersLocalScope,
} from '@features/aria/buildAriaInterviewServicesLocalSyncScope';
import {
  USER_INTERVIEW_PASS_SELECT,
  USER_INTERVIEW_ROUTING_TABLE,
} from '@data/supabase/userInterviewRoutingSelect';

export type AriaInterviewServicesScreenRefsParams = {
  identity: AriaInterviewServicesIdentityLocalScope;
  sessionRefs: AriaInterviewServicesSessionRefsLocalScope;
  liveState: AriaInterviewServicesLiveStateLocalScope;
  storagePipeline: AriaInterviewServicesStoragePipelineLocalScope;
  bootstrap: AriaInterviewServicesBootstrapLocalScope;
  uiSetters: AriaInterviewServicesUiSettersLocalScope;
  transcriptHelpers: AriaInterviewServicesTranscriptHelpersLocalScope;
};

/** Group live services screen fields (injects routing table constants). */
export function buildAriaInterviewServicesScreenScopeInput(
  params: AriaInterviewServicesScreenRefsParams,
): AriaInterviewServicesScreenScopeInput {
  return {
    ...params,
    routing: {
      userInterviewRoutingTable: USER_INTERVIEW_ROUTING_TABLE,
      userInterviewPassSelect: USER_INTERVIEW_PASS_SELECT,
    },
  };
}
