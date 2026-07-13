import { recentAssistantMessagesForAck } from '@features/aria/interviewAssistantReflection';
import type { PostClaudeAssistantTurnDeps } from '@features/aria/postClaudeAssistantTurnTypes';
import type { PostClaudeAssistantDraftProbeFlags } from '@features/aria/finalizePostClaudeAssistantDraftProbeSequence';
import type { PostClaudeInterviewMessage } from '@features/aria/postClaudeAssistantTurnTypes';
import { remoteLog } from '@utilities/remoteLog';

export function syncPostClaudeAssistantProbeAskedRefs(
  deps: PostClaudeAssistantTurnDeps,
  probeFlags: PostClaudeAssistantDraftProbeFlags,
): void {
  const {
    assistantIssuedMoment4ThresholdProbe,
    assistantIssuedScenarioAContemptProbe,
    assistantIssuedScenarioARepairQuestion,
  } = probeFlags;

  if (assistantIssuedMoment4ThresholdProbe) {
    deps.moment4ThresholdProbeAskedRef.current = true;
  }
  if (assistantIssuedScenarioAContemptProbe) {
    deps.scenarioAContemptProbeAskedRef.current = true;
  }
  if (assistantIssuedScenarioARepairQuestion) {
    deps.scenarioARepairQuestionAskedRef.current = true;
  }
  if (assistantIssuedScenarioARepairQuestion && !deps.scenarioAContemptProbeAskedRef.current) {
    if (__DEV__) {
      console.log('[S1_SEQUENCE_VIOLATION_REPAIR_WITHOUT_CONTEMPT]', {
        assistantIssuedScenarioARepairQuestion,
        scenarioAContemptProbeAsked: deps.scenarioAContemptProbeAskedRef.current,
      });
    }
    void remoteLog('[S1_SEQUENCE_VIOLATION_REPAIR_WITHOUT_CONTEMPT]', {
      assistantIssuedScenarioARepairQuestion,
      scenarioAContemptProbeAsked: deps.scenarioAContemptProbeAskedRef.current,
    });
  }
  if (assistantIssuedScenarioARepairQuestion && deps.scenarioAContemptProbeAskedRef.current) {
    if (__DEV__) {
      console.log('[S1_SEQUENCE_VALIDATED]', {
        assistantIssuedScenarioARepairQuestion,
        scenarioAContemptProbeAsked: deps.scenarioAContemptProbeAskedRef.current,
      });
    }
    void remoteLog('[S1_SEQUENCE_VALIDATED]', {
      assistantIssuedScenarioARepairQuestion,
      scenarioAContemptProbeAsked: deps.scenarioAContemptProbeAskedRef.current,
    });
  }
}

export function recentPostClaudeAssistantMessagesForAck(
  messagesToUse: PostClaudeInterviewMessage[],
) {
  return recentAssistantMessagesForAck(messagesToUse);
}
